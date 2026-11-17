import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from '@jest/globals';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import { ESLint } from 'eslint';
import {
  hardenedExclusions,
  hardenedPlugins,
  hardenedRules,
  typescriptExclusions,
  typescriptRuleSettings,
  typescriptTypedRules,
  unicornRuleSettings,
} from '../src/hardened.js';

interface RuleMeta {
  deprecated?: unknown;
}

const rules = hardenedRules();
const enabled = { ...rules.untyped, ...rules.typed };
const namespaces = Object.keys(hardenedPlugins);

describe('hardenedRules', () => {
  it.each(namespaces)('%s: every excluded rule exists', (namespace) => {
    const known = Object.keys(hardenedPlugins[namespace].rules ?? {});
    expect(
      Object.keys(hardenedExclusions[namespace]).filter(
        (name) => !known.includes(name),
      ),
    ).toEqual([]);
  });

  it.each(namespaces)(
    '%s: every live rule is either an error or excluded',
    (namespace) => {
      const missing = Object.entries(hardenedPlugins[namespace].rules ?? {})
        .filter(([, rule]) => !(rule as { meta?: RuleMeta }).meta?.deprecated)
        .map(([name]) => name)
        .filter(
          (name) =>
            enabled[`${namespace}/${name}`] !== 'error' &&
            !(name in hardenedExclusions[namespace]),
        );
      expect(missing).toEqual([]);
    },
  );

  it.each(namespaces)('%s: an excluded rule is not enabled', (namespace) => {
    const wrong = Object.keys(hardenedExclusions[namespace]).filter(
      (name) => `${namespace}/${name}` in enabled,
    );
    expect(wrong).toEqual([]);
  });

  it('keeps rules that need type information apart', () => {
    expect(
      Object.keys(rules.typed).filter((name) => name in rules.untyped),
    ).toEqual([]);
  });
});

describe('unicornExclusions', () => {
  it('only names rules that exist in the installed unicorn', async () => {
    const { unicornExclusions } = await import('../src/hardened.js');
    const { default: unicorn } = await import('eslint-plugin-unicorn');
    expect(
      Object.keys(unicornExclusions).filter((name) => !(name in unicorn.rules)),
    ).toEqual([]);
  });
});

describe('unicornExclusions reasons', () => {
  it('gives every excluded rule a real reason', async () => {
    const { unicornExclusions } = await import('../src/hardened.js');
    const thin = Object.entries(unicornExclusions)
      .filter(([, reason]) => reason.length < 40)
      .map(([name]) => name);
    expect(thin).toEqual([]);
  });
});

describe('unicornRuleSettings', () => {
  it('only names rules that exist in the installed unicorn', async () => {
    const { default: unicorn } = await import('eslint-plugin-unicorn');
    expect(
      Object.keys(unicornRuleSettings).filter(
        (name) => !(name.replace('unicorn/', '') in unicorn.rules),
      ),
    ).toEqual([]);
  });
});

/** Rules of the plugins under test. */
const RELEVANT_RULE = /^(e18e|unicorn|sonarjs)\//u;

/**
 * Lints a snippet without type information. A typed program reads the file
 * from disk, so its comment positions would not match a snippet linted under
 * a real path. The rules under test do not need types.
 */
const UNTYPED_PARSER = {
  files: ['**/*.ts'],
  languageOptions: { parserOptions: { projectService: false, project: false } },
  rules: Object.fromEntries(
    [
      ...Object.keys(rules.typed),
      ...typescriptTypedRules(),
      '@typescript-eslint/no-floating-promises',
    ].map((name) => [name, 'off']),
  ),
} as const;

const lintRuleIds = async (text: string): Promise<string[]> => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfig: [UNTYPED_PARSER],
  });
  const [result] = await eslint.lintText(text, {
    filePath: 'src/example/rules.ts',
  });
  return result.messages
    .map((message) => message.ruleId ?? '')
    .filter((id) => RELEVANT_RULE.test(id));
};

