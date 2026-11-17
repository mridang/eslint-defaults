import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  functionParameterBindingName,
  functionParameterTypeAnnotation,
} from './shared/function-parameters.js';
import {
  createTypeAliasEnvironment,
  resolvedTypeMatches,
} from './shared/type-alias-resolution.js';
import {
  defineRule,
  onParameterOwners,
  report,
  visitorKeys,
} from './shared/rule.js';
import type { TypeAliasEnvironment } from './shared/type-alias-resolution.js';
import type { ParameterOwner } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-object-parameters`: no parameter typed `object`.
 *
 * What it flags: a function, method or signature parameter whose annotation is
 * `object` (or a union with `object`), also through local aliases.
 *
 * Why: `object` accepts any non-primitive value (arrays, dates, functions) and
 * promises nothing about it, so the body ends up casting or probing it.
 *
 * How to fix: accept a named type that the owner of the data provides, and
 * parse external input at its boundary before calling the function.
 */
export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow object function parameters; inputs must use an owner-provided type and be parsed at their boundary.',
    },
    schema: [],
    messages: {
      objectParameter:
        'Parameter `{{parameter}}` uses the broad `object` type. Accept a named owner type; parse external input at its boundary before calling this function.',
    },
  },
  create(context) {
    const environment: TypeAliasEnvironment = createTypeAliasEnvironment(
      context.sourceCode.ast as unknown as TSESTree.Program,
      visitorKeys(context),
    );

    const resolvesToObject = (type: TSESTree.TypeNode): boolean =>
      resolvedTypeMatches(type, environment, (resolved, matches) => {
        if (resolved.type === AST_NODE_TYPES.TSObjectKeyword) {
          return true;
        }
        return (
          resolved.type === AST_NODE_TYPES.TSUnionType &&
          resolved.types.some((member) => matches(member))
        );
      });

    const check = (node: ParameterOwner): void => {
      const flagged = node.params.flatMap((parameter) => {
        const annotation = functionParameterTypeAnnotation(parameter);
        return annotation !== undefined &&
          resolvesToObject(annotation.typeAnnotation)
          ? [{ parameter, annotation }]
          : [];
      });
      // eslint-disable-next-line functional/no-loop-statements -- reporting is a side effect per finding, and neither forEach nor map-for-effect is allowed
      for (const { parameter, annotation } of flagged) {
        report(context, annotation.typeAnnotation, 'objectParameter', {
          parameter: functionParameterBindingName(parameter, context),
        });
      }
    };

    return onParameterOwners(check);
  },
});
