import { describe, expect, it } from '@jest/globals';
import jsPlugin from '@eslint/js';
import { fixupPluginRules } from '@eslint/compat';
import typescriptParser from '@typescript-eslint/parser';
import { ESLint } from 'eslint';
// eslint-disable-next-line e18e/ban-dependencies -- the preset's import rules are built on this plugin
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
// eslint-disable-next-line e18e/ban-dependencies -- the preset's React rules are built on this plugin
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import {
  coreExclusions,
  coreJavaScriptRuleSettings,
  coreRuleSettings,
  importRuleSettings,
  reactRuleSettings,
  unavailableRules,
} from '../src/core-rules.js';
import { bannedApiRuleSettings } from '../src/hardened.js';
import type { Linter } from 'eslint';

/**
 * The rules the ultracite ESLint preset (8.0.2) turns on from core ESLint, eslint-plugin-import
 * (its import-x twin), React, React Hooks and jsx-a11y, by plugin, after eslint-config-prettier.
 * Every one is either on in the preset, in coreExclusions with a reason, or in unavailableRules.
 */
const ULTRACITE = {
  core: 'accessor-pairs array-callback-return arrow-body-style block-scoped-var camelcase class-methods-use-this complexity consistent-return consistent-this constructor-super curly default-case default-case-last default-param-last dot-notation eqeqeq for-direction func-name-matching func-names func-style getter-return grouped-accessor-pairs guard-for-in id-denylist id-match logical-assignment-operators max-classes-per-file max-nested-callbacks no-alert no-array-constructor no-async-promise-executor no-await-in-loop no-bitwise no-caller no-case-declarations no-class-assign no-compare-neg-zero no-cond-assign no-const-assign no-constant-binary-expression no-constant-condition no-constructor-return no-control-regex no-debugger no-delete-var no-div-regex no-dupe-args no-dupe-class-members no-dupe-else-if no-dupe-keys no-duplicate-case no-duplicate-imports no-else-return no-empty no-empty-character-class no-empty-function no-empty-pattern no-empty-static-block no-eq-null no-eval no-ex-assign no-extend-native no-extra-bind no-extra-boolean-cast no-extra-label no-fallthrough no-func-assign no-global-assign no-implicit-globals no-implied-eval no-import-assign no-inline-comments no-inner-declarations no-invalid-regexp no-invalid-this no-irregular-whitespace no-iterator no-label-var no-labels no-lone-blocks no-lonely-if no-loop-func no-loss-of-precision no-magic-numbers no-misleading-character-class no-multi-assign no-multi-str no-negated-condition no-nested-ternary no-new no-new-func no-new-native-nonconstructor no-new-wrappers no-nonoctal-decimal-escape no-obj-calls no-object-constructor no-octal no-octal-escape no-param-reassign no-plusplus no-promise-executor-return no-proto no-prototype-builtins no-redeclare no-regex-spaces no-restricted-exports no-restricted-globals no-restricted-imports no-restricted-syntax no-return-assign no-script-url no-self-assign no-self-compare no-sequences no-setter-return no-shadow no-shadow-restricted-names no-sparse-arrays no-template-curly-in-string no-this-before-super no-throw-literal no-unassigned-vars no-undef no-undef-init no-unexpected-multiline no-unmodified-loop-condition no-unneeded-ternary no-unreachable no-unreachable-loop no-unsafe-finally no-unsafe-negation no-unsafe-optional-chaining no-unused-expressions no-unused-labels no-unused-private-class-members no-unused-vars no-use-before-define no-useless-assignment no-useless-backreference no-useless-call no-useless-catch no-useless-computed-key no-useless-concat no-useless-constructor no-useless-escape no-useless-rename no-useless-return no-var no-void no-warning-comments no-with object-shorthand one-var operator-assignment prefer-arrow-callback prefer-const prefer-destructuring prefer-exponentiation-operator prefer-named-capture-group prefer-numeric-literals prefer-object-has-own prefer-object-spread prefer-promise-reject-errors prefer-regex-literals prefer-rest-params prefer-spread prefer-template preserve-caught-error radix require-atomic-updates require-await require-unicode-regexp require-yield sort-keys sort-vars strict symbol-description unicode-bom use-isnan valid-typeof vars-on-top yoda',
  import:
    'avoid-barrel-files avoid-importing-barrel-files avoid-namespace-import avoid-re-export-all consistent-type-specifier-style dynamic-import-chunkname newline-after-import no-absolute-path no-amd no-cycle no-deprecated no-duplicates no-empty-named-blocks no-extraneous-dependencies no-import-module-exports no-mutable-exports no-named-as-default no-named-as-default-member no-named-default no-relative-packages no-rename-default no-restricted-paths no-self-import no-useless-path-segments no-webpack-loader-syntax order prefer-namespace-import',
  react:
    'boolean-prop-naming button-has-type checked-requires-onchange-or-readonly default-props-match-prop-types destructuring-assignment display-name forbid-dom-props forbid-elements forbid-foreign-prop-types forbid-prop-types function-component-definition hook-use-state iframe-missing-sandbox jsx-curly-brace-presence jsx-fragments jsx-handler-names jsx-key jsx-no-comment-textnodes jsx-no-constructed-context-values jsx-no-duplicate-props jsx-no-leaked-render jsx-no-script-url jsx-no-target-blank jsx-no-undef jsx-no-useless-fragment jsx-pascal-case jsx-props-no-spread-multi jsx-uses-react jsx-uses-vars no-access-state-in-setstate no-adjacent-inline-elements no-children-prop no-danger no-danger-with-children no-deprecated no-did-mount-set-state no-did-update-set-state no-direct-mutation-state no-find-dom-node no-is-mounted no-namespace no-object-type-as-default-prop no-redundant-should-component-update no-render-return-value no-set-state no-string-refs no-this-in-sfc no-typos no-unescaped-entities no-unsafe no-unstable-nested-components no-unused-prop-types no-unused-state no-will-update-set-state prefer-es6-class prefer-exact-props prefer-read-only-props prefer-stateless-function prop-types require-optimization require-render-return self-closing-comp sort-comp sort-default-props sort-prop-types state-in-constructor static-property-placement style-prop-object void-dom-elements-no-children',
  'react-hooks':
    'capitalized-calls config error-boundaries exhaustive-deps exhaustive-effect-dependencies fbt gating globals hooks immutability incompatible-library invariant memo-dependencies memoized-effect-dependencies no-deriving-state-in-effects preserve-manual-memoization purity refs rule-suppression rules-of-hooks set-state-in-effect set-state-in-render static-components syntax todo unsupported-syntax use-memo void-use-memo',
  'jsx-a11y':
    'alt-text anchor-ambiguous-text anchor-has-content anchor-is-valid aria-activedescendant-has-tabindex aria-props aria-proptypes aria-role aria-unsupported-elements autocomplete-valid click-events-have-key-events control-has-associated-label heading-has-content html-has-lang iframe-has-title img-redundant-alt interactive-supports-focus label-has-associated-control lang media-has-caption mouse-events-have-key-events no-access-key no-aria-hidden-on-focusable no-distracting-elements no-interactive-element-to-noninteractive-role no-noninteractive-element-interactions no-noninteractive-element-to-interactive-role no-noninteractive-tabindex no-redundant-roles no-static-element-interactions prefer-tag-over-role role-has-required-aria-props role-supports-aria-props scope tabindex-no-positive',
};

