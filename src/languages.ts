/** File extensions of TypeScript code, declaration files included. */
export const TYPESCRIPT_EXTENSIONS = [
  'ts',
  'tsx',
  'mts',
  'cts',
  'd.ts',
  'd.mts',
  'd.cts',
] as const;

/** File extensions of JavaScript code. */
export const JAVASCRIPT_EXTENSIONS = ['js', 'jsx', 'mjs', 'cjs'] as const;

/** File extensions of formats that embed script code in a template. */
export const EMBEDDED_EXTENSIONS = ['vue', 'svelte', 'astro'] as const;

/** File extensions of stylesheet languages that extend CSS. */
export const STYLE_EXTENSIONS = ['scss', 'sass', 'less'] as const;

/**
 * Builds the file globs that match every file with one of the extensions,
 * in any directory, and every code block of that kind inside a Markdown file.
 * @param extensions - The extensions, without the dot.
 * @returns The globs for real files.
 */
export function filesGlobs(extensions: readonly string[]): string[] {
  return extensions.map((extension) => `**/*.${extension}`);
}

/**
 * Builds the file globs for the virtual files that a processor extracts from
 * code blocks, which are named after the block's language: the code blocks of
 * a Markdown or MDX file, and the scripts of an Astro file.
 * @param extensions - The extensions of the blocks, without the dot.
 * @returns The globs for code blocks inside such files.
 */
export function blockGlobs(extensions: readonly string[]): string[] {
  return ['md', 'mdx', 'astro'].flatMap((host) =>
    extensions.map((extension) => `**/*.${host}/**/*.${extension}`),
  );
}
