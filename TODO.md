# env-contract — Architectural Roadmap & TODOs

As an npm package architect, I have reviewed the current implementation against the `env-contract-spec.md` and `npm-package-launch-playbook.md`.

The v0.1.0 MVP and v0.2.0 Polish phases are fully implemented. The foundation is exceptionally solid: we rely on a minimal set of dependencies (`cac`, `jiti`, `picocolors`, `oxc-parser`), ship dual ESM/CJS formats via `tsup`, and correctly export the CLI bin.

To ensure the package remains **lightweight** and **architecturally sound** as we scale to v1.0, here are the detailed architectural findings and the remaining tasks to be implemented.

---

## 1. Core Architecture: Validation Loaders

Currently, `src/loaders/` supports Zod and `@t3-oss/env-core`. While the `standard-schema` interface standardizes validation, it does not standardize schema introspection (extracting keys, descriptions, defaults). Therefore, we must build dedicated loaders for the major validation libraries to remain unopinionated.

- [x] **Implement `Valibot` Loader**
  - **Context:** Valibot is a highly requested, lightweight alternative to Zod.
  - **Task:** Create `src/loaders/valibot.ts` and refactor `load-schema.ts` to use a registered array of loaders.
  - **Goal:** Allow `env-contract` to automatically support Valibot out of the box.
- [ ] **Implement `ArkType` Loader**
  - **Context:** ArkType is gaining popularity for its string-based schema definitions.
  - **Task:** Create `src/loaders/arktype.ts` and add it to the loader registry.

## 2. Programmatic API Surface Area

To be a truly "architecturally good" npm package, `env-contract` must be composable. Tooling authors (like Vite plugin creators) will want to import our core engine.

- [ ] **Export Core Engine Functions**
  - **Context:** `src/index.ts` currently only exports `config.ts`, `load-schema.ts`, and types.
  - **Task:** Export `diff` from `src/core/diff.ts`, `generateExample` from `src/core/generate-example.ts`, and `scanSource` from `src/core/scan-source.ts`.
  - **Goal:** Enable developers to build `eslint-plugin-env-contract` or `vite-plugin-env-contract` using our primitives.

## 3. Performance & Stability Enhancements

While `oxc-parser` is incredibly fast, it carries a native binary footprint. For our AST scanner and watch modes to be robust, we need to address edge cases.

- [ ] **Debounce Watch Mode Events**
  - **Context:** `fs.watch` in `src/commands/sync.ts` triggers immediately on every save.
  - **Task:** Implement a 200ms debounce using a simple `setTimeout` mechanism to prevent duplicate sync executions when editors rapidly trigger multiple OS file-system events.
- [ ] **Template Literal Scanning**
  - **Context:** The current AST scanner in `src/core/scan-source.ts` relies strictly on MemberExpressions (`process.env.FOO`).
  - **Task:** Extend the visitor in `scan-source.ts` to detect `process.env` accesses embedded within Template Literals (e.g., \`\${process.env.API_URL}/users\`).

## 4. Scalability: Workspace / Monorepo Mode (v0.4)

Modern TS packages live in monorepos. Running `env-contract` individually in 20 packages is friction.

- [ ] **Implement `--workspace` Flag**
  - **Context:** Add workspace detection to the CLI.
  - **Task:** Use `fs.readdir` (recursively, avoiding `node_modules` to stay dependency-free) to find all `env.ts` or `env-contract.config.ts` files across the monorepo.
  - **Goal:** Aggregate all drift reports into a single, comprehensive CI output.

## 5. Launch & Distribution

The codebase is ready. We must execute the playbook to gain traction.

- [ ] **Publish v0.1.0 via Changesets**
  - **Task:** Run `pnpm changeset`, commit, and trigger the GitHub Action OIDC publishing workflow.
- [ ] **Community Outreach**
  - **Task:** Execute the marketing playbook. Post to r/typescript, r/nextjs, e18e.dev, and open a discussion on the `t3-oss/t3-env` repository.
