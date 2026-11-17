import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-runtime-typeof', code, [], 'file.ts');

describe('tslop/no-runtime-typeof', () => {
  it.each<[string, string, string]>([
    [
      'typeof string check',
      'export const a = (x: unknown) => typeof x === "string";',
      'runtimeTypeof',
    ],
    [
      'typeof in guard without option',
      'export function f(x: unknown): x is string { return typeof x === "string"; }',
      'runtimeTypeof',
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
    ['existence probe', 'export const a = typeof window === "undefined";'],
    [
      'existence probe reversed',
      'export const a = "undefined" !== typeof window;',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/no-runtime-typeof options', () => {
  const guard =
    'export function f(x: unknown): x is string { return typeof x === "string"; }';
  it('allows typeof inside a type guard with allowInTypeGuards', () => {
    expect(
      lintWith('no-runtime-typeof', guard, [{ allowInTypeGuards: true }]),
    ).toEqual([]);
  });
  it('still reports typeof outside a type guard with allowInTypeGuards', () => {
    expect(
      lintWith(
        'no-runtime-typeof',
        'export const a = (x: unknown) => typeof x;',
        [{ allowInTypeGuards: true }],
      ),
    ).toEqual(['runtimeTypeof']);
  });
});
