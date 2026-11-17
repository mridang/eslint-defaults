import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { lexicalTypeParameterNames } from './lexical-type-parameters.js';
import { nodesWithin } from './rule.js';
import type { TSESTree } from '@typescript-eslint/types';

type VisitorKeys = Readonly<Record<string, readonly string[]>>;

type TypeBinding = {
  readonly alias: TSESTree.TSTypeAliasDeclaration | null;
  readonly name: string;
  readonly scope: TSESTree.Node;
};

type Substitution = {
  readonly substitutions: Substitutions;
  readonly type: TSESTree.TypeNode;
};

type Substitutions = ReadonlyMap<string, Substitution>;

export type TypeAliasEnvironment = {
  readonly aliases: readonly TSESTree.TSTypeAliasDeclaration[];
  readonly bindingsByName: ReadonlyMap<string, readonly TypeBinding[]>;
  readonly visitorKeys: VisitorKeys;
};

type ResolvedTypeMatcher = (
  type: TSESTree.TypeNode,
  matches: (child: TSESTree.TypeNode) => boolean,
) => boolean;

const environmentsByProgram = new WeakMap<
  TSESTree.Program,
  TypeAliasEnvironment
>();

const TYPE_SCOPE_NODES: ReadonlySet<AST_NODE_TYPES> = new Set([
  AST_NODE_TYPES.Program,
  AST_NODE_TYPES.BlockStatement,
  AST_NODE_TYPES.TSModuleBlock,
  AST_NODE_TYPES.StaticBlock,
  AST_NODE_TYPES.SwitchStatement,
]);

function enclosingScopeOf(
  current: TSESTree.Node | null,
  fallback: TSESTree.Node,
): TSESTree.Node {
  if (current === null) {
    return fallback;
  }
  return TYPE_SCOPE_NODES.has(current.type)
    ? current
    : enclosingScopeOf(current.parent ?? null, fallback);
}

function enclosingTypeScope(node: TSESTree.Node): TSESTree.Node {
  return enclosingScopeOf(node.parent ?? null, node);
}

function declaredTypeBinding(node: TSESTree.Node): {
  readonly alias: TSESTree.TSTypeAliasDeclaration | null;
  readonly name: string;
} | null {
  switch (node.type) {
    case AST_NODE_TYPES.TSTypeAliasDeclaration: {
      return { alias: node, name: node.id.name };
    }
    case AST_NODE_TYPES.TSInterfaceDeclaration:
    case AST_NODE_TYPES.TSEnumDeclaration:
    case AST_NODE_TYPES.ClassDeclaration:
    case AST_NODE_TYPES.ClassExpression: {
      return node.id === null ? null : { alias: null, name: node.id.name };
    }
    case AST_NODE_TYPES.ImportSpecifier:
    case AST_NODE_TYPES.ImportDefaultSpecifier:
    case AST_NODE_TYPES.ImportNamespaceSpecifier: {
      return { alias: null, name: node.local.name };
    }
    default: {
      return null;
    }
  }
}

/** Collect every lexical type alias and competing type binding in a program. */
export function createTypeAliasEnvironment(
  program: TSESTree.Program,
  visitorKeys: VisitorKeys,
): TypeAliasEnvironment {
  const cached = environmentsByProgram.get(program);
  if (cached !== undefined) {
    return cached;
  }
  const bindings = nodesWithin(program, visitorKeys).flatMap(
    (node): readonly TypeBinding[] => {
      const declared = declaredTypeBinding(node);
      return declared === null
        ? []
        : [{ ...declared, scope: enclosingTypeScope(node) }];
    },
  );
  const environment: TypeAliasEnvironment = {
    aliases: bindings.flatMap((binding) =>
      binding.alias === null ? [] : [binding.alias],
    ),
    // Map.groupBy needs Node 21; the preset supports Node 20.
    bindingsByName: new Map(
      bindings.map((binding) => [
        binding.name,
        bindings.filter((other) => other.name === binding.name),
      ]),
    ),
    visitorKeys,
  };
  environmentsByProgram.set(program, environment);
  return environment;
}

function ancestorDistance(
  ancestor: TSESTree.Node,
  node: TSESTree.Node,
  distance = 0,
): number | null {
  if (node === ancestor) {
    return distance;
  }
  const parent = node.parent ?? null;
  return parent === null
    ? null
    : ancestorDistance(ancestor, parent, distance + 1);
}

