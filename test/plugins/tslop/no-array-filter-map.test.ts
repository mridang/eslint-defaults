import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-array-filter-map', code, [], 'file.ts');

describe('tslop/no-array-filter-map', () => {
  it.each<[string, string, string]>([
    [
      'filter then map on a literal',
      'const a = [1,2].filter((x)=>x>1).map((x)=>x*2);\nexport { a };',
      'arrayFilterMap',
    ],
    [
      'map then filter on an annotated binding',
      'export function f(items: number[]) { return items.map((x)=>x*2).filter(Boolean); }',
      'arrayFilterMap',
    ],
    [
      'computed method name',
      'const xs = [1];\nexport const a = xs["filter"](Boolean)["map"](String);',
      'arrayFilterMap',
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
    ['single pass', 'export const a = [1,2].filter(Boolean);'],
    [
      'lazy iterator pipeline',
      'export const a = [1,2].values().filter(Boolean).map(String).toArray();',
    ],
    [
      'unknown receiver',
      'export function f(items) { return items.filter(Boolean).map(String); }',
    ],
    ['map then map', 'export const a = [1].map(String).map(Number);'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
