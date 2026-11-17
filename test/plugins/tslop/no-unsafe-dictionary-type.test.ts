import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-unsafe-dictionary-type', code, [], 'file.ts');

describe('tslop/no-unsafe-dictionary-type', () => {
  it.each<[string, string, string]>([
    [
      'Record unknown',
      'export type A = Record<string, unknown>;',
      'unsafeDictionary',
    ],
    [
      'index signature any',
      'export interface A { [key: string]: any }',
      '__any__',
    ],
    [
      'Record with union holding unknown',
      'export type A = Record<string, string | unknown>;',
      'unsafeDictionary',
    ],
    [
      'mapped type object',
      'export type A = { [K in string]: object };',
      'unsafeDictionary',
    ],
    [
      'standalone index signature in alias',
      'type D = Record<string, unknown>;\nexport type A = D;',
      'unsafeDictionary',
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
    ['Record of string', 'export type A = Record<string, string>;'],
    [
      'type parameter constraint',
      'export function f<T extends Record<string, unknown>>(x: T) { return x; }',
    ],
    ['Record of named type', 'export type A = Record<string, { id: number }>;'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
