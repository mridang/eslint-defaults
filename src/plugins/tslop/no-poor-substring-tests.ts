import { readFileSync } from 'node:fs';
import path from 'node:path';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

import {
  defineRule,
  definitionNode,
  definitionParent,
  isTestFile,
  report,
  resolveVariable,
  rootIdentifierName,
  unwrapExpression,
} from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule, Scope } from 'eslint';

/**
 * `tslop/no-poor-substring-tests`: do not test that a constant string contains
 * a substring.
 *
 * What it flags, in test files only: `expect(CONSTANT).toContain('x')`,
 * `.toMatch(...)`, `.toEqual(expect.stringContaining(...))`,
 * `expect(CONSTANT.includes('x'))`, `expect(/re/.test(CONSTANT))` and the
 * `assert` forms (`assert.include(CONSTANT, 'x')`, `assert(CONSTANT.includes())`),
 * where the subject is a string that the file itself fixes: a literal, a
 * template without dynamic parts, a `const` of those, or a string `export
 * const` of a relative import (read from disk).
 *
 * Why: the test compares a fixed text with a fixed fragment, so it can only
 * fail when someone edits the constant, and says nothing about behavior.
 *
 * How to fix: assert on a value the code computes, or verify the whole contract
 * with an exact match or a snapshot.
 */

const SUBSTRING_MATCHERS = new Set([
  'toContain',
  'toInclude',
  'toMatch',
  'include',
  'contain',
  'string',
  'match',
]);
const CHAIN_MODIFIERS = new Set([
  'not',
  'resolves',
  'rejects',
  'to',
  'be',
  'have',
  'that',
  'which',
  'and',
  'is',
  'deep',
  'nested',
  'own',
]);
const SUBSTRING_METHODS = new Set([
  'includes',
  'startsWith',
  'endsWith',
  'indexOf',
  'search',
  'match',
]);
const ASSERT_MATCHERS = new Set([
  'include',
  'includes',
  'notInclude',
  'notIncludes',
  'match',
  'notMatch',
]);
const SOURCE_EXTENSIONS = new Map([
  ['.js', ['.ts', '.tsx']],
  ['.jsx', ['.tsx']],
  ['.mjs', ['.mts']],
  ['.cjs', ['.cts']],
]);

const escapeRegExp = (text: string): string =>
  text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

/** Reads a file, or `undefined` when it is not there. */
const readSource = (file: string): string | undefined => {
  try {
    // eslint-disable-next-line n/no-sync -- an ESLint rule runs synchronously, so it cannot await a file read
    return readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }
};

/** The name an import binding is exported under, or null for a namespace import. */
const importedNameOf = (node: TSESTree.Node): string | null => {
  if (node.type === AST_NODE_TYPES.ImportSpecifier) {
    return node.imported.type === AST_NODE_TYPES.Identifier
      ? node.imported.name
      : node.imported.value;
  }
  return node.type === AST_NODE_TYPES.ImportDefaultSpecifier ? 'default' : null;
};

const isImportedConstantString = (
  variable: Scope.Variable,
  currentFilename: string,
): boolean => {
  if (!path.isAbsolute(currentFilename)) {
    return false;
  }
  const definition = variable.defs.at(0);
  const parent = definition === undefined ? null : definitionParent(definition);
  if (
    definition?.type !== 'ImportBinding' ||
    parent?.type !== AST_NODE_TYPES.ImportDeclaration
  ) {
    return false;
  }
  const source = parent.source.value;
  if (!source.startsWith('.')) {
    return false;
  }
  const importedName = importedNameOf(definitionNode(definition));
  if (importedName === null) {
    return false;
  }
  const directory = path.dirname(currentFilename);
  const extension = path.extname(source);
  const stem = source.slice(0, source.length - extension.length);
  const candidates = [
    path.resolve(directory, source),
    ...(SOURCE_EXTENSIONS.get(extension) ?? []).map((replacement) =>
      path.resolve(directory, `${stem}${replacement}`),
    ),
    ...['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs'].map((suffix) =>
      path.resolve(directory, `${source}${suffix}`),
    ),
    path.resolve(directory, source, 'index.ts'),
    path.resolve(directory, source, 'index.js'),
  ];
  const pattern = new RegExp(
    String.raw`export\s+const\s+${escapeRegExp(importedName)}\s*=\s*(["'\x60])`,
    'u',
  );
  return candidates.some((candidate) => {
    const content = readSource(candidate);
    return content !== undefined && pattern.test(content);
  });
};

/** The only argument of a call, unless it is a spread. */
const firstArgument = (
  node: TSESTree.CallExpression,
): TSESTree.Expression | undefined => {
  const first = node.arguments.at(0);
  return first?.type === AST_NODE_TYPES.SpreadElement ? undefined : first;
};

/** The property name of a `.name` member access, or null for a computed one. */
const plainMemberName = (node: TSESTree.MemberExpression): string | null =>
  !node.computed && node.property.type === AST_NODE_TYPES.Identifier
    ? node.property.name
    : null;

const isStringCall = (node: TSESTree.CallExpression): boolean =>
  node.callee.type === AST_NODE_TYPES.Identifier &&
  node.callee.name === 'String' &&
  node.arguments.length === 1;

const isStableVariable = (
  variable: Scope.Variable,
  node: TSESTree.VariableDeclarator,
): boolean =>
  node.parent.kind === 'const' ||
  variable.references.every(
    (reference) => reference.init || !reference.isWrite(),
  );