describe('hardened rules that must agree', () => {
  it.each([
    [
      'keeps the callback form of Array.from (not e18e/prefer-array-fill)',
      'export const sizes = Array.from({ length: 3 }, () => 1);\n',
    ],
    [
      'keeps return undefined in a function with a return type',
      'export function find(id: number | undefined): string | undefined {\n  if (id === undefined) return undefined;\n  return String(id);\n}\n',
    ],
    [
      'accepts codePointAt in a loop (e18e and unicorn/prefer-code-point agree)',
      'export function count(text: string): number {\n  let total = 0;\n  for (let position = 0; position < text.length; position += 1) {\n    if (text.codePointAt(position) === 47) total += 1;\n  }\n  return total;\n}\n',
    ],
    [
      'allows the agreed abbreviations',
      'export function handle(req: string, res: string, ctx: string): string {\n  return req + res + ctx;\n}\n',
    ],
  ])('%s', async (_name, code) => {
    expect(await lintRuleIds(code)).toEqual([]);
  });

  it.each([
    [
      'unicorn/no-array-from-fill',
      'export const sizes = Array.from({ length: 3 }).fill(1);\n',
    ],
    [
      'unicorn/no-useless-undefined',
      'export function find(id: number | undefined) {\n  if (id === undefined) return undefined;\n  return String(id);\n}\n',
    ],
    [
      'unicorn/no-array-for-each',
      'export function run(items: string[]): void {\n  items.forEach((item) => console.log(item));\n}\n',
    ],
    [
      'unicorn/prevent-abbreviations',
      'export function id(e: string): string {\n  return e;\n}\n',
    ],
    ['unicorn/no-keyword-prefix', "export const className = 'a';\n"],
    [
      'e18e/prefer-static-regex',
      'export function digits(text: string): boolean {\n  return /\\d/.test(text);\n}\n',
    ],
    [
      'e18e/prefer-static-collator',
      'export function sorted(names: string[]): string[] {\n  return names.toSorted((a, b) => a.localeCompare(b));\n}\n',
    ],
  ])('reports %s', async (ruleId, code) => {
    expect(await lintRuleIds(code)).toContain(ruleId);
  });
});

const tsPluginRules = (typescriptPlugin.rules ?? {}) as Record<
  string,
  { meta?: { deprecated?: unknown } }
>;
const tsLiveRules = Object.entries(tsPluginRules)
  .filter(([, rule]) => !rule.meta?.deprecated)
  .map(([name]) => name);
const tsRecommended = new Set(
  Object.keys(typescriptPlugin.configs.recommended.rules).map((name) =>
    name.replace('@typescript-eslint/', ''),
  ),
);
const tsOn = (name: string): boolean =>
  tsRecommended.has(name) ||
  name === 'no-floating-promises' ||
  `@typescript-eslint/${name}` in typescriptRuleSettings;

describe('typescript-eslint rules', () => {
  it('turns every live rule on or lists it with a reason', () => {
    expect(
      tsLiveRules.filter(
        (name) => !tsOn(name) && !(name in typescriptExclusions),
      ),
    ).toEqual([]);
  });

  it('only excludes rules that exist and are not turned on', () => {
    expect(
      Object.keys(typescriptExclusions).filter(
        (name) => !(name in tsPluginRules) || tsOn(name),
      ),
    ).toEqual([]);
  });

  it('only turns on rules that exist', () => {
    expect(
      Object.keys(typescriptRuleSettings).filter(
        (name) => !(name.replace('@typescript-eslint/', '') in tsPluginRules),
      ),
    ).toEqual([]);
  });

  it('gives every excluded rule a real reason', () => {
    expect(
      Object.entries(typescriptExclusions)
        .filter(([, reason]) => reason.length < 15)
        .map(([name]) => name),
    ).toEqual([]);
  });

  it('knows which of its rules need type information', () => {
    const typed = typescriptTypedRules();
    expect(typed).toEqual(
      expect.arrayContaining([
        '@typescript-eslint/no-unsafe-call',
        '@typescript-eslint/switch-exhaustiveness-check',
      ]),
    );
    expect(typed).not.toContain('@typescript-eslint/consistent-type-imports');
  });
});

