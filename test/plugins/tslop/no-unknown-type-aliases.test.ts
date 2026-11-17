import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-unknown-type-aliases', code, [], 'file.ts');

describe('tslop/no-unknown-type-aliases', () => {
  it.each<[string, string, string]>([
    ['direct', 'export type A = unknown;', 'unknownAlias'],
    ['union', 'export type A = unknown | string;', 'unknownAlias'],
    [
      'through another alias',
      'type B = unknown;\nexport type A = B;',
      'unknownAlias',
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
    ['string alias', 'export type A = string;'],
    [
      'generic parameter shadows alias',
      'type T = string;\nexport type A<T> = T;',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
