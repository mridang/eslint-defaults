import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  arrayMethodTarget,
  constInitializer,
  isKnownArrayExpression,
  isNeverReassigned,
  resolveArrayBinding,
} from './shared/array-method.js';
import { defineRule, report, unwrapExpression } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule, Scope } from 'eslint';

/**
 * `tslop/no-reduce-accumulator-copy`: do not copy the accumulator of a reducer.
 *
 * What it flags: inside a `reduce`/`reduceRight` callback, a copy of the
 * accumulator made with `Object.assign({}, acc, ...)`, `Array.from(acc)` or an
 * array method that returns a copy (`acc.concat(...)`, `acc.slice()`,
 * `acc.toSorted()`, `acc.with(...)`) when the initial value is an array. The
 * spread form (`{ ...acc }`) is left to the core rule `no-accumulating-spread`.
 *
 * Why: copying a growing accumulator on every step makes the loop quadratic.
 *
 * How to fix: mutate a fresh accumulator that only this reducer owns and return
 * it, or build the result with a `for...of` loop, an iterator pipeline or
 * `flatMap`.
 */

interface Reducer {
  callback: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression;
  accumulator: TSESTree.Identifier;
  initialValue: TSESTree.CallExpressionArgument | undefined;
}

const REDUCE_METHODS = new Set(['reduce', 'reduceRight']);

/** The node that holds a callback once wrapping expressions are looked through. */
const outerOwner = (
  callback: TSESTree.Node,
  owner: TSESTree.Node | null,
): TSESTree.Node | null =>
  owner !== null && unwrapExpression(owner) === callback
    ? outerOwner(callback, owner.parent ?? null)
    : owner;

const reducerOfCallback = (
  reducerFunction:
    TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
): Reducer | null => {
  const owner = outerOwner(reducerFunction, reducerFunction.parent ?? null);
  if (owner?.type !== AST_NODE_TYPES.CallExpression) {
    return null;
  }
  const method = arrayMethodTarget(owner.callee);
  if (
    method === null ||
    !REDUCE_METHODS.has(method.name) ||
    owner.arguments.length > 2
  ) {
    return null;
  }
  const first = owner.arguments.at(0);
  if (first === undefined || unwrapExpression(first) !== reducerFunction) {
    return null;
  }
  const firstParameter = reducerFunction.params[0];
  const accumulator =
    firstParameter?.type === AST_NODE_TYPES.AssignmentPattern
      ? firstParameter.left
      : firstParameter;
  if (accumulator?.type !== AST_NODE_TYPES.Identifier) {
    return null;
  }
  return {
    callback: reducerFunction,
    accumulator,
    initialValue: owner.arguments[1],
  };
};

const enclosingReducer = (node: TSESTree.Node): Reducer | null => {
  const parent = node.parent ?? null;
  if (parent === null || parent.type === AST_NODE_TYPES.FunctionDeclaration) {
    return null;
  }
  if (
    parent.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    parent.type === AST_NODE_TYPES.FunctionExpression
  ) {
    return reducerOfCallback(parent);
  }
  return enclosingReducer(parent);
};

const referencesAccumulator = (
  context: Rule.RuleContext,
  node: TSESTree.Node,
  accumulator: Scope.Variable,
  visited: ReadonlySet<Scope.Variable> = new Set<Scope.Variable>(),
): boolean => {
  const variable = resolveArrayBinding(context, node);
  if (variable === null || visited.has(variable)) {
    return false;
  }
  if (variable === accumulator) {
    return true;
  }
  if (!isNeverReassigned(variable)) {
    return false;
  }
  const initializer = constInitializer(variable);
  return (
    initializer !== null &&
    referencesAccumulator(
      context,
      initializer,
      accumulator,
      new Set([...visited, variable]),
    )
  );
};

const isGlobalOwner = (
  context: Rule.RuleContext,
  node: TSESTree.Node,
  name: string,
): boolean => {
  const unwrapped = unwrapExpression(node);
  if (unwrapped.type !== AST_NODE_TYPES.Identifier || unwrapped.name !== name) {
    return false;
  }
  const variable = resolveArrayBinding(context, unwrapped);
  return variable === null || variable.defs.length === 0;
};

const COPYING_METHODS = new Set([
  'concat',
  'slice',
  'toSpliced',
  'toSorted',
  'toReversed',
  'with',
]);

/** Whether a call copies the accumulator of the reducer it sits in. */
const copiesAccumulator = (
  context: Rule.RuleContext,
  node: TSESTree.CallExpression,
  method: { readonly name: string; readonly object: TSESTree.Node },
  reducer: Reducer,
  isAccumulator: (expression: TSESTree.Node) => boolean,
): boolean => {
  if (
    method.name === 'assign' &&
    isGlobalOwner(context, method.object, 'Object')
  ) {
    const target = node.arguments.at(0);
    return (
      target !== undefined &&
      unwrapExpression(target).type === AST_NODE_TYPES.ObjectExpression &&
      node.arguments.slice(1).some((argument) => isAccumulator(argument))
    );
  }
  if (
    method.name === 'from' &&
    isGlobalOwner(context, method.object, 'Array')
  ) {
    const source = node.arguments.at(0);
    return source !== undefined && isAccumulator(source);
  }
  if (!COPYING_METHODS.has(method.name)) {
    return false;
  }
  const initial = reducer.initialValue;
  return (
    initial !== undefined &&
    isKnownArrayExpression(context, initial) &&
    isAccumulator(method.object)
  );
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow copying growing reducer accumulators with Object.assign, Array.from, or array copy methods.',
    },
    schema: [],
    messages: {
      accumulatorCopy:
        'Do not copy the reducer accumulator on every iteration; growing copies can cause quadratic work. Mutate a fresh, locally owned accumulator and return it, or use an iterator pipeline/flatMap.',
    },
  },
  create(context) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      CallExpression(node: TSESTree.CallExpression) {
        const method = arrayMethodTarget(node.callee);
        if (method === null) {
          return;
        }
        const reducer = enclosingReducer(node);
        if (reducer === null) {
          return;
        }
        const accumulator = context.sourceCode
          .getDeclaredVariables(reducer.callback as unknown as Rule.Node)
          .find((variable) =>
            variable.identifiers.some(
              (identifier) =>
                identifier.range?.[0] === reducer.accumulator.range[0],
            ),
          );
        if (accumulator === undefined) {
          return;
        }
        const isAccumulator = (expression: TSESTree.Node): boolean =>
          referencesAccumulator(context, expression, accumulator);
        const copies = copiesAccumulator(
          context,
          node,
          method,
          reducer,
          isAccumulator,
        );
        if (copies) {
          report(context, node, 'accumulatorCopy');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