const ultraciteRules = Object.entries(ULTRACITE).flatMap(([namespace, names]) =>
  names
    .split(' ')
    .map((name) => (namespace === 'core' ? name : `${namespace}/${name}`)),
);

const settings: Linter.RulesRecord = {
  ...coreRuleSettings,
  ...coreJavaScriptRuleSettings,
  ...importRuleSettings,
  ...reactRuleSettings,
};

const isOn = (value: unknown): boolean => {
  const level: unknown = Array.isArray(value) ? value[0] : value;
  return level !== 'off' && level !== 0 && level !== undefined;
};

const effectiveRules = async (filePath: string): Promise<Set<string>> => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const config = (await eslint.calculateConfigForFile(filePath)) as {
    rules: Record<string, unknown>;
  };
  return new Set(
    Object.entries(config.rules)
      .filter(([, value]) => isOn(value))
      .map(([name]) => name),
  );
};

const effectiveForEverything = async (
  filePaths: string[],
): Promise<Set<string>> => {
  const all = new Set<string>();
  for (const filePath of filePaths) {
    for (const name of await effectiveRules(filePath)) {
      all.add(name);
    }
  }
  return all;
};

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- the plugins ship no types, so their values are any */
const known = (): Set<string> => {
  const names = new Set<string>(Object.keys(jsPlugin.configs.all.rules));
  const plugins = {
    import: importPlugin,
    react: reactPlugin,
    'react-hooks': reactHooksPlugin,
    'jsx-a11y': jsxA11yPlugin,
  };
  for (const [namespace, plugin] of Object.entries(plugins)) {
    for (const name of Object.keys(plugin.rules ?? {})) {
      names.add(`${namespace}/${name}`);
    }
  }
  return names;
};
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access -- end of the untyped plugin values */

const isCovered = (name: string, effective: Set<string>): boolean =>
  isOn(settings[name]) ||
  isOn(bannedApiRuleSettings[name]) ||
  effective.has(name);