/** Lints a snippet with type information, as a virtual file in the project. */
const lintTyped = async (text: string): Promise<string[]> => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: {
          parserOptions: {
            projectService: { allowDefaultProject: ['virtual.ts'] },
            tsconfigRootDir: process.cwd(),
            project: false,
          },
        },
      },
    ],
  });
  const [result] = await eslint.lintText(text, { filePath: 'virtual.ts' });
  return result.messages
    .map((message) => message.ruleId ?? '')
    .filter((id) => id.startsWith('@typescript-eslint/'));
};

describe('typescript-eslint options', () => {
  it.each([
    [
      'lets a thrown Response through (only-throw-error)',
      "export function stop(): never {\n  throw new Response('no', { status: 400 });\n}\n",
      [],
    ],
    [
      'reports a thrown string (only-throw-error)',
      "export function stop(): never {\n  throw 'no';\n}\n",
      ['@typescript-eslint/only-throw-error'],
    ],
    [
      'lets an error be passed on as it arrived (prefer-promise-reject-errors)',
      'export async function wait(err: unknown): Promise<void> {\n  await new Promise<void>((_resolve, reject) => {\n    reject(err);\n  });\n}\n',
      [],
    ],
    [
      'reports a promise rejected with a string (prefer-promise-reject-errors)',
      "export async function wait(): Promise<void> {\n  await new Promise<void>((_resolve, reject) => {\n    reject('no');\n  });\n}\n",
      ['@typescript-eslint/prefer-promise-reject-errors'],
    ],
    [
      'accepts a switch with a default branch (switch-exhaustiveness-check)',
      "export function name(kind: 'a' | 'b'): string {\n  switch (kind) {\n    case 'a': {\n      return 'first';\n    }\n    default: {\n      return 'other';\n    }\n  }\n}\n",
      [],
    ],
    [
      'reports a missing case without a default (switch-exhaustiveness-check)',
      "export function name(kind: 'a' | 'b'): string {\n  switch (kind) {\n    case 'a': {\n      return 'first';\n    }\n  }\n  return 'other';\n}\n",
      ['@typescript-eslint/switch-exhaustiveness-check'],
    ],
    [
      'reports a method taken off its object (unbound-method)',
      'class Box {\n  value = 1;\n  read(): number {\n    return this.value;\n  }\n}\nexport const read = new Box().read;\n',
      ['@typescript-eslint/unbound-method'],
    ],
    [
      'lets a static method be taken (unbound-method with ignoreStatic)',
      'class Box {\n  static make(): number {\n    return 1;\n  }\n}\nexport const make = Box.make;\n',
      [],
    ],
  ])('%s', async (_name, code, expected) => {
    expect(await lintTyped(code)).toEqual(expected);
  });
});

/** Lints a snippet as a file at the given path, with or without type information, and returns every rule id reported. */
const lintAt = async (
  text: string,
  filePath: string,
  typed = false,
): Promise<string[]> => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfig: [
      typed
        ? {
            files: ['**/*.ts'],
            languageOptions: {
              parserOptions: {
                projectService: { allowDefaultProject: ['virtual.ts'] },
                tsconfigRootDir: process.cwd(),
                project: false,
              },
            },
          }
        : UNTYPED_PARSER,
    ],
  });
  const [result] = await eslint.lintText(text, { filePath });
  return result.messages.map((message) => message.ruleId ?? '');
};

describe('restricted properties and alerts', () => {
  it.each([
    ['toFixed', 'export const text = (1.5).toFixed(1);\n'],
    ['localeCompare', "export const order = 'a'.localeCompare('b', 'en');\n"],
    ['toLocaleString', "export const text = (1).toLocaleString('en');\n"],
    [
      'toLocaleDateString',
      "export const text = new Date().toLocaleDateString('en');\n",
    ],
    [
      'toLocaleTimeString',
      "export const text = new Date().toLocaleTimeString('en');\n",
    ],
  ])('reports %s (no-restricted-properties)', async (_name, code) => {
    expect(await lintAt(code, 'src/example/format.ts')).toContain(
      'no-restricted-properties',
    );
  });

  it('reports alert, confirm and prompt (no-alert)', async () => {
    expect(
      await lintAt("window.confirm('sure?');\n", 'src/example/dialog.ts'),
    ).toContain('no-alert');
  });
});

