import { ESLint } from 'eslint';
import eslintConfig from '../eslint.config.mjs';
import { matchesFileGlob, matchesIgnores } from './utils/patterns.js';

const fileTypeCases = [
  'js',
  'ts',
  'mts',
  'cts',
  'd.ts',
  'd.mts',
  'd.cts',
  'jsx',
  'tsx',
  'json',
  'jsonc',
  'json5',
  'md',
  'yml',
  'yaml',
  'mjs',
  'cjs',
  'html',
  'htm',
  'html.json5',
  'css',
  'scss',
  'sass',
  'less',
  'toml',
];

const configs = Array.isArray(eslintConfig) ? eslintConfig : [eslintConfig];

const extensionPaths: Record<string, string> = {
  md: 'docs/readme.md/code.js',
};

function buildPath(extension: string): string {
  return extensionPaths[extension] ?? `src/example/file.${extension}`;
}

describe('filetype coverage', () => {
  test.each(fileTypeCases)('lints .%s files', (extension) => {
    const filePath = buildPath(extension);
    const isCovered = configs.some((config) => {
      const matchesFiles = matchesFileGlob(filePath, config.files);
      if (!matchesFiles || matchesIgnores(filePath, config.ignores)) {
        return false;
      }
      const hasRules = config.rules && Object.keys(config.rules).length > 0;
      const hasParser = Boolean(config.languageOptions?.parser);
      const hasProcessor =
        typeof config.processor === 'string' && config.processor.length > 0;
      return hasParser || hasRules || hasProcessor;
    });

    expect(isCovered).toBe(true);
  });
});

describe('ESLint 10 plugin compatibility', () => {
  it('runs the react, import and jsx-a11y rules without crashing', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText(
      "import missing from './does-not-exist.js';\nexport default missing;\n",
      { filePath: 'src/app.js' },
    );

    expect(result.messages.filter((message) => message.fatal)).toEqual([]);
    expect(result.messages.map((message) => message.ruleId)).toContain(
      'import/no-unresolved',
    );
  });
});

describe('unicorn rules', () => {
  it('enables the unicorn plugin for scripts', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText('export const value = null;\n', {
      filePath: 'src/value.js',
    });

    expect(result.messages.map((message) => message.ruleId)).toContain(
      'unicorn/no-null',
    );
  });
});

describe('package.json linting', () => {
  const lint = async (text: string): Promise<string[]> => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText(text, { filePath: 'package.json' });
    return result.messages.map((message) => message.ruleId ?? '');
  };

  it('reports missing metadata fields', async () => {
    const ruleIds = await lint('{"version":"1.0.0"}');

    expect(ruleIds).toEqual(
      expect.arrayContaining([
        'package-json/require-description',
        'package-json/require-license',
        'package-json/require-repository',
      ]),
    );
  });

  it('reports scripts that are out of order', async () => {
    const ruleIds = await lint('{"scripts":{"test":"a","build":"b"}}');

    expect(ruleIds).toContain('package-json/sort-collections');
  });
});
