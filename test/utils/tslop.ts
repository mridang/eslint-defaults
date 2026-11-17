import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';

import { rules } from '../../src/plugins/tslop/index.js';

/** Lints a snippet with one tslop rule and returns the reported message ids. */
export const lintWith = (
  rule: string,
  code: string,
  options: unknown[] = [],
  filename = 'file.ts',
): (string | undefined)[] => {
  const config: Linter.Config[] = [
    {
      files: ['**/*.ts', '**/*.tsx'],
      languageOptions: { parser: tsParser },
      plugins: { tslop: { rules } },
      rules: { [`tslop/${rule}`]: ['error', ...options] },
    },
  ];
  return new Linter()
    .verify(code, config, filename)
    .map((message) => message.messageId ?? `fatal: ${message.message}`);
};

/** Lints a snippet and applies the fixes of one tslop rule. */
export const fixWith = (rule: string, code: string): string => {
  const config: Linter.Config[] = [
    {
      files: ['**/*.ts'],
      languageOptions: { parser: tsParser },
      plugins: { tslop: { rules } },
      rules: { [`tslop/${rule}`]: 'error' },
    },
  ];
  return new Linter().verifyAndFix(code, config, 'file.ts').output;
};
