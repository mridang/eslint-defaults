import { expect, it } from '@jest/globals';
import { parseForESLint } from 'jsonc-eslint-parser';
import { RuleTester } from 'eslint';
import rule from '../../../src/plugins/config-checks/types-in-development-dependencies.js';

const tester = new RuleTester({
  languageOptions: { parser: { parseForESLint } },
});

interface PackageBody {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  nested?: { dependencies: Record<string, string> };
}

const pkg = (body: PackageBody) => JSON.stringify(body, null, 2);

tester.run('types-in-dev-dependencies', rule, {
  valid: [
    { code: pkg({ devDependencies: { '@types/node': '^22' } }) },
    { code: pkg({ dependencies: { zod: '^4' } }) },
    { code: pkg({ name: 'x' }) },
    { code: pkg({ nested: { dependencies: { '@types/node': '1' } } }) },
  ],
  invalid: [
    {
      code: pkg({ dependencies: { '@types/node': '^22', zod: '^4' } }),
      errors: [{ messageId: 'misplaced' }],
    },
    {
      code: pkg({ dependencies: { '@types/a': '1', '@types/b': '1' } }),
      errors: [{ messageId: 'misplaced' }, { messageId: 'misplaced' }],
    },
  ],
});

it('describes every message it can report', () => {
  expect(Object.keys(rule.meta?.messages ?? {})).not.toEqual([]);
});
