import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { textOf } from './rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/** A parameter, or a pattern nested inside one. */
type ParameterLike = TSESTree.DestructuringPattern | TSESTree.Parameter;

/** Whether a type is, or is a union that contains, the `unknown` top type. */
export function containsUnknownType(type: TSESTree.TypeNode): boolean {
  if (type.type === AST_NODE_TYPES.TSUnknownKeyword) {
    return true;
  }
  return (
    type.type === AST_NODE_TYPES.TSUnionType &&
    type.types.some((member) => containsUnknownType(member))
  );
}

/** The annotation of a parameter, or of the binding it wraps. */
export function functionParameterTypeAnnotation(
  parameter: ParameterLike,
): TSESTree.TSTypeAnnotation | undefined {
  if (parameter.type === AST_NODE_TYPES.TSParameterProperty) {
    return functionParameterTypeAnnotation(parameter.parameter);
  }
  if (parameter.type === AST_NODE_TYPES.RestElement) {
    return (
      parameter.typeAnnotation ??
      functionParameterTypeAnnotation(parameter.argument)
    );
  }
  if (parameter.type === AST_NODE_TYPES.AssignmentPattern) {
    return (
      parameter.typeAnnotation ??
      functionParameterTypeAnnotation(parameter.left)
    );
  }
  return 'typeAnnotation' in parameter ? parameter.typeAnnotation : undefined;
}

/** The local binding of a parameter, without its annotation or default. */
export function functionParameterBindingName(
  parameter: ParameterLike,
  context: Rule.RuleContext,
): string {
  if (parameter.type === AST_NODE_TYPES.TSParameterProperty) {
    return functionParameterBindingName(parameter.parameter, context);
  }
  if (parameter.type === AST_NODE_TYPES.AssignmentPattern) {
    return functionParameterBindingName(parameter.left, context);
  }
  if (parameter.type === AST_NODE_TYPES.RestElement) {
    return functionParameterBindingName(parameter.argument, context);
  }
  if (parameter.type === AST_NODE_TYPES.Identifier) {
    return parameter.name;
  }
  const text = textOf(context, parameter);
  const annotation =
    'typeAnnotation' in parameter ? parameter.typeAnnotation : undefined;
  return annotation === undefined
    ? text
    : text.slice(0, annotation.range[0] - parameter.range[0]).trimEnd();
}
