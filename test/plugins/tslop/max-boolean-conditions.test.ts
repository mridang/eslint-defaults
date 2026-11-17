import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('max-boolean-conditions', code, [], 'file.ts');

describe('tslop/max-boolean-conditions', () => {
  it.each<[string, string, string]>([
    [
      'four terms',
      'declare const a: 1, b: 1, c: 1, d: 1;\nif (a && b && c && d) {}',
      'tooManyConditions',
    ],
    [
      'while loop',
      'declare const a: 1, b: 1, c: 1, d: 1;\nwhile (a || b || c || d) {}',
      'tooManyConditions',
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
    ['three terms', 'declare const a: 1, b: 1, c: 1;\nif (a && b && c) {}'],
    [
      'grouped terms count once',
      'declare const a: 1, b: 1, c: 1, d: 1;\nif (a && (b || c || d)) {}',
    ],
    [
      'nullish does not split',
      'declare const a: 1, b: 1, c: 1, d: 1;\nif (a ?? b ?? c ?? d) {}',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/max-boolean-conditions options', () => {
  it('honours maxConditions', () => {
    expect(
      lintWith(
        'max-boolean-conditions',
        'declare const a: 1, b: 1;\nif (a && b) {}',
        [{ maxConditions: 1 }],
      ),
    ).toEqual(['tooManyConditions']);
  });
});
