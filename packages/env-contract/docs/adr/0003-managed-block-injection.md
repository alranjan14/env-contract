# 0003 — Managed-block injection vs. full-file ownership of `.env.example`

- Status: Accepted
- Date: 2026-06-29

## Context

`.env.example` is frequently a hand-maintained file: it carries human comments,
logical grouping, example values, and sometimes keys that are not part of the
validated schema (local-only toggles, documentation). If `env-contract`
regenerated the whole file from the schema, it would destroy all of that on the
first `sync`.

## Decision

`env-contract` owns only the region between explicit markers — the *managed
block* — and never touches anything outside it
(`src/utils/managed-block.ts`: `injectIntoContent` / `extractManagedContent`).
`sync` regenerates the managed block from the schema and splices it back into the
existing file; drift detection (`sync --check`, `check`) compares the schema
against the **managed block's** keys, not the whole file.

## Consequences

- **+** Non-destructive: human comments and custom keys outside the markers are
  preserved across syncs.
- **+** The diff shown in interactive `sync` is scoped to what the tool actually
  manages.
- **−** Keys a user wants tracked must live inside the managed markers; keys
  placed outside are intentionally invisible to drift detection.
- **−** The marker contract is itself part of the file format and must remain
  stable across versions.
