import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report, unwrapExpression } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-conditional-empty-object-spread`: no `...(cond ? { a } : {})`.
 *
 * What it flags: an object spread whose argument is a conditional with an
 * empty object literal in one of its branches.
 *
 * Why: the spread hides which properties are optional behind an empty object,
 * so the reader (and the type checker) cannot see the omission rule at a
 * glance, and the result type becomes a union of shapes.
 *
 * How to fix: build the object in a named variable and add the property in an
 * `if` statement only when the value is present.
 */
export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow object spreads that conditionally spread an empty object to omit fields.',
    },
    schema: [],
    messages: {
      avoid:
        'This conditional spread hides property omission behind an empty object. Build the object in separate statements and add the property only when present.',
    },
  },
  create(context) {
    const isEmptyObject = (node: TSESTree.Node): boolean =>
      node.type === AST_NODE_TYPES.ObjectExpression &&
      node.properties.length === 0;
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      SpreadElement(node: TSESTree.SpreadElement) {
        if (node.parent.type !== AST_NODE_TYPES.ObjectExpression) {
          return;
        }
        const argument = unwrapExpression(node.argument);
        if (
          argument.type === AST_NODE_TYPES.ConditionalExpression &&
          (isEmptyObject(unwrapExpression(argument.consequent)) ||
            isEmptyObject(unwrapExpression(argument.alternate)))
        ) {
          report(context, node, 'avoid');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
