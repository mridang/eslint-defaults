import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-shape-in-symbol-names', code, [], 'file.ts');

describe('tslop/no-shape-in-symbol-names', () => {
  it.each<[string, string, string]>([
    ['type name', 'export type UserShape = { a: 1 };', 'forbiddenSymbolName'],
    [
      'variable name, case-insensitive',
      'export const myShAPe = 1;',
      'forbiddenSymbolName',
    ],
    [
      'private identifier',
      'export class A { #shape = 1; }',
      'forbiddenSymbolName',
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
      'borrowed member',
      'declare const other: Record<string, number>;\nexport const a = other.shape;',
    ],
    ['no shape', 'export const user = 1;'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
