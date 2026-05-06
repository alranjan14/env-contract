# env-contract v0.2 & Launch TODO

This document details the implementation plan for the **v0.2 Polish** features and the **Launch Strategy**, as defined in the `env-contract-spec.md` and `npm-package-launch-playbook.md`.

---

## Phase 1: Configurable `ignoreKeys`

Some environment variables (like `NODE_ENV`, `CI`, `VERCEL`) are standard and shouldn't trigger drift warnings if they are missing from the schema or unreferenced in the codebase.

- [ ] **Update `Config` Interface**
  - **Context:** Modify `packages/env-contract/src/config.ts`.
  - **Tasks:** Add `ignoreKeys?: string[]` to the `Config` interface.
- [ ] **Implement Filtering in Differ**
  - **Context:** Modify `packages/env-contract/src/core/diff.ts`.
  - **Tasks:** Before calculating `orphanedRefs` and `unusedSchemaKeys`, filter out any keys that exist in the `ignoreKeys` array.
- [ ] **Add Unit Tests**
  - **Context:** Update `packages/env-contract/tests/diff.test.ts`.
  - **Tasks:** Add a test case verifying that ignored keys are successfully omitted from the drift reports.

---

## Phase 2: The `install` Command

Provide an idempotent setup helper that configures git hooks and suggests CI workflows, making adoption frictionless.

- [ ] **Create `src/commands/install.ts`**
  - **Context:** New command handler.
  - **Tasks:**
    - Detect the presence of popular git hook runners by inspecting `package.json` (`husky`, `simple-git-hooks`, `lefthook`).
    - If `husky` is found, suggest/create the `npx env-contract check` command inside `.husky/pre-commit` (or the hook specified by `--hook`).
    - If `simple-git-hooks` is found, append to the `simple-git-hooks.pre-commit` field in `package.json`.
    - If no hook runner is found, suggest installing one (e.g., husky).
    - Print a beautifully formatted (via `picocolors`) copy-pasteable GitHub Actions snippet.
- [ ] **Wire up CLI**
  - **Context:** Modify `packages/env-contract/src/cli.ts`.
  - **Tasks:** Add the `install` command with an optional `--hook <name>` flag (defaulting to `pre-commit`).

---

## Phase 3: Watch Mode (`sync --watch`)

Allow users to keep their `.env.example` continuously in sync while they are actively developing and modifying their schema.

- [ ] **Implement File Watcher**
  - **Context:** Modify `packages/env-contract/src/commands/sync.ts`.
  - **Tasks:** 
    - If `--watch` is true, use `node:fs` `watch` (or a lightweight watcher) to monitor the schema file (`src/env.ts`).
    - On change, clear the `jiti` cache for that file and re-run the sync logic.
    - Print a message indicating it is watching for changes.
- [ ] **Wire up CLI**
  - **Context:** Modify `packages/env-contract/src/cli.ts`.
  - **Tasks:** Add `.option("--watch", "Watch schema for changes")` to the `sync` command.

---

## Phase 4: Better Error Messages

Improve Developer Experience (DX) by making error messages actionable.

- [ ] **Improve `scan` and `check` outputs**
  - **Tasks:** 
    - When `check` fails due to drift, append a clear suggestion: `👉 Fix this by running 'npx env-contract sync' locally.`
    - If the schema loader fails (e.g., TS error), intercept the error and suggest checking the schema path or looking for syntax errors in the schema file.

---

## Phase 5: Launch & Distribution (Playbook)

Once v0.1 is published, execute the marketing playbook.

- [ ] **Publish v0.1.0**
  - **Tasks:** Run `pnpm changeset`, commit, and merge the Version Packages PR to trigger the OIDC publish workflow.
- [ ] **Community Outreach**
  - **Tasks:**
    - Create a Show HN post.
    - Open a respectful GitHub Discussion on the `t3-oss/t3-env` repository.
    - Post on `r/typescript` and `r/nextjs` focusing on the problem solved.
    - Submit the package to the `e18e.dev` ecosystem list.
