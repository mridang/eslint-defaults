import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-conditional-empty-object-spread', code, [], 'file.ts');

describe('tslop/no-conditional-empty-object-spread', () => {
  it.each<[string, string, string]>([
    [
      'empty alternate',
      'export const a = { ...(x ? { b: 1 } : {}) };\ndeclare const x: boolean;',
      'avoid',
    ],
    [
      'empty consequent',
      'export const a = { ...(x ? {} : { b: 1 }) };\ndeclare const x: boolean;',
      'avoid',
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
    ['plain spread', 'export const a = { ...b };\ndeclare const b: object;'],
    [
      'conditional with two populated objects',
      'export const a = { ...(x ? { b: 1 } : { c: 2 }) };\ndeclare const x: boolean;',
    ],
    [
      'array spread',
      'export const a = [...(x ? [1] : [])];\ndeclare const x: boolean;',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
