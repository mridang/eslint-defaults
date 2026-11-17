import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  defineRule,
  definitionNode,
  report,
  resolveVariable,
} from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule, Scope } from 'eslint';

/**
 * `tslop/no-widen-then-assert`: do not widen a value and then assert it back.
 *
 * What it flags: a `const` that is declared (or asserted) as `unknown`, `any`,
 * `object` or `Record<string, unknown>` although its initializer is a known
 * value, and that the same function later asserts to a narrower type
 * (`const value: unknown = { id: 1 }; ... value as User`).
 *
 * Why: the first step deletes what the compiler knew, the second one makes the
 * compiler believe the author again. Nothing was checked in between.
 *
 * How to fix: keep the precise type from the initializer to its use, and parse
 * data from outside once, where it enters the program.
 */

type TypeAssertion = TSESTree.TSAsExpression | TSESTree.TSTypeAssertion;
type BroadKind = 'object' | 'record' | 'top';
interface Evidence {
  readonly type: TSESTree.TypeNode | null;
}

const FUNCTION_BOUNDARIES = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
]);

const BROAD_KEY_KEYWORDS: ReadonlySet<AST_NODE_TYPES> = new Set([
  AST_NODE_TYPES.TSStringKeyword,
  AST_NODE_TYPES.TSNumberKeyword,
  AST_NODE_TYPES.TSSymbolKeyword,
]);

const KNOWN_VALUE_NODES: ReadonlySet<AST_NODE_TYPES> = new Set([
  AST_NODE_TYPES.Literal,
  AST_NODE_TYPES.TemplateLiteral,
  AST_NODE_TYPES.ArrayExpression,
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.ClassExpression,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.NewExpression,
  AST_NODE_TYPES.ObjectExpression,
]);

const typeReferenceName = (type: TSESTree.TSTypeReference): string | null =>
  type.typeName.type === AST_NODE_TYPES.Identifier ? type.typeName.name : null;

const isUnknownOrAny = (type: TSESTree.TypeNode): boolean =>
  type.type === AST_NODE_TYPES.TSUnknownKeyword ||
  type.type === AST_NODE_TYPES.TSAnyKeyword;

const isBroadRecordKey = (type: TSESTree.TypeNode): boolean => {
  if (BROAD_KEY_KEYWORDS.has(type.type)) {
    return true;
  }
  if (type.type === AST_NODE_TYPES.TSUnionType) {
    return type.types.every((member) => isBroadRecordKey(member));
  }
  return (
    type.type === AST_NODE_TYPES.TSTypeReference &&
    typeReferenceName(type) === 'PropertyKey'
  );
};

const isBroadRecord = (type: TSESTree.TypeNode): boolean => {
  if (type.type === AST_NODE_TYPES.TSTypeReference) {
    const name = typeReferenceName(type);
    if (name === 'Readonly') {
      const inner = (type.typeArguments?.params ?? []).at(0);
      return inner !== undefined && isBroadRecord(inner);
    }
    if (name !== 'Record') {
      return false;
    }
    const parameters = type.typeArguments?.params ?? [];
    if (parameters.length !== 2) {
      return false;
    }
    const [key, value] = parameters;
    return isBroadRecordKey(key) && isUnknownOrAny(value);
  }
  if (type.type !== AST_NODE_TYPES.TSTypeLiteral || type.members.length !== 1) {
    return false;
  }
  const [member] = type.members;
  if (
    member?.type !== AST_NODE_TYPES.TSIndexSignature ||
    member.parameters.length !== 1
  ) {
    return false;
  }
  const [parameter] = member.parameters;
  const key =
    'typeAnnotation' in parameter
      ? parameter.typeAnnotation?.typeAnnotation
      : undefined;
  const value = member.typeAnnotation?.typeAnnotation;
  return (
    key !== undefined &&
    value !== undefined &&
    isBroadRecordKey(key) &&
    isUnknownOrAny(value)
  );
};

