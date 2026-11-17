import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-unknown-parameters', code, [], 'file.ts');

describe('tslop/no-unknown-parameters', () => {
  it.each<[string, string, string]>([
    [
      'unknown',
      'export function f(x: unknown) { return x; }',
      'unknownParameter',
    ],
    [
      'union with unknown',
      'export const f = (x: unknown | string) => x;',
      'unknownParameter',
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
    ['cause is allowed', 'export function f(cause: unknown) { return cause; }'],
    [
      'type predicate subject',
      'export function f(value: unknown): value is string { return true; }',
    ],
    [
      'promise catch callback',
      'export const p = Promise.resolve().catch((e: unknown) => e);',
    ],
    [
      'promise then rejection callback',
      'export const p = Promise.resolve().then(() => 1, (e: unknown) => e);',
    ],
    ['named type', 'export function f(x: string) { return x; }'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
