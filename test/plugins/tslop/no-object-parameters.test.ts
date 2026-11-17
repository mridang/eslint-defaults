import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-object-parameters', code, [], 'file.ts');

describe('tslop/no-object-parameters', () => {
  it.each<[string, string, string]>([
    [
      'object parameter',
      'export function f(x: object) { return x; }',
      'objectParameter',
    ],
    [
      'union with object',
      'export const f = (x: object | null) => x;',
      'objectParameter',
    ],
    [
      'alias to object',
      'type O = object;\nexport function f(x: O) { return x; }',
      'objectParameter',
    ],
    [
      'method signature',
      'export interface A { f(x: object): void }',
      'objectParameter',
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
    ['named type', 'export function f(x: { a: 1 }) { return x; }'],
    ['Record', 'export function f(x: Record<string, string>) { return x; }'],
    [
      'return type object is fine',
      'export function f(): object { return {}; }',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
