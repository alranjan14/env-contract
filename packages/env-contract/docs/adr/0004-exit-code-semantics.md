# 0004 — Exit-code semantics (0 / 1 / 2)

- Status: Accepted
- Date: 2026-06-29

## Context

`env-contract` is a CI-first tool. Its process exit code is the primary signal a
pipeline acts on, which makes it a public API: scripts depend on it, and changing
it is a breaking change. A binary "zero or non-zero" is not enough — a pipeline
needs to tell "the contract drifted" (a legitimate finding to fail on) apart from
"the tool could not run" (a misconfiguration to investigate).

## Decision

Exit codes are named constants in one place (`src/utils/exit-code.ts`) and used
everywhere:

| Code | Name           | Meaning                                                        |
| ---- | -------------- | -------------------------------------------------------------- |
| `0`  | `Ok`           | No drift and no contract violations.                           |
| `1`  | `Drift`        | Drift or violations found — CI should fail.                    |
| `2`  | `RuntimeError` | The check could not complete (bad schema, malformed config…).  |

Commands return a typed `ExitCode`; `cli.ts` exits with it. A top-level `.catch`
in `cli.ts` is the final safety net: any error that escapes a command's own
handling (e.g. a malformed config that throws during resolution) is turned into a
clean one-line message on stderr and exit `2` — never a raw stack trace.

## Consequences

- **+** Pipelines can distinguish "fix the drift" (`1`) from "fix the setup"
  (`2`), and treat them differently.
- **+** Exit codes are documented in the README, where users actually look.
- **−** These three values are now a compatibility surface; reusing or
  renumbering them is a breaking change.
