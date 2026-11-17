import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-duplicate-consts', code, [], 'file.ts');

describe('tslop/no-duplicate-consts', () => {
  it.each<[string, string]>([
    ['single declaration', 'export const MAX_RETRIES = 3;'],
    ['lowercase name is ignored', 'export const maxRetries = 3;'],
    [
      'dynamic value is ignored',
      'export const MAX_RETRIES = compute();\ndeclare function compute(): number;',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/no-duplicate-consts across files', () => {
  const code = 'export const LIMITS = { max: 3 };';
  it('reports the same constant in a second file', () => {
    expect(lintWith('no-duplicate-consts', code, [], 'src/a.ts')).toEqual([]);
    expect(lintWith('no-duplicate-consts', code, [], 'src/b.ts')).toEqual([
      'duplicate',
    ]);
  });
  it('does not report a different value', () => {
    expect(
      lintWith(
        'no-duplicate-consts',
        'export const LIMITS = { max: 4 };',
        [],
        'src/c.ts',
      ),
    ).toEqual([]);
  });
  it('does not report the same file linted again', () => {
    const first = lintWith(
      'no-duplicate-consts',
      'export const ONCE = 1;',
      [],
      'src/d.ts',
    );
    const second = lintWith(
      'no-duplicate-consts',
      'export const ONCE = 1;',
      [],
      'src/d.ts',
    );
    expect(first).toEqual([]);
    expect(second).toEqual([]);
  });
});
