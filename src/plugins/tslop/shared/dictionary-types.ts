import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { unwrapExpression } from './rule.js';
import {
  createTypeAliasEnvironment,
  hasVisibleTypeBinding,
  visibleTypeAlias,
} from './type-alias-resolution.js';
import type { TypeAliasEnvironment as LexicalTypeAliasEnvironment } from './type-alias-resolution.js';
import type { TSESTree } from '@typescript-eslint/types';

const BUILT_INS = new Set([
  'Record',
  'Readonly',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'PropertyKey',
  'NonNullable',
]);
const BROAD_KEY_KEYWORDS: ReadonlySet<AST_NODE_TYPES> = new Set([
  AST_NODE_TYPES.TSStringKeyword,
  AST_NODE_TYPES.TSNumberKeyword,
  AST_NODE_TYPES.TSSymbolKeyword,
]);
const KNOWN_EVIDENCE_TYPES: ReadonlySet<AST_NODE_TYPES> = new Set([
  AST_NODE_TYPES.ObjectExpression,
  AST_NODE_TYPES.ArrayExpression,
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.ClassExpression,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.NewExpression,
  AST_NODE_TYPES.Literal,
  AST_NODE_TYPES.TemplateLiteral,
  AST_NODE_TYPES.UnaryExpression,
]);
const TRANSPARENT_WRAPPERS = new Set([
  'Readonly',
  'Partial',
  'Required',
  'NonNullable',
]);

type TypeAliasEnvironment = ReadonlyMap<string, TSESTree.TypeNode>;

type ResolvedType = {
  readonly type: TSESTree.TypeNode;
  readonly substitutions: TypeAliasEnvironment;
};

type DirectUnsafeValue = 'any' | 'object' | 'unknown';

type CompositeUnsafeValue = 'empty-object' | 'union';

type UnsafeDictionary = {
  readonly kind: 'unsafe-dictionary';
  readonly unsafeValue: CompositeUnsafeValue | DirectUnsafeValue;
};

export type WideningTargetKind =
  | 'anonymous object'
  | 'generic container'
  | 'object'
  | 'open dictionary'
  | 'unknown';

export type WideningTarget = {
  readonly kind: WideningTargetKind;
};

export type TypeEnvironment = {
  readonly interfaces: ReadonlyMap<
    string,
    readonly TSESTree.TSInterfaceDeclaration[]
  >;
  readonly typeAliases: LexicalTypeAliasEnvironment;
};

function declaredStatement(
  statement: TSESTree.Statement,
): TSESTree.Node | null {
  return statement.type === AST_NODE_TYPES.ExportNamedDeclaration ||
    statement.type === AST_NODE_TYPES.ExportDefaultDeclaration
    ? (statement.declaration ?? null)
    : statement;
}

const environmentsByProgram = new WeakMap<TSESTree.Program, TypeEnvironment>();

export function createTypeEnvironment(
  program: TSESTree.Program,
  visitorKeys: Readonly<Record<string, readonly string[]>>,
): TypeEnvironment {
  const cached = environmentsByProgram.get(program);
  if (cached !== undefined) {
    return cached;
  }
  // Map.groupBy needs Node 21; the preset supports Node 20.
  const declarations = program.body
    .map((statement) => declaredStatement(statement))
    .filter(
      (declaration): declaration is TSESTree.TSInterfaceDeclaration =>
        declaration?.type === AST_NODE_TYPES.TSInterfaceDeclaration,
    );
  const interfaces = new Map(
    declarations.map((declaration) => [
      declaration.id.name,
      declarations.filter((other) => other.id.name === declaration.id.name),
    ]),
  );

  const environment = {
    interfaces,
    typeAliases: createTypeAliasEnvironment(program, visitorKeys),
  };
  environmentsByProgram.set(program, environment);
  return environment;
}

function typeReferenceName(type: TSESTree.TSTypeReference): string | null {
  return type.typeName.type === AST_NODE_TYPES.Identifier
    ? type.typeName.name
    : null;
}

function isBuiltIn(
  name: string,
  use: TSESTree.Node,
  environment: TypeEnvironment,
): boolean {
  return (
    BUILT_INS.has(name) &&
    !hasVisibleTypeBinding(name, use, environment.typeAliases)
  );
}

function isUnappliedReferenceTo(
  type: TSESTree.TypeNode,
  name: string,
): boolean {
  const unwrapped = unwrapTransparentType(type);
  return (
    unwrapped.type === AST_NODE_TYPES.TSTypeReference &&
    typeReferenceName(unwrapped) === name &&
    (unwrapped.typeArguments?.params.length ?? 0) === 0
  );
}

function unwrapTransparentType(type: TSESTree.TypeNode): TSESTree.TypeNode {
  return type.type === AST_NODE_TYPES.TSTypeOperator &&
    type.operator === 'readonly' &&
    type.typeAnnotation !== undefined
    ? unwrapTransparentType(type.typeAnnotation)
    : type;
}

