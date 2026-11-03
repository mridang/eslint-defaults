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

/** Rules that need type information and so only run on TypeScript files. */
export interface HardenedRules {
  untyped: Linter.RulesRecord;
  typed: Linter.RulesRecord;
}

const NO_TYPES_IN_TS = 'no-types forbids types in comments in TypeScript.';
const DEMANDS_DOCS =
  'Demands documentation on every symbol; the check rules still validate the docs that exist.';
const NOISY =
  'Too many findings that need judgment rather than a mechanical fix.';
const NEEDS_OPTIONS = 'Matches nothing without options, so it is only noise.';

const LIBRARIES: HardenedLibrary[] = [
  {
    namespace: 'promise',
    plugin: promisePlugin as unknown as ESLint.Plugin,
    excluded: {
      'prefer-catch': 'Its autofix can change behaviour or break types.',
      'no-callback-in-promise':
        'Matches parameter names such as next and err rather than real callbacks.',
      'no-promise-in-callback':
        'Matches parameter names such as next and err rather than real callbacks.',

      'always-return':
        'Mostly fire-and-forget .then() calls, and a false positive on Cypress chains.',
      'avoid-new':
        'Bans every new Promise(), including correct wrappers around callback APIs and timers.',
      'no-native':
        'Only relevant to ES5 environments without a native Promise.',
      'prefer-await-to-callbacks':
        'Matches parameter names (callback, cb) and flags .catch((error) => ...) handlers.',
      'prefer-await-to-then': 'We allow .then().',
    },
  },
  {
    namespace: 'sonarjs',
    plugin: sonarjsPlugin as unknown as ESLint.Plugin,
    excluded: {
      'max-lines': NOISY,
      'function-return-type': NOISY,
      'strings-comparison': NOISY,
      'different-types-comparison': NOISY,
      'pseudo-random': NOISY,
      'no-inconsistent-returns': NOISY,
      'bool-param-default': NOISY,
      'no-inverted-boolean-check': NOISY,
      'no-invariant-returns': NOISY,
      'assertions-in-tests': NOISY,
      'publicly-writable-directories': NOISY,
      'public-static-readonly': NOISY,
      'destructuring-assignment-syntax':
        'Conflicts with unicorn/no-unreadable-array-destructuring.',

      'void-use':
        'Conflicts with the void idiom no-floating-promises relies on.',
      'file-name-differ-from-class': 'Style opinion.',
      'declarations-in-global-scope': NOISY,
      'no-require-or-define': 'CommonJS files legitimately use require.',
      'no-duplicate-string': NOISY,
      'no-wildcard-import': NOISY,
      'no-undefined-assignment': NOISY,
      'cyclomatic-complexity': NOISY,
      'cognitive-complexity': NOISY,
      'no-nested-conditional': NOISY,
      'function-name': NOISY,
      'variable-name': NOISY,
      'no-alphabetical-sort': NOISY,
      'no-reference-error': NOISY,
      'no-clear-text-protocols': NOISY,
      'expression-complexity': NOISY,
      'max-lines-per-function': NOISY,
      'max-union-size': NOISY,
      'nested-control-flow': NOISY,
      'no-nested-template-literals': NOISY,
      'no-hardcoded-ip': NOISY,
      'no-os-command-from-path': NOISY,
      'super-linear-regex': NOISY,
      'no-implicit-dependencies': NOISY,
      'prefer-read-only-props': NOISY,
      'too-many-break-or-continue-in-loop': NOISY,
      'no-redundant-optional': NOISY,
      'regex-complexity': NOISY,

      'arrow-function-convention': 'Fights Prettier.',
      'elseif-without-else': 'Style opinion.',
      'file-header': 'Needs a header format to compare against.',
      'shorthand-property-grouping': 'Style opinion.',
    },
  },
  {
    namespace: 'jsdoc',
    plugin: jsdocPlugin as unknown as ESLint.Plugin,
    excluded: {
      'no-unnecessary-type-assertion':
        'typescript-eslint has the same rule, and this one needs its own parser setup.',
      'no-multi-asterisks': 'Its autofix can change behaviour or break types.',

      'require-jsdoc': DEMANDS_DOCS,
      'require-param': DEMANDS_DOCS,
      'require-param-description': DEMANDS_DOCS,
      'require-returns': DEMANDS_DOCS,
      'require-returns-description': DEMANDS_DOCS,
      'require-template': DEMANDS_DOCS,
      'require-rejects': DEMANDS_DOCS,
      'require-throws': DEMANDS_DOCS,
      'require-description': DEMANDS_DOCS,
      'require-yields': DEMANDS_DOCS,
      'require-property': DEMANDS_DOCS,
      'require-property-description': DEMANDS_DOCS,
      'check-indentation': 'Fights Prettier or is a style opinion.',
      'tag-lines': 'Fights Prettier or is a style opinion.',
      'escape-inline-tags': 'Fights Prettier or is a style opinion.',
      'informative-docs': 'Fights Prettier or is a style opinion.',
      'sort-tags': 'Fights Prettier or is a style opinion.',
      'no-types': 'Plain JavaScript repos keep their types in JSDoc.',

      'check-examples':
        'Lints @example code against the host config, not per file.',
      'check-line-alignment': 'Fights Prettier.',
      'convert-to-jsdoc-comments': 'Rewrites ordinary // comments.',
      'lines-before-block': 'Fights Prettier.',
      'match-description': 'Imposes a sentence style on every description.',
      'match-name': NEEDS_OPTIONS,
      'no-missing-syntax': NEEDS_OPTIONS,
      'no-restricted-syntax': NEEDS_OPTIONS,
      'no-undefined-types': 'typescript-eslint already resolves types.',
      'require-asterisk-prefix': 'Fights Prettier.',
      'require-description-complete-sentence': 'Style opinion.',
      'require-example': 'Demands an @example on every function.',
      'require-file-overview': 'Demands a file overview on every file.',
      'require-hyphen-before-param-description': 'Style opinion.',
      'require-next-type': NO_TYPES_IN_TS,
      'require-param-type': NO_TYPES_IN_TS,
      'require-property-type': NO_TYPES_IN_TS,
      'require-returns-type': NO_TYPES_IN_TS,
      'require-tags': NEEDS_OPTIONS,
      'require-throws-type': NO_TYPES_IN_TS,
      'require-yields-type': NO_TYPES_IN_TS,
      'text-escaping': 'Style opinion.',
    },
  },
  {
    namespace: 'github',
    plugin: githubPlugin as unknown as ESLint.Plugin,
    excluded: {
      'no-dataset':
        'Conflicts with unicorn/dom-node-dataset, which autofixes back to .dataset.',
      'a11y-no-title-attribute': 'Flags deliberate hover tooltips.',
      'a11y-no-visually-hidden-interactive-element':
        'Flags the standard sr-only skip link that appears on focus.',
      'a11y-svg-has-accessible-name': 'Flags decorative and placeholder icons.',
      'no-blur': 'Style opinion.',

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
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-process-env':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-top-level-await':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-unsupported-features/es-builtins':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-unsupported-features/es-syntax':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-unsupported-features/node-builtins':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'callback-return':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-callback-literal':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-unpublished-import':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',
      'no-unpublished-require':
        'Conflicts with TypeScript, bundlers or ESM, or depends on the engines field.',

      'no-missing-import':
        'Cannot resolve TypeScript paths, and import/no-unresolved covers it.',
      'no-missing-require':
        'Cannot resolve TypeScript paths, and import/no-unresolved covers it.',
      'no-sync': 'Synchronous calls are fine in scripts and config files.',
    },
  },
];

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
  'consistent-function-scoping': 'Style opinion or too noisy to adopt.',
  'no-array-callback-reference': 'Style opinion or too noisy to adopt.',
  'no-array-sort': 'Style opinion or too noisy to adopt.',
  'no-keyword-prefix': 'Style opinion or too noisy to adopt.',
  'no-manually-wrapped-comments': 'Style opinion or too noisy to adopt.',
  'no-useless-fallback-in-spread': 'Style opinion or too noisy to adopt.',
  'number-literal-case': 'Style opinion or too noisy to adopt.',
  'numeric-separators-style': 'Style opinion or too noisy to adopt.',
  'prefer-at': 'Style opinion or too noisy to adopt.',
  'prefer-iterator-concat': 'Style opinion or too noisy to adopt.',
  'prefer-node-protocol': 'Style opinion or too noisy to adopt.',
  'prefer-split-limit': 'Style opinion or too noisy to adopt.',
  'prefer-string-replace-all': 'Style opinion or too noisy to adopt.',
  'relative-url-style': 'Style opinion or too noisy to adopt.',
  'text-encoding-identifier-case': 'Style opinion or too noisy to adopt.',
  'try-complexity': 'Style opinion or too noisy to adopt.',
  'prevent-abbreviations': 'Style opinion or too noisy to adopt.',
  'no-null': 'Style opinion or too noisy to adopt.',
  'no-await-expression-member': 'Style opinion or too noisy to adopt.',
  'no-useless-undefined': 'Style opinion or too noisy to adopt.',
  'filename-case': 'Style opinion or too noisy to adopt.',
  'no-negated-condition': 'Style opinion or too noisy to adopt.',
  'no-nested-ternary': 'Style opinion or too noisy to adopt.',
  'no-array-for-each': 'Style opinion or too noisy to adopt.',
  'no-array-reduce': 'Style opinion or too noisy to adopt.',
  'prefer-global-this': 'Style opinion or too noisy to adopt.',
  'import-style': 'Style opinion or too noisy to adopt.',
  'explicit-length-check': 'Style opinion or too noisy to adopt.',
  'prefer-https': 'Style opinion or too noisy to adopt.',
  'no-this-outside-of-class': 'Style opinion or too noisy to adopt.',
  'consistent-destructuring': 'Style opinion or too noisy to adopt.',
  'prefer-code-point': 'Style opinion or too noisy to adopt.',
  'no-unused-array-method-return':
    'Style opinion, a false positive, or an unsafe autofix.',
  'no-array-method-this-argument':
    'Style opinion, a false positive, or an unsafe autofix.',
  'prefer-top-level-await':
    'Style opinion, a false positive, or an unsafe autofix.',
  'prefer-module': 'Style opinion, a false positive, or an unsafe autofix.',
  'no-useless-spread': 'Style opinion, a false positive, or an unsafe autofix.',
  'no-anonymous-default-export':
    'Style opinion, a false positive, or an unsafe autofix.',
  'prefer-add-event-listener':
    'Style opinion, a false positive, or an unsafe autofix.',
  'no-empty-file': 'Style opinion, a false positive, or an unsafe autofix.',
  'prefer-math-min-max':
    'Style opinion, a false positive, or an unsafe autofix.',
  'require-css-escape':
    'Style opinion, a false positive, or an unsafe autofix.',
  'better-dom-traversing':
    'Style opinion, a false positive, or an unsafe autofix.',
  'prefer-includes-over-repeated-comparisons':
    'Style opinion, a false positive, or an unsafe autofix.',
  'no-unused-properties':
    'Style opinion, a false positive, or an unsafe autofix.',
  'no-array-reverse': 'Style opinion, a false positive, or an unsafe autofix.',
};
