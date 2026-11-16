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
    expect(typescriptTypedRules()).toEqual(
      expect.arrayContaining([
        '@typescript-eslint/no-unsafe-call',
        '@typescript-eslint/switch-exhaustiveness-check',
      ]),
    );
    expect(typescriptTypedRules()).not.toContain(
      '@typescript-eslint/consistent-type-imports',
    );
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