function isNeverType(type: TSESTree.TypeNode): boolean {
  return unwrapTransparentType(type).type === AST_NODE_TYPES.TSNeverKeyword;
}

function isEffectivelyEmptyMember(member: TSESTree.TypeElement): boolean {
  if (member.type !== AST_NODE_TYPES.TSPropertySignature || !member.optional) {
    return false;
  }
  return (
    member.typeAnnotation !== undefined &&
    isNeverType(member.typeAnnotation.typeAnnotation)
  );
}

function isEffectivelyEmptyTypeLiteral(type: TSESTree.TSTypeLiteral): boolean {
  return type.members.every((member) => isEffectivelyEmptyMember(member));
}

function isEffectivelyEmptyInterface(
  declarations: readonly TSESTree.TSInterfaceDeclaration[],
): boolean {
  const [type] = declarations;
  return (
    declarations.length === 1 &&
    type.extends.length === 0 &&
    type.body.body.every((member) => isEffectivelyEmptyMember(member))
  );
}

function resolvedSubstitutionArgument(
  type: TSESTree.TypeNode,
  base: TypeAliasEnvironment,
  resolving: ReadonlySet<string> = new Set(),
): TSESTree.TypeNode {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type !== AST_NODE_TYPES.TSTypeReference) {
    return type;
  }
  const name = typeReferenceName(unwrapped);
  if (name === null || resolving.has(name)) {
    return type;
  }
  const substitution = base.get(name);
  if (substitution === undefined) {
    return type;
  }
  const nextResolving = new Set([...resolving, name]);
  return resolvedSubstitutionArgument(substitution, base, nextResolving);
}

function aliasSubstitution(
  alias: TSESTree.TSTypeAliasDeclaration,
  type: TSESTree.TSTypeReference,
  base: TypeAliasEnvironment,
): TypeAliasEnvironment | null {
  const parameters = alias.typeParameters?.params ?? [];
  const typeArguments = type.typeArguments?.params ?? [];
  const extend = (
    index: number,
    next: TypeAliasEnvironment,
  ): TypeAliasEnvironment | null => {
    const parameter = parameters.at(index);
    if (parameter === undefined) {
      return next;
    }
    const argument = typeArguments.at(index) ?? parameter.default;
    return argument === undefined
      ? null
      : extend(
          index + 1,
          new Map<string, TSESTree.TypeNode>([
            ...next,
            [parameter.name.name, resolvedSubstitutionArgument(argument, next)],
          ]),
        );
  };
  return extend(0, base);
}

function unsafeDirectValue(
  type: TSESTree.TypeNode,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): UnsafeDictionary['unsafeValue'] | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === AST_NODE_TYPES.TSUnknownKeyword) {
    return 'unknown';
  }
  if (unwrapped.type === AST_NODE_TYPES.TSAnyKeyword) {
    return 'any';
  }
  if (unwrapped.type === AST_NODE_TYPES.TSObjectKeyword) {
    return 'object';
  }
  if (
    unwrapped.type === AST_NODE_TYPES.TSTypeLiteral &&
    isEffectivelyEmptyTypeLiteral(unwrapped)
  ) {
    return 'empty-object';
  }
  if (unwrapped.type === AST_NODE_TYPES.TSUnionType) {
    return unwrapped.types.some(
      (member) =>
        unsafeDirectValue(
          member,
          environment,
          substitutions,
          resolvingAliases,
        ) !== null,
    )
      ? 'union'
      : null;
  }
  if (unwrapped.type === AST_NODE_TYPES.TSIntersectionType) {
    const unsafeMembers = unwrapped.types.map((member) =>
      unsafeDirectValue(member, environment, substitutions, resolvingAliases),
    );
    if (unsafeMembers.includes('any')) {
      return 'any';
    }
    return unsafeMembers.length > 0 &&
      unsafeMembers.every((member) => member !== null)
      ? unsafeMembers[0]
      : null;
  }
  if (unwrapped.type !== AST_NODE_TYPES.TSTypeReference) {
    return null;
  }
  const name = typeReferenceName(unwrapped);
  if (name === null) {
    return null;
  }
  if (
    TRANSPARENT_WRAPPERS.has(name) &&
    isBuiltIn(name, unwrapped, environment)
  ) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : unsafeDirectValue(
          wrapped,
          environment,
          substitutions,
          resolvingAliases,
        );
  }
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name)
      ? null
      : unsafeDirectValue(
          substitution,
          environment,
          substitutions,
          resolvingAliases,
        );
  }
  const interfaceDeclarations = environment.interfaces.get(name);
  if (interfaceDeclarations !== undefined) {
    return isEffectivelyEmptyInterface(interfaceDeclarations)
      ? 'empty-object'
      : null;
  }
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null || resolvingAliases.has(name)) {
    return null;
  }
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null) {
    return null;
  }
  const nextResolving = new Set([...resolvingAliases, name]);
  return unsafeDirectValue(
    alias.typeAnnotation,
    environment,
    nextSubstitutions,
    nextResolving,
  );
}

