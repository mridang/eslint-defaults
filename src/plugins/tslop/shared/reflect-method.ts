import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { isGlobalReference } from './rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/** Whether a call target is one method of the global `Reflect` object. */
export function isReflectMethodCall(
  context: Rule.RuleContext,
  callee: TSESTree.Node,
  methodName: string,
): boolean {
  if (callee.type !== AST_NODE_TYPES.MemberExpression) {
    return false;
  }
  const object = callee.object;
  if (
    object.type !== AST_NODE_TYPES.Identifier ||
    object.name !== 'Reflect' ||
    !isGlobalReference(context, object)
  ) {
    return false;
  }
  const property = callee.property;
  return callee.computed
    ? property.type === AST_NODE_TYPES.Literal && property.value === methodName
    : property.type === AST_NODE_TYPES.Identifier &&
        property.name === methodName;
}
