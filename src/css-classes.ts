/* eslint-disable functional/no-let, functional/no-loop-statements, functional/immutable-data -- a hand-written stylesheet scanner and directory walker: they keep a cursor and collect names into local sets while reading text one character at a time, and the declarative form would be longer and harder to follow for the same result */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';

/** Directories that never hold a project's own stylesheets: dependencies, build output and caches. */
const IGNORED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.nuxt',
  '.open-next',
  '.out',
  '.turbo',
  '.vercel',
  '.wrangler',
  '.devbox',
  '.cache',
  '.svelte-kit',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
]);

/** Character code of `/`. */
const SLASH = 47;

/** Splits text into lines on either line ending. */
const LINE_BREAK = /\r?\n/u;

/** A `.gitignore` line that is a comment, a negation or a glob rather than a plain name. */
const COMMENT_OR_GLOB = /(?:^[#!])|[*?[\]/]/u;

/** The name of a Tailwind 4 `@utility` at-rule. */
const UTILITY_AT_RULE = /^@utility\s+([^\s]+)/iu;

/** Compares text the way `localeCompare` does, building the collator once. */
const COLLATOR = new Intl.Collator();

/** The text without the slashes at either end. */
function trimSlashes(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && text.codePointAt(start) === SLASH) {
    start += 1;
  }
  while (end > start && text.codePointAt(end - 1) === SLASH) {
    end -= 1;
  }
  return text.slice(start, end);
}

/** The text without its `[...]` groups; a `[` that is never closed stays. */
function removeBracketGroups(text: string): string {
  let result = '';
  let position = 0;
  for (;;) {
    const open = text.indexOf('[', position);
    const close = open === -1 ? -1 : text.indexOf(']', open + 1);
    if (close === -1) {
      return result + text.slice(position);
    }
    result += text.slice(position, open);
    position = close + 1;
  }
}

/**
 * Directory names the project's root `.gitignore` lists as plain names
 * (`generated`, `/tmp/`, `reports/`). Patterns with wildcards or negations are
 * left alone: a class missed here is merely reported, never wrongly hidden.
 */
async function gitignoredDirectories(
  root: string,
): Promise<ReadonlySet<string>> {
  try {
    const lines = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
    return new Set(
      lines
        .split(LINE_BREAK)
        .map((line) => trimSlashes(line.trim()))
        .filter((line) => line && !COMMENT_OR_GLOB.test(line)),
    );
  } catch {
    return new Set();
  }
}

/** The project's own `.css` files under `root`, absolute, skipping dependencies, build output and ignored folders. */
export async function findCssFiles(root: string): Promise<string[]> {
  const ignored = await gitignoredDirectories(root);
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name) && !ignored.has(entry.name)) {
          await walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile() && entry.name.endsWith('.css')) {
        found.push(path.join(dir, entry.name));
      } else {
        // Not a folder to enter or a stylesheet to collect.
      }
    }
  };
  await walk(root);
  return found.toSorted((a, b) => COLLATOR.compare(a, b));
}

/** Comments, strings, `url(...)` and escape pairs, in one pass so each is seen in its own context. */
const NOISE = new RegExp(
  [
    String.raw`\/\*[\s\S]*?\*\/`,
    String.raw`"(?:\\[\s\S]|[^"\\\n])*"`,
    String.raw`'(?:\\[\s\S]|[^'\\\n])*'`,
    String.raw`url\((?:\\[\s\S]|[^)\\])*\)`,
    String.raw`\\[\s\S]`,
  ].join('|'),
  'giu',
);

/** The stylesheet with comments, strings and `url()` contents emptied out, keeping escapes and layout. */
function stripNoise(css: string): string {
  return css.replaceAll(NOISE, (match) => {
    if (match.startsWith('/*')) {
      return ' ';
    }
    if (match.startsWith('\\')) {
      return match;
    }
    if (match.startsWith('"') || match.startsWith("'")) {
      return '""';
    }
    return 'url()';
  });
}

/** A CSS identifier after a dot: escapes (`\:`, `\31 0`) and non-ASCII are part of the name. */
const CLASS_ESCAPE = String.raw`\\(?:[0-9a-fA-F]{1,6}\s?|[^\n])`;
const CLASS_SELECTOR = new RegExp(
  String.raw`\.(-{0,2}(?:[_a-zA-Z\u0080-￿]|${CLASS_ESCAPE})(?:[\w\u0080-￿-]|${CLASS_ESCAPE})*)`,
  'gu',
);