describe('describe, it and test outside test files', () => {
  const code = "describe('x', () => {\n  it('y', () => undefined);\n});\n";

  it('reports them in a file that is not a test file', async () => {
    expect(await lintAt(code, 'src/example/helper.ts')).toContain(
      'no-restricted-globals',
    );
  });

  it.each([
    'src/example/helper.test.ts',
    'src/example/helper.spec.ts',
    'test/helper.ts',
    'tests/helper.ts',
    'e2e/helper.ts',
    'src/__tests__/helper.ts',
  ])('lets %s use them', async (filePath) => {
    expect(await lintAt(code, filePath)).not.toContain('no-restricted-globals');
  });

  it('lets a file that imports them use them', async () => {
    expect(
      await lintAt(
        `import { describe, it } from '@jest/globals';\n${code}`,
        'src/example/helper.ts',
      ),
    ).not.toContain('no-restricted-globals');
  });
});

describe('functional rules', () => {
  it('reports let and loops in source files', async () => {
    const ids = await lintAt(
      'export function count(): number {\n  let total = 0;\n  for (const n of [1, 2]) {\n    total += n;\n  }\n  return total;\n}\n',
      'src/example/count.ts',
    );
    expect(ids).toEqual(
      expect.arrayContaining([
        'functional/no-let',
        'functional/no-loop-statements',
      ]),
    );
  });

  it('leaves let and loops alone in test files', async () => {
    const ids = await lintAt(
      'export function count(): number {\n  let total = 0;\n  for (const n of [1, 2]) {\n    total += n;\n  }\n  return total;\n}\n',
      'src/example/count.test.ts',
    );
    expect(ids.filter((id) => id.startsWith('functional/'))).toEqual([]);
  });

  it.each([
    [
      'reports push on an existing array',
      'export function add(items: string[]): void {\n  items.push("a");\n}\n',
      ['functional/immutable-data'],
    ],
    [
      'reports a sort in place',
      'export function order(items: number[]): number[] {\n  return items.sort((a, b) => a - b);\n}\n',
      ['functional/immutable-data'],
    ],
    [
      'reports a changed error message',
      "export function fail(hint: string): never {\n  const error = new Error('x');\n  error.message += hint;\n  throw error;\n}\n",
      ['functional/immutable-data'],
    ],
    [
      'lets a class set its own fields',
      'export class Box {\n  size = 0;\n  constructor() {\n    this.size = 1;\n  }\n  grow(): void {\n    this.size += 1;\n  }\n}\n',
      [],
    ],
    [
      'lets a copy be sorted in the expression that makes it',
      'export function order(items: number[]): number[] {\n  return [...items].sort((a, b) => a - b);\n}\n',
      [],
    ],
  ])('%s', async (_name, code, expected) => {
    const ids = await lintAt(code, 'virtual.ts', true);
    expect(ids.filter((id) => id.startsWith('functional/'))).toEqual(expected);
  });
});

describe('chrome typings', () => {
  it('does not report the chrome namespace as a type or as a value', async () => {
    const ids = await lintAt(
      '/// <reference types="chrome" />\nexport function show(tab: chrome.tabs.Tab, data: chrome.contextMenus.OnClickData): void {\n  void chrome.runtime.sendMessage({ id: tab.id, item: data.menuItemId });\n}\n',
      'virtual.ts',
      true,
    );
    expect(ids).not.toContain('@typescript-eslint/no-deprecated');
  });

  it('still reports other deprecated code', async () => {
    const ids = await lintAt(
      'export const buffer = new Buffer(1);\n',
      'virtual.ts',
      true,
    );
    expect(ids).toContain('@typescript-eslint/no-deprecated');
  });
});

