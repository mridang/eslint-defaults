import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-shape-in-symbol-names`: no "shape" in a name.
 *
 * What it flags: any identifier (also private and JSX ones) that contains the
 * case-insensitive text "shape", such as `UserShape` or `shapeOf`. A member
 * that belongs to another value (`other.shape`) is not flagged, because the
 * name is not ours to change.
 *
 * Why: "shape" describes the structure of a value and not its role in the
 * domain, and it is a favourite of generated code (`ResponseShape`,
 * `FormShape`).
 *
 * How to fix: rename the symbol for what it is in the domain (`UserRecord`,
 * `SignupForm`).
 */

const FORBIDDEN = 'shape';

const isBorrowedMemberName = (node: TSESTree.Node): boolean => {
  const parent: TSESTree.Node | undefined = node.parent;
  return (
    parent?.type === AST_NODE_TYPES.MemberExpression &&
    parent.property === node &&
    !parent.computed
  );
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the case-insensitive substring "shape" in JavaScript, TypeScript, private, and JSX symbol names.',
    },
    schema: [],
    messages: {
      forbiddenSymbolName:
        'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
    },
  },
  create(context) {
    const check = (
      node:
        | TSESTree.Identifier
        | TSESTree.JSXIdentifier
        | TSESTree.PrivateIdentifier,
    ): void => {
      if (
        node.name.toLowerCase().includes(FORBIDDEN) &&
        !isBorrowedMemberName(node)
      ) {
        report(context, node, 'forbiddenSymbolName', { name: node.name });
      }
    };
    return {
      Identifier: check,
      PrivateIdentifier: check,
      JSXIdentifier: check,
    };
  },
});
