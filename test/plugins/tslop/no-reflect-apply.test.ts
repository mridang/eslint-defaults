import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-reflect-apply', code, [], 'file.ts');

describe('tslop/no-reflect-apply', () => {
  it.each<[string, string, string]>([
    ['Reflect.apply', 'Reflect.apply(Math.max, null, [1]);', 'reflectApply'],
  ])('reports %s', (_name, code, id) => {
    const ids = lint(code);
    if (id === '__any__') {
      expect(ids.length).toBeGreaterThan(0);
    } else {
      expect(ids).toContain(id);
    }
  });

  it.each<[string, string]>([
    ['fn.apply', 'Math.max.apply(null, [1]);'],
    ['Reflect.get is another rule', 'Reflect.get({}, "a");'],
    ['shadowed', 'const Reflect = { apply() {} };\nReflect.apply();'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});
