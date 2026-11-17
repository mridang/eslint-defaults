import { AST_NODE_TYPES } from '@typescript-eslint/types';
import {
  defineRule,
  definitionNode,
  definitionParent,
  isGlobalReference,
  report,
  resolveVariable,
} from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/**
 * `tslop/no-module-mocking`: no `vi.mock`, `jest.mock`, `doMock` or
 * `unstable_mockModule`.
 *
 * What it flags: calls of `mock`, `doMock` and `unstable_mockModule` on Vitest's
 * `vi` or Jest's `jest` object, whether it is the global or imported from
 * `vitest` or `@jest/globals`.
 *
 * Why: replacing a whole module couples the test to import paths and hides the
 * real contract of the dependency, so the test passes while the real wiring is
 * broken.
 *
 * How to fix: pass the dependency in (a parameter, a constructor argument or a
 * small interface) and give the test a real, faithful implementation of it.
 */

const MOCK_METHODS = new Set(['doMock', 'mock', 'unstable_mockModule']);

const importedName = (node: TSESTree.Node): string | null => {
  if (node.type !== AST_NODE_TYPES.ImportSpecifier) {
    return null;
  }
  return node.imported.type === AST_NODE_TYPES.Identifier
    ? node.imported.name
    : node.imported.value;
};

const isFrameworkObject = (
  context: Rule.RuleContext,
  expression: TSESTree.Node,
): boolean => {
  if (expression.type !== AST_NODE_TYPES.Identifier) {
    return false;
  }
  const named = expression.name === 'vi' || expression.name === 'jest';
  if (named && isGlobalReference(context, expression)) {
    return true;
  }
  const variable = resolveVariable(context, expression);
  if (variable === null) {
    return named;
  }
  return variable.defs.some((definition) => {
    const parent = definitionParent(definition);
    if (
      definition.type !== 'ImportBinding' ||
      parent?.type !== AST_NODE_TYPES.ImportDeclaration
    ) {
      return false;
    }
    const source = parent.source.value;
    const name = importedName(definitionNode(definition));
    return (
      (source === 'vitest' && name === 'vi') ||
      (source === '@jest/globals' && name === 'jest')
    );
  });
};

const methodName = (callee: TSESTree.MemberExpression): string | null => {
  const property = callee.property;
  if (callee.computed) {
    return property.type === AST_NODE_TYPES.Literal &&
      typeof property.value === 'string'
      ? property.value
      : null;
  }
  return property.type === AST_NODE_TYPES.Identifier ? property.name : null;
};

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces.',
    },
    schema: [],
    messages: {
      moduleMock:
        'Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.',
    },
  },
  create(context) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      CallExpression(node: TSESTree.CallExpression) {
        const callee = node.callee;
        if (callee.type !== AST_NODE_TYPES.MemberExpression) {
          return;
        }
        const method = methodName(callee);
        if (
          method !== null &&
          MOCK_METHODS.has(method) &&
          isFrameworkObject(context, callee.object)
        ) {
          report(context, node, 'moduleMock');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
