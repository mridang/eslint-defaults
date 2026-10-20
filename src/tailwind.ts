import type { ESLint, Linter } from 'eslint';
import tailwindV4 from 'eslint-plugin-tailwindcss';
import tailwindV3 from 'eslint-plugin-tailwindcss-v3';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { projectCssWhitelist } from './css-classes.js';
import { normalizeConfig } from './utils.js';

/** What the Tailwind lint plugin contributes to a project: nothing, or a plugin with its rules and settings. */
interface TailwindSupport {
  /** The plugin to register under the `tailwindcss` name, if the project uses Tailwind. */
  readonly plugin?: ESLint.Plugin;
  /** The plugin's recommended rules (empty when the project does not use Tailwind). */
  readonly rules: Readonly<Linter.RulesRecord>;
  /** The shared `settings` the plugin needs (empty when the project does not use Tailwind). */
  readonly settings: Readonly<Record<string, unknown>>;
}

/** Where a project's Tailwind CSS entry file usually lives, most likely first. */
const CSS_ENTRY_CANDIDATES = [
  'src/app/globals.css',
  'app/globals.css',
  'src/styles/globals.css',
  'src/styles/tailwind.css',
  'src/styles/index.css',
  'src/index.css',
  'src/main.css',
  'src/global.css',
  'src/styles.css',
  'styles/globals.css',
  'styles/tailwind.css',
  'assets/css/main.css',
  'index.css',
] as const;

/** Whether a CSS file pulls in Tailwind 4 (`@import "tailwindcss"`, including sub-paths). */
function importsTailwind(file: string): boolean {
  try {
    return /@import\s+['"]tailwindcss(?:\/[^'"]*)?['"]/.test(
      fs.readFileSync(file, 'utf8'),
    );
  } catch {
    return false;
  }
}

/**
 * The project's Tailwind CSS 4 entry file, absolute, or `undefined` if none of
 * the usual places has one. (A project with an unusual layout sets
 * `settings.tailwindcss.cssConfigPath` itself, which wins over this guess.)
 */
export function findTailwindCssEntry(cwd: string): string | undefined {
  return CSS_ENTRY_CANDIDATES.map((candidate) =>
    path.join(cwd, candidate),
  ).find(importsTailwind);
}

/**
 * The major version of the Tailwind CSS the project has installed (3 or 4), or
 * `undefined` when it has none. It is read from the installed package, because
 * that is what the lint plugin will actually load.
 */
export function tailwindMajorVersion(cwd: string): number | undefined {
  try {
    const projectRequire = createRequire(path.join(cwd, 'package.json'));
    const { version } = projectRequire('tailwindcss/package.json') as {
      version?: string;
    };
    const major = Number.parseInt(version?.split('.')[0] ?? '', 10);
    return Number.isNaN(major) ? undefined : major;
  } catch {
    return undefined;
  }
}

/** The rules a plugin recommends, whichever way its config is shaped. */
function recommendedRules(plugin: {
  configs?: Record<string, unknown>;
}): Readonly<Linter.RulesRecord> {
  const rules = normalizeConfig(plugin.configs?.['recommended']).rules ?? {};
  return Object.fromEntries(
    Object.entries(rules).flatMap(([name, setting]) =>
      setting === undefined ? [] : [[name, setting]],
    ),
  );
}

/** Helpers the 4.x plugin scans for class names: its own defaults, plus the ones this preset's projects use. */
const V4_FUNCTIONS = [
  'classnames',
  'classNames',
  'clsx',
  'cn',
  'createTheme',
  'ctl',
  'cva',
  'tv',
  'tw',
  'twJoin',
  'twMerge',
] as const;

/**
 * Rules switched off for the 4.x plugin. `no-unnecessary-arbitrary-value`
 * reads unitless arbitrary values as spacing steps and suggests (and autofixes
 * to) classes that mean something else: `leading-[1.3]` becomes `leading-1.3`
 * (0.325rem), `tracking-[-0.025em]` becomes `-tracking-wide`. Its safe cases
 * are covered by `enforces-canonical-classname`.
 */
const V4_DISABLED_RULES: Linter.RulesRecord = {
  'tailwindcss/no-unnecessary-arbitrary-value': 'off',
};

/** The 4.x rule that reports every class Tailwind does not know, including the project's own. */
const NO_CUSTOM_CLASSNAME = 'tailwindcss/no-custom-classname';

/**
 * Teach `no-custom-classname` the classes the project defines in its own CSS,
 * as the 3.x plugin's `cssFiles` setting did, so only a class that is neither
 * Tailwind's nor the project's (a typo) is reported. The severity and any
 * options the plugin recommends are kept; the rule is never switched off.
 */
function withProjectClasses(
  rules: Readonly<Linter.RulesRecord>,
  cwd: string,
): Readonly<Linter.RulesRecord> {
  const setting = rules[NO_CUSTOM_CLASSNAME];
  if (setting === undefined) return rules;
  const whitelist = projectCssWhitelist(cwd);
  if (whitelist.length === 0) return rules;
  const [severity, options] = Array.isArray(setting)
    ? [setting[0], (setting[1] ?? {}) as { whitelist?: string[] }]
    : [setting, {}];
  return {
    ...rules,
    [NO_CUSTOM_CLASSNAME]: [
      severity,
      {
        ...options,
        whitelist: [...new Set([...(options.whitelist ?? []), ...whitelist])],
      },
    ],
  };
}

/** The Tailwind 3 plugin's shared settings: how it finds class names in our helpers. */
const V3_SETTINGS = {
  tailwindcss: {
    callees: ['twMerge', 'createTheme'],
    classRegex: '^(class(Name)|theme)?$',
  },
} as const;

/**
 * Pick the Tailwind lint support for the project in `cwd`.
 *
 * - No Tailwind installed: none. The plugin's rules would only slow linting
 *   down and have nothing to check.
 * - Tailwind 3: the 3.x plugin, which reads `tailwind.config.js`.
 * - Tailwind 4: the 4.x plugin, which needs the path of the CSS file holding
 *   the theme (`cssConfigPath`); it is found automatically where it usually is.
 *   The 3.x plugin cannot read a Tailwind 4 project (there is no config file,
 *   the theme lives in CSS), and re-resolves its config for every file, which
 *   costs gigabytes and minutes on a real project.
 *   The classes the project's own CSS defines are whitelisted for
 *   `no-custom-classname`, which the 4.x plugin would otherwise flag.
 */
export function tailwindSupport(cwd: string = process.cwd()): TailwindSupport {
  const major = tailwindMajorVersion(cwd);
  if (major === undefined) {
    return { rules: {}, settings: {} };
  }
  if (major <= 3) {
    return {
      plugin: tailwindV3 as ESLint.Plugin,
      rules: recommendedRules(tailwindV3),
      settings: V3_SETTINGS,
    };
  }
  const cssConfigPath = findTailwindCssEntry(cwd);
  return {
    plugin: tailwindV4 as ESLint.Plugin,
    rules: cssConfigPath
      ? withProjectClasses(
          { ...recommendedRules(tailwindV4), ...V4_DISABLED_RULES },
          cwd,
        )
      : {},
    settings: {
      tailwindcss: {
        ...(cssConfigPath ? { cssConfigPath } : {}),
        functions: V4_FUNCTIONS,
      },
    },
  };
}
