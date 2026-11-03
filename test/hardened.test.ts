import {
  hardenedExclusions,
  hardenedPlugins,
  hardenedRules,
} from '../src/hardened.js';

interface RuleMeta {
  deprecated?: unknown;
}

const rules = hardenedRules();
const enabled = { ...rules.untyped, ...rules.typed };
const namespaces = Object.keys(hardenedPlugins);

describe('hardenedRules', () => {
  it.each(namespaces)('%s: every excluded rule exists', (namespace) => {
    const known = Object.keys(hardenedPlugins[namespace].rules ?? {});
    expect(
      Object.keys(hardenedExclusions[namespace]).filter(
        (name) => !known.includes(name),
      ),
    ).toEqual([]);
  });

  it.each(namespaces)(
    '%s: every live rule is either an error or excluded',
    (namespace) => {
      const missing = Object.entries(hardenedPlugins[namespace].rules ?? {})
        .filter(([, rule]) => !(rule as { meta?: RuleMeta }).meta?.deprecated)
        .map(([name]) => name)
        .filter(
          (name) =>
            enabled[`${namespace}/${name}`] !== 'error' &&
            !(name in hardenedExclusions[namespace]),
        );
      expect(missing).toEqual([]);
    },
  );

  it.each(namespaces)('%s: an excluded rule is not enabled', (namespace) => {
    const wrong = Object.keys(hardenedExclusions[namespace]).filter(
      (name) => `${namespace}/${name}` in enabled,
    );
    expect(wrong).toEqual([]);
  });

  it('keeps rules that need type information apart', () => {
    expect(
      Object.keys(rules.typed).filter((name) => name in rules.untyped),
    ).toEqual([]);
  });
});

describe('unicornExclusions', () => {
  it('only names rules that exist in the installed unicorn', async () => {
    const { unicornExclusions } = await import('../src/hardened.js');
    const unicorn = (await import('eslint-plugin-unicorn')).default;
    expect(
      Object.keys(unicornExclusions).filter((name) => !(name in unicorn.rules)),
    ).toEqual([]);
  });
});
