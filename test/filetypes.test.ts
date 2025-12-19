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
