import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  findTailwindCssEntry,
  tailwindMajorVersion,
  tailwindSupport,
} from '../src/tailwind.js';

/** A throwaway project directory with an optional installed Tailwind and CSS files. */
function project(options: {
  tailwindVersion?: string;
  css?: Record<string, string>;
}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-project-'));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"p"}');
  if (options.tailwindVersion) {
    const pkg = path.join(dir, 'node_modules', 'tailwindcss');
    fs.mkdirSync(pkg, { recursive: true });
    fs.writeFileSync(
      path.join(pkg, 'package.json'),
      JSON.stringify({ name: 'tailwindcss', version: options.tailwindVersion }),
    );
  }
  for (const [file, content] of Object.entries(options.css ?? {})) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
  return dir;
}

describe('tailwindMajorVersion', () => {
  it('reads the major version of the installed Tailwind', () => {
    expect(tailwindMajorVersion(project({ tailwindVersion: '4.3.1' }))).toBe(4);
    expect(tailwindMajorVersion(project({ tailwindVersion: '3.4.19' }))).toBe(
      3,
    );
  });

  it('is undefined for a project without Tailwind', () => {
    expect(tailwindMajorVersion(project({}))).toBeUndefined();
  });
});

describe('findTailwindCssEntry', () => {
  it('finds the file that imports Tailwind, wherever the usual places put it', () => {
    const dir = project({
      css: { 'src/app/globals.css': '@import "tailwindcss";\n@theme {}' },
    });
    expect(findTailwindCssEntry(dir)).toBe(
      path.join(dir, 'src/app/globals.css'),
    );
  });

  it('accepts single quotes and sub-path imports', () => {
    const dir = project({
      css: { 'src/index.css': "@import 'tailwindcss/theme.css';" },
    });
    expect(findTailwindCssEntry(dir)).toBe(path.join(dir, 'src/index.css'));
  });

  it('skips a stylesheet that does not use Tailwind, and finds nothing when none does', () => {
    const dir = project({
      css: { 'src/app/globals.css': 'body { color: red }' },
    });
    expect(findTailwindCssEntry(dir)).toBeUndefined();
  });
});

describe('tailwindSupport', () => {
  it('contributes nothing to a project without Tailwind', () => {
    const support = tailwindSupport(project({}));
    expect(support.plugin).toBeUndefined();
    expect(support.rules).toEqual({});
    expect(support.settings).toEqual({});
  });

  it('uses the Tailwind 3 plugin and its settings for a Tailwind 3 project', () => {
    const support = tailwindSupport(project({ tailwindVersion: '3.4.19' }));
    expect(support.plugin).toBeDefined();
    expect(
      Object.keys(support.rules).every((r) => r.startsWith('tailwindcss/')),
    ).toBe(true);
    expect(Object.keys(support.rules).length).toBeGreaterThan(0);
    expect(support.settings).toMatchObject({
      tailwindcss: { callees: ['twMerge', 'createTheme'] },
    });
  });

  it('uses the Tailwind 4 plugin and points it at the CSS file for a Tailwind 4 project', () => {
    const dir = project({
      tailwindVersion: '4.3.1',
      css: { 'src/app/globals.css': '@import "tailwindcss";' },
    });
    const support = tailwindSupport(dir);
    expect(support.plugin).toBeDefined();
    expect(Object.keys(support.rules).length).toBeGreaterThan(0);
    expect(support.settings).toMatchObject({
      tailwindcss: { cssConfigPath: path.join(dir, 'src/app/globals.css') },
    });
  });

  it('turns the rules off for a Tailwind 4 project whose CSS entry it cannot find, instead of guessing', () => {
    const support = tailwindSupport(project({ tailwindVersion: '4.3.1' }));
    expect(support.rules).toEqual({});
  });
});
