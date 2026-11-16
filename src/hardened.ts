import type { ESLint, Linter } from 'eslint';
import e18ePlugin from '@e18e/eslint-plugin';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- the plugin ships no types, so its value is any
    plugin: promisePlugin,
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
    plugin: sonarjsPlugin,
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
    plugin: jsdocPlugin,
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- the plugin ships no types, so its value is any
    plugin: githubPlugin,
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
    plugin: eslintCommentsPlugin,
    excluded: {
      'no-use':
        'Bans every directive comment, which the other rules already police.',
    },
  },
  {
    namespace: 'e18e',
    plugin: e18ePlugin,
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
    plugin: unusedImportsPlugin,
    excluded: {},
  },
  {
    namespace: 'n',
    plugin: nPlugin,
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

/**
 * typescript-eslint rules switched on in addition to its `recommended` set,
 * decided one by one against 34 repositories (mridang/eslint-defaults#139).
 * Rules without options run with their defaults. A rule listed with options
 * says in a comment why it needs them.
 */
export const typescriptRuleSettings: Linter.RulesRecord = {
  // No findings in any repository today: they only guard new code.
  '@typescript-eslint/adjacent-overload-signatures': 'error',
  '@typescript-eslint/ban-tslint-comment': 'error',
  '@typescript-eslint/consistent-type-assertions': 'error',
  '@typescript-eslint/consistent-type-exports': 'error',
  '@typescript-eslint/no-array-delete': 'error',
  '@typescript-eslint/no-confusing-non-null-assertion': 'error',
  '@typescript-eslint/no-for-in-array': 'error',
  '@typescript-eslint/no-implied-eval': 'error',
  '@typescript-eslint/no-meaningless-void-operator': 'error',
  '@typescript-eslint/no-mixed-enums': 'error',
  '@typescript-eslint/no-non-null-asserted-nullish-coalescing': 'error',
  '@typescript-eslint/no-unnecessary-parameter-property-assignment': 'error',
  '@typescript-eslint/no-unnecessary-qualifier': 'error',
  '@typescript-eslint/no-unsafe-unary-minus': 'error',
  '@typescript-eslint/no-useless-empty-export': 'error',
  '@typescript-eslint/prefer-find': 'error',
  '@typescript-eslint/prefer-for-of': 'error',
  '@typescript-eslint/prefer-literal-enum-member': 'error',
  '@typescript-eslint/prefer-reduce-type-parameter': 'error',
  '@typescript-eslint/prefer-regexp-exec': 'error',
  '@typescript-eslint/prefer-return-this-type': 'error',
  '@typescript-eslint/related-getter-setter-pairs': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
  '@typescript-eslint/restrict-plus-operands': 'error',

  // An auto-fix or only a handful of findings.
  '@typescript-eslint/await-thenable': 'error',
  '@typescript-eslint/consistent-generic-constructors': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/default-param-last': 'error',
  '@typescript-eslint/dot-notation': 'error',
  '@typescript-eslint/no-duplicate-type-constituents': 'error',
  '@typescript-eslint/no-generated-empty-object-type': 'error',
  '@typescript-eslint/no-import-type-side-effects': 'error',
  '@typescript-eslint/no-inferrable-types': 'error',
  '@typescript-eslint/no-redundant-type-constituents': 'error',
  '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
  '@typescript-eslint/no-unnecessary-template-expression': 'error',
  '@typescript-eslint/no-unnecessary-type-arguments': 'error',
  '@typescript-eslint/no-unnecessary-type-assertion': 'error',
  '@typescript-eslint/no-useless-constructor': 'error',
  '@typescript-eslint/no-useless-default-assignment': 'error',
  '@typescript-eslint/non-nullable-type-assertion-style': 'error',
  '@typescript-eslint/prefer-function-type': 'error',
  '@typescript-eslint/prefer-includes': 'error',
  '@typescript-eslint/prefer-optional-chain': 'error',
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/prefer-string-starts-ends-with': 'error',
  '@typescript-eslint/promise-function-async': 'error',
  '@typescript-eslint/return-await': 'error',
  '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',

  // Rules that catch real bugs, reviewed one at a time.
  '@typescript-eslint/no-base-to-string': 'error',
  // A static method cannot lose `this`, so it is not reported.
  '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/no-misused-spread': 'error',
  '@typescript-eslint/no-unnecessary-type-conversion': 'error',
  '@typescript-eslint/restrict-template-expressions': 'error',
  // Passing an error on as it arrived (typed any or unknown) is fine; a string
  // or an object literal is still reported.
  '@typescript-eslint/prefer-promise-reject-errors': [
    'error',
    { allowThrowingAny: true, allowThrowingUnknown: true },
  ],
  // At its default strictness the rule reports a missing case even when the
  // switch has a default branch. This reports only a switch over a union that
  // has no default and misses a value, for example after a member is added.
  '@typescript-eslint/switch-exhaustiveness-check': [
    'error',
    { considerDefaultExhaustiveForUnions: true },
  ],
  // The Chrome typings mark part of the `chrome` global as the deprecated
  // Chrome Apps platform, which does not apply to browser extensions.
  '@typescript-eslint/no-deprecated': [
    'error',
    { allow: [{ from: 'package', package: '@types/chrome', name: 'chrome' }] },
  ],
  // The apps throw an HTTP Response on purpose to end a request handler. Any
  // other value that is not an Error is still reported. A project with the
  // DOM library declares Response in the lib; a Node-only project gets it from
  // the types that ship with Node.
  '@typescript-eslint/only-throw-error': [
    'error',
    {
      allow: [
        { from: 'lib', name: 'Response' },
        { from: 'package', package: 'undici-types', name: 'Response' },
      ],
    },
  ],
  // `any` leaking into typed code. Most findings come from a few untyped
  // imports; type those once and the rest follows.
  '@typescript-eslint/no-unsafe-argument': 'error',
  '@typescript-eslint/no-unsafe-assignment': 'error',
  '@typescript-eslint/no-unsafe-call': 'error',
  '@typescript-eslint/no-unsafe-enum-assignment': 'error',
  '@typescript-eslint/no-unsafe-enum-comparison': 'error',
  '@typescript-eslint/no-unsafe-member-access': 'error',
  '@typescript-eslint/no-unsafe-return': 'error',
};

const NOT_DECIDED =
  'Not decided yet: the findings are listed in mridang/eslint-defaults#139 and the rule stays off until that review reaches it.';

/**
 * The typescript-eslint rules left off, with the reason. Every rule of the
 * plugin is either on (its `recommended` set or the settings above) or listed
 * here, and a test enforces that.
 */
export const typescriptExclusions: Record<string, string> = {
  // Judged and kept off.
  'no-magic-numbers':
    'Reports every bare number, including 0, 1, 2 and HTTP status codes: 29,067 findings across the repositories, 72% of them in tests, and no auto-fix. Making it useful means ignoring most of what it checks.',
  'naming-convention':
    'Needs a configuration per repository: API payloads and database columns use snake_case, and about 11,800 names would have to be listed or renamed.',
  'prefer-readonly-parameter-types':
    'Demands readonly types on every parameter: about 6,600 findings, no auto-fix, and little gain over what TypeScript already checks.',
  'explicit-function-return-type':
    'TypeScript infers return types, and requiring them everywhere is about 3,800 findings of upkeep.',
  'explicit-module-boundary-types':
    'Overlaps explicit-function-return-type, which is off for the same reason.',
  'explicit-member-accessibility':
    'Forces a public keyword on every class member (about 1,900 findings) for no safety gain.',
  'strict-boolean-expressions':
    'Bans ordinary truthiness checks such as if (value); far too strict, about 1,600 findings.',
  'no-non-null-assertion':
    'The ! operator is a deliberate escape hatch used in about 900 places; the no-unsafe-* rules cover the real risks.',
  'max-params': 'An arbitrary limit.',
  'method-signature-style':
    'A style opinion (method versus property signature) with no safety benefit.',
  'no-use-before-define':
    'TypeScript already reports use before definition, and function and class order is a style matter.',
  'member-ordering':
    'The order of class members is handled by the perfectionist plugin.',
  'parameter-properties':
    'Bans the constructor parameter-property shorthand that our classes and NestJS use.',
  'class-methods-use-this':
    'Noisy for methods that implement an interface or a framework contract.',
  'prefer-destructuring': 'A style opinion.',
  'no-empty-function':
    'No-op callbacks such as () => {} are common and intentional.',
  'consistent-indexed-object-style':
    'A style opinion (Record versus index signature).',
  'array-type': 'A style opinion (T[] versus Array<T>).',
  'no-dynamic-delete':
    'delete obj[key] on a dictionary is a normal operation, and the rule only flags the dynamic key.',
  'consistent-return':
    'Duplicates sonarjs/no-inconsistent-returns, which is on.',
  'consistent-type-definitions':
    'A style opinion (interface versus type alias).',
  'no-extraneous-class':
    'Flags classes with only static members, which are used on purpose.',
  'no-unnecessary-type-parameters': 'Noisy for generic helpers.',
  'unified-signatures': 'A style opinion.',
  'no-invalid-void-type': 'A style opinion.',
  'no-unused-private-class-members':
    'Duplicates the base ESLint rule of the same name, which is on.',
  'no-dupe-class-members':
    'TypeScript and the base ESLint rule already report duplicate class members.',
  'no-redeclare':
    'TypeScript and the base ESLint rule already report redeclared variables.',
  'no-invalid-this':
    'TypeScript already reports an invalid this with noImplicitThis.',
  'init-declarations':
    'Forces initialisation at the declaration, which clashes with a let that is assigned inside a try.',
  'no-restricted-types': 'Matches nothing without options.',
  'class-literal-property-style':
    'A style opinion with no benefit that justifies it.',
  'prefer-enum-initializers':
    'A style opinion with no benefit that justifies it.',

  // Still to be decided.
  'strict-void-return': `${NOT_DECIDED} Leaning off: 167 findings of mostly idiomatic code (promisify(exec), Jest mocks), and the promise cases are covered by no-misused-promises and no-floating-promises.`,
  'no-unsafe-type-assertion': NOT_DECIDED,
  'require-await': NOT_DECIDED,
  'no-confusing-void-expression': NOT_DECIDED,
  'prefer-nullish-coalescing': NOT_DECIDED,
  'no-unnecessary-condition': NOT_DECIDED,
  'no-shadow': NOT_DECIDED,
};

/**
 * The rules of typescriptRuleSettings that need type information, which
 * cannot run on files outside a tsconfig.
 * @returns The rule names, with the plugin prefix.
 */
export function typescriptTypedRules(): string[] {
  const rules = (typescriptPlugin.rules ?? {}) as Record<
    string,
    { meta?: RuleMeta }
  >;
  return Object.keys(typescriptRuleSettings).filter(
    (name) =>
      rules[name.replace('@typescript-eslint/', '')]?.meta?.docs
        ?.requiresTypeChecking,
  );
}
