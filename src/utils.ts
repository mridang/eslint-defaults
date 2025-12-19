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
  if (!value) return [];
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
