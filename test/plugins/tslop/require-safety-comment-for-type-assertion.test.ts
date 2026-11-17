import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('require-safety-comment-for-type-assertion', code, [], 'file.ts');

describe('tslop/require-safety-comment-for-type-assertion', () => {
  it.each<[string, string, string]>([
    [
      'bare assertion',
      'export const a = {} as string;',
      'missingSafetyComment',
    ],
    ['angle bracket', 'export const a = <string>{};', 'missingSafetyComment'],
    [
      'comment without reason',
      '// SAFETY:\nexport const a = {} as string;',
      'missingSafetyComment',
    ],
    [
      'comment too far away',
      '// SAFETY: ok\nexport const b = 1;\nexport const a = {} as string;',
      'missingSafetyComment',
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
    ['as const', 'export const a = [1] as const;'],
    [
      'safety comment before statement',
      '// SAFETY: checked by the schema above\nexport const a = {} as string;',
    ],
    [
      'safety comment inside expression',
      'export const a = (\n  // SAFETY: always a string here\n  {} as string\n);',
    ],
    [
      'safety comment before return',
      'export function f(): string {\n  // SAFETY: invariant of the caller\n  return {} as string;\n}',
    ],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/require-safety-comment-for-type-assertion options', () => {
  it('accepts a configured marker', () => {
    expect(
      lintWith(
        'require-safety-comment-for-type-assertion',
        '// INVARIANT: checked\nexport const a = {} as string;',
        [{ markers: ['INVARIANT'] }],
      ),
    ).toEqual([]);
  });
  it('rejects the default marker when another is configured', () => {
    expect(
      lintWith(
        'require-safety-comment-for-type-assertion',
        '// SAFETY: checked\nexport const a = {} as string;',
        [{ markers: ['INVARIANT'] }],
      ),
    ).toEqual(['missingSafetyComment']);
  });
});
