import path from 'node:path';
import { AST_NODE_TYPES } from '@typescript-eslint/types';

import { defineRule, report, resolveVariable } from './shared/rule.js';
import type { TSESTree } from '@typescript-eslint/types';
import type { Rule } from 'eslint';

/**
 * `tslop/no-reexports-outside-entrypoints`: re-export only from an entry file.
 *
 * What it flags: `export { x } from './x'`, `export * from './x'`,
 * `export { importedName }` and `export default importedName` in a file that is
 * not an entrypoint. Entrypoints are `index.{ts,tsx,mts,cts,js,jsx,mjs}` files
 * by default; change them with `{ entrypoints: ['src/index.ts'] }` (globs
 * relative to the working directory, with `*`, `**`, `?` and `{a,b}`).
 *
 * Why: barrel files scattered through a codebase create import cycles, hide the
 * real owner of a symbol and defeat tree shaking and "find usages".
 *
 * How to fix: import the symbol from the file that defines it. Keep re-exports
 * for the package entrypoint that outside code consumes.
 */

const DEFAULT_ENTRYPOINTS = [
  '**/index.ts',
  '**/index.tsx',
  '**/index.mts',
  '**/index.cts',
  '**/index.js',
  '**/index.jsx',
  '**/index.mjs',
];

/** Escapes a character that has a meaning in a regular expression. */
const escapeCharacter = (character: string): string =>
  character.replaceAll(/[.+^$()|[\]\\]/gu, String.raw`\$&`);

/** Turns the glob from a position onward into regular expression source. */
const globSource = (glob: string, index: number, braces: number): string => {
  if (index >= glob.length) {
    return '';
  }
  const character = glob.charAt(index);
  if (character === '*' && glob.charAt(index + 1) === '*') {
    const slash = glob.charAt(index + 2) === '/';
    return `${slash ? '(?:.*/)?' : '.*'}${globSource(glob, index + (slash ? 3 : 2), braces)}`;
  }
  switch (character) {
    case '*': {
      return `[^/]*${globSource(glob, index + 1, braces)}`;
    }
    case '?': {
      return `[^/]${globSource(glob, index + 1, braces)}`;
    }
    case '{': {
      return `(?:${globSource(glob, index + 1, braces + 1)}`;
    }
    case '}': {
      return braces > 0
        ? `)${globSource(glob, index + 1, braces - 1)}`
        : `${escapeCharacter(character)}${globSource(glob, index + 1, braces)}`;
    }
    case ',': {
      return braces > 0
        ? `|${globSource(glob, index + 1, braces)}`
        : `${character}${globSource(glob, index + 1, braces)}`;
    }
    default: {
      return `${escapeCharacter(character)}${globSource(glob, index + 1, braces)}`;
    }
  }
};

/** Turns a glob into a regular expression. */
const globToRegExp = (glob: string): RegExp =>
  new RegExp(`^${globSource(glob, 0, 0)}$`, 'u');

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow re-exports outside configured entrypoint files',
    },
    schema: [
      {
        type: 'object',
        properties: {
          entrypoints: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      reexport:
        'Import this symbol directly from its source, or re-export it from a package entrypoint for external consumers.',
    },
  },
  create(context: Rule.RuleContext) {
    const options = (context.options[0] ?? {}) as { entrypoints?: string[] };
    const relativeName = path
      .relative(context.cwd, context.filename)
      .replaceAll('\\', '/');
    const isEntrypoint = (options.entrypoints ?? DEFAULT_ENTRYPOINTS).some(
      (pattern) => globToRegExp(pattern).test(relativeName),
    );
    const isImported = (node: TSESTree.Node): boolean =>
      node.type === AST_NODE_TYPES.Identifier &&
      (resolveVariable(context, node)?.defs.some(
        (definition) => definition.type === 'ImportBinding',
      ) ??
        false);

    /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
    return {
      ExportNamedDeclaration(node: TSESTree.ExportNamedDeclaration) {
        if (node.source !== null) {
          if (!isEntrypoint) {
            report(context, node, 'reexport');
          }
          return;
        }
        // eslint-disable-next-line functional/no-loop-statements -- reporting is a side effect per specifier, and unicorn/no-array-for-each forbids forEach
        for (const specifier of node.specifiers) {
          if (isImported(specifier.local) && !isEntrypoint) {
            report(context, specifier, 'reexport');
          }
        }
      },
      ExportAllDeclaration(node: TSESTree.ExportAllDeclaration) {
        if (!isEntrypoint) {
          report(context, node, 'reexport');
        }
      },
      ExportDefaultDeclaration(node: TSESTree.ExportDefaultDeclaration) {
        if (isImported(node.declaration) && !isEntrypoint) {
          report(context, node, 'reexport');
        }
      },
    };
    /* eslint-enable sonarjs/function-name -- end of the visitor keys */
  },
});
