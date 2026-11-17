import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from '@jest/globals';
import { parseForESLint } from 'jsonc-eslint-parser';
import { RuleTester } from 'eslint';
import rule from '../../../src/plugins/config-checks/nvmrc-matches-engines.js';

const tester = new RuleTester({
  languageOptions: { parser: { parseForESLint } },
});

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'nvmrc-'));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content);
  }
  return path.join(dir, 'package.json');
}

const engines = (node?: string) =>
  JSON.stringify(node === undefined ? {} : { engines: { node } });

const nvm24 = project({ '.nvmrc': 'v24.1.0\n' });
const devbox = project({
  'devbox.json': JSON.stringify({ packages: ['nodejs@22'] }),
});

tester.run('nvmrc-matches-engines', rule, {
  valid: [
    { code: engines('>=22.0.0'), filename: nvm24 },
    { code: engines('^24.0.0'), filename: nvm24 },
    { code: engines('^20 || ^24'), filename: nvm24 },
    { code: engines('>=20 <26'), filename: nvm24 },
    { code: engines('24.x'), filename: nvm24 },
    { code: engines('>=22'), filename: devbox },
    { code: engines('1.0.0'), filename: project({}) },
    { code: engines(), filename: project({}) },
  ],
  invalid: [
    {
      code: engines('>=25.0.0'),
      filename: nvm24,
      errors: [{ messageId: 'mismatch' }],
    },
    {
      code: engines('^22.0.0'),
      filename: nvm24,
      errors: [{ messageId: 'mismatch' }],
    },
    {
      code: engines('<24'),
      filename: nvm24,
      errors: [{ messageId: 'mismatch' }],
    },
    { code: engines(), filename: nvm24, errors: [{ messageId: 'missing' }] },
    {
      code: engines('>=24'),
      filename: devbox,
      errors: [{ messageId: 'mismatch' }],
    },
  ],
});

it('describes every message it can report', () => {
  expect(Object.keys(rule.meta?.messages ?? {})).not.toEqual([]);
});
