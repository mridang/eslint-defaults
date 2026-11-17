import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  arrayMethodTarget,
  isKnownArrayExpression,
} from './shared/array-method.js';
import { defineRule, report, unwrapExpression } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/**
 * `tslop/no-array-filter-map`: no adjacent `.filter()` and `.map()` passes.
 *
 * What it flags: `items.filter(a).map(b)` and `items.map(a).filter(b)` on a
 * receiver that is known to be an array (an array literal, a `const` that holds
 * one, an annotated binding, or a chain of array methods).
 *
 * Why: every pass allocates a new array and walks the whole input, and the two
 * callbacks usually repeat the same work (a test, then the same lookup again).
 *
 * How to fix: use a lazy pipeline (`items.values().filter(a).map(b).toArray()`)
 * or a single `flatMap`, or one loop that pushes into a local array.
 */
export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow adjacent array filter/map passes in favor of lazy iterator helpers or a single transformation.',
    },
    schema: [],
    messages: {
      arrayFilterMap:
        'Avoid consecutive array `{{first}}` and `{{second}}` passes. Prefer `.values().{{first}}(...).{{second}}(...).toArray()` where iterator helpers are supported, or a single `flatMap`/mutating reducer. Preserve callback ordering, indexes, and filtering semantics.',
    },
  },
  create(context: Rule.RuleContext) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      CallExpression(node: TSESTree.CallExpression) {
        const outer = arrayMethodTarget(node.callee);
        if (outer?.name !== 'map' && outer?.name !== 'filter') {
          return;
        }
        const innerCall = unwrapExpression(outer.object);
        if (innerCall.type !== AST_NODE_TYPES.CallExpression) {
          return;
        }
        const inner = arrayMethodTarget(innerCall.callee);
        if (inner?.name !== (outer.name === 'map' ? 'filter' : 'map')) {
          return;
        }
        if (!isKnownArrayExpression(context, inner.object)) {
          return;
        }
        report(context, node, 'arrayFilterMap', {
          first: inner.name,
          second: outer.name,
        });
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
