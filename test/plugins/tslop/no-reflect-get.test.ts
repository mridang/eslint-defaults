import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-reflect-get', code, [], 'file.ts');

describe('tslop/no-reflect-get', () => {
  it.each<[string, string, string]>([
    ['Reflect.get', 'Reflect.get({}, "a");', 'reflectGet'],
    ['computed', 'Reflect["get"]({}, "a");', 'reflectGet'],
  ])('reports %s', (_name, code, id) => {
    const ids = lint(code);
    if (id === '__any__') {
      expect(ids.length).toBeGreaterThan(0);
    } else {
      expect(ids).toContain(id);
    }
  });

  it.each<[string, string]>([
    ['Reflect.has', 'Reflect.has({}, "a");'],
    ['shadowed Reflect', 'const Reflect = { get() {} };\nReflect.get();'],
    ['plain access', 'export const a = ({ b: 1 }).b;'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
