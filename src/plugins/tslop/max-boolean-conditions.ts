import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/**
 * `tslop/max-boolean-conditions`: at most three terms in a loop or `if` test.
 *
 * What it flags: the test of an `if`, `while`, `do...while` or `for` that joins
 * more than `maxConditions` (default 3) terms with `&&` and `||`. A term in
 * parentheses counts as one, and `??` does not split terms.
 *
 * Why: a long boolean chain hides what the condition means.
 *
 * How to fix: name the parts with variables (`const isEligible = ...`) and test
 * those. Overlaps with `sonarjs/expression-complexity`; use only one of them.
 */

const countTerms = (
  context: Rule.RuleContext,
  term: TSESTree.Node,
  respectGroups: boolean,
  isRoot = true,
): number => {
  const { sourceCode } = context;
  const grouped =
    respectGroups &&
    !isRoot &&
    sourceCode.getTokenBefore(term as unknown as Rule.Node)?.value === '(' &&
    sourceCode.getTokenAfter(term as unknown as Rule.Node)?.value === ')';
  if (
    term.type === AST_NODE_TYPES.LogicalExpression &&
    term.operator !== '??' &&
    !grouped
  ) {
    return (
      countTerms(context, term.left, respectGroups, false) +
      countTerms(context, term.right, respectGroups, false)
    );
  }
  return 1;
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Limit top-level Boolean terms in control-flow conditions',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxConditions: { type: 'integer', minimum: 1 },
          message: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tooManyConditions:
        'This condition has {{count}} top-level terms (maximum {{max}}). Prefer a named variable that describes what these conditions mean.',
    },
  },
  create(context) {
    const options = (context.options[0] ?? {}) as {
      maxConditions?: number;
      message?: string;
    };
    const max = options.maxConditions ?? 3;
    const check = (node: { test: TSESTree.Expression | null }): void => {
      if (node.test === null) {
        return;
      }
      // Grouping only merges terms, so skip the token reads when the plain count fits.
      if (countTerms(context, node.test, false) <= max) {
        return;
      }
      const count = countTerms(context, node.test, true);
      if (count <= max) {
        return;
      }
      if (options.message === undefined) {
        report(context, node.test, 'tooManyConditions', { count, max });
      } else {
        context.report({
          node: node.test as unknown as Rule.Node,
          message: options.message,
        });
      }
    };
    return {
      IfStatement: check,
      WhileStatement: check,
      DoWhileStatement: check,
      ForStatement: check,
    };
  },
});
