import { performance } from "node:perf_hooks";

/**
 * Zero-dependency debug channel — the "debug, not telemetry" production knob.
 *
 * Enabled by `--debug` or by a `DEBUG` env var that names this tool, following
 * the `debug` package convention (comma/space-separated globs, e.g.
 * `DEBUG=env-contract*` or `DEBUG=*`). All output goes to STDERR so it can never
 * contaminate the machine-readable `--json` payload on stdout.
 */
const NAMESPACE = "env-contract";

/** Does a single `DEBUG` pattern (a glob with `*`) name our namespace? */
function patternMatchesNamespace(pattern: string): boolean {
  // Negations (`-foo`) only ever *disable*, so they never count as a match here.
  if (!pattern || pattern.startsWith("-")) return false;
  const source = "^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
  return new RegExp(source).test(NAMESPACE);
}

/** True if `--debug` was passed, or `DEBUG` names this tool (`env-contract*`, `*`, …). */
export function isDebugEnabled(flag?: boolean, debugEnv = process.env.DEBUG): boolean {
  if (flag) return true;
  if (!debugEnv) return false;
  return debugEnv
    .split(/[\s,]+/)
    .filter(Boolean)
    .some(patternMatchesNamespace);
}

export interface Debug {
  readonly enabled: boolean;
  /** Print a diagnostic line to stderr (never stdout — keeps `--json` clean). */
  log(message: string): void;
  /** Start a timer; the returned function logs `<label> (Nms)` when invoked. */
  timer(label: string): () => void;
}

export function makeDebug(flag?: boolean): Debug {
  const enabled = isDebugEnabled(flag);
  let last = performance.now();

  const write = (message: string): void => {
    const now = performance.now();
    const delta = Math.round(now - last);
    last = now;
    process.stderr.write(`${NAMESPACE} ${message} +${delta}ms\n`);
  };

  return {
    enabled,
    log(message: string): void {
      if (enabled) write(message);
    },
    timer(label: string): () => void {
      const start = performance.now();
      return () => {
        if (enabled) write(`${label} (${Math.round(performance.now() - start)}ms)`);
      };
    },
  };
}
