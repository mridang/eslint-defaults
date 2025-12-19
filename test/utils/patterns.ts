import { minimatch } from 'minimatch';

export type PatternInput =
  | string
  | string[]
  | Array<string | string[]>
  | undefined;

/**
 * Determines whether a path matches any file glob patterns. Accepts nested
 * arrays because ESLint configs often spread arrays. Undefined or empty
 * patterns mean "match everything" to mirror ESLint's default behavior.
 */
export function matchesFileGlob(
  filePath: string,
  files?: PatternInput,
): boolean {
  if (!files || (Array.isArray(files) && files.length === 0)) {
    return true;
  }
  const patterns = (Array.isArray(files) ? files.flat() : [files]).filter(
    Boolean,
  ) as string[];
  return patterns.some((pattern) =>
    minimatch(filePath, pattern, { dot: true }),
  );
}

/**
 * Checks whether a path is excluded by any ignore glob. Nested arrays and
 * falsy entries are tolerated because upstream configs may include mixed
 * shapes; a match returns true to indicate the path should be skipped.
 */
export function matchesIgnores(
  filePath: string,
  ignores?: PatternInput,
): boolean {
  if (!ignores) {
    return false;
  }
  const patterns = (Array.isArray(ignores) ? ignores.flat() : [ignores]).filter(
    Boolean,
  ) as string[];
  return patterns.some((pattern) =>
    minimatch(filePath, pattern, { dot: true }),
  );
}
