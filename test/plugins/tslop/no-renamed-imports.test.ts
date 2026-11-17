import { describe, expect, it } from '@jest/globals';

import { fixWith, lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-renamed-imports', code, [], 'file.ts');

describe('tslop/no-renamed-imports', () => {
  it.each<[string, string, string]>([
    [
      'renamed',
      'import { readFile as read } from "node:fs";\nexport const a = read;',
      'unnecessaryAlias',
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
      'same name',
      'import { readFile } from "node:fs";\nexport const a = readFile;',
    ],
    [
      'original name already taken',
      'import { readFile as read } from "node:fs";\nconst readFile = 1;\nexport const a = [read, readFile];',
    ],
    ['default import', 'import fs from "node:fs";\nexport const a = fs;'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/no-renamed-imports fixer', () => {
  it('renames the import and its uses', () => {
    expect(
      fixWith(
        'no-renamed-imports',
        'import { readFile as read } from "node:fs";\nexport const a = read;\nexport { read };',
      ),
    ).toBe(
      'import { readFile } from "node:fs";\nexport const a = readFile;\nexport { readFile as read };',
    );
  });
  it('expands a shorthand property', () => {
    expect(
      fixWith(
        'no-renamed-imports',
        'import { x as y } from "m";\nexport const a = { y };',
      ),
    ).toBe('import { x } from "m";\nexport const a = { y: x };');
  });
  it('leaves a use that shadows the original name alone', () => {
    const code =
      'import { x as y } from "m";\nexport function f(x: number) { return [x, y]; }';
    expect(fixWith('no-renamed-imports', code)).toBe(code);
  });
});
