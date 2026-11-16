import type { ESLint, Linter } from 'eslint';
import e18ePlugin from '@e18e/eslint-plugin';
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
      'array-foreach': 'Duplicates unicorn/no-array-for-each, which is on.',

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
    namespace: 'e18e',
    plugin: e18ePlugin as unknown as ESLint.Plugin,
    excluded: {
      'prefer-array-fill':
        'Contradicts unicorn/no-array-from-fill: its fix writes Array.from({ length: n }).fill(1), which that rule rejects. The callback form that rule keeps is also the safe one for objects, since .fill({}) shares one object between every slot.',
      'prefer-get-or-insert':
        'Map.prototype.getOrInsert does not exist on Node 24, so the auto-fix would break the code at runtime. Switch it on once the supported Node versions have it.',
      'prefer-inline-equality':
        'Rewrites [1, 2, 3].includes(x) as chained === checks. The rule has no option for a size limit, so it also rewrites longer lists, and the code gets longer and harder to read for a negligible speed gain.',
      'prefer-slice-over-split-index':
        'Replaces the one-line split(sep)[0] with two lines (indexOf, then slice with an explicit fallback for a missing separator) for a negligible speed gain on short strings.',
      'prefer-string-fromcharcode':
        'Contradicts unicorn/prefer-code-point, which wants String.fromCodePoint; the two would undo each other.',
      'prefer-timer-args':
        'setTimeout(fn, ms, arg) reads the argument when the timer is set rather than when it fires, a subtle change in behaviour for a negligible gain.',
      'no-delete-property':
        'Its suggestion turns delete obj.key into obj.key = undefined, which changes the result of in, Object.keys and Object.hasOwn.',
      'no-indexof-equality':
        'Needs type information but does not declare it, so it crashes on files without it, and its type-aware pass runs out of memory on large projects.',
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
  'consistent-function-scoping':
    'Kept off by choice: it reports almost only code that is fine as written, such as a small formatter next to its only use or a React event handler inside its component, and most hits are in tests.',
  'try-complexity':
    'Kept off by choice: fixing the existing code is a large refactor for little gain, and an oversized try block is caught in review. If the code is ever cleaned up, max: 5 is the setting to start with.',
  'no-null':
    'null is required by JSON, the DOM, databases (a missing column is null, and binding undefined drops the value) and React refs, and the rule cannot tell where. Enabling it is tracked in mridang/eslint-defaults#157.',
  'no-array-reduce':
    'Kept off by choice: it reports 85 reductions and its auto-fix repairs only one of them, so enabling it means rewriting the rest by hand.',
  'number-literal-case':
    'Conflicts with Prettier, which writes hex digits in lower case.',
  'no-nested-ternary':
    'Conflicts with Prettier, which formats nested ternaries itself.',
  'empty-brace-spaces':
    'Conflicts with Prettier, which owns the spacing inside braces.',
  'template-indent':
    'Conflicts with Prettier, which owns the indentation of template literals.',
};

/**
 * The abbreviations unicorn/prevent-abbreviations leaves alone. They are
 * conventional and read clearly here. The list is deliberately short: single
 * letters (i, j, e) and ambiguous words (doc, docs, rel, str) are still reported.
 */
const ALLOWED_ABBREVIATIONS = [
  'req',
  'res',
  'db',
  'ctx',
  'err',
  'env',
  'args',
  'params',
  'props',
  'opts',
  'idx',
  'arg',
  'tmp',
  'pkg',
  'fn',
  'acc',
  'ref',
  'src',
  'msg',
  'dir',
];

/**
 * Unicorn rules that run with options, or that unicorn's own `all` config
 * leaves off but we switch on. They are applied after `all` and the exclusions.
 */
export const unicornRuleSettings: Linter.RulesRecord = {
  // Arrow bodies such as .catch(() => undefined) are clearer than () => {}.
  // A function that returns a value on some paths needs an explicit return
  // type, which makes this rule leave `return undefined` alone and satisfies
  // sonarjs/no-inconsistent-returns.
  'unicorn/no-useless-undefined': ['error', { checkArrowFunctionBody: false }],
  'unicorn/prevent-abbreviations': [
    'error',
    {
      replacements: Object.fromEntries(
        ALLOWED_ABBREVIATIONS.map((word) => [word, false]),
      ),
    },
  ],
  // Switched off in unicorn's `all` config; there are no findings in any repository.
  'unicorn/no-negated-condition': 'error',
};
