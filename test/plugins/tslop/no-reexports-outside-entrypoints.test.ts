import { describe, expect, it } from '@jest/globals';

import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-reexports-outside-entrypoints', code, [], 'src/feature.ts');

describe('tslop/no-reexports-outside-entrypoints', () => {
  it.each<[string, string, string]>([
    ['export from', 'export { a } from "./a";', 'reexport'],
    ['export all', 'export * from "./a";', 'reexport'],
    [
      'export of an import',
      'import { a } from "./a";\nexport { a };',
      'reexport',
    ],
    [
      'default export of an import',
      'import a from "./a";\nexport default a;',
      'reexport',
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
    ['local export', 'const a = 1;\nexport { a };'],
    ['own declaration', 'export const a = 1;'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/no-reexports-outside-entrypoints entrypoints', () => {
  it('allows re-exports in an index file', () => {
    expect(
      lintWith(
        'no-reexports-outside-entrypoints',
        'export * from "./a";',
        [],
        'src/index.ts',
      ),
    ).toEqual([]);
  });
  it('honours the entrypoints option', () => {
    expect(
      lintWith(
        'no-reexports-outside-entrypoints',
        'export * from "./a";',
        [{ entrypoints: ['src/public/*.ts'] }],
        'src/public/api.ts',
      ),
    ).toEqual([]);
    expect(
      lintWith(
        'no-reexports-outside-entrypoints',
        'export * from "./a";',
        [{ entrypoints: ['src/public/*.ts'] }],
        'src/index.ts',
      ),
    ).toEqual(['reexport']);
  });
});
