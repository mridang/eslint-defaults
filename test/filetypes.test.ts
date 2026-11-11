import { ESLint } from 'eslint';
import fs from 'node:fs';
import path from 'node:path';
import { hardenedRules, jsdocTypeRules } from '../src/hardened.js';
import eslintConfig from '../eslint.config.mjs';
import { matchesFileGlob, matchesIgnores } from './utils/patterns.js';

const lintMessages = async (text: string, filePath: string) => {
  const eslint = new ESLint({ cwd: process.cwd() });
  const [result] = await eslint.lintText(text, { filePath });
  return result.messages;
};

const compareCodeUnits = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

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
    const [result] = await eslint.lintText('process.exit(1);\n', {
      filePath: 'src/value.js',
    });

    expect(result.messages.map((message) => message.ruleId)).toContain(
      'unicorn/no-process-exit',
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

describe('shared project settings', () => {
  const lint = async (text: string, filePath: string): Promise<string[]> => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const [result] = await eslint.lintText(text, { filePath });
    return result.messages.map((message) => message.ruleId ?? 'fatal');
  };

  it('does not report ambient types as undefined in TypeScript', async () => {
    expect(
      await lint('export type Db = D1Database;\n', 'src/db.ts'),
    ).not.toContain('no-undef');
  });

  it('resolves the cloudflare:workers runtime module', async () => {
    expect(
      await lint(
        "import { env } from 'cloudflare:workers';\nexport const value = env;\n",
        'src/worker.ts',
      ),
    ).not.toContain('import/no-unresolved');
  });

  it('accepts Tailwind at-rules in CSS', async () => {
    expect(
      await lint('@config "./tailwind.config.js";\n', 'src/app.css'),
    ).not.toContain('css/no-invalid-at-rules');
  });

  it('knows the WebExtension globals', async () => {
    expect(
      await lint('export const id = chrome.runtime.id;\n', 'src/background.js'),
    ).not.toContain('no-undef');
  });
});

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
const EMBEDDED_EXTENSIONS = ['vue', 'svelte', 'astro'];
const TYPESCRIPT_FENCES = ['ts', 'tsx', 'mts', 'cts', 'typescript'];
const JAVASCRIPT_FENCES = [
  'js',
  'jsx',
  'mjs',
  'cjs',
  'javascript',
  'ecmascript',
];
/** The file extension the Markdown processor gives a code block of each language. */
const FENCE_EXTENSION: Record<string, string> = {
  javascript: 'js',
  ecmascript: 'js',
  typescript: 'ts',
};
const fenceExtension = (fence: string): string =>
  FENCE_EXTENSION[fence] ?? fence;
const MARKER_RULE = 'unicorn/prefer-node-protocol';
const MARKER_CODE = "import fs from 'fs';\nexport default fs;\n";

type Language = 'typescript' | 'javascript';

const hardened = hardenedRules();

function expectedRules(language: Language, typed: boolean): string[] {
  const rules: Record<string, unknown> = {
    ...hardened.untyped,
    ...(typed ? hardened.typed : {}),
    ...(language === 'typescript' ? jsdocTypeRules.ts : jsdocTypeRules.js),
  };
  return Object.entries(rules)
    .filter(([, value]) => value !== 'off')
    .map(([name]) => name)
    .toSorted(compareCodeUnits);
}

async function activeRules(
  filePath: string,
): Promise<{ rules: Set<string>; project: unknown }> {
  const eslint = new ESLint({ cwd: process.cwd() });
  const config = await eslint.calculateConfigForFile(filePath);
  const active = Object.entries(config?.rules ?? {})
    .filter(([, value]) => {
      const level = Array.isArray(value) ? value[0] : value;
      return level !== 'off' && level !== 0;
    })
    .map(([name]) => name);
  return {
    rules: new Set(active),
    project: (
      config?.languageOptions?.parserOptions as
        Record<string, unknown> | undefined
    )?.project,
  };
}

function missing(expected: string[], active: Set<string>): string[] {
  return expected.filter((name) => !active.has(name));
}

