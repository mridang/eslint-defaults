import type { ESLint, Linter } from 'eslint';

/**
 * The flat config ESLint resolves for a file.
 * @param eslint - The ESLint instance to ask.
 * @param filePath - The file to resolve the config for.
 * @returns The config, or `undefined` when the file is ignored.
 */
export async function configFor(
  eslint: ESLint,
  filePath: string,
): Promise<Linter.Config | undefined> {
  const config: unknown = await eslint.calculateConfigForFile(filePath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- ESLint types the result as any; it is the file's flat config, or undefined for an ignored file
  return config as Linter.Config | undefined;
}

/**
 * Reads parsed JSON as a record.
 * @param value - The parsed JSON.
 * @returns Its entries as a record, or an empty one when it is not an object.
 */
export function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? Object.fromEntries(Object.entries(value))
    : {};
}
