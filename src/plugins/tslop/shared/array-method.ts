import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  asTypeScript,
  definitionNode,
  resolveVariable,
  unwrapExpression,
} from './rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule, Scope } from 'eslint';

/** Resolves a local binding by scope, not by the spelling of its name. */
export function resolveArrayBinding(
  context: Rule.RuleContext,
  node: TSESTree.Node,
): Scope.Variable | null {
  const unwrapped = unwrapExpression(node);
  return unwrapped.type === AST_NODE_TYPES.Identifier
    ? resolveVariable(context, unwrapped)
    : null;
}

/** Reads a static method name, including a computed string literal. */
export function arrayMethodTarget(
  node: TSESTree.Node,
): { readonly name: string; readonly object: TSESTree.Node } | null {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type !== AST_NODE_TYPES.MemberExpression) {
    return null;
  }
  const property = unwrapped.property;
  if (!unwrapped.computed && property.type === AST_NODE_TYPES.Identifier) {
    return { name: property.name, object: unwrapped.object };
  }
  if (
    unwrapped.computed &&
    property.type === AST_NODE_TYPES.Literal &&
    typeof property.value === 'string'
  ) {
    return { name: property.value, object: unwrapped.object };
  }
  return null;
}

function isArrayAnnotation(type: TSESTree.TypeNode): boolean {
  if (
    type.type === AST_NODE_TYPES.TSArrayType ||
    type.type === AST_NODE_TYPES.TSTupleType
  ) {
    return true;
  }
  if (
    type.type === AST_NODE_TYPES.TSTypeOperator &&
    type.operator === 'readonly'
  ) {
    return (
      type.typeAnnotation !== undefined &&
      isArrayAnnotation(type.typeAnnotation)
    );
  }
  return (
    type.type === AST_NODE_TYPES.TSTypeReference &&
    type.typeName.type === AST_NODE_TYPES.Identifier &&
    (type.typeName.name === 'Array' || type.typeName.name === 'ReadonlyArray')
  );
}

/** Array methods whose result is an array when the receiver is one. */
const ARRAY_RETURNING = new Set([
  'map',
  'filter',
  'flatMap',
  'slice',
  'concat',
  'toSorted',
  'toReversed',
  'toSpliced',
]);

/** True for a binding that is never written after its declaration. */
export function isNeverReassigned(variable: Scope.Variable): boolean {
  return !variable.references.some(
    (reference) => reference.isWrite() && !reference.init,
  );
}

/** The initializer a definition gives its `const` binding, if it is one. */
function declaredConstInitializer(
  definition: Scope.Definition,
): TSESTree.Expression | null {
  const node = definitionNode(definition);
  if (
    definition.type !== 'Variable' ||
    node.type !== AST_NODE_TYPES.VariableDeclarator
  ) {
    return null;
  }
  const declaration = node.parent;
  return node.id.type === AST_NODE_TYPES.Identifier &&
    declaration.kind === 'const'
    ? node.init
    : null;
}

/** The initializer of a `const` binding that has exactly one declaration. */
export function constInitializer(
  variable: Scope.Variable,
): TSESTree.Expression | null {
  return (
    variable.defs
      .map((definition) => declaredConstInitializer(definition))
      .find((initializer) => initializer !== null) ?? null
  );
}

/** Recognizes local evidence for an array; unknown receivers are not arrays. */
export function isKnownArrayExpression(
  context: Rule.RuleContext,
  node: TSESTree.Node,
  visited: ReadonlySet<Scope.Variable> = new Set<Scope.Variable>(),
): boolean {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type === AST_NODE_TYPES.ArrayExpression) {
    return true;
  }
  if (unwrapped.type === AST_NODE_TYPES.CallExpression) {
    const method = arrayMethodTarget(unwrapped.callee);
    return (
      method !== null &&
      ARRAY_RETURNING.has(method.name) &&
      isKnownArrayExpression(context, method.object, visited)
    );
  }
  if (unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }
  const variable = resolveArrayBinding(context, unwrapped);
  if (variable === null || visited.has(variable)) {
    return false;
  }
  if (!isNeverReassigned(variable)) {
    return false;
  }
  const annotation = variable.identifiers
    .map(
      (identifier) =>
        asTypeScript<TSESTree.Identifier>(identifier).typeAnnotation
          ?.typeAnnotation,
    )
    .find((candidate) => candidate !== undefined);
  if (annotation !== undefined) {
    return isArrayAnnotation(annotation);
  }
  const initializer = constInitializer(variable);
  return (
    initializer !== null &&
    isKnownArrayExpression(
      context,
      initializer,
      new Set([...visited, variable]),
    )
  );
}
