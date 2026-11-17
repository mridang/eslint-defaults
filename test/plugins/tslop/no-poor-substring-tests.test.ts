import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-poor-substring-tests', code, [], 'src/a.test.ts');

describe('tslop/no-poor-substring-tests', () => {
  it.each<[string, string, string]>([
    [
      'toContain on literal',
      'expect("hello world").toContain("hello");',
      'poorSubstringTest',
    ],
    [
      'toMatch on const',
      'const text = "hello world";\nexpect(text).toMatch(/hello/);',
      'poorSubstringTest',
    ],
    [
      'includes inside expect',
      `const text = \`a\${"b"}\`;\nexpect(text.includes("a")).toBe(true);`,
      'poorSubstringTest',
    ],
    [
      'stringContaining',
      'expect("hello").toEqual(expect.stringContaining("he"));',
      'poorSubstringTest',
    ],
    [
      'assert include',
      'assert.include("hello", "he");\ndeclare const assert: { include(a: string, b: string): void };',
      'poorSubstringTest',
    ],
  ])('reports %s', (_name, code, id) => {
    const ids = lint(code);
    if (id === '__any__') {
      expect(ids.length).toBeGreaterThan(0);
    } else {
      expect(ids).toContain(id);
    }
  });

  it.each<[string, string]>([
    [
      'dynamic subject',
      'declare const text: string;\nexpect(text).toContain("a");',
    ],
    ['exact match', 'expect("hello").toBe("hello");'],
    ['array toContain', 'expect([1, 2]).toContain(1);'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
