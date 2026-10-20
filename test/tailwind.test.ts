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

  it('is undefined when the installed version cannot be read', () => {
    expect(
      tailwindMajorVersion(project({ tailwindVersion: 'not-a-version' })),
    ).toBeUndefined();
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

  it('keeps the 4.x rule that suggests wrong classes for unitless values switched off', () => {
    const support = tailwindSupport(
      project({
        tailwindVersion: '4.3.1',
        css: { 'src/app/globals.css': '@import "tailwindcss";' },
      }),
    );
    expect(support.rules['tailwindcss/no-unnecessary-arbitrary-value']).toBe(
      'off',
    );
    expect(support.rules['tailwindcss/enforces-canonical-classname']).toBe(
      'warn',
    );
  });

  it('turns the rules off for a Tailwind 4 project whose CSS entry it cannot find, instead of guessing', () => {
    const support = tailwindSupport(project({ tailwindVersion: '4.3.1' }));
    expect(support.rules).toEqual({});
  });

  it('registers different plugins for Tailwind 3 and Tailwind 4', () => {
    const v4Dir = project({
      tailwindVersion: '4.3.1',
      css: { 'src/app/globals.css': '@import "tailwindcss";' },
    });
    const v3 = tailwindSupport(project({ tailwindVersion: '3.4.19' }));
    const v4 = tailwindSupport(v4Dir);
    expect(v3.plugin).not.toBe(v4.plugin);
  });

  it('contributes nothing to a project whose Tailwind version cannot be read', () => {
    const support = tailwindSupport(project({ tailwindVersion: 'garbage' }));
    expect(support.plugin).toBeUndefined();
    expect(support.rules).toEqual({});
  });

  it('keeps the 4.x plugin default helpers and adds the ones the preset uses', () => {
    const support = tailwindSupport(
      project({
        tailwindVersion: '4.3.1',
        css: { 'src/app/globals.css': '@import "tailwindcss";' },
      }),
    );
    expect(support.settings).toMatchObject({
      tailwindcss: {
        functions: expect.arrayContaining([
          'clsx',
          'cn',
          'cva',
          'tv',
          'twJoin',
          'twMerge',
          'createTheme',
        ]),
      },
    });
  });

  it('whitelists the classes the project CSS defines on no-custom-classname, keeping its severity', () => {
    const dir = project({
      tailwindVersion: '4.3.1',
      css: {
        'src/app/globals.css':
          '@import "tailwindcss";\n.card { x: y }\n@utility focus-ring { x: y }',
        'src/components/panel.css': '.panel.t-lead { x: y }',
        'node_modules/lib/lib.css': '.dep { x: y }',
      },
    });
    const { rules } = tailwindSupport(dir);
    const setting = rules['tailwindcss/no-custom-classname'];
    expect(setting).toEqual([
      'warn',
      { whitelist: ['card', 'focus-ring', 'panel', 't-lead'] },
    ]);
  });

  it('leaves no-custom-classname as the plugin ships it when the project CSS defines no classes', () => {
    const { rules } = tailwindSupport(
      project({
        tailwindVersion: '4.3.1',
        css: { 'src/app/globals.css': '@import "tailwindcss";' },
      }),
    );
    expect(rules['tailwindcss/no-custom-classname']).toBe('warn');
  });

  it('does not scan CSS for a Tailwind 3 project or one without Tailwind', () => {
    const css = { 'src/app/globals.css': '.card { x: y }' };
    const v3 = tailwindSupport(project({ tailwindVersion: '3.4.19', css }));
    expect(v3.rules['tailwindcss/no-custom-classname']).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ whitelist: ['card'] }),
      ]),
    );
    expect(tailwindSupport(project({ css })).rules).toEqual({});
  });
});