describe('every hardened rule applies to every kind of code file', () => {
  test.each(TYPESCRIPT_EXTENSIONS)('.%s gets every rule', async (extension) => {
    const { rules } = await activeRules(`src/example/file.${extension}`);

    expect(missing(expectedRules('typescript', true), rules)).toEqual([]);
  });

  test.each(JAVASCRIPT_EXTENSIONS)('.%s gets every rule', async (extension) => {
    const { rules } = await activeRules(`src/example/file.${extension}`);

    expect(missing(expectedRules('javascript', false), rules)).toEqual([]);
  });

  test.each(EMBEDDED_EXTENSIONS)(
    '.%s gets every rule that does not need type information',
    async (extension) => {
      const { rules } = await activeRules(`src/example/file.${extension}`);

      expect(missing(expectedRules('typescript', false), rules)).toEqual([]);
    },
  );

  test('.mdx gets every rule without type information', async () => {
    const { rules } = await activeRules('docs/guide.mdx/0_0.ts');

    expect(missing(expectedRules('typescript', false), rules)).toEqual([]);
  });

  test.each([...TYPESCRIPT_FENCES, ...EMBEDDED_EXTENSIONS])(
    'a %s code block in Markdown gets every rule without type information',
    async (fence) => {
      const { rules, project } = await activeRules(
        `docs/guide.md/0_0.${fenceExtension(fence)}`,
      );

      expect(missing(expectedRules('typescript', false), rules)).toEqual([]);
      expect(
        Object.keys(hardened.typed).filter((name) => rules.has(name)),
      ).toEqual([]);
      expect(project).toBeFalsy();
    },
  );

  test.each(JAVASCRIPT_FENCES)(
    'a %s code block in Markdown gets every rule',
    async (fence) => {
      const { rules } = await activeRules(
        `docs/guide.md/0_0.${fenceExtension(fence)}`,
      );

      expect(missing(expectedRules('javascript', false), rules)).toEqual([]);
    },
  );
});

/** Data and style formats, a sample of each, and a rule that must report it. */
const DATA_FORMATS: Array<[string, string, string | undefined]> = [
  ['json', '{"a":1,"a":2}\n', 'json/no-duplicate-keys'],
  ['jsonc', '{"a":1,"a":2}\n', 'json/no-duplicate-keys'],
  ['json5', '{"a":1,"a":2}\n', 'json/no-duplicate-keys'],
  ['yaml', 'a: "x"\n', 'yml/quotes'],
  ['yml', 'a: "x"\n', 'yml/quotes'],
  ['toml', 'a = 1\n', undefined],
  ['css', '@import "x.css";\n@import "x.css";\n', 'css/no-duplicate-imports'],
  ['html', '<html><body></body></html>\n', '@html-eslint/require-lang'],
  [
    'scss',
    '@import "x";\n@import "x";\n$c: red;\n.a { .b { color: $c; } }\n',
    'css/no-duplicate-imports',
  ],
  ['sass', '$c: red\n.a\n  color: $c\n', undefined],
  ['less', '@c: red;\n.m() { color: @c; }\n.a { .m(); }\n', undefined],
];

