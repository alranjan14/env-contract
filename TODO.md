# env-contract Implementation TODO

This document breaks down the remaining implementation steps for `env-contract`, based on the `env-contract-spec.md` and `npm-package-launch-playbook.md`. It provides the necessary context for each task so they can be implemented sequentially.

---

## Phase 1: NPM Package Hygiene

Ensure the package meets the strict standards defined in the launch playbook before publishing.

- [x] **Update `packages/env-contract/package.json` Metadata**
  - **Context:** The playbook demands explicit metadata for discoverability and bundler compatibility.
  - **Tasks:**
    - Add `keywords` array (e.g., `["env", "dotenv", "zod", "t3-env", "validation", "typescript"]`).
    - Add `homepage`, `repository` (with `type: "git"` and exact URL), and `bugs` fields.
    - Add `author` and `license` (`"MIT"`).
    - Add `sideEffects: false` (Critical for bundler tree-shaking).
    - Update `exports` to include `"./package.json": "./package.json"`.
    - Add `"prepublishOnly": "npm run build && npm run test"` to `scripts`.
    - Explicitly set `peerDependenciesMeta` for `zod` as `optional: false`.

- [x] **Update `.github/workflows/release.yml` for OIDC**
  - **Context:** NPM Trusted Publishing (OIDC) requires an up-to-date npm CLI version to avoid the `ENEEDAUTH` error.
  - **Tasks:**
    - Before the `pnpm install` step, add a run step: `npm install -g npm@latest`.
    - Add a step to run tests (`pnpm run test`) before building/publishing to ensure a broken build never deploys.

---

## Phase 2: Managed Block & `sync` Command

Implement the logic to generate `.env.example` while preserving user comments outside the managed block.

- [ ] **Implement `src/utils/managed-block.ts`**
  - **Context:** We cannot overwrite `.env.example` entirely because users might have local secrets comments. We must use `>>> env-contract:start` and `<<< env-contract:end` markers.
  - **Tasks:**
    - Export `injectIntoContent(existingContent: string, newManagedContent: string): string`.
    - If markers exist, replace the content between them.
    - If markers don't exist, append the markers and new content at the bottom of the file.

- [ ] **Implement `src/core/generate-example.ts`**
  - **Context:** Converts the parsed `Schema` (from Phase 0) into the raw string that goes inside the managed block.
  - **Tasks:**
    - Iterate over `schema.entries`.
    - Group by `server` then `client`.
    - Format output: Add `# <description>` if present. Add `# Optional:` if optional. Add `# (default: X)` if default exists.
    - E.g.: `DATABASE_URL=` (never output real default values).

- [ ] **Implement `src/commands/sync.ts` & update `cli.ts`**
  - **Context:** The user-facing command that glues the schema loader, generator, and managed block together.
  - **Tasks:**
    - Load schema -> Generate content -> Read `.env.example` -> Inject -> Write to file.
    - Handle `--yes` (skip prompt) and `--check` (dry-run, exit 1 if changes needed - critical for CI).
    - Use `picocolors` to print a diff before prompting the user.

---

## Phase 3: AST Scanner (`scan` command foundation)

Find where environment variables are actually used in the codebase.

- [ ] **Implement `src/core/scan-source.ts`**
  - **Context:** We need to find references to `process.env.XXX` and `import.meta.env.XXX` to detect orphaned references.
  - **Tasks:**
    - Install and use `oxc-parser` to parse TS/JS/TSX/JSX files in the user's `src/` directory.
    - Walk the AST to find MemberExpression nodes matching `process.env` or `import.meta.env`.
    - Record the exact key being accessed, the file path, line number, and column.
    - Detect and warn on dynamic access (e.g., `process.env[dynamicVar]`).

---

## Phase 4: Differ & Reporting (`check` command)

The logic that drives the CI failures and the `scan` command output.

- [ ] **Implement `src/core/diff.ts`**
  - **Context:** Compares the three pillars: Schema, `.env.example`, and AST Scanner results.
  - **Tasks:**
    - Input: `Schema`, Example file keys, Scanner references.
    - Output: A structured report containing:
      - `exampleDrift`: Keys missing from or wrongly present in `.env.example`.
      - `orphanedRefs`: Scanned references that don't exist in the `Schema`.
      - `unusedSchemaKeys` (strict mode): Keys in `Schema` not found by the scanner.

- [ ] **Implement `src/commands/scan.ts` & update `cli.ts`**
  - **Context:** Expose the scanner and differ to the user.
  - **Tasks:**
    - Run the AST scanner.
    - Run `diff.ts`.
    - Print beautifully formatted output (using `picocolors`) listing orphaned references with their file paths/lines.
    - Support `--strict` flag.

- [ ] **Implement `src/commands/check.ts` & update `cli.ts`**
  - **Context:** The CI-friendly composite command.
  - **Tasks:**
    - Run `sync` in `--check` mode (don't write, just detect diffs).
    - Run `scan` to detect orphaned references.
    - If *any* drift exists across either pillar, print the report and `process.exit(1)`.
    - If clean, print a success message and exit 0.

---

## Phase 5: Testing & Polish

- [ ] **Unit Tests**
  - Create fixtures and write `vitest` unit tests for `managed-block.ts`, `generate-example.ts`, and `diff.ts`.
- [ ] **E2E Tests**
  - Test the CLI binary against a dummy project to ensure exit codes are correctly respected.
