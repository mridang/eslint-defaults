/**
 * Why: `.env.example` is the list of variables a repository needs. A variable
 * read from `process.env` but missing there is invisible to whoever sets the
 * project up.
 *
 * Flags: `process.env.NAME`, `process.env['NAME']` and
 * `const { NAME } = process.env` when NAME has no `NAME=` line in the
 * `.env.example` next to the nearest package.json (comments and blank lines
 * are ignored). When there is no `.env.example` nothing is reported, so a
 * repository can adopt the file later.
 *
 * Fix: add `NAME=` to `.env.example` (names only, never values).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Rule } from 'eslint';
import type { Node } from 'estree';

/** Parsed `.env.example` per path, for the lint run (undefined: no file). */
const cache = new Map<string, Set<string> | undefined>();

const LINE_BREAK = /\r?\n/u;
const ASSIGNMENT = /^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=/u;

/** ESLint rules run synchronously, so the file system is read synchronously. */
function exists(file: string): boolean {
  // eslint-disable-next-line n/no-sync -- ESLint rule callbacks cannot await
  return existsSync(file);
}

function parse(example: string): Set<string> | undefined {
  if (!exists(example)) {
    return undefined;
  }
  return new Set(
    // eslint-disable-next-line n/no-sync -- ESLint rule callbacks cannot await
    readFileSync(example, 'utf8')
      .split(LINE_BREAK)
      .flatMap((line) => ASSIGNMENT.exec(line)?.[1] ?? []),
  );
}

function declared(example: string): Set<string> | undefined {
  if (!cache.has(example)) {
    // eslint-disable-next-line functional/immutable-data -- per-run memo of parsed files
    cache.set(example, parse(example));
  }
  return cache.get(example);
}

function packageDirectory(from: string): string | undefined {
  if (exists(path.join(from, 'package.json'))) {
    return from;
  }
  const parent = path.dirname(from);
  return parent === from ? undefined : packageDirectory(parent);
}

type AnyNode = Node & {
  object?: AnyNode;
  property?: AnyNode;
  computed?: boolean;
  name?: string;
  value?: unknown;
};

interface KeyedNode {
  key: Node;
  computed: boolean;
}

/** The name a member or property key spells, when it is a plain name or string. */
function keyName({ key, computed }: KeyedNode): string | undefined {
  if (!computed) {
    return (key as AnyNode).name;
  }
  return key.type === 'Literal' && typeof key.value === 'string'
    ? key.value
    : undefined;
}

function isProcess(node: AnyNode | undefined): boolean {
  return node?.type === 'Identifier' && node.name === 'process';
}

function isProcessEnv(node: AnyNode | null | undefined): boolean {
  if (node?.type !== 'MemberExpression' || node.computed) {
    return false;
  }
  return isProcess(node.object) && node.property?.name === 'env';
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require every environment variable read in code to be listed in .env.example (when the file exists).',
    },
    schema: [],
    messages: {
      undeclared:
        '`{{name}}` is not listed in `.env.example`: add `{{name}}=`.',
    },
  },
  create(context) {
    const dir = packageDirectory(path.dirname(context.filename));
    const names = dir ? declared(path.join(dir, '.env.example')) : undefined;
    if (!names) {
      return {};
    }
    const check = (node: Node, name: string | undefined): void => {
      if (name !== undefined && !names.has(name)) {
        context.report({ node, messageId: 'undeclared', data: { name } });
      }
    };
    return {
      /* eslint-disable sonarjs/function-name -- ESLint visitor keys are the AST node type names, fixed by the ESLint API */
      MemberExpression(raw) {
        const node = raw as AnyNode;
        if (isProcessEnv(node.object)) {
          check(
            node,
            keyName({
              key: node.property as Node,
              computed: Boolean(node.computed),
            }),
          );
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'ObjectPattern' && isProcessEnv(node.init)) {
          node.id.properties
            .filter((property) => property.type === 'Property')
            // eslint-disable-next-line unicorn/no-array-for-each -- reporting is a side effect per element, there is no value to map
            .forEach((property) => {
              check(property, keyName(property));
            });
        }
      },
      /* eslint-enable sonarjs/function-name -- end of the visitor keys */
    };
  },
};

export default rule;