const broadKind = (type: TSESTree.TypeNode): BroadKind | null => {
  if (isUnknownOrAny(type)) {
    return 'top';
  }
  if (type.type === AST_NODE_TYPES.TSObjectKeyword) {
    return 'object';
  }
  return isBroadRecord(type) ? 'record' : null;
};

const isAssertion = (node: TSESTree.Node): node is TypeAssertion =>
  node.type === AST_NODE_TYPES.TSAsExpression ||
  node.type === AST_NODE_TYPES.TSTypeAssertion;

const normalizedText = (text: string, type: TSESTree.TypeNode): string =>
  text.slice(type.range[0], type.range[1]).replaceAll(/\s+/gu, '');

const sameSyntax = (
  text: string,
  left: TSESTree.TypeNode | null,
  right: TSESTree.TypeNode,
): boolean =>
  left !== null && normalizedText(text, left) === normalizedText(text, right);

const isDefinitelyObject = (type: TSESTree.TypeNode): boolean => {
  switch (type.type) {
    case AST_NODE_TYPES.TSArrayType:
    case AST_NODE_TYPES.TSConstructorType:
    case AST_NODE_TYPES.TSFunctionType:
    case AST_NODE_TYPES.TSMappedType:
    case AST_NODE_TYPES.TSObjectKeyword:
    case AST_NODE_TYPES.TSTupleType: {
      return true;
    }
    case AST_NODE_TYPES.TSTypeLiteral: {
      return type.members.length > 0;
    }
    case AST_NODE_TYPES.TSIntersectionType: {
      return type.types.every((member) => isDefinitelyObject(member));
    }
    case AST_NODE_TYPES.TSTypeOperator: {
      return (
        type.operator === 'readonly' &&
        type.typeAnnotation !== undefined &&
        isDefinitelyObject(type.typeAnnotation)
      );
    }
    default: {
      return false;
    }
  }
};

const isNarrowerRecord = (type: TSESTree.TypeNode): boolean => {
  if (type.type === AST_NODE_TYPES.TSTypeLiteral) {
    return type.members.some(
      (member) => member.type !== AST_NODE_TYPES.TSIndexSignature,
    );
  }
  if (type.type !== AST_NODE_TYPES.TSTypeReference) {
    return false;
  }
  const name = typeReferenceName(type);
  if (name === 'Readonly') {
    const inner = (type.typeArguments?.params ?? []).at(0);
    return inner !== undefined && isNarrowerRecord(inner);
  }
  if (name !== 'Record') {
    return false;
  }
  const parameters = type.typeArguments?.params ?? [];
  return parameters.length === 2 && !isUnknownOrAny(parameters[1]);
};

const functionBoundary = (node: TSESTree.Node): TSESTree.Node | null => {
  const parent = node.parent ?? null;
  if (parent === null || parent.type === AST_NODE_TYPES.Program) {
    return null;
  }
  return FUNCTION_BOUNDARIES.has(parent.type)
    ? parent
    : functionBoundary(parent);
};

const variableDeclarator = (
  variable: Scope.Variable,
): TSESTree.VariableDeclarator | null =>
  variable.defs
    .flatMap((definition): readonly TSESTree.VariableDeclarator[] => {
      const node = definitionNode(definition);
      return definition.type === 'Variable' &&
        node.type === AST_NODE_TYPES.VariableDeclarator
        ? [node]
        : [];
    })
    .at(0) ?? null;

const hasWrite = (variable: Scope.Variable): boolean =>
  variable.references.some(
    (reference) => reference.isWrite() && !reference.init,
  );

/** The declarator and initializer of a `const` binding that is never written again. */
const writeOnceConst = (
  variable: Scope.Variable,
): {
  readonly declarator: TSESTree.VariableDeclarator;
  readonly init: TSESTree.Expression;
} | null => {
  const declarator = variableDeclarator(variable);
  const init = declarator?.init ?? null;
  if (declarator === null || init === null) {
    return null;
  }
  const declaration = declarator.parent;
  return declaration.type === AST_NODE_TYPES.VariableDeclaration &&
    declaration.kind === 'const' &&
    !hasWrite(variable)
    ? { declarator, init }
    : null;
};

