import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-chained-type-assertions', code, [], 'file.ts');

describe('tslop/no-chained-type-assertions', () => {
  it.each<[string, string, string]>([
    ['as unknown as', 'export const a = {} as unknown as string;', 'chained'],
    ['angle brackets', 'export const a = <string><unknown>{};', 'chained'],
    [
      'three in a row reports once',
      'export const a = 1 as unknown as number as string;',
      'chained',
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
    ['single assertion', 'export const a = {} as string;'],
    ['const chain only', 'export const a = [1] as const as const;'],
    [
      'separate assertions',
      'export const a = ({} as object) && ({} as string);',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
