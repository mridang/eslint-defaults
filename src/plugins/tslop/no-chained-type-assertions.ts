import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

type TypeAssertion = TSESTree.TSAsExpression | TSESTree.TSTypeAssertion;

/**
 * `tslop/no-chained-type-assertions`: no `x as A as B` or `<B>(<A>x)`.
 *
 * What it flags: a chain of two or more type assertions where at least one is
 * not `as const`. `as const as const`-only chains are left alone.
 *
 * Why: a second assertion overrides the compiler's check of the first, so the
 * chain (typically `as unknown as T`) throws away every bit of type evidence
 * and fabricates a type the code never proved.
 *
 * How to fix: keep the precise type, or parse the untrusted value at its
 * boundary (a schema, a type guard) before narrowing it.
 */

const isAssertion = (node: TSESTree.Node): node is TypeAssertion =>
  node.type === AST_NODE_TYPES.TSAsExpression ||
  node.type === AST_NODE_TYPES.TSTypeAssertion;

const isConstAssertion = (node: TypeAssertion): boolean =>
  node.typeAnnotation.type === AST_NODE_TYPES.TSTypeReference &&
  node.typeAnnotation.typeName.type === AST_NODE_TYPES.Identifier &&
  node.typeAnnotation.typeName.name === 'const';

const isOutermost = (node: TypeAssertion): boolean => {
  const parent = node.parent;
  return !isAssertion(parent) || parent.expression !== node;
};

const chainOf = (node: TSESTree.Node): TypeAssertion[] =>
  isAssertion(node) ? [node, ...chainOf(node.expression)] : [];

const isForbiddenChain = (node: TypeAssertion): boolean => {
  const chain = chainOf(node);
  return chain.length > 1 && chain.some((link) => !isConstAssertion(link));
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow chained TypeScript as and angle-bracket assertions.',
    },
    schema: [],
    messages: {
      chained:
        'This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.',
    },
  },
  create(context) {
    const check = (node: TypeAssertion): void => {
      if (isOutermost(node) && isForbiddenChain(node)) {
        report(context, node, 'chained');
      }
    };
    return { TSAsExpression: check, TSTypeAssertion: check };
  },
});