describe('code is really linted, with no parse errors', () => {
  const lint = lintMessages;

  const sources: Array<[string, string]> = [
    ...[...TYPESCRIPT_EXTENSIONS, ...JAVASCRIPT_EXTENSIONS].map(
      (extension): [string, string] => [
        `test/coverage-tmp/${extension.replaceAll('.', '-')}.${extension}`,
        MARKER_CODE,
      ],
    ),
    [
      'test/coverage-tmp/App.vue',
      `<script lang="ts">\n${MARKER_CODE}</script>\n`,
    ],
    [
      'test/coverage-tmp/App.svelte',
      `<script lang="ts">\n${MARKER_CODE}</script>\n`,
    ],
    [
      'test/coverage-tmp/Page.astro',
      `---\nimport fs from 'fs';\nconsole.log(fs);\n---\n<div />\n`,
    ],
  ];

  // Files are written to disk because type-aware linting only accepts files
  // that belong to the TypeScript project.
  beforeAll(() => {
    fs.mkdirSync('test/coverage-tmp', { recursive: true });
    for (const [filePath, text] of sources) {
      fs.writeFileSync(path.join(process.cwd(), filePath), text);
    }
  });

  afterAll(() => {
    fs.rmSync('test/coverage-tmp', { recursive: true, force: true });
  });

  test.each(DATA_FORMATS)('a real .%s file', async (format, code, rule) => {
    const messages = await lint(code, `docs/sample.${format}`);

    expect(messages.filter((message) => message.fatal)).toEqual([]);
    if (rule) {
      expect(messages.map((message) => message.ruleId)).toContain(rule);
    }
  });

  test.each(sources)('%s', async (filePath, text) => {
    const messages = await lint(text, filePath);

    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(messages.map((message) => message.ruleId)).toContain(MARKER_RULE);
  });

  describe.each(['md', 'mdx'])('code blocks in a .%s file', (host) => {
    test.each([
      ...TYPESCRIPT_FENCES,
      ...JAVASCRIPT_FENCES,
      ...EMBEDDED_EXTENSIONS,
    ])('a %s block is linted', async (fence) => {
      let body = MARKER_CODE;
      if (fence === 'vue' || fence === 'svelte') {
        body = `<script lang="ts">\n${MARKER_CODE}</script>`;
      } else if (fence === 'astro') {
        body = `---\nimport fs from 'fs';\nconsole.log(fs);\n---\n<div />`;
      }
      const messages = await lint(
        `# Title\n\n\`\`\`${fence}\n${body}\n\`\`\`\n`,
        `docs/guide.${host}`,
      );

      expect(messages.filter((message) => message.fatal)).toEqual([]);
      expect(messages.map((message) => message.ruleId)).toContain(MARKER_RULE);
    });

    test.each(DATA_FORMATS)(
      'a %s block is linted',
      async (format, code, rule) => {
        const messages = await lint(
          `# Title\n\n\`\`\`${format}\n${code}\`\`\`\n`,
          `docs/guide.${host}`,
        );

        expect(messages.filter((message) => message.fatal)).toEqual([]);
        if (rule) {
          expect(messages.map((message) => message.ruleId)).toContain(rule);
        }
      },
    );
  });
});

describe('embedded formats, MDX and styles', () => {
  const lint = lintMessages;
  test.each([
    [
      'src/Format.svelte',
      '<script lang="ts">\nlet   a=1;\nconsole.log( a )\n</script>\n',
    ],
    ['src/Format.astro', '---\nlet   a=1;\nconsole.log( a )\n---\n<div />\n'],
    [
      'src/Format.vue',
      '<script setup lang="ts">\nlet   a=1;\nconsole.log( a )\n</script>\n',
    ],
  ])('Prettier formats %s', async (filePath, text) => {
    const messages = await lint(text, filePath);

    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(messages.map((message) => message.ruleId)).toContain(
      'prettier/prettier',
    );
  });

  test('MDX files are linted, code blocks included', async () => {
    const messages = await lint(
      `# Title\n\nSome <b>text</b>.\n\n\`\`\`ts\n${MARKER_CODE}\`\`\`\n`,
      'docs/guide.mdx',
    );

    expect(messages.filter((message) => message.fatal)).toEqual([]);
    expect(messages.map((message) => message.ruleId)).toContain(MARKER_RULE);
  });

  test.each([
    ['src/a.scss', '$c: red;\n.a { .b { color: $c; } }\n'],
    ['src/a.sass', '$c: red\n.a\n  color: $c\n'],
    ['src/a.less', '@c: red;\n.a { .b { color: @c; } }\n'],
    [
      'docs/guide.md',
      '# T\n\n```scss\n$c: red;\n.a { .b { color: $c; } }\n```\n',
    ],
  ])('%s does not fail with a parse error', async (filePath, text) => {
    const messages = await lint(text, filePath);

    expect(messages.filter((message) => message.fatal)).toEqual([]);
  });
});

