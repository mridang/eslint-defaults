import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-runtime-typeof`: no ad hoc `typeof` narrowing.
 *
 * What it flags: every `typeof x` expression, except the existence probe
 * `typeof x === 'undefined'` (the only safe way to ask about a binding that may
 * not exist). With `{ allowInTypeGuards: true }`, a `typeof` inside a function
 * that returns a type predicate is allowed as well.
 *
 * Why: `typeof` narrows a representation (a string, an object) without
 * establishing what the value means. Code that needs it usually holds a value
 * nobody parsed.
 *
 * How to fix: parse the input once at its I/O boundary (a schema, a decoder)
 * and then branch on the domain value.
 */

const FUNCTION_TYPES: ReadonlySet<AST_NODE_TYPES> = new Set([
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
]);

const isFunction = (
  node: TSESTree.Node,
): node is
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression => FUNCTION_TYPES.has(node.type);

const isInsideTypeGuard = (node: TSESTree.Node): boolean => {
  const parent = node.parent ?? null;
  if (parent === null || parent.type === AST_NODE_TYPES.Program) {
    return false;
  }
  if (isFunction(parent)) {
    return (
      parent.returnType?.typeAnnotation.type === AST_NODE_TYPES.TSTypePredicate
    );
  }
  return isInsideTypeGuard(parent);
};

const isExistenceProbe = (node: TSESTree.UnaryExpression): boolean => {
  const parent = node.parent;
  if (parent.type !== AST_NODE_TYPES.BinaryExpression) {
    return false;
  }
  if (!['===', '!==', '==', '!='].includes(parent.operator)) {
    return false;
  }
  const other = parent.left === node ? parent.right : parent.left;
  return other.type === AST_NODE_TYPES.Literal && other.value === 'undefined';
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary.',
    },
    schema: [
      {
        type: 'object',
        properties: { allowInTypeGuards: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      runtimeTypeof:
        'A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.',
    },
  },
  create(context) {
    const option = context.options[0] as
      { allowInTypeGuards?: boolean } | undefined;
    const allowInTypeGuards = option?.allowInTypeGuards === true;
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      UnaryExpression(node: TSESTree.UnaryExpression) {
        if (
          node.operator === 'typeof' &&
          !isExistenceProbe(node) &&
          !(allowInTypeGuards && isInsideTypeGuard(node))
        ) {
          report(context, node, 'runtimeTypeof');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
