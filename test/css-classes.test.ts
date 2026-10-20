import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  extractClassNames,
  findCssFiles,
  projectCssWhitelist,
  toWhitelist,
} from '../src/css-classes.js';

const classes = (css: string): string[] => [...extractClassNames(css)].sort();

describe('extractClassNames', () => {
  it('reads plain, compound and combined selectors', () => {
    expect(
      classes('.card.t-lead > .btn:hover, a .panel::before { color: red }'),
    ).toEqual(['btn', 'card', 'panel', 't-lead']);
  });

  it('reads classes inside :is(), :where() and :not()', () => {
    expect(classes(':is(.a, .b) :where(.c) :not(.d) { margin: 0 }')).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('ignores attribute selectors', () => {
    expect(classes('a[href$=".pdf"], a[href$=.zip], .real { x: y }')).toEqual([
      'real',
    ]);
  });

  it('reads classes nested in @media, @layer and @supports', () => {
    expect(
      classes(`
        @layer components {
          @media (min-width: 40em) {
            @supports (display: grid) { .grid-card { display: grid } }
          }
          .layered { color: red }
        }
      `),
    ).toEqual(['grid-card', 'layered']);
  });

  it('reads nested rules, including the ones using &', () => {
    expect(
      classes(
        '.outer { &.inner { color: red } .deep { & > .deeper { x: y } } }',
      ),
    ).toEqual(['deep', 'deeper', 'inner', 'outer']);
  });

  it('reads the names given to @utility, keeping the functional marker', () => {
    expect(
      classes('@utility focus-ring { outline: 0 }\n@utility tab-* { x: y }'),
    ).toEqual(['focus-ring', 'tab-*']);
  });

  it('reads selectors in @scope and @custom-variant blocks only', () => {
    expect(
      classes(
        '@scope (.card) to (.slot) { img { x: y } }\n@media (max-width: 10px) { .m {x: y} }',
      ),
    ).toEqual(['card', 'm', 'slot']);
  });

  it('unescapes escaped characters', () => {
    expect(
      classes(String.raw`.sm\:flex, .w-1\/2, .\31 0px, .a\.b { x: y }`),
    ).toEqual(['10px', 'a.b', 'sm:flex', 'w-1/2']);
  });

  it('reads non-ASCII and underscore names', () => {
    expect(classes('._private, .café, .--x { x: y }')).toEqual([
      '--x',
      '_private',
      'café',
    ]);
  });

  it('ignores comments, strings and url()', () => {
    expect(
      classes(`
        /* .commented { } */
        .a { content: ".in-string {"; background: url(img.v2.png) }
        .b { background: url("x.y/.z.png") }
        .c::after { content: '.single { x: y }' }
      `),
    ).toEqual(['a', 'b', 'c']);
  });

  it('does not read dots in declaration values as classes', () => {
    expect(
      classes('.a { margin: .5em 0.25rem; width: calc(100% - 1.5px) }'),
    ).toEqual(['a']);
  });

  it('does not read at-rule preludes or keyframe selectors', () => {
    expect(
      classes(
        '@import "a.b.css";\n@keyframes spin.x { 50.5% { opacity: .5 } }\n@font-face { font-family: x }',
      ),
    ).toEqual([]);
  });

  it('is empty for an empty or selector-less stylesheet', () => {
    expect(classes('')).toEqual([]);
    expect(classes('body { margin: 0 }')).toEqual([]);
  });
});

describe('toWhitelist', () => {
  it('keeps plain names as exact entries', () => {
    expect(toWhitelist(['card', 'btn-primary', 'sm:flex', 'w-1/2'])).toEqual([
      'btn-primary',
      'card',
      'sm:flex',
      'w-1/2',
    ]);
  });

  it('escapes and anchors names that would otherwise read as patterns', () => {
    const [entry] = toWhitelist(['w-[10px]']);
    expect(entry).toBe(String.raw`^w-\[10px\]$`);
    expect(new RegExp(entry ?? '').test('w-[10px]')).toBe(true);
    expect(new RegExp(entry ?? '').test('w-1x')).toBe(false);
  });

  it('turns a functional utility into an anchored prefix pattern', () => {
    const [entry] = toWhitelist(['tab-*']);
    expect(entry).toBe('^tab-.+$');
    expect(new RegExp(entry ?? '').test('tab-4')).toBe(true);
    expect(new RegExp(entry ?? '').test('xtab-4')).toBe(false);
  });

  it('drops duplicates', () => {
    expect(toWhitelist(['a', 'a'])).toEqual(['a']);
  });
});

describe('findCssFiles and projectCssWhitelist', () => {
  function tree(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'css-classes-'));
    for (const [file, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), content);
    }
    return dir;
  }

  it('finds the project stylesheets and skips dependencies and build output', () => {
    const dir = tree({
      'src/app/globals.css': '.a {}',
      'styles/extra.css': '.b {}',
      'node_modules/lib/lib.css': '.dep {}',
      '.next/static/x.css': '.built {}',
      '.open-next/x.css': '.built {}',
      'dist/x.css': '.built {}',
      'coverage/x.css': '.built {}',
      '.out/x.css': '.built {}',
      'src/notes.txt': '.nope {}',
    });
    expect(findCssFiles(dir).map((f) => path.relative(dir, f))).toEqual([
      'src/app/globals.css',
      'styles/extra.css',
    ]);
  });

  it('skips folders listed by name in the root .gitignore', () => {
    const dir = tree({
      '.gitignore': '# generated\n/generated/\n*.log\n!keep\n',
      'generated/x.css': '.gen {}',
      'src/x.css': '.a {}',
    });
    expect(findCssFiles(dir).map((f) => path.relative(dir, f))).toEqual([
      'src/x.css',
    ]);
  });

  it('collects the classes of every stylesheet as whitelist entries', () => {
    const dir = tree({
      'a.css': '.card { x: y }',
      'b/b.css': '@utility focus-ring { x: y }',
      'node_modules/c.css': '.dep { x: y }',
    });
    expect(projectCssWhitelist(dir)).toEqual(['card', 'focus-ring']);
  });

  it('is empty for a project without CSS', () => {
    expect(projectCssWhitelist(tree({ 'index.ts': '' }))).toEqual([]);
  });

  it('is empty for a folder that does not exist', () => {
    expect(
      projectCssWhitelist(path.join(os.tmpdir(), 'nope-nope-nope')),
    ).toEqual([]);
  });
});
