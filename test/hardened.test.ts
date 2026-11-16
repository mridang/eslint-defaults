import { ESLint } from 'eslint';
import {
  hardenedExclusions,
  hardenedPlugins,
  hardenedRules,
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
      .filter(([, reason]) => (reason as string).length < 40)
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