const knownValueEvidence = (
  context: Rule.RuleContext,
  expression: TSESTree.Node,
  boundary: TSESTree.Node | null,
  visited: ReadonlySet<Scope.Variable>,
): Evidence | null => {
  const unwrapped = expression;
  if (isAssertion(unwrapped)) {
    return broadKind(unwrapped.typeAnnotation) === null
      ? { type: unwrapped.typeAnnotation }
      : null;
  }
  if (KNOWN_VALUE_NODES.has(unwrapped.type)) {
    return { type: null };
  }
  if (unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  const variable = resolveVariable(context, unwrapped);
  if (variable === null || visited.has(variable)) {
    return null;
  }
  const annotated = variable.identifiers.find(
    (identifier) =>
      (identifier as unknown as TSESTree.Identifier).typeAnnotation !==
      undefined,
  ) as unknown as TSESTree.Identifier | undefined;
  const annotation = annotated?.typeAnnotation?.typeAnnotation;
  if (annotation !== undefined && annotated !== undefined) {
    if (
      functionBoundary(annotated) !== boundary ||
      broadKind(annotation) !== null
    ) {
      return null;
    }
    return { type: annotation };
  }
  const constant = writeOnceConst(variable);
  if (constant === null || functionBoundary(constant.declarator) !== boundary) {
    return null;
  }
  return knownValueEvidence(
    context,
    constant.init,
    boundary,
    new Set([...visited, variable]),
  );
};

interface Widened {
  readonly broad: BroadKind;
  readonly evidence: Evidence;
  readonly declaredAt: number;
  readonly boundary: TSESTree.Node | null;
}

const widenedBinding = (
  context: Rule.RuleContext,
  variable: Scope.Variable,
): Widened | null => {
  const constant = writeOnceConst(variable);
  if (constant?.declarator.id.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  const { declarator, init } = constant;
  const boundary = functionBoundary(declarator);
  const declared = declarator.id.typeAnnotation?.typeAnnotation;
  const initializer = isAssertion(init) ? init : null;
  const initializerKind =
    initializer === null ? null : broadKind(initializer.typeAnnotation);
  const kind =
    (declared === undefined ? null : broadKind(declared)) ?? initializerKind;
  if (kind === null) {
    return null;
  }
  const original =
    initializer !== null && initializerKind !== null
      ? initializer.expression
      : init;
  const evidence = knownValueEvidence(
    context,
    original,
    boundary,
    new Set([variable]),
  );
  return evidence === null
    ? null
    : { broad: kind, evidence, declaredAt: declarator.range[1], boundary };
};

const isNarrower = (
  text: string,
  broad: BroadKind,
  evidence: Evidence,
  asserted: TSESTree.TypeNode,
): boolean => {
  if (broadKind(asserted) !== null) {
    return false;
  }
  if (broad === 'top' || sameSyntax(text, evidence.type, asserted)) {
    return true;
  }
  return broad === 'object'
    ? isDefinitelyObject(asserted)
    : isNarrowerRecord(asserted);
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow local const flows that explicitly widen a known value before asserting the widened binding to a narrower type.',
    },
    schema: [],
    messages: {
      widenThenAssert:
        'Binding "{{name}}" discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use; parse boundary input once.',
    },
  },
  create(context) {
    const check = (node: TypeAssertion): void => {
      const expression = node.expression;
      if (expression.type !== AST_NODE_TYPES.Identifier) {
        return;
      }
      const variable = resolveVariable(context, expression);
      if (variable === null) {
        return;
      }
      const widened = widenedBinding(context, variable);
      if (
        widened === null ||
        node.range[0] <= widened.declaredAt ||
        functionBoundary(node) !== widened.boundary ||
        !isNarrower(
          context.sourceCode.text,
          widened.broad,
          widened.evidence,
          node.typeAnnotation,
        )
      ) {
        return;
      }
      report(context, node, 'widenThenAssert', { name: expression.name });
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
});