function dictionaryValueTypes(
  type: TSESTree.TypeNode,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === AST_NODE_TYPES.TSTypeLiteral) {
    return unwrapped.members.flatMap((member): readonly ResolvedType[] =>
      member.type === AST_NODE_TYPES.TSIndexSignature &&
      member.typeAnnotation !== undefined
        ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }]
        : [],
    );
  }

  if (unwrapped.type === AST_NODE_TYPES.TSMappedType) {
    return unwrapped.typeAnnotation === undefined
      ? []
      : [{ type: unwrapped.typeAnnotation, substitutions }];
  }

  if (unwrapped.type !== AST_NODE_TYPES.TSTypeReference) {
    return [];
  }
  const name = typeReferenceName(unwrapped);
  if (name === null) {
    return [];
  }

  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name)
      ? []
      : dictionaryValueTypes(
          substitution,
          environment,
          substitutions,
          resolvingAliases,
        );
  }

  if (
    TRANSPARENT_WRAPPERS.has(name) &&
    isBuiltIn(name, unwrapped, environment)
  ) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? []
      : dictionaryValueTypes(
          wrapped,
          environment,
          substitutions,
          resolvingAliases,
        );
  }

  if (name === 'Record' && isBuiltIn(name, unwrapped, environment)) {
    const value = unwrapped.typeArguments?.params[1] ?? null;
    return value === null ? [] : [{ type: value, substitutions }];
  }

  if (
    (name === 'Pick' || name === 'Omit') &&
    isBuiltIn(name, unwrapped, environment)
  ) {
    const source = unwrapped.typeArguments?.params[0];
    return source === undefined
      ? []
      : dictionaryValueTypes(
          source,
          environment,
          substitutions,
          resolvingAliases,
        );
  }

  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null || resolvingAliases.has(name)) {
    return [];
  }
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null) {
    return [];
  }
  const nextResolving = new Set([...resolvingAliases, name]);
  return dictionaryValueTypes(
    alias.typeAnnotation,
    environment,
    nextSubstitutions,
    nextResolving,
  );
}

export function classifyUnsafeDictionaryValue(
  valueType: TSESTree.TypeNode,
  environment: TypeEnvironment,
): UnsafeDictionary | null {
  const unsafeValue = unsafeDirectValue(
    valueType,
    environment,
    new Map<string, TSESTree.TypeNode>(),
    new Set(),
  );
  return unsafeValue === null
    ? null
    : { kind: 'unsafe-dictionary', unsafeValue };
}

export function classifyUnsafeDictionary(
  type: TSESTree.TypeNode,
  environment: TypeEnvironment,
): UnsafeDictionary | null {
  const unsafeValue =
    dictionaryValueTypes(
      type,
      environment,
      new Map<string, TSESTree.TypeNode>(),
      new Set(),
    )
      .map((valueType) =>
        unsafeDirectValue(
          valueType.type,
          environment,
          valueType.substitutions,
          new Set(),
        ),
      )
      .find((value) => value !== null) ?? null;
  return unsafeValue === null
    ? null
    : { kind: 'unsafe-dictionary', unsafeValue };
}

export function classifyWideningTarget(
  type: TSESTree.TypeNode,
  environment: TypeEnvironment,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === AST_NODE_TYPES.TSUnknownKeyword) {
    return { kind: 'unknown' };
  }
  if (unwrapped.type === AST_NODE_TYPES.TSObjectKeyword) {
    return { kind: 'object' };
  }
  if (unwrapped.type === AST_NODE_TYPES.TSTypeLiteral) {
    if (
      unwrapped.members.some(
        (member) => member.type === AST_NODE_TYPES.TSIndexSignature,
      )
    ) {
      return { kind: 'open dictionary' };
    }
    return unwrapped.members.length > 0 ? { kind: 'anonymous object' } : null;
  }
  if (unwrapped.type === AST_NODE_TYPES.TSMappedType) {
    return { kind: 'open dictionary' };
  }
  if (unwrapped.type !== AST_NODE_TYPES.TSTypeReference) {
    return null;
  }
  const name = typeReferenceName(unwrapped);
  if (name === null) {
    return null;
  }
  if (
    TRANSPARENT_WRAPPERS.has(name) &&
    isBuiltIn(name, unwrapped, environment)
  ) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : classifyWideningTarget(wrapped, environment);
  }
  if (name === 'Record' && isBuiltIn(name, unwrapped, environment)) {
    return hasBroadRecordKey(
      unwrapped,
      environment,
      new Map<string, TSESTree.TypeNode>(),
    )
      ? { kind: 'open dictionary' }
      : null;
  }
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null) {
    return null;
  }
  if ((alias.typeParameters?.params.length ?? 0) > 0) {
    const substitutions = aliasSubstitution(
      alias,
      unwrapped,
      new Map<string, TSESTree.TypeNode>(),
    );
    const resolved =
      substitutions === null
        ? null
        : classifyAliasBroadTarget(
            alias.typeAnnotation,
            environment,
            substitutions,
            new Set([name]),
          );
    return resolved?.kind === 'open dictionary'
      ? { kind: 'generic container' }
      : null;
  }
  const substitutions = aliasSubstitution(
    alias,
    unwrapped,
    new Map<string, TSESTree.TypeNode>(),
  );
  if (substitutions === null) {
    return null;
  }
  return classifyAliasBroadTarget(
    alias.typeAnnotation,
    environment,
    substitutions,
    new Set([name]),
  );
}

