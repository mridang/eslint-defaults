import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  childNodes,
  defineRule,
  report,
  rootIdentifierName,
  visitorKeys,
} from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';

/**
 * `tslop/no-call-only-assertions`: a test must assert more than "was called".
 *
 * What it flags: an `it`/`test` whose every `expect` assertion is a bare call
 * check (`toHaveBeenCalled`, `toHaveBeenCalledTimes`, `toHaveBeenCalledOnce`,
 * `toBeCalled`, `toBeCalledTimes`). `toHaveBeenCalledWith` is fine because it
 * checks real data, and a `node:assert` call counts as a real assertion.
 *
 * Why: a test that only proves a mock ran checks the orchestration, not the
 * behavior, and it breaks on every refactor without catching a bug.
 *
 * How to fix: first ask whether the test is worth having. If it is, assert on
 * the returned value, the resulting state or the arguments of the call.
 */

const CALL_ONLY = new Set([
  'toHaveBeenCalled',
  'toHaveBeenCalledTimes',
  'toHaveBeenCalledOnce',
  'toBeCalled',
  'toBeCalledTimes',
]);
const TEST_NAMES = new Set(['it', 'test']);
const MODIFIERS = new Set(['not', 'resolves', 'rejects']);

const isTestCall = (node: TSESTree.CallExpression): boolean => {
  const name = rootIdentifierName(node.callee);
  if (name === undefined || !TEST_NAMES.has(name)) {
    return false;
  }
  const callback = node.arguments.at(-1);
  return (
    callback?.type === AST_NODE_TYPES.FunctionExpression ||
    callback?.type === AST_NODE_TYPES.ArrowFunctionExpression
  );
};

/** Strips `.not`, `.resolves` and `.rejects` to reach what `expect(...)` returned. */
const stripModifiers = (object: TSESTree.Node): TSESTree.Node => {
  const name =
    object.type === AST_NODE_TYPES.MemberExpression &&
    !object.computed &&
    object.property.type === AST_NODE_TYPES.Identifier
      ? object.property.name
      : undefined;
  return object.type === AST_NODE_TYPES.MemberExpression &&
    name !== undefined &&
    MODIFIERS.has(name)
    ? stripModifiers(object.object)
    : object;
};

const matcherName = (node: TSESTree.CallExpression): string | undefined => {
  const callee = node.callee;
  if (
    callee.type !== AST_NODE_TYPES.MemberExpression ||
    callee.computed ||
    callee.property.type !== AST_NODE_TYPES.Identifier
  ) {
    return undefined;
  }
  const object = stripModifiers(callee.object);
  const isExpect =
    object.type === AST_NODE_TYPES.CallExpression &&
    rootIdentifierName(object.callee) === 'expect';
  return isExpect ? callee.property.name : undefined;
};

/** The base of `assert.strict.equal`: the object under every plain `.name`. */
const memberBase = (node: TSESTree.Node): TSESTree.Node =>
  node.type === AST_NODE_TYPES.MemberExpression &&
  !node.computed &&
  node.property.type === AST_NODE_TYPES.Identifier
    ? memberBase(node.object)
    : node;

/** `assert(...)`, `assert.equal(...)`, `assert.strict.equal(...)`. */
const isAssertCall = (node: TSESTree.CallExpression): boolean => {
  const callee = memberBase(node.callee);
  return callee.type === AST_NODE_TYPES.Identifier && callee.name === 'assert';
};

/**
 * What one call contributes to the test around it: nothing for a call that is
 * not an assertion, `false` for a real assertion and `true` for a bare call check.
 */
const assertionOf = (node: TSESTree.CallExpression): boolean[] => {
  if (isAssertCall(node)) {
    return [false];
  }
  const matcher = matcherName(node);
  return matcher === undefined ? [] : [CALL_ONLY.has(matcher)];
};

/** Every assertion of one test, leaving out the tests nested inside it. */
const assertionsWithin = (
  node: TSESTree.Node,
  keys: Readonly<Record<string, readonly string[]>>,
  isRoot: boolean,
): boolean[] => {
  if (node.type !== AST_NODE_TYPES.CallExpression) {
    return childNodes(node, keys).flatMap((child) =>
      assertionsWithin(child, keys, false),
    );
  }
  if (isTestCall(node)) {
    return isRoot
      ? childNodes(node, keys).flatMap((child) =>
          assertionsWithin(child, keys, false),
        )
      : [];
  }
  return [
    ...assertionOf(node),
    ...childNodes(node, keys).flatMap((child) =>
      assertionsWithin(child, keys, false),
    ),
  ];
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Tests must assert on behavior, not only that a mock was called',
    },
    schema: [],
    messages: {
      callOnlyAssertions:
        'Every assertion in this test only checks that a mock was called. First check whether this is a valuable test; remove it if not. Otherwise, assert on returned values, state, or call arguments instead.',
    },
  },
  create(context) {
    const keys = visitorKeys(context);
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (!isTestCall(node)) {
          return;
        }
        const assertions = assertionsWithin(node, keys, true);
        if (assertions.length > 0 && assertions.every(Boolean)) {
          report(context, node.callee, 'callOnlyAssertions');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