describe('no file kind is given a rule from a plugin that is not loaded', () => {
  const directories = [
    'src',
    'test',
    'tests',
    'e2e',
    'src/pages',
    'pages/api',
    'app/api/users',
    'test/fixtures',
    'docs',
  ];
  const extensions = [
    ...TYPESCRIPT_EXTENSIONS,
    ...JAVASCRIPT_EXTENSIONS,
    ...EMBEDDED_EXTENSIONS,
    'mdx',
    'md',
    'json',
    'jsonc',
    'json5',
    'yml',
    'yaml',
    'toml',
    'css',
    'html',
    'txt',
  ];
  const names = ['sample', 'route', 'sample.test', 'sample.spec'];
  const paths = directories.flatMap((directory) =>
    extensions.flatMap((extension) =>
      names.map((name) => `${directory}/${name}.${extension}`),
    ),
  );

  test('every rule of every path belongs to a loaded plugin', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const unloaded: string[] = [];
    for (const filePath of paths) {
      if (await eslint.isPathIgnored(filePath)) {
        continue;
      }
      const config = await eslint.calculateConfigForFile(filePath);
      const plugins = Object.keys(config?.plugins ?? {});
      for (const [rule, value] of Object.entries(config?.rules ?? {})) {
        const level = Array.isArray(value) ? value[0] : value;
        const isActive = level !== 'off' && level !== 0;
        const isPluginRule = rule.includes('/');
        if (
          isActive &&
          isPluginRule &&
          !plugins.some((plugin) => rule.startsWith(`${plugin}/`))
        ) {
          unloaded.push(`${filePath}: ${rule}`);
        }
      }
    }

    expect(unloaded.slice(0, 20)).toEqual([]);
  });
});

describe('rules adjusted for Prettier, frameworks and tests', () => {
  const eslint = new ESLint({ overrideConfigFile: 'eslint.config.mjs' });
  const ruleOf = async (file: string, rule: string): Promise<unknown> => {
    const config = await eslint.calculateConfigForFile(file);
    return config?.rules?.[rule];
  };

  test.each([
    'unicorn/number-literal-case',
    'unicorn/no-nested-ternary',
    'unicorn/empty-brace-spaces',
    'unicorn/template-indent',
    'no-unexpected-multiline',
  ])('leaves %s to Prettier', async (rule) => {
    expect(((await ruleOf('src/example.ts', rule)) as unknown[])?.[0]).toBe(0);
  });

  test('ignores route parameter file names', async () => {
    expect(
      JSON.stringify(await ruleOf('src/[id].ts', 'unicorn/filename-case')),
    ).toContain(String.raw`[.+\\]`);
  });

  test('ignores browser globals in the Node compatibility rule', async () => {
    expect(
      JSON.stringify(
        await ruleOf('src/a.ts', 'n/no-unsupported-features/node-builtins'),
      ),
    ).toContain('navigator');
    expect(
      JSON.stringify(
        await ruleOf('src/a.ts', 'n/no-unsupported-features/node-builtins'),
      ),
    ).toContain('sqlite');
  });

  test('ignores unused names that start with an underscore', async () => {
    const rule = (await ruleOf(
      'src/a.ts',
      'unused-imports/no-unused-vars',
    )) as unknown[];
    expect(JSON.stringify(rule)).toContain('^_');
    expect(
      await ruleOf('src/a.ts', '@typescript-eslint/no-unused-vars'),
    ).toEqual([0]);
  });

  test('leaves HTML layout to Prettier', async () => {
    expect(await ruleOf('src/a.html', '@html-eslint/indent')).toEqual([0]);
  });

  test('applies Testing Library rules in tests only', async () => {
    const rule = 'testing-library/no-debugging-utils';
    expect(await ruleOf('test/a.test.tsx', rule)).toBeDefined();
    expect(await ruleOf('src/a.tsx', rule)).toBeUndefined();
  });

  test.each(['n/no-sync', 'sonarjs/no-hardcoded-ip', 'unicorn/prefer-https'])(
    'turns %s off in tests only',
    async (rule) => {
      expect(((await ruleOf('test/a.test.ts', rule)) as unknown[])?.[0]).toBe(
        0,
      );
      expect(((await ruleOf('src/a.ts', rule)) as unknown[])?.[0]).toBe(2);
    },
  );
});
