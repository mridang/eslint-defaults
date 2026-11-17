import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  createTypeAliasEnvironment,
  resolvedTypeMatches,
} from './shared/type-alias-resolution.js';
import {
  defineRule,
  onParameterOwners,
  programOf,
  report,
  visitorKeys,
} from './shared/rule.js';
import type { ParameterOwner } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-unknown-returns`: no function that is declared to return
 * `unknown`.
 *
 * What it flags: an explicit return type that is `unknown`, a union holding
 * `unknown`, `Promise<unknown>` or `PromiseLike<unknown>`, also through local
 * aliases.
 *
 * Why: a function that hands `unknown` to its caller pushes the parsing work to
 * every call site, and each of them tends to answer it with a cast.
 *
 * How to fix: parse the value inside the function and return a named domain
 * type.
 */
export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow functions whose explicit return contract is unknown or Promise<unknown>.',
    },
    schema: [],
    messages: {
      unknownReturn:
        'This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.',
    },
  },
  create(context) {
    const resolvesToUnknown = (type: TSESTree.TypeNode): boolean =>
      resolvedTypeMatches(
        type,
        createTypeAliasEnvironment(programOf(context), visitorKeys(context)),
        (resolved, matches) => {
          if (resolved.type === AST_NODE_TYPES.TSUnknownKeyword) {
            return true;
          }
          if (resolved.type === AST_NODE_TYPES.TSUnionType) {
            return resolved.types.some((member) => matches(member));
          }
          if (
            resolved.type !== AST_NODE_TYPES.TSTypeReference ||
            resolved.typeName.type !== AST_NODE_TYPES.Identifier ||
            (resolved.typeName.name !== 'Promise' &&
              resolved.typeName.name !== 'PromiseLike')
          ) {
            return false;
          }
          const value = resolved.typeArguments?.params[0];
          return value !== undefined && matches(value);
        },
      );

    const check = (node: ParameterOwner): void => {
      const annotation = node.returnType;
      if (
        annotation !== undefined &&
        resolvesToUnknown(annotation.typeAnnotation)
      ) {
        report(context, annotation.typeAnnotation, 'unknownReturn');
      }
    };

    return onParameterOwners(check);
  },
});
