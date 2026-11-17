import type { Linter } from 'eslint';

/**
 * Narrows plugin config values that may be undefined or non-object into a
 * `Linter.Config`. Upstream plugins sometimes export `unknown` shapes, so this
 * guard keeps downstream spreads type-safe without blanket casts.
 */
function isConfig(value: unknown): value is Linter.Config {
  return Boolean(value && typeof value === 'object');
}

/**
 * Normalizes plugin config exports into an array of `Linter.Config` objects.
 * Handles `undefined`, single objects, or arrays while filtering out stray
 * values to avoid runtime errors when spreading third-party configs.
 */
export function normalizeConfigArray(value: unknown): Linter.Config[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter(isConfig);
  }
  return isConfig(value) ? [value] : [];
}

/**
 * Ensures a usable `Linter.Config` object for plugins that may return
 * `undefined` or a non-object. This avoids optional chaining on unknown
 * values and keeps consumer code small and explicit.
 */
export function normalizeConfig(value: unknown): Linter.Config {
  return isConfig(value) ? value : {};
}

/**
 * Drops the rules a config sets to `undefined`, which a rules record cannot hold.
 * @param rules - The rules of a config, if it has any.
 * @returns The rules that have a setting.
 */
export function definedRules(
  rules: Linter.Config['rules'],
): Linter.RulesRecord {
  return Object.fromEntries(
    Object.entries(rules ?? {}).flatMap(([name, setting]) =>
      setting === undefined ? [] : [[name, setting]],
    ),
  );
}

/**
 * Reads a string field of a parsed JSON value.
 * @param value - The parsed JSON.
 * @param key - The field to read.
 * @returns The field, or an empty string when it is missing or not a string.
 */
export function stringField(value: unknown, key: string): string {
  const field = fieldOf(value, key);
  return typeof field === 'string' ? field : '';
}

/**
 * Reads one field of a value of unknown shape.
 * @param value - The value to read from.
 * @param key - The field to read.
 * @returns The field, or `undefined` when the value is not an object or has none.
 */
// eslint-disable-next-line tslop/no-unknown-returns -- reads a field of foreign JSON whose shape is not known; every caller narrows the result
export function fieldOf(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null
    ? Object.fromEntries(Object.entries(value))[key]
    : undefined;
}
