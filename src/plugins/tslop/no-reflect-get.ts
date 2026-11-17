import { defineRule, report } from './shared/rule.js';
import { isReflectMethodCall } from './shared/reflect-method.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-reflect-get`: no `Reflect.get(...)`.
 *
 * What it flags: a call of the global `Reflect.get`.
 *
 * Why: it reads a property by a runtime key and returns `any`, which
 * bypasses ordinary property access and every bit of type evidence on the
 * way.
 *
 * How to fix: use typed property access, or parse the dynamic input into a
 * named domain type first.
 */
export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Reflect.get; use typed property access or parse dynamic input into a domain type.',
    },
    schema: [],
    messages: {
      reflectGet:
        'Replace `Reflect.get` with typed property access. Parse dynamic input into a named domain type before reading it.',
    },
  },
  create(context) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (isReflectMethodCall(context, node.callee, 'get')) {
          report(context, node, 'reflectGet');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
