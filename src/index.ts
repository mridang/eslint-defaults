import type { ESLint, Linter } from 'eslint';
import typescriptParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import jsonLanguagePlugin from '@eslint/json';
import markdownPlugin from '@eslint/markdown';
import jsPlugin from '@eslint/js';
import tailwindcssPlugin from 'eslint-plugin-tailwindcss';
import testingLibraryPlugin from 'eslint-plugin-testing-library';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import importPlugin from 'eslint-plugin-import';
import perfectionistPlugin from 'eslint-plugin-perfectionist';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import xssPlugin from 'eslint-plugin-no-unsanitized';
import cypressPlugin from 'eslint-plugin-cypress/flat';
import htmlEslintPlugin from '@html-eslint/eslint-plugin';
import htmlParser from '@html-eslint/parser';
import cssPlugin from '@eslint/css';
import ymlPlugin from 'eslint-plugin-yml';
import tomlPlugin from 'eslint-plugin-toml';
import path from 'path';
import fs from 'fs';
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
const require = createRequire(import.meta.url);
const packageJson = require('../package.json') as {
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
const sharedGlobals = {
  ...globals.node,
  ...globals.es2021,
  ...globals.jest,
  ...globals.browser,
  ...globals.jasmine,
};
const tailwindSettings = {
  tailwindcss: {
    callees: ['twMerge', 'createTheme'],
    classRegex: '^(class(Name)|theme)?$',
  },
};
const reactPlugins = {
  prettier: prettierPlugin,
  tailwindcss: tailwindcssPlugin,
  'testing-library': testingLibraryPlugin,
  react: reactPlugin,
  'react-hooks': reactHooksPlugin,
  'jsx-a11y': jsxA11yPlugin,
  import: importPlugin,
  perfectionist: perfectionistPlugin,
};
const tsPlugins = {
  ...reactPlugins,
  '@typescript-eslint': typescriptPlugin,
};
const reactRuleBase: Linter.RulesRecord = {
  ...jsPlugin.configs.recommended.rules,
  ...tailwindcssPlugin.configs.recommended.rules,
  ...testingLibraryPlugin.configs.react.rules,
  ...reactPlugin.configs.recommended.rules,
  ...reactPlugin.configs['jsx-runtime'].rules,
  ...reactHooksPlugin.configs.recommended.rules,
  ...jsxA11yPlugin.configs.recommended.rules,
  ...importPlugin.configs.recommended.rules,
  'react/prop-types': 'off',
};
const tsRules: Linter.RulesRecord = {
  ...reactRuleBase,
  ...typescriptPlugin.configs.recommended.rules,
  '@typescript-eslint/no-floating-promises': 'error',
  ...prettierRules,
};
const jsRules: Linter.RulesRecord = {
  ...reactRuleBase,
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
      'dist/**',
      'node_modules/**',
      '.serverless',
      '.github',
      '.devbox/**',
      'devbox.json',
      'package-lock.json',
      'package.json',
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
      react: {
        version: 'detect',
        pragma: 'React',
      },
      'import/resolver': {
        typescript: {},
      },
    },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: sharedGlobals,
      sourceType: 'module',
    },
    plugins: reactPlugins,
    rules: jsRules,
    settings: {
      ...tailwindSettings,
      react: {
        version: 'detect',
      },
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
  ...tomlPlugin.configs['flat/standard'],
  ...htmlRecommended,
  {
    ...cssRecommended,
    files: ['**/*.css', '**/*.scss', '**/*.sass', '**/*.less'],
    languageOptions: {
      ...(cssRecommended.languageOptions || {}),
      parser: cssPlugin.languages.css as unknown as Linter.Parser,
    },
  },
  cypressPlugin.configs.recommended,
  xssPlugin.configs.recommended,
  ...markdownRecommended,
  ...markdownProcessor,
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
