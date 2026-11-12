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
import vuePlugin from 'eslint-plugin-vue';
import sveltePlugin from 'eslint-plugin-svelte';
import astroPlugin from 'eslint-plugin-astro';
import {
  createRemarkProcessor,
  flat as mdxFlat,
  flatCodeBlocks as mdxFlatCodeBlocks,
} from 'eslint-plugin-mdx';
import path from 'node:path';
import fs from 'node:fs/promises';
import { tailwindSupport } from './tailwind.js';
import {
  hardenedPlugins,
  hardenedRules,
  hardenedSettings,
  jsdocTypeRules,
  unicornExclusions,
} from './hardened.js';
import {
  EMBEDDED_EXTENSIONS,
  JAVASCRIPT_EXTENSIONS,
  STYLE_EXTENSIONS,
  TYPESCRIPT_EXTENSIONS,
  filesGlobs,
  blockGlobs,
} from './languages.js';
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
const requirePlugin = loadJson;
const packageJson = loadJson('../package.json') as {
  name: string;
  version: string;
};
const [htmlConfig] = htmlRecommended.slice(-1);
htmlConfig.files = ['**/*.html', '**/*.htm', '**/*.html.json5'];
htmlConfig.languageOptions = {
  ...htmlConfig.languageOptions,
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
const hasJestTsconfig = await fs
  .access(path.join(process.cwd(), 'tsconfig.jest.json'))
  .then(() => true)
  .catch(() => false);
const tsProjectPath = path.join(
  process.cwd(),
  hasJestTsconfig ? 'tsconfig.jest.json' : 'tsconfig.json',
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
const tailwind = await tailwindSupport();
const tailwindSettings = tailwind.settings;
/** Matches every TypeScript and JavaScript file. */
const CODE_FILES = `**/*.{${[...TYPESCRIPT_EXTENSIONS, ...JAVASCRIPT_EXTENSIONS].join(',')}}`;
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
  ...jsdocTypeRules.ts,
  ...prettierRules,
};
const jsRules: Linter.RulesRecord = {
  ...reactRuleBase,
  ...hardened.untyped,
  ...jsdocTypeRules.js,
  ...prettierRules,
};
/** Switches off the rules that need type information. */
const untypedOnly: Linter.RulesRecord = Object.fromEntries(
  [
    ...Object.keys(hardened.typed),
    '@typescript-eslint/no-floating-promises',
  ].map((name) => [name, 'off']),
);
/**
 * Limits every entry of a plugin's shared config that names no files to the
 * files of that format, so its rules and parser never reach other files.
 * @param configs - The plugin's shared config.
 * @param files - The globs of the files the plugin is for.
 * @returns The same entries, each limited to those files.
 */
function limitedTo(configs: unknown, files: string[]): Linter.Config[] {
  return (configs as Linter.Config[]).map((entry) => ({
    ...entry,
    files: entry.files ?? files,
  }));
}
/** The plugins of each embedded format, then our TypeScript parser for its script. */
const embeddedParsers: Linter.Config[] = [
  ...limitedTo(vuePlugin.configs['flat/recommended'], ['**/*.vue']),
  ...limitedTo(sveltePlugin.configs['flat/recommended'], ['**/*.svelte']),
  ...limitedTo(astroPlugin.configs['flat/recommended'], ['**/*.astro']),
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: typescriptParser,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: typescriptParser,
        extraFileExtensions: ['.svelte'],
      },
    },
  },
  {
    files: ['**/*.astro'],
    languageOptions: {
      parserOptions: {
        parser: typescriptParser,
        extraFileExtensions: ['.astro'],
      },
    },
  },
];
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
      '**/public/sw.js',
    ],
  },
  {
    files: ['**/*.md', '**/*.md/**'],
    rules: {
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'off',
    },
  },
  {
    files: filesGlobs(TYPESCRIPT_EXTENSIONS),
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
    files: filesGlobs(JAVASCRIPT_EXTENSIONS),
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
  ...embeddedParsers,
  {
    // Code blocks in Markdown are virtual files outside any tsconfig, so the
    // rules that need type information cannot run on them.
    files: blockGlobs([...TYPESCRIPT_EXTENSIONS, ...EMBEDDED_EXTENSIONS]),
    languageOptions: { parserOptions: { project: false } },
    rules: untypedOnly,
  },
  {
    // Vue, Svelte and Astro files: the template is linted by each plugin and
    // the script is parsed as TypeScript, so every TypeScript rule applies.
    files: filesGlobs(EMBEDDED_EXTENSIONS),
    languageOptions: {
      globals: { ...sharedGlobals, React: 'readonly' },
      sourceType: 'module',
    },
    plugins: tsPlugins,
    rules: { ...tsRules, ...untypedOnly },
    settings: {
      ...tailwindSettings,
      ...hardenedSettings,
      react: { version: reactVersion, pragma: 'React' },
      'import/core-modules': ['cloudflare:workers'],
      'import/resolver': { typescript: {} },
    },
  },
  {
    // Prettier reads these formats only through plugins of its own.
    files: ['**/*.svelte'],
    rules: {
      'prettier/prettier': [
        'error',
        {
          plugins: [requirePlugin.resolve('prettier-plugin-svelte')],
          parser: 'svelte',
        },
      ],
    },
  },
  {
    // The Prettier rule formats Astro templates differently from the Prettier
    // command (it moves comments and rewraps attributes), so the two fight each
    // other. Prettier itself checks these files.
    files: ['**/*.astro'],
    rules: { 'prettier/prettier': 'off' },
  },
  {
    // Astro templates are HTML, not React: `class`, `tabindex` and directives
    // such as `set:html` are correct there, lists need no `key`, and text may
    // hold a plain apostrophe. The React fixes for these break `astro check`.
    files: ['**/*.astro'],
    rules: {
      'react/jsx-key': 'off',
      'react/no-unescaped-entities': 'off',
      'react/no-unknown-property': 'off',
    },
  },
  {
    // MDX: the text and its JSX are linted by the MDX plugin, and the code
    // blocks inside are virtual files that follow the rules of their language.
    ...mdxFlat,
    files: ['**/*.mdx'],
    plugins: { ...mdxFlat.plugins, react: reactPlugins.react },
    processor: createRemarkProcessor({
      lintCodeBlocks: true,
      languageMapper: {},
    }),
  },
  { ...mdxFlatCodeBlocks, files: ['**/*.mdx/**'] },
  {
    // Next.js route handlers and Astro or pages-router endpoints must be named GET, POST and so on.
    files: [
      '**/route.{ts,js,mjs}',
      '**/src/pages/**/*.{ts,js}',
      '**/pages/api/**/*.{ts,js}',
    ],
    rules: { 'sonarjs/function-name': 'off' },
  },
  {
    // React components are PascalCase, and tests name fixtures and components freely.
    // Only code files: a list that ends in a code glob keeps the rule away from
    // the data files that live in the same directories.
    files: [
      ...filesGlobs(['tsx', 'jsx']),
      ...[
        '**/test/**',
        '**/tests/**',
        '**/e2e/**',
        '**/*.test.*',
        '**/*.spec.*',
      ].map((location) => [location, CODE_FILES]),
    ],
    rules: {
      'sonarjs/function-name': [
        'error',
        { format: '^[_a-zA-Z][a-zA-Z0-9_]*$' },
      ],
    },
  },
  {
    // Route parameter files such as [id].ts must keep the name the framework reads.
    files: [
      ...filesGlobs(TYPESCRIPT_EXTENSIONS),
      ...filesGlobs(JAVASCRIPT_EXTENSIONS),
    ],
    rules: {
      'unicorn/filename-case': [
        'error',
        { cases: { kebabCase: true }, ignore: [String.raw`^\[.+\]`] },
      ],
      // Conflicts with Prettier.
      'no-unexpected-multiline': 'off',
      // One unused-variable rule, not two: the unused-imports one also removes
      // unused imports, and names that start with an underscore are on purpose.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Browser globals that the Node compatibility rule misreads as experimental.
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          ignores: [
            'navigator',
            'localStorage',
            'Storage',
            'EventSource',
            'ReadableStream',
            // node:sqlite is experimental but used on purpose.
            'sqlite',
            'sqlite.DatabaseSync',
            'sqlite.StatementSync',
          ],
        },
      ],
    },
  },
  {
    // Testing Library rules only make sense in tests: elsewhere they misfire on
    // names like getByIds or debug.
    files: [
      '**/test/**',
      '**/tests/**',
      '**/e2e/**',
      '**/*.test.*',
      '**/*.spec.*',
    ].map((location) => [location, CODE_FILES]),
    rules: testingLibraryPlugin.configs.react.rules,
  },
  {
    // Tests use local servers, plain http URLs and synchronous fixtures freely.
    files: [
      '**/test/**',
      '**/tests/**',
      '**/e2e/**',
      '**/*.test.*',
      '**/*.spec.*',
    ].map((location) => [location, CODE_FILES]),
    rules: {
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/no-clear-text-protocols': 'off',
      'unicorn/prefer-https': 'off',
      'n/no-sync': 'off',
    },
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
    // Layout rules that contradict the Prettier output for HTML.
    files: ['**/*.html', '**/*.htm', '**/*.html.json5'],
    rules: {
      '@html-eslint/indent': 'off',
      '@html-eslint/no-extra-spacing-tags': 'off',
      '@html-eslint/require-closing-tags': 'off',
    },
  },
  {
    ...cssRecommended,
    rules: {
      ...cssRecommended.rules,
      'css/no-invalid-at-rules': 'off',
      'css/no-invalid-properties': 'off',
    },
    files: ['**/*.css'],
    language: 'css/css',
  },
  {
    // Sass, SCSS and Less are not CSS, and ESLint has no language for them.
    // Tolerant parsing keeps the CSS rules working on the CSS they contain
    // instead of failing on the first variable or mixin.
    ...cssRecommended,
    rules: {
      ...cssRecommended.rules,
      'css/no-invalid-at-rules': 'off',
      'css/no-invalid-properties': 'off',
    },
    files: filesGlobs(STYLE_EXTENSIONS),
    language: 'css/css',
    languageOptions: { tolerant: true },
  },
  cypressPlugin.configs.recommended,
  xssPlugin.configs.recommended,
  ...markdownRecommended,
  ...markdownProcessor,
  {
    ...packageJsonPlugin.configs.recommended,
    language: '@/js',
    rules: {
      ...packageJsonPlugin.configs.recommended.rules,
      'no-restricted-syntax': [
        'error',
        {
          selector: String.raw`JSONProperty[key.value='scripts'] > JSONObjectExpression > JSONProperty > JSONLiteral.value[value=/(^|[\s;&|(])npx(\s|$)/]`,
          message:
            'Do not use npx in package.json scripts: npm run already puts node_modules/.bin on the PATH, so call the binary directly.',
        },
      ],
    },
  },
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
