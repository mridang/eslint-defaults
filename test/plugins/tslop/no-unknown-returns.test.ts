import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-unknown-returns', code, [], 'file.ts');

describe('tslop/no-unknown-returns', () => {
  it.each<[string, string, string]>([
    ['unknown', 'export function f(): unknown { return 1; }', 'unknownReturn'],
    [
      'Promise<unknown>',
      'export async function f(): Promise<unknown> { return 1; }',
      'unknownReturn',
    ],
    [
      'through alias',
      'type U = unknown;\nexport const f = (): U => 1;',
      'unknownReturn',
    ],
    ['signature', 'export interface A { f(): unknown }', 'unknownReturn'],
  ])('reports %s', (_name, code, id) => {
    const ids = lint(code);
    if (id === '__any__') {
      expect(ids.length).toBeGreaterThan(0);
    } else {
      expect(ids).toContain(id);
    }
  });

  it.each<[string, string]>([
    ['typed', 'export function f(): string { return "a"; }'],
    ['void', 'export function f(): void {}'],
    ['no annotation', 'export function f() { return 1 as unknown; }'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
