import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from '@jest/globals';
import { RuleTester } from 'eslint';
import rule from '../../../src/plugins/config-checks/env-declared-in-example.js';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

function project(example?: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'env-'));
  writeFileSync(path.join(dir, 'package.json'), '{}');
  if (example !== undefined) {
    writeFileSync(path.join(dir, '.env.example'), example);
  }
  mkdirSync(path.join(dir, 'src'));
  return path.join(dir, 'src', 'a.js');
}

const listed = project('# comment\n\nPORT=\nexport TOKEN=abc\n');
const none = project();

tester.run('env-declared-in-example', rule, {
  valid: [
    { code: 'process.env.PORT', filename: listed },
    { code: "process.env['TOKEN']", filename: listed },
    { code: 'const { PORT } = process.env', filename: listed },
    { code: 'process.env[name]', filename: listed },
    { code: 'process.env.ANYTHING', filename: none },
  ],
  invalid: [
    {
      code: 'process.env.SECRET',
      filename: listed,
      errors: [{ messageId: 'undeclared', data: { name: 'SECRET' } }],
    },
    {
      code: "process.env['SECRET']",
      filename: listed,
      errors: [{ messageId: 'undeclared' }],
    },
    {
      code: 'const { PORT, SECRET, OTHER: x } = process.env',
      filename: listed,
      errors: [
        { messageId: 'undeclared', data: { name: 'SECRET' } },
        { messageId: 'undeclared', data: { name: 'OTHER' } },
      ],
    },
    {
      code: 'process.env.comment',
      filename: project('# comment=1\n'),
      errors: [{ messageId: 'undeclared' }],
    },
  ],
});

it('describes every message it can report', () => {
  expect(Object.keys(rule.meta?.messages ?? {})).not.toEqual([]);
});
