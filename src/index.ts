import type { ESLint, Linter } from 'eslint';
import { fixupPluginRules } from '@eslint/compat';
import typescriptParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import jsonLanguagePlugin from '@eslint/json';
import markdownPlugin from '@eslint/markdown';
import jsPlugin from '@eslint/js';
import testingLibraryPlugin from 'eslint-plugin-testing-library';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import unicornPlugin from 'eslint-plugin-unicorn';
import perfectionistPlugin from 'eslint-plugin-perfectionist';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import xssPlugin from 'eslint-plugin-no-unsanitized';
import cypressPlugin from 'eslint-plugin-cypress';
import htmlEslintPlugin from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';
import cssPlugin from '@eslint/css';
import ymlPlugin from 'eslint-plugin-yml';
import tomlPlugin from 'eslint-plugin-toml';
import packageJsonPlugin from 'eslint-plugin-package-json';
import path from 'node:path';
import fs from 'node:fs';
import { tailwindSupport } from './tailwind.js';
import {
  hardenedPlugins,
  hardenedRules,
  hardenedSettings,
  unicornExclusions,
} from './hardened.js';
import { normalizeConfig, normalizeConfigArray } from './utils.js';
import { createRequire } from 'node:module';

const prettierRules = (normalizeConfig(prettierPlugin.configs?.recommended)
  .rules ?? {}) as Linter.RulesRecord;
const cssRecommended = normalizeConfig(cssPlugin.configs?.recommended);
const htmlRecommendedArray = normalizeConfigArray(
  htmlEslintPlugin.configs?.['flat/recommended'],
);
const markdownRecommended = normalizeConfigArray(
  markdownPlugin.configs?.recommended,
);
const markdownProcessor = normalizeConfigArray(
  markdownPlugin.configs?.processor,
);
const htmlRecommended =
  htmlRecommendedArray.length > 0
    ? htmlRecommendedArray.map((cfg) => ({ ...cfg }))
    : [{} satisfies Linter.Config];
const loadJson = createRequire(import.meta.url);
const packageJson = loadJson('../package.json') as {
  name: string;
  version: string;
};
const htmlConfig = htmlRecommended[htmlRecommended.length - 1];
htmlConfig.files = ['**/*.html', '**/*.htm', '**/*.html.json5'];
htmlConfig.languageOptions = {
  ...(htmlConfig.languageOptions || {}),
  parser: htmlParser,
};
const jsonRecommended = normalizeConfig(
  jsonLanguagePlugin.configs?.recommended,
);
const makeJsonConfig = (
  files: string | string[],
  language: 'json/json' | 'json/jsonc' | 'json/json5',
  extra: Partial<Linter.Config> = {},
): Linter.Config => ({
  ...jsonRecommended,
  ...extra,
  files: Array.isArray(files) ? files : [files],
  language,
});
const tsProjectPath = path.join(
  process.cwd(),
  fs.existsSync(path.join(process.cwd(), 'tsconfig.jest.json'))
    ? 'tsconfig.jest.json'
    : 'tsconfig.json',
);
/** The React version for the lint settings: detected when React is installed, fixed otherwise so the plugin stays quiet. */
const reactVersion = ((): string => {
  try {
    createRequire(path.join(process.cwd(), 'package.json')).resolve(
      'react/package.json',
    );
    return 'detect';
  } catch {
    return '19.0';
  }
})();
const sharedGlobals = {
  ...globals.node,
  ...globals.es2021,
  ...globals.jest,
  ...globals.browser,
  ...globals.jasmine,
  ...globals.webextensions,
};
/** The Tailwind lint support for the project being linted: none, the 3.x or the 4.x plugin. */
const tailwind = tailwindSupport();
const tailwindSettings = tailwind.settings;
const hardened = hardenedRules();
const reactPlugins = {
  ...hardenedPlugins,
  prettier: prettierPlugin,
  ...(tailwind.plugin ? { tailwindcss: tailwind.plugin } : {}),
  'testing-library': testingLibraryPlugin,
  react: fixupPluginRules(reactPlugin as unknown as ESLint.Plugin),
  'react-hooks': reactHooksPlugin,
  'jsx-a11y': fixupPluginRules(jsxA11yPlugin as unknown as ESLint.Plugin),
  import: fixupPluginRules(importPlugin as unknown as ESLint.Plugin),
  perfectionist: perfectionistPlugin,
  unicorn: unicornPlugin,
};
const tsPlugins = {
  ...reactPlugins,
  '@typescript-eslint': typescriptPlugin,
};
const reactRuleBase: Linter.RulesRecord = {
  ...jsPlugin.configs.recommended.rules,
  ...tailwind.rules,
  ...testingLibraryPlugin.configs.react.rules,
  ...reactPlugin.configs.recommended.rules,
  ...reactPlugin.configs['jsx-runtime'].rules,
  ...reactHooksPlugin.configs.recommended.rules,
  ...jsxA11yPlugin.configs.recommended.rules,
  ...importPlugin.configs.recommended.rules,
  ...unicornPlugin.configs.all.rules,
  ...Object.fromEntries(
    Object.keys(unicornExclusions).map((name) => [`unicorn/${name}`, 'off']),
  ),
  'react/prop-types': 'off',
};
const tsRules: Linter.RulesRecord = {
  ...reactRuleBase,
  ...typescriptPlugin.configs.recommended.rules,
  '@typescript-eslint/no-floating-promises': 'error',
  'no-undef': 'off',
  ...hardened.untyped,
  ...hardened.typed,
  ...prettierRules,
};
const jsRules: Linter.RulesRecord = {
  ...reactRuleBase,
  ...hardened.untyped,
  ...prettierRules,
};
const jsonConfigs: Linter.Config[] = [
  makeJsonConfig(['**/*.json'], 'json/json', {
    ignores: ['package-lock.json', '**/tsconfig*.json'],
  }),
  makeJsonConfig(['**/*.jsonc'], 'json/jsonc'),
  makeJsonConfig(['**/tsconfig*.json'], 'json/jsonc', {
    languageOptions: { allowTrailingCommas: true },
  }),
  makeJsonConfig(['**/*.json5'], 'json/json5'),
];

