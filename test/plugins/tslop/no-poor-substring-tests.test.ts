import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tsParser from '@typescript-eslint/parser';
import { describe, expect, it } from '@jest/globals';
import { Linter } from 'eslint';

import { rules } from '../../../src/plugins/tslop/index.js';
import { lintWith } from '../../utils/tslop.js';

const lint = (code: string): (string | undefined)[] =>
  lintWith('no-poor-substring-tests', code, [], 'src/a.test.ts');

describe('tslop/no-poor-substring-tests', () => {
  it.each<[string, string, string]>([
    [
      'toContain on literal',
      'expect("hello world").toContain("hello");',
      'poorSubstringTest',
    ],
    [
      'toMatch on const',
      'const text = "hello world";\nexpect(text).toMatch(/hello/);',
      'poorSubstringTest',
    ],
    [
      'includes inside expect',
      `const text = \`a\${"b"}\`;\nexpect(text.includes("a")).toBe(true);`,
      'poorSubstringTest',
    ],
    [
      'stringContaining',
      'expect("hello").toEqual(expect.stringContaining("he"));',
      'poorSubstringTest',
    ],
    [
      'assert include',
      'assert.include("hello", "he");\ndeclare const assert: { include(a: string, b: string): void };',
      'poorSubstringTest',
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
      'dynamic subject',
      'declare const text: string;\nexpect(text).toContain("a");',
    ],
    ['exact match', 'expect("hello").toBe("hello");'],
    ['array toContain', 'expect([1, 2]).toContain(1);'],
  ])('accepts %s', (_name, code) => {
    expect(lint(code)).toEqual([]);
  });
});

describe('tslop/no-poor-substring-tests with an imported constant', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'substring-'));
  writeFileSync(
    path.join(directory, 'constants.ts'),
    'export const QUOTED = "abc";\nexport const TICKED = `abc`;\nexport const NUMBER = 3;\n',
  );
  const lintInDirectory = (code: string): (string | undefined)[] =>
    new Linter({ cwd: directory })
      .verify(
        code,
        [
          {
            files: ['**/*.ts'],
            languageOptions: { parser: tsParser },
            plugins: { tslop: { rules } },
            rules: { 'tslop/no-poor-substring-tests': 'error' },
          },
        ],
        path.join(directory, 'constants.test.ts'),
      )
      .map((message) => message.messageId ?? `fatal: ${message.message}`);

  it.each(['QUOTED', 'TICKED'])(
    'reads the file of %s without crashing and reports the substring test',
    (name) => {
      expect(
        lintInDirectory(
          `import { ${name} } from "./constants.js";\nexpect(${name}).toContain("a");`,
        ),
      ).toEqual(['poorSubstringTest']);
    },
  );

  it('does not report a constant that is not a string', () => {
    expect(
      lintInDirectory(
        'import { NUMBER } from "./constants.js";\nexpect(NUMBER).toContain("a");',
      ),
    ).toEqual([]);
  });
});