/** Turn the escapes in a CSS identifier into the characters they stand for. */
function unescapeIdentifier(identifier: string): string {
  return identifier.replaceAll(
    /\\(?:([0-9a-fA-F]{1,6})\s?|([^\n]))/gu,
    (_match, hex: string | undefined, char: string | undefined) => {
      if (char !== undefined) {
        return char;
      }
      const code = Number.parseInt(hex ?? '', 16);
      return code > 0 && code <= 0x10_ff_ff ? String.fromCodePoint(code) : '�';
    },
  );
}

/** At-rules whose prelude holds selectors (the rest, like `@media (min-width: 40em)`, do not). */
const SELECTOR_AT_RULES = /^@(?:scope|custom-variant|custom-selector|nest)\b/iu;

/** The trimmed text before each `{`, back to the previous `{`, `}` or `;`. */
function* preludes(css: string): Generator<string> {
  let start = 0;
  for (let index = 0; index < css.length; index += 1) {
    const char = css[index];
    if (char === '{') {
      yield css.slice(start, index).trim();
      start = index + 1;
    } else if (char === '}' || char === ';') {
      start = index + 1;
    } else {
      // Part of the text that precedes the next brace.
    }
  }
}

/**
 * Every class a stylesheet defines: the `.name` in rule selectors, wherever
 * they sit (nested rules, `@media`/`@layer`/`@supports` blocks, `:is()`,
 * `:where()`, `:not()`, `&.name`), plus the names given to `@utility`. A
 * functional utility (`@utility tab-*`) is returned as `tab-*`.
 *
 * Selectors are the text before a `{`. Declarations end in `;` or `}`, so a
 * dot in a value (`0.5rem`) is never read as a class.
 */
export function extractClassNames(css: string): Set<string> {
  const names = new Set<string>();
  const clean = stripNoise(css);
  for (const text of preludes(clean)) {
    const utility = text.startsWith('@') ? UTILITY_AT_RULE.exec(text) : null;
    if (utility?.[1]) {
      names.add(unescapeIdentifier(utility[1]));
    } else if (!text.startsWith('@') || SELECTOR_AT_RULES.test(text)) {
      const selector = removeBracketGroups(text);
      for (const match of selector.matchAll(CLASS_SELECTOR)) {
        names.add(unescapeIdentifier(match[1] ?? ''));
      }
    } else {
      // An at-rule whose prelude holds no selectors.
    }
  }
  return names;
}

/** Characters that make the Tailwind plugin read a `whitelist` entry as a regular expression. */
const REGEX_METACHARACTERS = /[\\[\]{}()*+?^$|]/u;

/** Escape the characters that mean something in a regular expression. */
function escapeRegExp(text: string): string {
  return text.replaceAll(/[\\[\]{}()*+?^$|.]/gu, String.raw`\$&`);
}

/**
 * Turn class names into `whitelist` entries for `tailwindcss/no-custom-classname`.
 * The rule treats an entry holding a regex character as a pattern and anything
 * else as an exact name, so names with such characters are escaped and
 * anchored, and `tab-*` (a functional `@utility`) becomes `^tab-.+$`.
 */
export function toWhitelist(names: Iterable<string>): string[] {
  const entries = new Set<string>();
  for (const name of names) {
    if (name.endsWith('-*')) {
      entries.add(`^${escapeRegExp(name.slice(0, -1))}.+$`);
    } else if (REGEX_METACHARACTERS.test(name)) {
      entries.add(`^${escapeRegExp(name)}$`);
    } else {
      entries.add(name);
    }
  }
  return [...entries].toSorted((a, b) => COLLATOR.compare(a, b));
}

/** The classes defined by the project's own stylesheets under `root`, as `whitelist` entries. */
export async function projectCssWhitelist(root: string): Promise<string[]> {
  const names = new Set<string>();
  for (const file of await findCssFiles(root)) {
    try {
      for (const name of extractClassNames(await fs.readFile(file, 'utf8'))) {
        names.add(name);
      }
    } catch {
      continue;
    }
  }
  return toWhitelist(names);
}
/* eslint-enable functional/no-let, functional/no-loop-statements, functional/immutable-data -- end of the scanner and the directory walker */
