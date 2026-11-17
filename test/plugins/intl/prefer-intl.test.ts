import { describe, expect, it } from '@jest/globals';
import tsParser from '@typescript-eslint/parser';
import { Linter } from 'eslint';

import { rules } from '../../../src/plugins/intl/index.js';

const linter = new Linter();
const config: Linter.Config[] = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { intl: { rules } },
    rules: { 'intl/prefer-intl': 'error' },
  },
];

/** Test sources write `#{` where the code under test has `${`. */
const ids = (code: string): (string | undefined)[] =>
  linter
    .verify(code.replaceAll('#{', '${'), config, 'file.ts')
    .map((message) => message.messageId);

const flagged: [string, string, string][] = [
  [
    'pluralSuffix',
    'template with empty and s',
    'const a = `#{n} item#{n === 1 ? "" : "s"}`;',
  ],
  [
    'pluralSuffix',
    'template with !== 1',
    'const a = `#{n} item#{count !== 1 ? "s" : ""}`;',
  ],
  [
    'pluralSuffix',
    'template with es',
    'const a = `#{n} box#{n === 1 ? "" : "es"}`;',
  ],
  [
    'pluralSuffix',
    'template with a boolean',
    'const a = `#{n} file#{single ? "" : "s"}`;',
  ],
  ['pluralSuffix', 'concatenation', 'const a = "item" + (one ? "" : "s");'],
  ['pluralWords', 'two words', 'const a = n === 1 ? "item" : "items";'],
  ['pluralWords', 'mirrored words', 'const a = many ? "boxes" : "box";'],
  ['relativeTimeText', 'template days ago', 'const a = `#{n} days ago`;'],
  ['relativeTimeText', 'number hours ago', 'const a = "3 hours ago";'],
  ['relativeTimeText', 'short form', 'const a = `#{n}m ago`;'],
  [
    'relativeTimeText',
    'unit with plural suffix',
    'const a = `#{n} day#{s} ago`;',
  ],
  ['relativeTimeText', 'in the future', 'const a = `in #{n} minutes`;'],
  ['relativeTimeText', 'joined tail', 'const a = n + " days ago";'],
  ['relativeTimeText', 'just now', 'const a = "Just now";'],
  ['relativeTimeText', 'yesterday', 'const a = "yesterday";'],
  [
    'relativeTimeMath',
    'minutes from seconds',
    'function f(s: number) { return s / 60 > 1 ? "minutes" : "seconds"; }',
  ],
  [
    'relativeTimeMath',
    'days from milliseconds',
    'const f = (ms: number) => { const d = ms / 86400000; return [d, "day"]; };',
  ],
  [
    'relativeTimeMath',
    'chained division',
    'function f(ms: number) { const m = ms / 1000 / 60; return `#{m}` + " hours"; }',
  ],
  ['splitEmpty', 'split on an empty string', 'const a = text.split("");'],
  [
    'ellipsis',
    'template with an ellipsis',
    'const a = `#{text.slice(0, 10)}…`;',
  ],
  [
    'ellipsis',
    'template with three dots',
    'const a = `#{text.substring(0, 10)}...`;',
  ],
  ['ellipsis', 'concatenation', 'const a = text.substr(0, 10) + "…";'],
  ['ellipsis', 'leading ellipsis', 'const a = "..." + text.slice(0, 10);'],
];

const clean: [string, string][] = [
  [
    'an Intl.PluralRules call',
    'const a = new Intl.PluralRules("en").select(n);',
  ],
  [
    'an Intl.RelativeTimeFormat call',
    'const a = new Intl.RelativeTimeFormat("en").format(-3, "day");',
  ],
  [
    'a plural that does not end a word',
    'const a = `#{n}#{n === 1 ? "" : "s"}`;',
  ],
  ['a suffix that is not a plural', 'const a = `item#{ok ? "" : "x"}`;'],
  ['unrelated words', 'const a = ok ? "yes" : "no";'],
  ['words that only share a prefix', 'const a = ok ? "a" : "as";'],
  ['a regex', String.raw`const a = /(\d+) days ago/;`],
  ['a log key', 'const a = "cache.days_ago";'],
  ['a duration in prose', 'const a = "keep for 3 days";'],
  ['a division with no unit word', 'function f(s: number) { return s / 60; }'],
  ['a unit word with no division', 'function f() { return "days"; }'],
  [
    'a division in another function',
    'function f(s: number) { return s / 60; } function g() { return "days"; }',
  ],
  [
    'arithmetic that feeds Intl.RelativeTimeFormat',
    'function f(s: number) { return new Intl.RelativeTimeFormat("en").format(-Math.floor(s / 60), "minute"); }',
  ],
  ['a split on a separator', 'const a = text.split(",");'],
  ['a slice with no ellipsis', 'const a = text.slice(0, 10);'],
  ['a slice that does not start at zero', 'const a = `#{text.slice(2, 10)}…`;'],
  ['an ellipsis without a slice', 'const a = `#{text}…`;'],
];

describe('intl/prefer-intl', () => {
  it.each(flagged)('%s: flags %s', (messageId, _name, code) => {
    expect(ids(code)).toContain(messageId);
  });

  it.each(clean)('accepts %s', (_name, code) => {
    expect(ids(code)).toEqual([]);
  });

  it('reports a suppression with a reason as clean', () => {
    expect(
      ids(
        '// eslint-disable-next-line intl/prefer-intl -- log key\nconst a = text.split("");',
      ),
    ).toEqual([]);
  });
});
