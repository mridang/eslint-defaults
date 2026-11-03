import {
  classifyRules,
  buildReport,
  buildRuleList,
  sampleHits,
  type Hit,
  type ReportData,
} from '../../etc/rule-impact.js';

const hit = (repo: string, line = 1): Hit => ({
  repo,
  file: 'src/a.ts',
  line,
  message: 'bad <thing>',
});

describe('classifyRules', () => {
  it('disables listed and deprecated rules with a reason, and keeps type-aware ones', () => {
    const rules = classifyRules(
      [
        { name: 'listed', description: '', deprecated: false, typed: false },
        { name: 'old', description: '', deprecated: true, typed: false },
        { name: 'typed', description: '', deprecated: false, typed: true },
        { name: 'fine', description: '', deprecated: false, typed: false },
      ],
      { listed: 'We allow it.' },
    );

    expect(
      rules.map(({ name, enabled, reason }) => [name, enabled, reason]),
    ).toEqual([
      ['fine', true, undefined],
      ['listed', false, 'We allow it.'],
      ['old', false, 'Deprecated.'],
      ['typed', true, undefined],
    ]);
  });
});

describe('sampleHits', () => {
  it('spreads the sample across repositories', () => {
    const hits = [hit('a'), hit('a'), hit('a'), hit('b'), hit('c')];

    expect(sampleHits(hits, 3).map((picked) => picked.repo)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('returns everything when under the cap', () => {
    expect(sampleHits([hit('a'), hit('b')], 10)).toHaveLength(2);
  });
});

describe('buildReport', () => {
  const data: ReportData = {
    generatedAt: '2026-01-01',
    orgDir: '/org',
    repos: ['one'],
    repoErrors: {},
    repoNotes: {},
    maxSnippets: 10,
    readLines: () => ['a', 'b', 'c', 'd <e>', 'f', 'g', 'h'],
    libraries: [
      {
        definition: {
          id: 'promise',
          title: 'promise',
          pkg: 'eslint-plugin-promise',
          namespace: 'promise',
          disabled: {},
        },
        version: '7.0.0',
        rules: [
          {
            name: 'on-rule',
            description: '',
            typed: false,
            enabled: true,
            hits: [hit('one', 4)],
          },
          {
            name: 'quiet-rule',
            description: '',
            typed: false,
            enabled: true,
            hits: [],
          },
          {
            name: 'off-rule',
            description: '',
            typed: false,
            enabled: false,
            reason: 'We allow it.',
            hits: [],
          },
        ],
      },
    ],
  };

  it('shows a tab per library with its finding count', () => {
    expect(buildReport(data)).toContain('promise (1)');
  });

  it('keeps a disabled rule visible and says no checks ran', () => {
    const page = buildReport(data);

    expect(page).toContain('<span>off-rule</span><span>off</span>');
    expect(page).toContain('We allow it. No checks were run.');
  });

  it('shows three lines around the finding, escaped', () => {
    const page = buildReport(data);

    expect(page).toContain(
      '<span class="hit"><span class="ln">4</span>d &lt;e&gt;</span>',
    );
    expect(page).toContain('<span class="ln">1</span>a');
    expect(page).toContain('<span class="ln">7</span>h');
    expect(page).toContain('bad &lt;thing&gt;');
  });
});

describe('buildRuleList', () => {
  const library = {
    definition: {
      id: 'promise',
      title: 'promise',
      pkg: 'eslint-plugin-promise',
      namespace: 'promise',
      disabled: {},
    },
    version: '7.0.0',
    rules: [
      {
        name: 'catch-or-return',
        description: 'Enforce catch.',
        typed: false,
        enabled: true,
        hits: [],
      },
      {
        name: 'await-thenable',
        description: '',
        typed: true,
        enabled: true,
        hits: [],
      },
      {
        name: 'no-native',
        description: '',
        typed: false,
        enabled: false,
        reason: 'Only relevant to ES5.',
        hits: [],
      },
    ],
  };

  it('strikes through disabled rules and gives the reason', () => {
    expect(buildRuleList([library])).toContain(
      '- ~~`no-native`~~ **Only relevant to ES5.**',
    );
  });

  it('counts the rules that run and marks type-aware ones', () => {
    const list = buildRuleList([library]);

    expect(list).toContain('eslint-plugin-promise 7.0.0: 2 of 3 rules run');
    expect(list).toContain('- `await-thenable` (type-aware)');
  });
});
