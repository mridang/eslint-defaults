import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-widen-then-assert', code, [], 'file.ts');

describe('tslop/no-widen-then-assert', () => {
  it.each<[string, string, string]>([
    [
      'unknown then assert',
      'export function f() {\n  const v: unknown = { id: 1 };\n  return v as { id: number };\n}',
      'widenThenAssert',
    ],
    [
      'asserted to unknown then back',
      'export function f() {\n  const v = { id: 1 } as unknown;\n  return v as { id: number };\n}',
      'widenThenAssert',
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
      'no widening',
      'export function f() {\n  const v = { id: 1 };\n  return v as { id: number };\n}',
    ],
    [
      'unknown from outside',
      'export function f(v: unknown) {\n  return v as { id: number };\n}',
    ],
    [
      'different function',
      'const v: unknown = { id: 1 };\nexport function f() {\n  return v as { id: number };\n}',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
