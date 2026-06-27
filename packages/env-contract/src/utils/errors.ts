/**
 * Helpers for working with `catch (e: unknown)`. Using `unknown` instead of
 * `any` keeps a thrown value from silently disabling type-checking for
 * everything downstream of the catch.
 */

/** Coerce any caught value into an `Error` so `.message` is always safe. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/**
 * Read a Node.js system-error `code` (e.g. "ENOENT") off a caught value, if
 * present. Returns `undefined` for non-system errors.
 */
export function errorCode(value: unknown): string | undefined {
  if (value !== null && typeof value === "object" && "code" in value) {
    const code: unknown = value.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}