const recommended: Linter.Config[] = [
  {
    ignores: [
      'build/**',
      'dist/**',
      'node_modules/**',
      '.serverless',
      '.github',
      '.devbox/**',
      'devbox.json',
      'package-lock.json',
      'README.md',
      'tsconfig.json',
      'tsconfig.*.json',
      '.gitignore',
      '.idea',
      '.nvmrc',
      '.env',
      '.prettierignore',
      '.out',
      'test/fixtures/**',
    ],
  },
  {
    files: ['**/*.md'],
    rules: {
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'off',
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.mts',
      '**/*.cts',
      '**/*.d.ts',
      '**/*.d.mts',
      '**/*.d.cts',
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: tsProjectPath,
        ...reactPlugin.configs['jsx-runtime'].parserOptions,
      },
      globals: {
        ...sharedGlobals,
        React: 'readonly',
      },
      sourceType: 'module',
    },
    plugins: tsPlugins,
    rules: tsRules,
    settings: {
      ...tailwindSettings,
      ...hardenedSettings,
      react: {
        version: reactVersion,
        pragma: 'React',
      },
      'import/core-modules': ['cloudflare:workers'],
      'import/resolver': {
        typescript: {},
      },
    },
  },
  {
    files: ['**/*.d.ts', '**/*.d.mts', '**/*.d.cts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: sharedGlobals,
      sourceType: 'module',
      ecmaVersion: 'latest',
    },
    plugins: reactPlugins,
    rules: jsRules,
    settings: {
      ...tailwindSettings,
      ...hardenedSettings,
      react: {
        version: reactVersion,
      },
      'import/core-modules': ['cloudflare:workers'],
      'import/resolver': {
        typescript: {},
        node: {
          extensions: ['.js', '.jsx', '.mjs', '.cjs'],
        },
      },
    },
  },
  {
    files: ['**/*.js'],
    rules: jsPlugin.configs.recommended.rules,
  },
  ...jsonConfigs,
  ...ymlPlugin.configs['flat/standard'],
  {
    files: ['*.yaml', '**/*.yaml', '*.yml', '**/*.yml'],
    rules: {
      'yml/quotes': ['error', { prefer: 'single' }],
    },
  },
  ...tomlPlugin.configs['flat/standard'],
  ...htmlRecommended,
  {
    ...cssRecommended,
    rules: {
      ...cssRecommended.rules,
      'css/no-invalid-at-rules': 'off',
      'css/no-invalid-properties': 'off',
    },
    files: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
    language: 'css/css',
  },
  cypressPlugin.configs.recommended,
  xssPlugin.configs.recommended,
  ...markdownRecommended,
  ...markdownProcessor,
  { ...packageJsonPlugin.configs.recommended, language: '@/js' },
];

const config: ESLint.Plugin = {
  meta: {
    name: packageJson.name,
    version: packageJson.version,
  },
  rules: {},
  configs: {
    recommended,
  },
};

// noinspection JSUnusedGlobalSymbols
export default config;
