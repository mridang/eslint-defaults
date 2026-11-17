import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-duplicate-types', code, [], 'file.ts');

describe('tslop/no-duplicate-types', () => {
  it.each<[string, string, string]>([
    [
      'same interface twice in one file',
      'export interface A { id: number; name: string }\nexport interface B { name: string; id: number }',
      'duplicate',
    ],
    [
      'interface and type alias',
      'export interface A { id: number; name?: string }\nexport type B = { id: number; name?: string };',
      'duplicate',
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
      'different optionality',
      'export interface A { id: number; name?: string }\nexport interface B { id: number; name: string }',
    ],
    [
      'below minimum size',
      'export interface A { id: number }\nexport interface B { id: number }',
    ],
    [
      'extends is ignored',
      'interface P { a: 1 }\nexport interface A extends P { id: number; name: string }\nexport interface B extends P { id: number; name: string }',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/no-duplicate-types across files', () => {
  const code = 'export interface Pair { left: string; right: string }';
  it('reports the same contract in a second file', () => {
    expect(lintWith('no-duplicate-types', code, [], 'src/a.ts')).toEqual([]);
    expect(lintWith('no-duplicate-types', code, [], 'src/b.ts')).toEqual([
      'duplicate',
    ]);
  });
  it('honours minProperties', () => {
    const one =
      'export interface Solo { only: string }\nexport interface Twin { only: string }';
    expect(
      lintWith('no-duplicate-types', one, [{ minProperties: 1 }], 'src/c.ts'),
    ).toEqual(['duplicate']);
  });
});
