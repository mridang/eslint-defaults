import { AST_NODE_TYPES } from '@typescript-eslint/types';
import { asEslintNode, asTypeScript, defineRule } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Scope } from 'eslint';

/**
 * `tslop/no-renamed-imports`: no `import { a as b }` when `a` is free.
 *
 * What it flags: a named import that is renamed (`import { readFile as read }`)
 * although the original name is not declared or used anywhere else at module
 * level. The fixer renames the import and every use of it, and it declines to
 * fix when the name is reserved, shadowed at a use, or an intrinsic JSX tag.
 *
 * Why: a different name in each file makes the code harder to search and to
 * read, and the alias often only hides where a symbol comes from.
 *
 * How to fix: use the original name (run `eslint --fix`). Keep the alias only
 * where the name really clashes, and say why in a disable comment.
 */

const RESERVED = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const moduleScopeFor = (scope: Scope.Scope | null): Scope.Scope | null => {
  if (scope === null || scope.type === 'module') {
    return scope;
  }
  return moduleScopeFor(scope.upper);
};

const isShadowedFrom = (
  scope: Scope.Scope | null,
  name: string,
  moduleScope: Scope.Scope,
): boolean => {
  if (scope === null || scope === moduleScope) {
    return false;
  }
  return scope.set.has(name) || isShadowedFrom(scope.upper, name, moduleScope);
};

const isShadowedAt = (
  reference: Scope.Reference,
  name: string,
  moduleScope: Scope.Scope,
): boolean => isShadowedFrom(reference.from, name, moduleScope);

const LOWERCASE_START = /^[a-z]/u;

const isIntrinsicJsxTag = (
  identifier: TSESTree.Node,
  name: string,
): boolean => {
  const parent = identifier.parent;
  return (
    (parent?.type === AST_NODE_TYPES.JSXOpeningElement ||
      parent?.type === AST_NODE_TYPES.JSXClosingElement) &&
    LOWERCASE_START.test(name)
  );
};

const replacement = (
  identifier: TSESTree.Node,
  localName: string,
  name: string,
): string => {
  const parent = identifier.parent;
  if (
    parent?.type === AST_NODE_TYPES.Property &&
    parent.shorthand &&
    parent.value === identifier
  ) {
    return `${localName}: ${name}`;
  }
  if (
    parent?.type === AST_NODE_TYPES.ExportSpecifier &&
    parent.local === identifier &&
    parent.exported.range[0] === identifier.range[0]
  ) {
    return `${name} as ${localName}`;
  }
  return name;
};

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow unnecessary aliases for named imports' },
    fixable: 'code',
    schema: [],
    messages: {
      unnecessaryAlias:
        'Use {{importedName}} directly instead of renaming this import to {{localName}}.',
    },
  },
  create(context) {
    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      ImportSpecifier(node: TSESTree.ImportSpecifier) {
        const name =
          node.imported.type === AST_NODE_TYPES.Identifier
            ? node.imported.name
            : null;
        if (name === null || name === node.local.name) {
          return;
        }
        const moduleScope = moduleScopeFor(context.sourceCode.getScope(node));
        if (moduleScope === null || moduleScope.set.has(name)) {
          return;
        }
        const localName = node.local.name;
        const variable = moduleScope.set.get(localName);
        if (variable === undefined) {
          return;
        }
        context.report({
          node: asEslintNode(node),
          messageId: 'unnecessaryAlias',
          data: { importedName: name, localName },
          fix(fixer) {
            const references = variable.references.filter(
              (reference) => reference.resolved === variable,
            );
            const blocked =
              RESERVED.has(name) ||
              moduleScope.through.some(
                (reference) => reference.identifier.name === name,
              ) ||
              references.some(
                (reference) =>
                  isShadowedAt(reference, name, moduleScope) ||
                  isIntrinsicJsxTag(asTypeScript(reference.identifier), name),
              );
            if (blocked) {
              return null;
            }
            return [
              fixer.replaceTextRange(
                [node.imported.range[0], node.range[1]],
                name,
              ),
              ...references.map((reference) =>
                fixer.replaceText(
                  reference.identifier,
                  replacement(
                    asTypeScript(reference.identifier),
                    localName,
                    name,
                  ),
                ),
              ),
            ];
          },
        });
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
