import fs from 'node:fs';
import path from 'node:path';

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

/**
 * Directory names the project's root `.gitignore` lists as plain names
 * (`generated`, `/tmp/`, `reports/`). Patterns with wildcards or negations are
 * left alone: a class missed here is merely reported, never wrongly hidden.
 */
function gitignoredDirectories(root: string): ReadonlySet<string> {
  try {
    const lines = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
    return new Set(
      lines
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^\/+|\/+$/g, ''))
        .filter((line) => line && !/^[#!]|[*?[\]/]/.test(line)),
    );
  } catch {
    return new Set();
  }
}

/** The project's own `.css` files under `root`, absolute, skipping dependencies, build output and ignored folders. */
export function findCssFiles(root: string): string[] {
  const ignored = gitignoredDirectories(root);
  const found: string[] = [];
  const walk = (dir: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name) && !ignored.has(entry.name)) {
          walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile() && entry.name.endsWith('.css')) {
        found.push(path.join(dir, entry.name));
      }
    }
  };
  walk(root);
  return found.sort();
}

/** Comments, strings, `url(...)` and escape pairs, in one pass so each is seen in its own context. */
const NOISE =
  /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*'|url\((?:\\[\s\S]|[^)\\])*\)|\\[\s\S]/gi;

/** The stylesheet with comments, strings and `url()` contents emptied out, keeping escapes and layout. */
function stripNoise(css: string): string {
  return css.replace(NOISE, (match) => {
    if (match.startsWith('/*')) return ' ';
    if (match.startsWith('\\')) return match;
    if (match[0] === '"' || match[0] === "'") return '""';
    return 'url()';
  });
}

/** A CSS identifier after a dot: escapes (`\:`, `\31 0`) and non-ASCII are part of the name. */
const CLASS_SELECTOR =
  /\.(-{0,2}(?:[_a-zA-Z\u0080-￿]|\\(?:[0-9a-fA-F]{1,6}\s?|[^\n]))(?:[\w\u0080-￿-]|\\(?:[0-9a-fA-F]{1,6}\s?|[^\n]))*)/g;

/** Turn the escapes in a CSS identifier into the characters they stand for. */
function unescapeIdentifier(identifier: string): string {
  return identifier.replace(
    /\\(?:([0-9a-fA-F]{1,6})\s?|([^\n]))/g,
    (_match, hex: string | undefined, char: string | undefined) => {
      if (char !== undefined) return char;
      const code = Number.parseInt(hex ?? '', 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
    },
  );
}

/** At-rules whose prelude holds selectors (the rest, like `@media (min-width: 40em)`, do not). */
const SELECTOR_AT_RULES = /^@(?:scope|custom-variant|custom-selector|nest)\b/i;

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
  for (const prelude of clean.matchAll(/[^{};]*\{/g)) {
    const text = prelude[0].slice(0, -1).trim();
    if (text.startsWith('@')) {
      const utility = /^@utility\s+([^\s]+)/i.exec(text);
      if (utility?.[1]) {
        names.add(unescapeIdentifier(utility[1]));
        continue;
      }
      if (!SELECTOR_AT_RULES.test(text)) continue;
    }
    const selector = text.replace(/\[[^\]]*\]/g, '');
    for (const match of selector.matchAll(CLASS_SELECTOR)) {
      names.add(unescapeIdentifier(match[1] ?? ''));
    }
  }
  return names;
}

/** Characters that make the Tailwind plugin read a `whitelist` entry as a regular expression. */
const REGEX_METACHARACTERS = /[\\[\]{}()*+?^$|]/;

/** Escape the characters that mean something in a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[\\[\]{}()*+?^$|.]/g, String.raw`\$&`);
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
  return [...entries].sort();
}

/** The classes defined by the project's own stylesheets under `root`, as `whitelist` entries. */
export function projectCssWhitelist(root: string): string[] {
  const names = new Set<string>();
  for (const file of findCssFiles(root)) {
    try {
      for (const name of extractClassNames(fs.readFileSync(file, 'utf8'))) {
        names.add(name);
      }
    } catch {
      continue;
    }
  }
  return toWhitelist(names);
}