function nearestTypeBindings(
  name: string,
  use: TSESTree.Node,
  environment: TypeAliasEnvironment,
): readonly TypeBinding[] {
  const reachable = (environment.bindingsByName.get(name) ?? []).flatMap(
    (candidate) => {
      const distance = ancestorDistance(candidate.scope, use);
      return distance === null ? [] : [{ candidate, distance }];
    },
  );
  const nearestDistance = Math.min(...reachable.map((entry) => entry.distance));
  return reachable
    .filter((entry) => entry.distance === nearestDistance)
    .map((entry) => entry.candidate);
}

/** Resolve the nearest visible alias with this name, respecting lexical shadowing. */
export function visibleTypeAlias(
  name: string,
  use: TSESTree.Node,
  environment: TypeAliasEnvironment,
): TSESTree.TSTypeAliasDeclaration | null {
  if (lexicalTypeParameterNames(use, environment.visitorKeys).has(name)) {
    return null;
  }
  const bindings = nearestTypeBindings(name, use, environment);
  return bindings.length === 1 ? (bindings[0]?.alias ?? null) : null;
}

/** Return whether a local declaration shadows a built-in type at this use. */
export function hasVisibleTypeBinding(
  name: string,
  use: TSESTree.Node,
  environment: TypeAliasEnvironment,
): boolean {
  return (
    lexicalTypeParameterNames(use, environment.visitorKeys).has(name) ||
    nearestTypeBindings(name, use, environment).length > 0
  );
}

function typeReferenceName(type: TSESTree.TSTypeReference): string | null {
  return type.typeName.type === AST_NODE_TYPES.Identifier
    ? type.typeName.name
    : null;
}

function aliasSubstitutions(
  alias: TSESTree.TSTypeAliasDeclaration,
  reference: TSESTree.TSTypeReference,
  base: Substitutions,
): Substitutions | null {
  const parameters = alias.typeParameters?.params ?? [];
  const typeArguments = reference.typeArguments?.params ?? [];
  const extend = (index: number, next: Substitutions): Substitutions | null => {
    const parameter = parameters.at(index);
    if (parameter === undefined) {
      return next;
    }
    const explicitArgument = typeArguments.at(index);
    const argument = explicitArgument ?? parameter.default;
    return argument === undefined
      ? null
      : extend(
          index + 1,
          new Map<string, Substitution>([
            ...next,
            [
              parameter.name.name,
              {
                type: argument,
                substitutions: new Map(
                  explicitArgument === undefined ? next : base,
                ),
              },
            ],
          ]),
        );
  };
  return extend(0, base);
}

type Expansion = {
  readonly resolving: ReadonlySet<TSESTree.TSTypeAliasDeclaration>;
  readonly substitutions: Substitutions;
  readonly type: TSESTree.TypeNode;
};

/** Expands a reference to the type it stands for, or null when it stands for itself. */
function expandReference(
  reference: TSESTree.TSTypeReference,
  substitutions: Substitutions,
  resolving: ReadonlySet<TSESTree.TSTypeAliasDeclaration>,
  environment: TypeAliasEnvironment,
): Expansion | null {
  const name = typeReferenceName(reference);
  if (name === null) {
    return null;
  }
  const substitution = substitutions.get(name);
  if (substitution !== undefined && !reference.typeArguments?.params.length) {
    return {
      resolving,
      substitutions: substitution.substitutions,
      type: substitution.type,
    };
  }
  const alias = visibleTypeAlias(name, reference, environment);
  if (alias === null || resolving.has(alias)) {
    return null;
  }
  const nextSubstitutions = aliasSubstitutions(alias, reference, substitutions);
  return nextSubstitutions === null
    ? null
    : {
        resolving: new Set([...resolving, alias]),
        substitutions: nextSubstitutions,
        type: alias.typeAnnotation,
      };
}

/** Match a type after resolving visible aliases and substituting their type parameters. */
export function resolvedTypeMatches(
  type: TSESTree.TypeNode,
  environment: TypeAliasEnvironment,
  matcher: ResolvedTypeMatcher,
): boolean {
  const evaluate = (
    current: TSESTree.TypeNode,
    substitutions: Substitutions,
    resolvingAliases: ReadonlySet<TSESTree.TSTypeAliasDeclaration>,
  ): boolean => {
    const expansion =
      current.type === AST_NODE_TYPES.TSTypeReference
        ? expandReference(current, substitutions, resolvingAliases, environment)
        : null;
    if (expansion !== null) {
      return evaluate(
        expansion.type,
        expansion.substitutions,
        expansion.resolving,
      );
    }
    return matcher(current, (child) =>
      evaluate(child, substitutions, resolvingAliases),
    );
  };

  return evaluate(
    type,
    new Map<string, Substitution>(),
    new Set<TSESTree.TSTypeAliasDeclaration>(),
  );
}