const isConstantString = (
  context: Rule.RuleContext,
  expression: TSESTree.Node,
  visited: ReadonlySet<Scope.Variable> = new Set<Scope.Variable>(),
): boolean => {
  const current = unwrapExpression(expression);
  if (current.type === AST_NODE_TYPES.Literal) {
    return typeof current.value === 'string';
  }
  if (current.type === AST_NODE_TYPES.TemplateLiteral) {
    return current.expressions.every((part) =>
      isConstantString(context, part, visited),
    );
  }
  if (
    current.type === AST_NODE_TYPES.BinaryExpression &&
    current.operator === '+'
  ) {
    return (
      isConstantString(context, current.left, visited) &&
      isConstantString(context, current.right, visited)
    );
  }
  if (current.type === AST_NODE_TYPES.CallExpression && isStringCall(current)) {
    const argument = firstArgument(current);
    if (argument !== undefined) {
      return isConstantString(context, argument, visited);
    }
  }
  if (current.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }
  const variable = resolveVariable(context, current);
  if (
    variable === null ||
    visited.has(variable) ||
    variable.defs.length !== 1
  ) {
    return false;
  }
  const definition = variable.defs.at(0);
  if (definition === undefined) {
    return false;
  }
  const node = definitionNode(definition);
  if (
    definition.type === 'Variable' &&
    node.type === AST_NODE_TYPES.VariableDeclarator &&
    node.init !== null &&
    isStableVariable(variable, node)
  ) {
    return isConstantString(
      context,
      node.init,
      new Set([...visited, variable]),
    );
  }
  return (
    definition.type === 'ImportBinding' &&
    isImportedConstantString(variable, context.filename)
  );
};

/** Looks through `.not`, `.resolves`, `.to.be` and the like to reach `expect(...)`. */
const stripChainModifiers = (object: TSESTree.Node): TSESTree.Node => {
  const name =
    object.type === AST_NODE_TYPES.MemberExpression
      ? plainMemberName(object)
      : null;
  return object.type === AST_NODE_TYPES.MemberExpression &&
    name !== null &&
    CHAIN_MODIFIERS.has(name)
    ? stripChainModifiers(object.object)
    : object;
};

const extractExpectSubject = (
  callee: TSESTree.MemberExpression,
): TSESTree.Node | null => {
  const object = stripChainModifiers(callee.object);
  const first =
    object.type === AST_NODE_TYPES.CallExpression
      ? firstArgument(object)
      : undefined;
  return object.type === AST_NODE_TYPES.CallExpression &&
    rootIdentifierName(object.callee) === 'expect'
    ? (first ?? null)
    : null;
};

const extractSubstringSubject = (node: TSESTree.Node): TSESTree.Node | null => {
  const unwrapped = unwrapExpression(node);
  if (
    unwrapped.type === AST_NODE_TYPES.CallExpression &&
    unwrapped.callee.type === AST_NODE_TYPES.MemberExpression
  ) {
    const method = plainMemberName(unwrapped.callee);
    if (method !== null && SUBSTRING_METHODS.has(method)) {
      return unwrapped.callee.object;
    }
    const first = firstArgument(unwrapped);
    if (method === 'test' && first !== undefined) {
      return first;
    }
  }
  if (unwrapped.type === AST_NODE_TYPES.BinaryExpression) {
    const left =
      unwrapped.left.type === AST_NODE_TYPES.PrivateIdentifier
        ? null
        : extractSubstringSubject(unwrapped.left);
    return left ?? extractSubstringSubject(unwrapped.right);
  }
  return null;
};

const isStringContaining = (node: TSESTree.Node): boolean => {
  const unwrapped = unwrapExpression(node);
  return (
    unwrapped.type === AST_NODE_TYPES.CallExpression &&
    unwrapped.callee.type === AST_NODE_TYPES.MemberExpression &&
    plainMemberName(unwrapped.callee) === 'stringContaining' &&
    rootIdentifierName(unwrapped.callee.object) === 'expect'
  );
};

const isPoorSubstringCall = (
  context: Rule.RuleContext,
  node: TSESTree.CallExpression,
): boolean => {
  const callee = node.callee;
  const argument = firstArgument(node);
  const constant = (subject: TSESTree.Node | null): boolean =>
    subject !== null && isConstantString(context, subject);
  const name =
    callee.type === AST_NODE_TYPES.MemberExpression
      ? plainMemberName(callee)
      : null;
  // expect(subject).toContain(sub), .toMatch(re), .toEqual(expect.stringContaining(sub))
  if (name !== null && callee.type === AST_NODE_TYPES.MemberExpression) {
    const viaContaining =
      argument !== undefined && isStringContaining(argument);
    if (
      (SUBSTRING_MATCHERS.has(name) || viaContaining) &&
      constant(extractExpectSubject(callee))
    ) {
      return true;
    }
  }
  const root = rootIdentifierName(callee);
  // expect(subject.includes('sub')), expect(/re/.test(subject))
  if (
    root === 'expect' &&
    argument !== undefined &&
    constant(extractSubstringSubject(argument))
  ) {
    return true;
  }
  // assert.include(subject, 'sub'), assert(subject.includes('sub')), assert.ok(...)
  if (root !== 'assert' || argument === undefined) {
    return false;
  }
  if (name !== null && ASSERT_MATCHERS.has(name) && constant(argument)) {
    return true;
  }
  return constant(extractSubstringSubject(argument));
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow testing that a constant string contains substrings; tests must assert on dynamic behavior or verify full contracts.',
    },
    schema: [],
    messages: {
      poorSubstringTest:
        'Testing that a constant string contains a substring provides little signal. Assert against dynamic behavior, or verify the complete contract with an exact match or snapshot instead.',
    },
  },
  create(context) {
    if (!isTestFile(context.filename)) {
      return {};
    }
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      CallExpression(node: TSESTree.CallExpression) {
        if (isPoorSubstringCall(context, node)) {
          report(context, node, 'poorSubstringTest');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
