const typescriptParser = require('@typescript-eslint/parser');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');
const jsonPlugin = require('eslint-plugin-json');
const markdownPlugin = require('eslint-plugin-markdown');
const jsPlugin = require('@eslint/js');
const tailwindcssPlugin = require('eslint-plugin-tailwindcss');
const testingLibraryPlugin = require('eslint-plugin-testing-library');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const jsxA11yPlugin = require('eslint-plugin-jsx-a11y');
const importPlugin = require('eslint-plugin-import');
const perfectionistPlugin = require('eslint-plugin-perfectionist');
const typescriptPlugin = require('@typescript-eslint/eslint-plugin');
const xssPlugin = require('eslint-plugin-no-unsanitized');
const path = require('path');

module.exports = {
  meta: {
    name: '@mridang/eslint-defaults',
    version: '0.0.1',
  },
  rules: {
    //
  },
  configs: {
    recommended: [
      {
        ignores: [
          'dist/**',
          'node_modules/**',
          '.serverless',
          '.github',
          '.gitignore',
          '.idea',
          '.nvmrc',
          '.env',
          '.prettierignore',
          '.out',
        ],
      },
      {
        plugins: {
          '@typescript-eslint': typescriptPlugin,
          prettier: prettierPlugin,
        },
      },
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          parser: typescriptParser,
          parserOptions: {
            project: path.join(process.cwd(), 'tsconfig.jest.json'),
            ...reactPlugin.configs['jsx-runtime'].parserOptions,
          },
          globals: {
            ...globals.node,
            ...globals.es2021,
            ...globals.jest,
            ...globals.browser,
            ...globals.jasmine,
            React: 'readonly',
          },
          sourceType: 'module',
        },
        plugins: {
          '@typescript-eslint': typescriptPlugin,
          prettier: prettierPlugin,
          tailwindcss: tailwindcssPlugin,
          'testing-library': testingLibraryPlugin,
          react: reactPlugin,
          'react-hooks': reactHooksPlugin,
          'jsx-a11y': jsxA11yPlugin,
          import: importPlugin,
          perfectionist: perfectionistPlugin,
        },
        rules: {
          ...jsPlugin.configs.recommended.rules,
          '@typescript-eslint/no-floating-promises': 'error',
          ...typescriptPlugin.configs.recommended.rules,
          ...prettierPlugin.configs.recommended.rules,
          ...tailwindcssPlugin.configs.recommended.rules,
          ...testingLibraryPlugin.configs.react.rules,
          ...reactPlugin.configs.recommended.rules,
          ...reactPlugin.configs['jsx-runtime'].rules,
          ...reactHooksPlugin.configs.recommended.rules,
          ...jsxA11yPlugin.configs.recommended.rules,
          ...importPlugin.configs.recommended.rules,
          //...perfectionistPlugin.configs['recommended-alphabetical'].rules,
          'react/prop-types': 'off',
          //'react/jsx-pascal-case': ['warn', { allowAllCaps: true, ignore: [] }],
        },
        settings: {
          tailwindcss: {
            callees: ['twMerge', 'createTheme'],
            classRegex: '^(class(Name)|theme)?$',
          },
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
        files: ['**/*.js', '**/*.jsx'],
        languageOptions: {
          globals: {
            ...globals.node,
            ...globals.es2021,
            ...globals.jest,
            ...globals.browser,
            ...globals.jasmine,
          },
          sourceType: 'module',
        },
        plugins: {
          prettier: prettierPlugin,
          tailwindcss: tailwindcssPlugin,
          'testing-library': testingLibraryPlugin,
          react: reactPlugin,
          'react-hooks': reactHooksPlugin,
          'jsx-a11y': jsxA11yPlugin,
          import: importPlugin,
          perfectionist: perfectionistPlugin,
        },
        rules: {
          ...jsPlugin.configs.recommended.rules,
          ...prettierPlugin.configs.recommended.rules,
          ...tailwindcssPlugin.configs.recommended.rules,
          ...testingLibraryPlugin.configs.react.rules,
          ...reactPlugin.configs.recommended.rules,
          ...reactPlugin.configs['jsx-runtime'].rules,
          ...reactHooksPlugin.configs.recommended.rules,
          ...jsxA11yPlugin.configs.recommended.rules,
          ...importPlugin.configs.recommended.rules,
          //...perfectionistPlugin.configs['recommended-alphabetical'].rules,
          'react/prop-types': 'off',
          //'react/jsx-pascal-case': ['warn', { allowAllCaps: true, ignore: [] }],
        },
        settings: {
          tailwindcss: {
            callees: ['twMerge', 'createTheme'],
            classRegex: '^(class(Name)|theme)?$',
          },
          react: {
            version: 'detect',
          },
        },
      },
      {
        files: ['**/*.js'],
        rules: jsPlugin.configs.recommended.rules,
      },
      xssPlugin.configs.recommended,
      jsonPlugin.configs.recommended,
      ...markdownPlugin.configs.recommended,
    ],
  },
};
