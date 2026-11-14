import type { ESLint, Linter } from 'eslint';
import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import githubPlugin from 'eslint-plugin-github';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import nPlugin from 'eslint-plugin-n';
import promisePlugin from 'eslint-plugin-promise';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

interface RuleMeta {
  deprecated?: unknown;
  docs?: { requiresTypeChecking?: boolean };
}

interface HardenedLibrary {
  namespace: string;
  plugin: ESLint.Plugin;
  /** Rules left off, each with the reason. Every other rule is an error. */
  excluded: Record<string, string>;
}

/**
 * The JSDoc rules about types in comments. TypeScript files must not repeat
 * types in JSDoc, while JavaScript files must state them there.
 */
const JSDOC_TYPE_TAGS = [
  'require-next-type',
  'require-param-type',
  'require-property-type',
  'require-returns-type',
  'require-throws-type',
  'require-yields-type',
];

/**
 * The per-language settings for the JSDoc type rules, applied over the
 * general rule set.
 */
export const jsdocTypeRules: {
  ts: Linter.RulesRecord;
  js: Linter.RulesRecord;
} = {
  ts: {
    ...Object.fromEntries(
      JSDOC_TYPE_TAGS.map((tag) => [`jsdoc/${tag}`, 'off']),
    ),
    'jsdoc/no-undefined-types': 'off',
  },
  js: { 'jsdoc/no-types': 'off' },
};

/** Rules that need type information and so only run on TypeScript files. */
export interface HardenedRules {
  untyped: Linter.RulesRecord;
  typed: Linter.RulesRecord;
}

const NEEDS_OPTIONS = 'Matches nothing without options, so it is only noise.';

const LIBRARIES: HardenedLibrary[] = [
  {
    namespace: 'promise',
    plugin: promisePlugin as unknown as ESLint.Plugin,
    excluded: {
      'avoid-new':
        'Bans every new Promise(), including correct wrappers around callback APIs and timers.',
      'no-native':
        'Only relevant to ES5 environments without a native Promise.',
      'prefer-await-to-then': 'We allow .then().',
    },
  },
  {
    namespace: 'sonarjs',
    plugin: sonarjsPlugin as unknown as ESLint.Plugin,
    excluded: {
      'file-name-differ-from-class':
        'Clashes with framework-fixed file names and with our own file naming convention.',
      'no-duplicate-string':
        'Flags repeated messages, headers and fixture data, where a constant hurts readability.',
      'cyclomatic-complexity':
        'Needs a large refactor across the repos; to be enabled later.',
      'cognitive-complexity':
        'Needs a large refactor across the repos; to be enabled later.',
      'no-reference-error':
        'TypeScript already reports undefined names (error 2304), and this rule cannot see types from lib.dom or the Cloudflare packages.',
      'no-implicit-dependencies':
        'knip already reports unlisted dependencies, without needing per-repo options for built-ins and subpath imports.',

      'arrow-function-convention': 'Fights Prettier.',
      'file-header':
        'Kept off by choice: we do not want licence headers in files.',
      'shorthand-property-grouping':
        'Kept off by choice: too trivial to enforce.',
    },
  },
  {
    namespace: 'jsdoc',
    plugin: jsdocPlugin as unknown as ESLint.Plugin,
    excluded: {
      'require-example':
        'Kept off by choice: an @example on every function would be generated, untested and go stale.',
      'require-file-overview':
        'Kept off by choice: a file overview on every file, tests included, would mostly repeat the file name.',
      'no-unnecessary-type-assertion':
        'Needs the typescript-eslint parser with type information, and our plain JavaScript files sit outside any tsconfig.',
      'match-name': NEEDS_OPTIONS,
      'no-missing-syntax': NEEDS_OPTIONS,
      'no-restricted-syntax': NEEDS_OPTIONS,
      'require-tags': NEEDS_OPTIONS,
      'check-examples':
        'Deprecated and broken on ESLint 8 and later; the plugin points to its JSDoc processor instead.',
      'text-escaping':
        'Errors on every comment unless escapeHTML or escapeMarkdown is chosen, and escaping descriptions is a style choice we have not made.',
    },
  },
  {
    namespace: 'github',
    plugin: githubPlugin as unknown as ESLint.Plugin,
    excluded: {
      'no-dataset':
        'We follow unicorn/dom-node-dataset (.dataset); the two rules contradict each other.',

      'unescaped-html-literal':
        'Flags every string containing markup, which HTML-generating code needs.',
      'array-foreach': 'Style opinion; forEach is fine.',

      'filenames-match-regex': 'Would force every file to be renamed.',
      'no-then': 'We allow .then().',
    },
  },
  {
    namespace: '@eslint-community/eslint-comments',
    plugin: eslintCommentsPlugin as unknown as ESLint.Plugin,
    excluded: {
      'no-use':
        'Bans every directive comment, which the other rules already police.',
    },
  },
  {
    namespace: 'unused-imports',
    plugin: unusedImportsPlugin as unknown as ESLint.Plugin,
    excluded: {},
  },
  {
    namespace: 'n',
    plugin: nPlugin as unknown as ESLint.Plugin,
    excluded: {
      'no-extraneous-import': 'Cannot follow workspace and nested manifests.',
      'no-extraneous-require': 'Cannot follow workspace and nested manifests.',
      'file-extension-in-import':
        'TypeScript ESM requires .js extensions on relative imports and extensions on JSON imports, which the rule would strip or forbid.',
      'no-process-env':
        'Reading process.env is our standard way to take configuration, together with a plain .env file.',
      'no-top-level-await':
        'Only matters for published CommonJS-compatible libraries; every hit is a worker entry, build script, bin file or test, none of them published library code.',
      'no-missing-import':
        'Cannot resolve TypeScript paths; knip and import/no-unresolved already check imports.',
    },
  },
];

