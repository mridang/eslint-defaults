const TYPESCRIPT_EXTENSIONS = [
  'ts',
  'tsx',
  'mts',
  'cts',
  'd.ts',
  'd.mts',
  'd.cts',
];
const JAVASCRIPT_EXTENSIONS = ['js', 'jsx', 'mjs', 'cjs'];

export const MARKER_CODE = "import fs from 'fs';\nexport default fs;\n";

export const COVERAGE_DIRECTORY = 'test/coverage-tmp';

/** Files the type-aware lint test needs on disk before typescript-eslint resolves the project. */
export const COVERAGE_SOURCES: Array<[string, string]> = [
  ...[...TYPESCRIPT_EXTENSIONS, ...JAVASCRIPT_EXTENSIONS].map(
    (extension): [string, string] => [
      `${COVERAGE_DIRECTORY}/${extension.replaceAll('.', '-')}.${extension}`,
      MARKER_CODE,
    ],
  ),
  [
    `${COVERAGE_DIRECTORY}/App.vue`,
    `<script lang="ts">\n${MARKER_CODE}</script>\n`,
  ],
  [
    `${COVERAGE_DIRECTORY}/App.svelte`,
    `<script lang="ts">\n${MARKER_CODE}</script>\n`,
  ],
  [
    `${COVERAGE_DIRECTORY}/Page.astro`,
    `---\nimport fs from 'fs';\nconsole.log(fs);\n---\n<div />\n`,
  ],
];
