/**
 * Output policy lives here, in one place, so individual commands and reporters
 * can't accidentally print human chatter to stdout in `--json` mode (which would
 * corrupt machine-readable output) or leak in `--silent` mode.
 *
 *   info()   human progress/status  -> stdout, suppressed when json || silent
 *   output() machine output (JSON)  -> stdout, always
 *   error()  diagnostics            -> stderr, always (even when silent)
 */
export interface Logger {
  info(message: string): void;
  output(message: string): void;
  error(message: string): void;
}

export interface LoggerOptions {
  json?: boolean | undefined;
  silent?: boolean | undefined;
}

export function makeLogger(options: LoggerOptions = {}): Logger {
  const quiet = Boolean(options.json) || Boolean(options.silent);
  return {
    info(message: string): void {
      if (!quiet) console.log(message);
    },
    output(message: string): void {
      console.log(message);
    },
    error(message: string): void {
      console.error(message);
    },
  };
}

/** Console-backed, never-quiet logger for direct callers (and reporter defaults). */
export const consoleLogger: Logger = makeLogger();
