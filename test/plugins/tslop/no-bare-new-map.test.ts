import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-bare-new-map', code, [], 'file.ts');

describe('tslop/no-bare-new-map', () => {
  it.each<[string, string, string]>([
    ['bare', 'export const a = new Map();', 'bareMap'],
    ['in a call', 'console.log(new Map());', 'bareMap'],
  ])('reports %s', (_name, code, id) => {
    const ids = lint(code);
    if (id === '__any__') {
      expect(ids.length).toBeGreaterThan(0);
    } else {
      expect(ids).toContain(id);
    }
  });

  it.each<[string, string]>([
    ['type arguments', 'export const a = new Map<string, number>();'],
    ['entries', 'export const a = new Map([["a", 1]]);'],
    ['annotated variable', 'export const a: Map<string, number> = new Map();'],
    [
      'annotated property',
      'export class A { b: Map<string, number> = new Map(); }',
    ],
    ['local Map', 'class Map {}\nexport const a = new Map();'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
