import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-repeated-expect-call', code, [], 'src/a.test.ts');

describe('tslop/no-repeated-expect-call', () => {
  it.each<[string, string, string]>([
    [
      'same call twice',
      'it("a", () => {\n  expect(f(1)).toBe(1);\n  expect(f(1)).toBe(2);\n});\ndeclare function f(n: number): number;',
      'repeatedCall',
    ],
    [
      'await and trailing comma',
      'it("a", async () => {\n  await expect(await g(1, 2,)).toBe(1);\n  await expect(await g(1, 2)).toBe(2);\n});\ndeclare function g(a: number, b: number): Promise<number>;',
      'repeatedCall',
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
      'different arguments',
      'it("a", () => {\n  expect(f(1)).toBe(1);\n  expect(f(2)).toBe(2);\n});\ndeclare function f(n: number): number;',
    ],
    [
      'not adjacent',
      'it("a", () => {\n  expect(f(1)).toBe(1);\n  expect(2).toBe(2);\n  expect(f(1)).toBe(1);\n});\ndeclare function f(n: number): number;',
    ],
    [
      'called once',
      'it("a", () => {\n  const r = f(1);\n  expect(r).toBe(1);\n  expect(r).toBe(1);\n});\ndeclare function f(n: number): number;',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
