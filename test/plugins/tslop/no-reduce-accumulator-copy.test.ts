import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-reduce-accumulator-copy', code, [], 'file.ts');

describe('tslop/no-reduce-accumulator-copy', () => {
  it.each<[string, string, string]>([
    [
      'Object.assign copy',
      'export const a = [1].reduce((acc, x) => Object.assign({}, acc, { [x]: x }), {});',
      'accumulatorCopy',
    ],
    [
      'Array.from copy',
      'export const a = [1].reduce((acc: number[], x) => Array.from(acc).concat([x]), [] as number[]);',
      '__any__',
    ],
    [
      'concat copy',
      'export const a = [1].reduce((acc, x) => acc.concat([x]), [] as number[]);',
      'accumulatorCopy',
    ],
    [
      'slice copy',
      'export const a = [1].reduce((acc, x) => { const c = acc.slice(); c.push(x); return c; }, [] as number[]);',
      'accumulatorCopy',
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
      'mutating accumulator',
      'export const a = [1].reduce((acc, x) => { acc.push(x); return acc; }, [] as number[]);',
    ],
    ['concat outside reducer', 'export const a = [1].concat([2]);'],
    [
      'object accumulator concat on other value',
      'export const a = [[1]].reduce((acc, x) => acc + x.concat([2]).length, 0);',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
