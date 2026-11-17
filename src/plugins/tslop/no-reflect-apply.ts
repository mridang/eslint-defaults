import { defineRule, report } from './shared/rule.js';
import { isReflectMethodCall } from './shared/reflect-method.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-reflect-apply`: no `Reflect.apply(...)`.
 *
 * What it flags: a call of the global `Reflect.apply`.
 *
 * Why: it calls a function through an untyped path, so the compiler no longer
 * checks the arguments against the signature.
 *
 * How to fix: call the function directly, or model the dynamic dispatch behind
 * a named interface. Note that `unicorn/prefer-reflect-apply` asks for the
 * opposite of this rule for `fn.apply(this, args)`, so a configuration turns
 * on only one of the two.
 */
export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Reflect.apply; call typed functions directly or model dynamic dispatch behind an interface.',
    },
    schema: [],
    messages: {
      reflectApply:
        'Replace `Reflect.apply` with a typed function call. Model dynamic dispatch behind a named interface.',
    },
  },
  create(context) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (isReflectMethodCall(context, node.callee, 'apply')) {
          report(context, node, 'reflectApply');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
