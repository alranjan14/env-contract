# 0002 — Hand-rolled glob / YAML / diff instead of dependencies

- Status: Accepted
- Date: 2026-06-29

## Context

A small dependency tree is a deliberate feature of this tool: it means a smaller
install, a smaller attack surface, no transitive postinstall scripts, and no
network access. `env-contract` nonetheless needs three capabilities that are
usually pulled in as dependencies:

- glob matching for `--include` / `--exclude` (often `picomatch`/`minimatch`),
- parsing `pnpm-workspace.yaml` (often `js-yaml`),
- rendering a terminal diff for the interactive `sync` preview (often `diff`).

## Decision

Implement minimal, purpose-built versions in-repo instead of taking the
dependencies:

- `globToRegex` (`src/core/scan-source.ts`) — supports `*`, `?`, `**`, leading
  and mid-path `/**/`, brace alternation `{a,b}`, and literal escaping.
- `parsePnpmWorkspaceYaml` (`src/utils/workspace.ts`) — parses a **documented
  subset**: a top-level `packages:` key as either a block sequence or an inline
  array. Unrecognized keys are ignored leniently so unrelated pnpm config does
  not break discovery.
- `showDiff` (`src/reporters/render-diff.ts`) — a line-oriented renderer with a
  bounded look-ahead window to re-sync after edits.

**Please do not "helpfully" replace these with `picomatch`, `js-yaml`, or
`diff`.** The zero-runtime-dependency budget is the point.

## Consequences

- **+** Zero runtime dependencies for these features; full control over behavior.
- **−** We own the edge cases. This is paid down with adversarial tests in
  `tests/utils-hardening.test.ts`. (A real bug — a mid-path `/**/` translating to
  a double-slash regex that matched nothing — was found and fixed exactly because
  this ADR mandates that coverage.)
- **−** The supported glob and YAML surfaces are intentionally limited; anything
  outside the documented subset is unsupported rather than guaranteed.
