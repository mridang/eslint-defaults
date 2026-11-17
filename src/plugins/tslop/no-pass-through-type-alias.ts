import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { defineRule, report } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-pass-through-type-alias`: no alias that only renames a type.
 *
 * What it flags: `type A = B`, `type A<T> = B<T>` and `type A = ns.B`, where the
 * alias adds nothing but a second name (type parameters are forwarded one to
 * one, in order).
 *
 * Why: two names for one type make a reader look up both and wonder whether
 * they differ, and they drift when one of them changes.
 *
 * How to fix: use the original type directly. If the alias carries a domain
 * meaning (a branded or narrowed type), make it do so.
 */

const typeNameText = (node: TSESTree.Node): string | null => {
  if (node.type === AST_NODE_TYPES.Identifier) {
    return node.name;
  }
  if (node.type !== AST_NODE_TYPES.TSQualifiedName) {
    return null;
  }
  const left = typeNameText(node.left);
  return left === null ? null : `${left}.${node.right.name}`;
};

const isForwarded = (
  argument: TSESTree.TypeNode | undefined,
  parameter: TSESTree.TSTypeParameter,
): boolean =>
  argument?.type === AST_NODE_TYPES.TSTypeReference &&
  argument.typeName.type === AST_NODE_TYPES.Identifier &&
  argument.typeName.name === parameter.name.name &&
  argument.typeArguments === undefined;

const passThroughTarget = (
  node: TSESTree.TSTypeAliasDeclaration,
): string | null => {
  const annotation = node.typeAnnotation;
  if (annotation.type !== AST_NODE_TYPES.TSTypeReference) {
    return null;
  }
  const name = typeNameText(annotation.typeName);
  if (name === null) {
    return null;
  }
  const parameters = node.typeParameters?.params ?? [];
  const forwarded = annotation.typeArguments?.params ?? [];
  const isPassThrough =
    parameters.length === forwarded.length &&
    parameters.every((parameter, index) =>
      isForwarded(forwarded[index], parameter),
    );
  return isPassThrough ? name : null;
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow type aliases that only rename another type',
    },
    schema: [],
    messages: {
      passThroughAlias:
        'Use {{typeName}} directly instead of creating a pass-through type alias.',
    },
  },
  create(context) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      TSTypeAliasDeclaration(node: TSESTree.TSTypeAliasDeclaration) {
        const typeName = passThroughTarget(node);
        if (typeName !== null) {
          report(context, node, 'passThroughAlias', { typeName });
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