function hasBroadRecordKey(
  type: TSESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
): boolean {
  const key = type.typeArguments?.params[0];
  return key === undefined || isBroadMappedKey(key, environment, substitutions);
}

function isBroadMappedKey(
  type: TSESTree.TypeNode,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  visitedAliases: ReadonlySet<string> = new Set(),
): boolean {
  const unwrapped = unwrapTransparentType(type);
  if (BROAD_KEY_KEYWORDS.has(unwrapped.type)) {
    return true;
  }
  if (unwrapped.type === AST_NODE_TYPES.TSUnionType) {
    return unwrapped.types.some((member) =>
      isBroadMappedKey(member, environment, substitutions, visitedAliases),
    );
  }
  if (unwrapped.type !== AST_NODE_TYPES.TSTypeReference) {
    return false;
  }
  const name = typeReferenceName(unwrapped);
  if (name === null) {
    return false;
  }
  const substitution = substitutions.get(name);
  if (
    substitution !== undefined &&
    !isUnappliedReferenceTo(substitution, name)
  ) {
    return isBroadMappedKey(
      substitution,
      environment,
      substitutions,
      visitedAliases,
    );
  }
  if (name === 'PropertyKey' && isBuiltIn(name, unwrapped, environment)) {
    return true;
  }
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (
    alias === null ||
    (alias.typeParameters?.params.length ?? 0) > 0 ||
    visitedAliases.has(name)
  ) {
    return false;
  }
  const nextVisited = new Set([...visitedAliases, name]);
  return isBroadMappedKey(
    alias.typeAnnotation,
    environment,
    substitutions,
    nextVisited,
  );
}

function classifyAliasBroadTarget(
  type: TSESTree.TypeNode,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === AST_NODE_TYPES.TSUnknownKeyword) {
    return { kind: 'unknown' };
  }
  if (unwrapped.type === AST_NODE_TYPES.TSObjectKeyword) {
    return { kind: 'object' };
  }
  if (unwrapped.type === AST_NODE_TYPES.TSTypeLiteral) {
    return unwrapped.members.some(
      (member) => member.type === AST_NODE_TYPES.TSIndexSignature,
    )
      ? { kind: 'open dictionary' }
      : null;
  }
  if (unwrapped.type === AST_NODE_TYPES.TSMappedType) {
    return isBroadMappedKey(unwrapped.constraint, environment, substitutions)
      ? { kind: 'open dictionary' }
      : null;
  }
  if (unwrapped.type !== AST_NODE_TYPES.TSTypeReference) {
    return null;
  }
  const name = typeReferenceName(unwrapped);
  if (name === null) {
    return null;
  }
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name)
      ? null
      : classifyAliasBroadTarget(
          substitution,
          environment,
          substitutions,
          resolvingAliases,
        );
  }
  if (
    TRANSPARENT_WRAPPERS.has(name) &&
    isBuiltIn(name, unwrapped, environment)
  ) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined
      ? null
      : classifyAliasBroadTarget(
          wrapped,
          environment,
          substitutions,
          resolvingAliases,
        );
  }
  if (name === 'Record' && isBuiltIn(name, unwrapped, environment)) {
    return hasBroadRecordKey(unwrapped, environment, substitutions)
      ? { kind: 'open dictionary' }
      : null;
  }
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null || resolvingAliases.has(name)) {
    return null;
  }
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null) {
    return null;
  }
  const nextResolving = new Set([...resolvingAliases, name]);
  return classifyAliasBroadTarget(
    alias.typeAnnotation,
    environment,
    nextSubstitutions,
    nextResolving,
  );
}

export function isKnownEvidenceExpression(
  expression: TSESTree.Expression,
): boolean {
  return KNOWN_EVIDENCE_TYPES.has(unwrapExpression(expression).type);
}