describe('gitignore', () => {
  /** Asks the built preset, run from a directory, which of the paths ESLint ignores. */
  const ignoredIn = (cwd: string, files: string[]): Record<string, boolean> => {
    const script = path.join(cwd, 'ask.mjs');
    writeFileSync(
      script,
      "import { createRequire } from 'node:module';\nconst [, , project, preset, ...files] = process.argv;\nconst { ESLint } = createRequire(project)('eslint');\nconst { default: defaults } = await import(preset);\nconst eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: defaults.configs.recommended });\nconst answers = await Promise.all(files.map(async (file) => [file, await eslint.isPathIgnored(file)]));\nconsole.log(JSON.stringify(Object.fromEntries(answers)));\n",
    );
    return JSON.parse(
      execFileSync(
        process.execPath,
        [
          script,
          path.join(process.cwd(), 'package.json'),
          pathToFileURL(path.join(process.cwd(), 'dist/index.js')).href,
          ...files,
        ],
        { cwd, encoding: 'utf8' },
      ),
    ) as Record<string, boolean>;
  };

  it('ignores what the .gitignore of the directory lists', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gitignore-'));
    try {
      writeFileSync(path.join(dir, '.gitignore'), 'generated/\n*.gen.ts\n');
      expect(
        ignoredIn(dir, ['generated/a.ts', 'src/a.gen.ts', 'src/a.ts']),
      ).toEqual({
        'generated/a.ts': true,
        'src/a.gen.ts': true,
        'src/a.ts': false,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('finds the .gitignore above when run from a subdirectory', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'gitignore-'));
    const dir = path.join(root, 'packages', 'app');
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(root, '.gitignore'), 'generated/\n');
      expect(ignoredIn(dir, ['generated/a.ts', 'src/a.ts'])).toEqual({
        'generated/a.ts': true,
        'src/a.ts': false,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('still lints when there is no .gitignore', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'gitignore-'));
    try {
      expect(ignoredIn(dir, ['src/a.ts', 'dist/a.ts'])).toEqual({
        'src/a.ts': false,
        'dist/a.ts': true,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** Lints files of a project directory with the built preset, run from that directory, and returns the rule ids reported per file. */
const lintProject = (
  files: Record<string, string>,
  targets: string[],
): Record<string, string[]> => {
  const dir = mkdtempSync(path.join(tmpdir(), 'project-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), content);
    }
    const script = path.join(dir, 'ask.mjs');
    writeFileSync(
      script,
      "import { createRequire } from 'node:module';\nconst [, , project, preset, ...files] = process.argv;\nconst { ESLint } = createRequire(project)('eslint');\nconst { default: defaults } = await import(preset);\nconst eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: defaults.configs.recommended });\nconst results = await eslint.lintFiles(files);\nconsole.log(JSON.stringify(Object.fromEntries(results.map((result) => [result.filePath.slice(process.cwd().length + 1), result.messages.map((message) => message.ruleId)]))));\n",
    );
    return JSON.parse(
      execFileSync(
        process.execPath,
        [
          script,
          path.join(process.cwd(), 'package.json'),
          pathToFileURL(path.join(process.cwd(), 'dist/index.js')).href,
          ...targets,
        ],
        { cwd: dir, encoding: 'utf8' },
      ),
    ) as Record<string, string[]>;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

describe('config-checks through the preset', () => {
  const manifest = (extra: Record<string, Record<string, string>>): string =>
    JSON.stringify({ name: 'demo', version: '1.0.0', ...extra });
  const code = 'export const port = process.env.PORT || 3000;\n';

  it('reports a mixed config type and an undeclared variable in source files', () => {
    const ids = lintProject(
      {
        'package.json': manifest({}),
        '.env.example': 'OTHER=\n',
        'src/config.js': code,
      },
      ['src/config.js'],
    )['src/config.js'];
    expect(ids).toEqual(
      expect.arrayContaining([
        'config-checks/mixed-config-types',
        'config-checks/env-declared-in-example',
      ]),
    );
  });

  it('leaves test files alone', () => {
    const ids = lintProject(
      {
        'package.json': manifest({}),
        '.env.example': 'OTHER=\n',
        'src/config.test.js': code,
      },
      ['src/config.test.js'],
    )['src/config.test.js'];
    expect(ids.filter((id) => id.startsWith('config-checks/'))).toEqual([]);
  });

  it('reports package.json rules: @types under dependencies and an engines range that misses .nvmrc', () => {
    const ids = lintProject(
      {
        'package.json': manifest({
          engines: { node: '<=18.0.0' },
          dependencies: { '@types/node': '^22.0.0' },
        }),
        '.nvmrc': '22\n',
      },
      ['package.json'],
    )['package.json'];
    expect(ids).toEqual(
      expect.arrayContaining([
        'config-checks/nvmrc-matches-engines',
        'config-checks/types-in-dev-dependencies',
      ]),
    );
  });

  it('accepts a consistent package.json', () => {
    const ids = lintProject(
      {
        'package.json': manifest({
          engines: { node: '>=22.0.0' },
          devDependencies: { '@types/node': '^22.0.0' },
        }),
        '.nvmrc': '22\n',
      },
      ['package.json'],
    )['package.json'];
    expect(ids.filter((id) => id.startsWith('config-checks/'))).toEqual([]);
  });
});

describe('intl through the preset', () => {
  const code =
    "export function label(n: number): string {\n  return n === 1 ? 'item' : 'items';\n}\n";

  it('reports a hand-written plural in the source tree', async () => {
    expect(await lintAt(code, 'src/example/label.ts')).toContain(
      'intl/prefer-intl',
    );
  });

  it.each(['test/label.ts', 'src/example/label.test.ts', 'lib/label.ts'])(
    'does not look at %s',
    async (filePath) => {
      expect(await lintAt(code, filePath)).not.toContain('intl/prefer-intl');
    },
  );
});

describe('tslop through the preset', () => {
  it('reports a filter followed by a map', async () => {
    expect(
      await lintAt(
        'export const names = (xs: string[]): string[] => xs.filter(Boolean).map((x) => x.trim());\n',
        'src/example/names.ts',
      ),
    ).toContain('tslop/no-array-filter-map');
  });

  it('leaves the ported rules that are not enabled yet off', async () => {
    expect(
      await lintAt(
        'export const port = (value: unknown): boolean => typeof value === "string";\n',
        'src/example/port.ts',
      ),
    ).not.toContain('tslop/no-runtime-typeof');
  });
});

/** Applies every fix of the full preset to a snippet, as `eslint --fix` does, without type information. */
const fixText = async (
  text: string,
  filePath: string,
): Promise<{ output: string; ruleIds: string[]; fatal: boolean }> => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    fix: true,
    overrideConfig: [UNTYPED_PARSER],
  });
  const [result] = await eslint.lintText(text, { filePath });
  return {
    output: result.output ?? text,
    ruleIds: result.messages.map((message) => message.ruleId ?? ''),
    fatal: result.messages.some((message) => message.fatal),
  };
};

/** A line that starts with a comma: what a broken import merge leaves behind. */
const LEADING_COMMA = /^,/mu;

describe('fixers that must not collide', () => {
  const mixedImports =
    "import {\n  type Thing,\n  FIRST,\n  type Other,\n} from './constants.js';\nimport { second, type More } from './constants.js';\n\nexport const all = [FIRST, second];\nexport type Alias = Thing | Other | More;\n";

  it('leaves a file with mixed inline-type and value imports of one module parsing, and a second fix changes nothing', async () => {
    const first = await fixText(mixedImports, 'src/example/imports.ts');
    expect(first.fatal).toBe(false);
    expect(first.output).not.toMatch(LEADING_COMMA);
    const second = await fixText(first.output, 'src/example/imports.ts');
    expect(second.fatal).toBe(false);
    expect(second.output).toBe(first.output);
  });

  it('leaves the duplicate import for the author and reports it', async () => {
    const { output, ruleIds } = await fixText(
      mixedImports,
      'src/example/imports.ts',
    );
    expect(output.match(/from '\.\/constants\.js'/gu)).toHaveLength(4);
    expect(ruleIds).toContain('no-duplicate-imports');
  });

  it('lints a regex that starts with = clean, and a second fix changes nothing', async () => {
    const code = 'export const padding = /={1,2}$/u;\n';
    const first = await fixText(code, 'src/example/padding.ts');
    expect(first.ruleIds).not.toContain('no-div-regex');
    expect(first.ruleIds).not.toContain(
      'sonarjs/single-char-in-character-classes',
    );
    expect(first.output).toBe(code);
  });
});

describe('rules that contradict each other or their own fixers', () => {
  const unchanged: [string, string, string[]][] = [
    [
      'an if / else if / else chain that returns in every branch',
      "export function name(kind: string): string {\n  if (kind === 'a') {\n    return 'first';\n  } else if (kind === 'b') {\n    return 'second';\n  } else {\n    return 'other';\n  }\n}\n",
      ['no-else-return', 'sonarjs/elseif-without-else'],
    ],
    [
      'a relative path into node_modules',
      "export const load = async () =>\n  import('../../node_modules/@typescript-eslint/types/dist/index.js');\n",
      ['import/no-relative-packages'],
    ],
    [
      'a catch binding while a name is in scope',
      "import { error } from 'node:console';\n\nexport function run(): void {\n  try {\n    error('x');\n  } catch (failure) {\n    throw failure;\n  }\n}\n",
      ['unicorn/catch-error-name', 'sonarjs/variable-name'],
    ],
    [
      'a string built by concatenation around a conditional',
      "export const label = (id: string, ok: boolean, n: string): string =>\n  'a' + id + (ok ? 'x' + n : 'y');\n",
      ['prefer-template', 'sonarjs/no-nested-template-literals'],
    ],
    [
      'a reduce that spreads its accumulator',
      'export const group = (items: string[]): Record<string, number> =>\n  items.reduce<Record<string, number>>(\n    (accumulator, item) => ({ ...accumulator, [item]: 1 }),\n    {},\n  );\n',
      ['e18e/no-spread-in-reduce', 'tslop/no-reduce-accumulator-copy'],
    ],
    [
      'a reduce with an explicit undefined initial value',
      'export const last = (items: number[]): number | undefined =>\n  items.reduce<number | undefined>((_previous, item) => item, undefined);\n',
      ['unicorn/no-useless-undefined', 'sonarjs/reduce-initial-value'],
    ],
    [
      'a set built from two spreads',
      'export const joined = (a: string[], b: string[]): Set<string> =>\n  new Set([...a, ...b]);\n',
      ['unicorn/prefer-iterator-concat', 'e18e/prefer-spread-syntax'],
    ],
    [
      'Array.from over a string',
      'export const letters = (text: string): string[] => Array.from(text);\n',
      ['unicorn/prefer-spread', 'e18e/prefer-spread-syntax'],
    ],
  ];

  it.each(unchanged)(
    'leaves %s as written, and a second fix changes nothing',
    async (_name, code, rejected) => {
      const first = await fixText(code, 'src/example/conflict.ts');
      expect(first.fatal).toBe(false);
      expect(first.output).toBe(code);
      expect(first.ruleIds.filter((id) => rejected.includes(id))).toEqual([]);
    },
  );

  it('turns react/self-closing-comp off for Astro files', async () => {
    const eslint = new ESLint({ cwd: process.cwd() });
    const config = (await eslint.calculateConfigForFile(
      'src/pages/index.astro',
    )) as { rules: Record<string, unknown> };
    expect(config.rules['react/self-closing-comp']).toEqual([0]);
  });
});

describe('Node 20 compatibility of the preset', () => {
  it.each([
    'export const grouped = Map.groupBy([1, 2], (n) => n % 2);\n',
    'export const grouped = Object.groupBy([1, 2], (n) => String(n % 2));\n',
  ])('reports a built-in that Node 20 lacks: %s', async (code) => {
    expect(await lintAt(code, 'src/example/builtin.ts')).toContain(
      'n/no-unsupported-features/es-builtins',
    );
  });
});
