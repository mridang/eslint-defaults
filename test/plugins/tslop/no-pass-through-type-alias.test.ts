import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-pass-through-type-alias', code, [], 'file.ts');

describe('tslop/no-pass-through-type-alias', () => {
  it.each<[string, string, string]>([
    ['rename', 'type B = string;\nexport type A = B;', 'passThroughAlias'],
    [
      'qualified',
      'export type A = Foo.Bar;\ndeclare namespace Foo { type Bar = 1 }',
      'passThroughAlias',
    ],
    [
      'forwarded generics',
      'export type A<T, U> = Map<T, U>;',
      'passThroughAlias',
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
    ['narrowing', 'export type A = Partial<B>;\ntype B = { a: 1 };'],
    ['generics reordered', 'export type A<T, U> = Map<U, T>;'],
    ['extra argument', 'export type A<T> = Map<T, string>;'],
    ['union', 'export type A = B | C;\ntype B = 1;\ntype C = 2;'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
