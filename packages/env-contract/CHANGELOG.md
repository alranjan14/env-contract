# env-contract

## 0.1.0

### Minor Changes

- Initial public release.
  - `sync` — generate and update a managed block in `.env.example` from your env schema (preserves manual content outside the block).
  - `scan` — AST-based detection of `process.env` / `import.meta.env` references; flags references missing from the schema, and with `--strict`, schema keys unused in code.
  - `check` — CI-friendly composite command with `0` / `1` / `2` exit codes and stable `--json` output.
  - `install` — pre-commit hook setup for husky, simple-git-hooks, or lefthook.
  - Validator support: Zod (v3 & v4) and `@t3-oss/env-core` / `@t3-oss/env-nextjs` (production-ready); Valibot and ArkType (experimental).
  - Programmatic API: `loadSchema`, `scan`, `check`, `generateExample`.
