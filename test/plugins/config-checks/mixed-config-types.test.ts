import { fileURLToPath } from 'node:url';
import { expect, it } from '@jest/globals';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import rule from '../../../src/plugins/config-checks/mixed-config-types.js';

const untyped = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

untyped.run('mixed-config-types (syntax only)', rule, {
  valid: [
    { code: 'const a = process.env.PORT || "3000"' },
    { code: 'const a = Number(process.env.PORT ?? 3000)' },
    { code: 'const a = other.PORT || 3000' },
    { code: 'const a = 1 || 3000' },
  ],
  invalid: [
    {
      code: 'const a = process.env.PORT || 3000',
      errors: [{ messageId: 'mixed' }],
    },
    {
      code: 'const a = process.env["PORT"] ?? 3000',
      errors: [{ messageId: 'mixed' }],
    },
    {
      code: 'const a = import.meta.env.PORT || 3000',
      errors: [{ messageId: 'mixed' }],
    },
    {
      code: 'const p = process.env.PORT; const a = p || 3000',
      errors: [{ messageId: 'mixed' }],
    },
    {
      code: 'const a = process.env.PORT ? process.env.PORT : 3000',
      errors: [{ messageId: 'mixed' }],
    },
  ],
});

const root = fileURLToPath(new URL('../../fixtures', import.meta.url));
const typed = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      projectService: { allowDefaultProject: ['*.ts'] },
      tsconfigRootDir: root,
    },
  },
});

typed.run('mixed-config-types (typed)', rule, {
  valid: [
    {
      code: 'declare const n: number; const a = process.env.PORT || "3000"; const b = n || 3',
      filename: 'file.ts',
    },
    { code: 'const a = Number(process.env.PORT ?? 3000)', filename: 'file.ts' },
    {
      code: 'const a = process.env.PORT!; const b = a ?? "x"',
      filename: 'file.ts',
    },
  ],
  invalid: [
    {
      code: 'const a = process.env.PORT || 3000',
      filename: 'file.ts',
      errors: [{ messageId: 'mixed' }],
    },
    {
      code: 'const a = process.env.PORT ? process.env.PORT : 3000',
      filename: 'file.ts',
      errors: [{ messageId: 'mixed' }],
    },
  ],
});

it('describes every message it can report', () => {
  expect(Object.keys(rule.meta?.messages ?? {})).not.toEqual([]);
});
