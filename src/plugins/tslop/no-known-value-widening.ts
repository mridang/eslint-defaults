import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  classifyUnsafeDictionaryValue,
  classifyWideningTarget,
  createTypeEnvironment,
  isKnownEvidenceExpression,
} from './shared/dictionary-types.js';
import {
  containsUnknownType,
  functionParameterBindingName,
  functionParameterTypeAnnotation,
} from './shared/function-parameters.js';
import {
  defineRule,
  definitionNode,
  report,
  resolveVariable,
  textOf,
  unwrapExpression,
  visitorKeys,
  programOf,
} from './shared/rule.js';
import type {
  TypeEnvironment,
  WideningTarget,
} from './shared/dictionary-types.js';
import type { FunctionNode } from './shared/rule.js';
import type { Rule, Scope } from 'eslint';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-known-value-widening`: do not annotate a known value with a broad
 * type.
 *
 * What it flags: a value whose type the code already establishes (an object, an
 * array, a literal, a function, `new X()`, or a `const` that holds one) flowing
 * into an explicit `unknown`, `object`, open dictionary (`Record<string, X>`,
 * an index signature), anonymous object type or generic container. The flows it
 * checks are variable and property initializers, assignments, `return`
 * statements and arrow bodies with a return type, `as` assertions, and the
 * argument of a call to a local type guard whose parameter is `unknown`. An
 * empty `{}` that starts a dictionary is allowed.
 *
 * Why: the annotation throws away what the compiler knew, and later code has to
 * rebuild it with casts.
 *
 * How to fix: drop the annotation and keep the inferred type, use `satisfies`
 * to check the value against a contract without widening it, or use the named
 * type of the data's owner.
 */

const unwrap = (node: TSESTree.Node): TSESTree.Node => unwrapExpression(node);

const variableDeclarator = (
  variable: Scope.Variable,
): TSESTree.VariableDeclarator | null => {
  if (variable.defs.length !== 1) {
    return null;
  }
  const definition = variable.defs.at(0);
  const node = definition === undefined ? null : definitionNode(definition);
  return definition?.type === 'Variable' &&
    node?.type === AST_NODE_TYPES.VariableDeclarator
    ? node
    : null;
};

const isStableConst = (
  variable: Scope.Variable,
  declarator: TSESTree.VariableDeclarator,
): boolean =>
  declarator.parent.kind === 'const' &&
  variable.references.every(
    (reference) => reference.init || !reference.isWrite(),
  );

const hasKnownEvidence = (
  context: Rule.RuleContext,
  expression: TSESTree.Node,
  visited = new Set<Scope.Variable>(),
): boolean => {
  if (isKnownEvidenceExpression(expression)) {
    return true;
  }
  const unwrapped = unwrap(expression);
  if (unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }
  const variable = resolveVariable(context, unwrapped);
  if (variable === null || visited.has(variable)) {
    return false;
  }
  const declarator = variableDeclarator(variable);
  const init = declarator?.init;
  if (
    declarator === null ||
    init === null ||
    init === undefined ||
    !isStableConst(variable, declarator)
  ) {
    return false;
  }
  return hasKnownEvidence(context, init, new Set([...visited, variable]));
};

const FUNCTION_NODE_TYPES = new Set<string>([
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
  AST_NODE_TYPES.TSDeclareFunction,
  AST_NODE_TYPES.TSEmptyBodyFunctionExpression,
]);

const isFunctionNode = (node: TSESTree.Node): node is FunctionNode =>
  FUNCTION_NODE_TYPES.has(node.type);

const localFunctionForCall = (
  context: Rule.RuleContext,
  callee: TSESTree.Node,
): FunctionNode | null => {
  const unwrapped = unwrap(callee);
  if (isFunctionNode(unwrapped)) {
    return unwrapped;
  }
  if (unwrapped.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  const variable = resolveVariable(context, unwrapped);
  if (variable?.defs.length !== 1) {
    return null;
  }
  const definition = variable.defs.at(0);
  if (definition === undefined) {
    return null;
  }
  const node = definitionNode(definition);
  if (definition.type === 'FunctionName' && isFunctionNode(node)) {
    return node;
  }
  if (
    definition.type !== 'Variable' ||
    node.type !== AST_NODE_TYPES.VariableDeclarator
  ) {
    return null;
  }
  const initializer = node.init === null ? null : unwrap(node.init);
  return initializer !== null && isFunctionNode(initializer)
    ? initializer
    : null;
};

const variableTypeAnnotation = (
  context: Rule.RuleContext,
  variable: Scope.Variable,
): TSESTree.TSTypeAnnotation | null => {
  if (variable.defs.length !== 1) {
    return null;
  }
  const definition = variable.defs.at(0);
  if (definition === undefined) {
    return null;
  }
  const node = definitionNode(definition);
  if (
    definition.type === 'Variable' &&
    node.type === AST_NODE_TYPES.VariableDeclarator &&
    node.id.type === AST_NODE_TYPES.Identifier
  ) {
    return node.id.typeAnnotation ?? null;
  }
  if (definition.type !== 'Parameter' || !isFunctionNode(node)) {
    return null;
  }
  const parameter = node.params.find(
    (candidate) =>
      functionParameterBindingName(candidate, context) === variable.name,
  );
  return parameter === undefined
    ? null
    : (functionParameterTypeAnnotation(parameter) ?? null);
};

const hasInformativeType = (
  type: TSESTree.TypeNode,
  environment: TypeEnvironment,
): boolean => classifyUnsafeDictionaryValue(type, environment) === null;

const hasKnownCallArgumentEvidence = (
  context: Rule.RuleContext,
  expression: TSESTree.Node,
  environment: TypeEnvironment,
  visited = new Set<Scope.Variable>(),
): boolean => {
  if (
    expression.type === AST_NODE_TYPES.TSNonNullExpression ||
    expression.type === AST_NODE_TYPES.TSSatisfiesExpression
  ) {
    return hasKnownCallArgumentEvidence(
      context,
      expression.expression,
      environment,
      visited,
    );
  }
  if (
    expression.type === AST_NODE_TYPES.TSAsExpression ||
    expression.type === AST_NODE_TYPES.TSTypeAssertion
  ) {
    return hasInformativeType(expression.typeAnnotation, environment);
  }
  if (expression.type === AST_NODE_TYPES.CallExpression) {
    const owner = localFunctionForCall(context, expression.callee);
    const returnType = owner?.returnType?.typeAnnotation;
    return (
      returnType !== undefined && hasInformativeType(returnType, environment)
    );
  }
  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return isKnownEvidenceExpression(expression);
  }
  const variable = resolveVariable(context, expression);
  if (variable === null || visited.has(variable)) {
    return false;
  }
  const annotation = variableTypeAnnotation(context, variable);
  if (annotation !== null) {
    return hasInformativeType(annotation.typeAnnotation, environment);
  }
  const declarator = variableDeclarator(variable);
  const init = declarator?.init;
  if (
    declarator === null ||
    init === null ||
    init === undefined ||
    !isStableConst(variable, declarator)
  ) {
    return false;
  }
  return hasKnownCallArgumentEvidence(
    context,
    init,
    environment,
    new Set([...visited, variable]),
  );
};

const typePredicateSubjectIndex = (
  context: Rule.RuleContext,
  owner: FunctionNode,
): number | null => {
  const predicate = owner.returnType?.typeAnnotation;
  if (
    predicate?.type !== AST_NODE_TYPES.TSTypePredicate ||
    predicate.parameterName.type !== AST_NODE_TYPES.Identifier
  ) {
    return null;
  }
  const subject = predicate.parameterName.name;
  const index = owner.params.findIndex(
    (parameter) => functionParameterBindingName(parameter, context) === subject,
  );
  return index === -1 ? null : index;
};

const annotationTarget = (
  annotation: TSESTree.TSTypeAnnotation | null | undefined,
  environment: TypeEnvironment,
): WideningTarget | null =>
  annotation === null || annotation === undefined
    ? null
    : classifyWideningTarget(annotation.typeAnnotation, environment);

const NAMED_FUNCTION_TYPES = new Set<string>([
  AST_NODE_TYPES.ArrowFunctionExpression,
  AST_NODE_TYPES.FunctionDeclaration,
  AST_NODE_TYPES.FunctionExpression,
]);

const functionAbove = (
  current: TSESTree.Node | null | undefined,
): FunctionNode | null => {
  if (
    current === null ||
    current === undefined ||
    current.type === AST_NODE_TYPES.Program
  ) {
    return null;
  }
  return NAMED_FUNCTION_TYPES.has(current.type) && isFunctionNode(current)
    ? current
    : functionAbove(current.parent);
};

const enclosingFunction = (node: TSESTree.Node): FunctionNode | null =>
  functionAbove(node.parent);

const keyName = (context: Rule.RuleContext, key: TSESTree.Node): string => {
  if (
    key.type === AST_NODE_TYPES.Identifier ||
    key.type === AST_NODE_TYPES.PrivateIdentifier
  ) {
    return key.name;
  }
  if (key.type === AST_NODE_TYPES.Literal) {
    return String(key.value);
  }
  return textOf(context, key);
};

const functionName = (
  context: Rule.RuleContext,
  owner: FunctionNode | null,
): string => {
  if (owner === null) {
    return 'anonymous function';
  }
  if (owner.id !== null) {
    return owner.id.name;
  }
  const parent = owner.parent;
  if (
    parent.type === AST_NODE_TYPES.VariableDeclarator &&
    parent.id.type === AST_NODE_TYPES.Identifier
  ) {
    return parent.id.name;
  }
  if (parent.type === AST_NODE_TYPES.MethodDefinition) {
    return keyName(context, parent.key);
  }
  return 'anonymous function';
};

const isEmptyObject = (expression: TSESTree.Node): boolean => {
  const unwrapped = unwrap(expression);
  return (
    unwrapped.type === AST_NODE_TYPES.ObjectExpression &&
    unwrapped.properties.length === 0
  );
};

const isDictionaryTarget = (target: WideningTarget): boolean =>
  target.kind === 'open dictionary' || target.kind === 'generic container';

const hasParentAssertion = (node: TSESTree.Node): boolean =>
  node.parent?.type === AST_NODE_TYPES.TSAsExpression ||
  node.parent?.type === AST_NODE_TYPES.TSTypeAssertion;

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow syntactically established values from flowing into explicitly broad or anonymous target types that discard useful evidence.',
    },
    schema: [],
    messages: {
      widening:
        'The explicit {{target}} type on {{subject}} discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract.',
    },
  },
  create(context) {
    const environment: TypeEnvironment = createTypeEnvironment(
      programOf(context),
      visitorKeys(context),
    );

    const reportFlow = (
      expression: TSESTree.Node,
      destination: WideningTarget | null,
      subject: string,
    ): void => {
      if (destination === null) {
        return;
      }
      if (isDictionaryTarget(destination) && isEmptyObject(expression)) {
        return;
      }
      if (!hasKnownEvidence(context, expression)) {
        return;
      }
      report(context, expression, 'widening', {
        subject,
        target: destination.kind,
      });
    };

    const target = (
      annotation: TSESTree.TSTypeAnnotation | null | undefined,
    ): WideningTarget | null => annotationTarget(annotation, environment);

    const assertion = (
      node: TSESTree.TSAsExpression | TSESTree.TSTypeAssertion,
    ): void => {
      if (hasParentAssertion(node)) {
        return;
      }
      reportFlow(
        node.expression,
        classifyWideningTarget(node.typeAnnotation, environment),
        'assertion',
      );
    };

    const property = (
      node: TSESTree.PropertyDefinition | TSESTree.AccessorProperty,
    ): void => {
      if (node.value === null) {
        return;
      }
      reportFlow(
        node.value,
        target(node.typeAnnotation),
        `property \`${keyName(context, node.key)}\``,
      );
    };

    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      VariableDeclarator(node: TSESTree.VariableDeclarator) {
        if (node.init === null || node.id.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        reportFlow(
          node.init,
          target(node.id.typeAnnotation),
          `binding \`${node.id.name}\``,
        );
      },
      PropertyDefinition: property,
      AccessorProperty: property,
      AssignmentExpression(node: TSESTree.AssignmentExpression) {
        if (
          node.operator !== '=' ||
          node.left.type !== AST_NODE_TYPES.Identifier
        ) {
          return;
        }
        const variable = resolveVariable(context, node.left);
        const declarator =
          variable === null ? null : variableDeclarator(variable);
        if (declarator?.id.type !== AST_NODE_TYPES.Identifier) {
          return;
        }
        reportFlow(
          node.right,
          target(declarator.id.typeAnnotation),
          `binding \`${declarator.id.name}\``,
        );
      },
      CallExpression(node: TSESTree.CallExpression) {
        const owner = localFunctionForCall(context, node.callee);
        if (owner === null) {
          return;
        }
        const index = typePredicateSubjectIndex(context, owner);
        if (index === null) {
          return;
        }
        const parameter = owner.params.at(index);
        const argument = node.arguments.at(index);
        if (
          parameter === undefined ||
          argument === undefined ||
          argument.type === AST_NODE_TYPES.SpreadElement
        ) {
          return;
        }
        const annotation = functionParameterTypeAnnotation(parameter);
        if (
          annotation === undefined ||
          !containsUnknownType(annotation.typeAnnotation) ||
          !hasKnownCallArgumentEvidence(context, argument, environment)
        ) {
          return;
        }
        const parameterName = functionParameterBindingName(parameter, context);
        report(context, argument, 'widening', {
          subject: `argument for parameter \`${parameterName}\` of \`${functionName(context, owner)}\``,
          target: 'unknown',
        });
      },
      ReturnStatement(node: TSESTree.ReturnStatement) {
        if (node.argument === null) {
          return;
        }
        const owner = enclosingFunction(node);
        reportFlow(
          node.argument,
          target(owner?.returnType),
          `return value of \`${functionName(context, owner)}\``,
        );
      },
      ArrowFunctionExpression(node: TSESTree.ArrowFunctionExpression) {
        if (node.body.type === AST_NODE_TYPES.BlockStatement) {
          return;
        }
        reportFlow(
          node.body,
          target(node.returnType),
          `return value of \`${functionName(context, node)}\``,
        );
      },
      TSAsExpression: assertion,
      TSTypeAssertion: assertion,
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
