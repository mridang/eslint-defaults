/**
 * Why: `.nvmrc` (and the Node pin of `devbox.json`) say which Node the project
 * is developed and tested on, while `engines.node` tells consumers which Node
 * it supports. When `engines.node` does not admit the pinned major, or is
 * missing, the two disagree about what the project runs on.
 *
 * Flags: in package.json, `engines.node` that does not admit the major version
 * of the `.nvmrc` next to it (or of the `nodejs@<version>` pin in the
 * `devbox.json` next to it), and a missing `engines.node` when `.nvmrc`
 * exists. Nothing is reported when neither file exists.
 *
 * Fix: set `engines.node` to a range that includes the pinned major, e.g.
 * `>=22.0.0`, or change the pin.
 *
 * Limits: ranges are checked at major-version level (`>=`, `>`, `<=`, `<`,
 * `^`, `~`, `x`/`*`, `||`, space-joined comparators). `semver` is only a
 * transitive dependency of the preset, so it is not imported.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Rule } from 'eslint';

/** A node of the JSONC parser that package.json is linted with. */
interface JsonNode {
  type: string;
  loc: Rule.Node['loc'];
  key?: { value?: string; name?: string };
  value?: JsonNode;
  expression?: JsonNode;
  properties?: JsonNode[];
  body?: JsonNode[];
}

/** The literal a JSON property holds, e.g. the range string of `engines.node`. */
interface JsonLiteral {
  value?: string;
}

const keyOf = (node: JsonNode): string =>
  node.key?.value ?? node.key?.name ?? '';

const propertyOf = (object: JsonNode | undefined, name: string) =>
  object?.properties?.find((member) => keyOf(member) === name);

const MAJOR = /(\d+)/u;
const WILDCARD = /^[x*]?$/iu;
const OPERATOR_GAP = /([<>=~^])\s+/gu;
const WHITESPACE = /\s+/u;
const LEADING_OPERATORS = /^[<>=~^]*/u;
const LEADING_V = /^v/u;

function read(file: string): string | undefined {
  // eslint-disable-next-line n/no-sync -- ESLint rule callbacks cannot await
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
}

function devboxNodeMajor(text: string): string | undefined {
  const { packages } = JSON.parse(text) as {
    packages?: string[] | Record<string, string>;
  };
  const entries = Array.isArray(packages)
    ? packages
    : Object.entries(packages ?? {}).map(
        ([name, version]) => `${name}@${version}`,
      );
  const pin = entries.find((entry) => entry.startsWith('nodejs@'));
  return pin ? MAJOR.exec(pin)?.[1] : undefined;
}

/** Whether one space-joined comparator set admits the major version. */
function admitsSet(set: string, major: number): boolean {
  const tokens = set
    .replaceAll(OPERATOR_GAP, '$1')
    .split(WHITESPACE)
    .filter(Boolean);
  return tokens.every((token) => {
    const operator = LEADING_OPERATORS.exec(token)?.[0] ?? '';
    const parts = token
      .slice(operator.length)
      .replace(LEADING_V, '')
      .split('.');
    if (WILDCARD.test(parts[0])) {
      return true;
    }
    const base = Number(parts[0]);
    const partial = parts
      .slice(1)
      .some((part) => !WILDCARD.test(part) && part !== '0');
    switch (operator) {
      case '>=': {
        return major >= base;
      }
      case '>': {
        return partial ? major >= base : major > base;
      }
      case '<=': {
        return major <= base;
      }
      case '<': {
        return partial ? major <= base : major < base;
      }
      default: {
        return major === base;
      }
    }
  });
}

function admits(range: string, major: number): boolean {
  return range.split('||').some((set) => admitsSet(set.trim(), major));
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require engines.node to admit the Node major pinned in .nvmrc and devbox.json.',
    },
    schema: [],
    messages: {
      mismatch:
        '`engines.node` ("{{range}}") does not admit Node {{major}} from {{source}}.',
      missing: '`engines.node` is missing but {{source}} pins Node {{major}}.',
    },
  },
  create(context) {
    const dir = path.dirname(context.filename);
    return {
      /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
      Program(raw: unknown) {
        const program = raw as JsonNode;
        const nvmrc = MAJOR.exec(read(path.join(dir, '.nvmrc')) ?? '')?.[1];
        const devboxText = read(path.join(dir, 'devbox.json'));
        const devbox = devboxText ? devboxNodeMajor(devboxText) : undefined;
        const pins = [
          ...(nvmrc ? [{ source: '.nvmrc', major: Number(nvmrc) }] : []),
          ...(devbox ? [{ source: 'devbox.json', major: Number(devbox) }] : []),
        ];

        const top = program.body?.[0]?.expression;
        const engines = propertyOf(top, 'engines')?.value;
        const node = propertyOf(engines, 'node');
        const range = String((node?.value as JsonLiteral | undefined)?.value);
        pins
          .flatMap(({ source, major }) => {
            if (!node) {
              return [
                {
                  loc: program.loc!,
                  messageId: 'missing',
                  data: { source, major: String(major) },
                },
              ];
            }
            return admits(range, major)
              ? []
              : [
                  {
                    loc: node.loc!,
                    messageId: 'mismatch',
                    data: { range, major: String(major), source },
                  },
                ];
          })
          // eslint-disable-next-line unicorn/no-array-for-each -- reporting is a side effect per element, there is no value to map
          .forEach((report) => {
            context.report(report);
          });
      },
      /* eslint-enable sonarjs/function-name -- end of the visitor keys */
    };
  },
};

export default rule;
