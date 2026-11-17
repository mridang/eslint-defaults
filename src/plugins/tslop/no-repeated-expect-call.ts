import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  defineRule,
  definitionNode,
  definitionParent,
  isTestFile,
  report,
  resolveVariable,
  textOf,
} from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { AST, Rule } from 'eslint';

/**
 * `tslop/no-repeated-expect-call`: call once, assert many times.
 *
 * What it flags: two adjacent statements of the form `expect(call(...))...`
 * (also with `await`) in a test file where both wrap the same call. Two calls
 * are the same when their source is the same, ignoring trailing commas.
 *
 * Why: the second call runs the code again, so a test with side effects or a
 * changing result asserts on two different things, and the repetition hides
 * which assertion belongs to which call.
 *
 * How to fix: call once, keep the result in a variable and assert on it.
 */

const TEST_MODULES = new Set(['bun:test', '@jest/globals', 'vitest']);
const CLOSING = new Set([')', ']', '}']);

const isExpectSpecifier = (node: TSESTree.Node): boolean =>
  node.type === AST_NODE_TYPES.ImportSpecifier &&
  node.imported.type === AST_NODE_TYPES.Identifier &&
  node.imported.name === 'expect';

const isTestModuleImport = (node: TSESTree.Node | null): boolean =>
  node?.type === AST_NODE_TYPES.ImportDeclaration &&
  TEST_MODULES.has(node.source.value);

const isExpect = (
  context: Rule.RuleContext,
  identifier: TSESTree.Node,
): boolean => {
  if (identifier.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }
  const variable = resolveVariable(context, identifier);
  if (variable !== null && variable.defs.length > 0) {
    return variable.defs.some(
      (definition) =>
        definition.type === 'ImportBinding' &&
        isExpectSpecifier(definitionNode(definition)) &&
        isTestModuleImport(definitionParent(definition)),
    );
  }
  return identifier.name === 'expect';
};

const withoutAwait = (expression: TSESTree.Expression): TSESTree.Expression =>
  expression.type === AST_NODE_TYPES.AwaitExpression
    ? expression.argument
    : expression;

const rootOfMembers = (node: TSESTree.Node): TSESTree.Node =>
  node.type === AST_NODE_TYPES.MemberExpression
    ? rootOfMembers(node.object)
    : node;

const assertionCall = (
  context: Rule.RuleContext,
  statement: TSESTree.Node,
): TSESTree.CallExpression | null => {
  if (statement.type !== AST_NODE_TYPES.ExpressionStatement) {
    return null;
  }
  const expression = withoutAwait(statement.expression);
  if (
    expression.type !== AST_NODE_TYPES.CallExpression ||
    expression.callee.type !== AST_NODE_TYPES.MemberExpression
  ) {
    return null;
  }
  const assertion = rootOfMembers(expression.callee.object);
  const first =
    assertion.type === AST_NODE_TYPES.CallExpression
      ? assertion.arguments[0]
      : undefined;
  if (
    assertion.type !== AST_NODE_TYPES.CallExpression ||
    assertion.arguments.length !== 1 ||
    first === undefined ||
    !isExpect(context, assertion.callee)
  ) {
    return null;
  }
  const call =
    first.type === AST_NODE_TYPES.AwaitExpression ? first.argument : first;
  return call.type === AST_NODE_TYPES.CallExpression ? call : null;
};

const isTrailingComma = (tokens: AST.Token[], index: number): boolean => {
  const token = tokens[index];
  const before = tokens[index - 1]?.value;
  return (
    token?.value === ',' &&
    CLOSING.has(tokens[index + 1]?.value ?? '') &&
    before !== '[' &&
    before !== ','
  );
};

const withoutTrailingCommas = (tokens: AST.Token[]): AST.Token[] =>
  tokens.filter((_token, index) => !isTrailingComma(tokens, index));

const sameCall = (
  context: Rule.RuleContext,
  left: TSESTree.CallExpression,
  right: TSESTree.CallExpression,
): boolean => {
  if (textOf(context, left) === textOf(context, right)) {
    return true;
  }
  const { sourceCode } = context;
  const leftTokens = withoutTrailingCommas(
    sourceCode.getTokens(left as unknown as Rule.Node),
  );
  const rightTokens = withoutTrailingCommas(
    sourceCode.getTokens(right as unknown as Rule.Node),
  );
  return (
    leftTokens.length === rightTokens.length &&
    leftTokens.every(
      (token, index) =>
        token.type === rightTokens[index]?.type &&
        token.value === rightTokens[index]?.value,
    )
  );
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow repeated calls across adjacent assertions; call once and reuse the result.',
    },
    schema: [],
    messages: {
      repeatedCall: 'Call once and reuse the result across assertions.',
    },
  },
  create(context) {
    if (!isTestFile(context.filename)) {
      return {};
    }
    const check = (node: TSESTree.BlockStatement | TSESTree.Program): void => {
      const calls = node.body.map((statement) =>
        assertionCall(context, statement),
      );
      const repeated = calls.slice(1).flatMap((call, index) => {
        const previous = calls[index];
        return call !== null &&
          previous !== null &&
          sameCall(context, previous, call)
          ? [call]
          : [];
      });
      // eslint-disable-next-line functional/no-loop-statements -- reporting is a side effect per call, and unicorn/no-array-for-each forbids forEach
      for (const call of repeated) {
        report(context, call, 'repeatedCall');
      }
    };
    return { Program: check, BlockStatement: check };
  },
});
