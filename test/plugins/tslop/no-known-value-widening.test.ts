import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-known-value-widening', code, [], 'file.ts');

describe('tslop/no-known-value-widening', () => {
  it.each<[string, string, string]>([
    ['object to unknown', 'export const a: unknown = { id: 1 };', 'widening'],
    ['array to object', 'export const a: object = [1, 2];', 'widening'],
    [
      'literal to open dictionary',
      'export const a: Record<string, string> = { b: "c" };',
      'widening',
    ],
    [
      'return value',
      'export function f(): unknown { return { id: 1 }; }',
      'widening',
    ],
    ['assertion', 'export const a = { id: 1 } as unknown;', 'widening'],
    [
      'class property',
      'export class A { value: object = { id: 1 }; }',
      'widening',
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
    ['inferred', 'export const a = { id: 1 };'],
    [
      'named type',
      'interface User { id: number }\nexport const a: User = { id: 1 };',
    ],
    [
      'empty dictionary accumulator',
      'export const a: Record<string, string> = {};',
    ],
    [
      'unknown parameter flow',
      'export function f(x: unknown): unknown { return x; }',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