describe('ultracite rule coverage', () => {
  it('lists the rules it counts', () => {
    expect(ultraciteRules.length).toBeGreaterThan(300);
  });

  it('covers every ultracite rule: on, excluded with a reason, or unavailable', async () => {
    const effective = await effectiveForEverything([
      'src/example/file.ts',
      'src/example/file.js',
      'src/example/file.tsx',
    ]);
    const uncovered = ultraciteRules.filter(
      (name) =>
        !isCovered(name, effective) &&
        !(name in coreExclusions) &&
        !(name in unavailableRules),
    );
    expect(uncovered).toEqual([]);
  });

  it('gives every exclusion a real reason', () => {
    const thin = Object.entries({ ...coreExclusions, ...unavailableRules })
      .filter(([, reason]) => reason.length < 40)
      .map(([name]) => name);
    expect(thin).toEqual([]);
  });

  it('only excludes rules that exist in the installed plugins', () => {
    const rules = known();
    expect(
      Object.keys(coreExclusions).filter(
        (name) => !rules.has(name) && !name.startsWith('@typescript-eslint/'),
      ),
    ).toEqual([]);
  });

  it('does not switch on a rule it excludes', async () => {
    const effective = await effectiveForEverything([
      'src/example/file.ts',
      'src/example/file.js',
    ]);
    const wrong = Object.keys(coreExclusions).filter(
      (name) => isOn(settings[name]) || effective.has(name),
    );
    expect(wrong).toEqual([]);
  });

  it('lists as unavailable only rules the installed plugins lack', () => {
    const rules = known();
    expect(
      Object.keys(unavailableRules).filter((name) => rules.has(name)),
    ).toEqual([]);
  });

  it('only switches on rules that exist in the installed plugins', () => {
    const rules = known();
    expect(Object.keys(settings).filter((name) => !rules.has(name))).toEqual(
      [],
    );
  });

  it('keeps JavaScript-only rules out of the all-files settings', () => {
    expect(
      Object.keys(coreJavaScriptRuleSettings).filter(
        (name) => name in coreRuleSettings,
      ),
    ).toEqual([]);
  });

  it('does not repeat a rule of the existing core settings', () => {
    expect(
      Object.keys(coreRuleSettings).filter(
        (name) => name in bannedApiRuleSettings,
      ),
    ).toEqual([]);
  });

  it('switches every rule on as an error', () => {
    const wrong = Object.entries(settings)
      .filter(
        ([, value]) => (Array.isArray(value) ? value[0] : value) !== 'error',
      )
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });
});

describe('ultracite rule settings in ESLint', () => {
  const lint = async (text: string, filePath: string) => {
    const eslint = new ESLint({
      cwd: process.cwd(),
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ['**/*.{js,ts}'],
          languageOptions: { parser: typescriptParser, sourceType: 'module' },
          plugins: {
            import: fixupPluginRules(importPlugin as ESLint.Plugin),
            react: fixupPluginRules(reactPlugin as unknown as ESLint.Plugin),
            'react-hooks': reactHooksPlugin,
            'jsx-a11y': fixupPluginRules(jsxA11yPlugin as ESLint.Plugin),
          },
          settings: { react: { version: '19.0' } },
          rules: { ...settings },
        },
      ],
    });
    const [result] = await eslint.lintText(text, { filePath });
    return result.messages.map((message) => message.ruleId);
  };

  it('accepts every rule and its options', async () => {
    const messages = await lint('export const value = 1;\n', 'src/value.js');
    expect(messages).toEqual([]);
  });

  it.each([
    ['curly', 'if (process.argv.length) console.log(1);\n'],
    ['eqeqeq', 'export const same = (a, b) => a == b;\n'],
    ['no-var', 'var count = 1;\nexport { count };\n'],
    ['prefer-template', 'export const hi = (n) => "hi " + n;\n'],
    ['no-void', 'export const run = () => void 1 + 1;\n'],
    [
      'import/order',
      'import b from "./b.js";\nimport fs from "node:fs";\nexport { b, fs };\n',
    ],
    [
      'import/consistent-type-specifier-style',
      'import { type A } from "./a.js";\nexport type B = A;\n',
    ],
    ['require-unicode-regexp', 'export const pattern = /a+/;\n'],
    [
      'no-promise-executor-return',
      'export const wait = new Promise((resolve) => resolve(1));\n',
    ],
  ])('reports %s', async (rule, text) => {
    const ids = await lint(
      text,
      rule.startsWith('import/') ? 'src/value.ts' : 'src/value.js',
    );
    expect(ids).toContain(rule);
  });
});
