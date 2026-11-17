import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  containsUnknownType,
  functionParameterBindingName,
  functionParameterTypeAnnotation,
} from './shared/function-parameters.js';
import { defineRule, onParameterOwners, report } from './shared/rule.js';
import type { ParameterOwner } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-unknown-parameters`: no parameter typed `unknown`.
 *
 * What it flags: a function, method or signature parameter whose annotation is
 * `unknown` or a union that holds it. Three cases are allowed on purpose:
 * a parameter named `cause` (error enrichment), the subject of a type
 * predicate (`(value: unknown): value is User`), and the callback of
 * `.catch(...)` or the rejection callback of `.then(_, ...)`, where
 * `@typescript-eslint/use-unknown-in-catch-callback-variable` demands `unknown`.
 *
 * Why: an `unknown` input moves the parsing into the function body, where it is
 * repeated and often skipped.
 *
 * How to fix: accept a named domain type, and run the schema or parser at the
 * I/O boundary before calling this function. For a type guard, name the
 * predicate subject.
 */

const isTypePredicateSubject = (
  owner: ParameterOwner,
  name: string,
): boolean => {
  const predicate = owner.returnType?.typeAnnotation;
  return (
    predicate?.type === AST_NODE_TYPES.TSTypePredicate &&
    predicate.parameterName.type === AST_NODE_TYPES.Identifier &&
    predicate.parameterName.name === name
  );
};

/** A function that is the rejection callback of a promise. */
const isSameNode = (left: TSESTree.Node, right: TSESTree.Node): boolean =>
  left === right;

const isRejectionCallback = (owner: ParameterOwner): boolean => {
  const call = owner.parent;
  if (
    call.type !== AST_NODE_TYPES.CallExpression ||
    call.callee.type !== AST_NODE_TYPES.MemberExpression ||
    call.callee.computed ||
    call.callee.property.type !== AST_NODE_TYPES.Identifier
  ) {
    return false;
  }
  const method = call.callee.property.name;
  return (
    (method === 'catch' && isSameNode(call.arguments[0], owner)) ||
    (method === 'then' && isSameNode(call.arguments[1], owner))
  );
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow explicitly unknown function parameters except `cause`, type-predicate subjects and promise rejection callbacks; decode unknown input at its I/O boundary instead.',
    },
    schema: [],
    messages: {
      unknownParameter:
        'Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.',
    },
  },
  create(context) {
    const check = (node: ParameterOwner): void => {
      if (isRejectionCallback(node)) {
        return;
      }
      const unknownParameters = node.params.flatMap((parameter) => {
        const annotation = functionParameterTypeAnnotation(parameter);
        if (
          annotation === undefined ||
          !containsUnknownType(annotation.typeAnnotation)
        ) {
          return [];
        }
        const name = functionParameterBindingName(parameter, context);
        return name === 'cause' || isTypePredicateSubject(node, name)
          ? []
          : [{ type: annotation.typeAnnotation, name }];
      });
      // eslint-disable-next-line functional/no-loop-statements -- reporting is a side effect per parameter, and unicorn/no-array-for-each forbids forEach
      for (const { type, name } of unknownParameters) {
        report(context, type, 'unknownParameter', { parameter: name });
      }
    };
    return onParameterOwners(check);
  },
});
