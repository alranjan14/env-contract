/**
 * Process exit codes are part of a CLI's public contract (CI relies on them), so
 * they live here as named constants instead of scattered magic numbers.
 */
export const ExitCode = {
  /** No drift and no contract violations. */
  Ok: 0,
  /** Drift or violations found — CI should fail. */
  Drift: 1,
  /** Configuration or runtime error: the check could not complete. */
  RuntimeError: 2,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