/** Reason shared by every JSDoc rule that is not already excluded for another reason. */
const JSDOC_TEMPORARILY_OFF =
  'Temporarily off while the repositories are brought to a clean baseline; to be switched back on later.';
const jsdocLibrary = LIBRARIES.find((library) => library.namespace === 'jsdoc');
for (const name of Object.keys(jsdocLibrary?.plugin.rules ?? {})) {
  if (jsdocLibrary && !(name in jsdocLibrary.excluded)) {
    jsdocLibrary.excluded[name] = JSDOC_TEMPORARILY_OFF;
  }
}

/**
 * The rules left off for each plugin namespace, with the reason.
 */
export const hardenedExclusions: Record<
  string,
  Record<string, string>
> = Object.fromEntries(
  LIBRARIES.map(({ namespace, excluded }) => [namespace, excluded]),
);

/**
 * Every plugin of the hardened rule set, keyed by the namespace its rules
 * are written under.
 */
export const hardenedPlugins: Record<string, ESLint.Plugin> =
  Object.fromEntries(
    LIBRARIES.map(({ namespace, plugin }) => [namespace, plugin]),
  );

/** Settings the hardened rules read. */
export const hardenedSettings: Linter.Config['settings'] = {
  jsdoc: { mode: 'typescript' },
};

/**
 * Turns on, as errors, every rule of the library that is neither deprecated
 * nor excluded. New rules shipped by a plugin are therefore on by default.
 * @param library - The plugin and the rules to leave off.
 * @returns The rules split by whether they need type information.
 */
function rulesOf(library: HardenedLibrary): HardenedRules {
  const result: HardenedRules = { untyped: {}, typed: {} };
  for (const [name, rule] of Object.entries(library.plugin.rules ?? {})) {
    const meta = (rule as { meta?: RuleMeta }).meta;
    if (meta?.deprecated || name in library.excluded) continue;
    const target = meta?.docs?.requiresTypeChecking
      ? result.typed
      : result.untyped;
    target[`${library.namespace}/${name}`] = 'error';
  }
  return result;
}

/**
 * Builds the hardened rule set: every rule of every plugin on as an error,
 * minus the exclusions listed above.
 * @returns The rules for any file and the ones that also need type information.
 */
export function hardenedRules(): HardenedRules {
  const result: HardenedRules = { untyped: {}, typed: {} };
  for (const library of LIBRARIES) {
    const rules = rulesOf(library);
    Object.assign(result.untyped, rules.untyped);
    Object.assign(result.typed, rules.typed);
  }
  return result;
}

/**
 * The unicorn rules left off. Unicorn is enabled through its own `all`
 * config, so these are switched off after it.
 */
export const unicornExclusions: Record<string, string> = {
  'consistent-function-scoping': 'Kept off by choice.',
  'try-complexity': 'Kept off by choice.',
  'no-keyword-prefix':
    'Flags the React className prop, which cannot be renamed.',
  'prevent-abbreviations':
    'Fights our own naming convention and the standard names in our frameworks (req, res, env, db, ctx).',
  'no-null':
    'null is required by JSON, DOM, databases and React refs, and the autofix cannot tell where.',
  'no-useless-undefined': 'Kept off by choice.',
  'no-array-for-each': 'Kept off by choice.',
  'no-array-reduce': 'Kept off by choice.',
  'number-literal-case':
    'Conflicts with Prettier, which writes hex digits in lower case.',
  'no-nested-ternary':
    'Conflicts with Prettier, which formats nested ternaries itself.',
  'empty-brace-spaces':
    'Conflicts with Prettier, which owns the spacing inside braces.',
  'template-indent':
    'Conflicts with Prettier, which owns the indentation of template literals.',
  'prefer-iterator-concat':
    'Unsatisfiable with unicorn/prefer-spread: that rule rejects a.concat(b) and this one rejects [...a, ...b], and Iterator.concat is not declared on IteratorConstructor in TypeScript 6, so neither form is accepted and the one it asks for does not compile.',
};
