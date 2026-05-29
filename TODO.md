# env-contract - Architectural Roadmap & TODOs

This TODO is based on a review of the current implementation against
`env-contract-spec.md` and `npm-package-launch-playbook.md`.

Current status: the product direction is strong, but the package is not
publish-ready yet. `pnpm run build` and `pnpm run test` pass, but
`pnpm run typecheck`, `pnpm run lint`, and a fresh consumer import from the
packed tarball currently fail. Treat the P0 section as release-blocking.

---

## P0 - Release Blockers

- [x] Fix optional peer dependency loading.
  - [x] Remove the static `import { z } from "zod"` from the always-loaded bundle, or make `zod` a required peer.
  - [x] If Zod remains optional, avoid loading Zod as a runtime dependency during package import.
  - [x] Ensure `import("env-contract")` works in a fresh project with no validator peers installed.
  - [x] Add a tarball smoke test matrix for validator peer installs.
    - [x] No validator peers installed.
    - [x] With Zod installed.
    - [x] With Valibot installed.
    - [x] With ArkType installed.

- [x] Restore the "read-only by default" trust contract for `sync`.
  - [x] Show a diff before writing unless `--yes` is passed.
  - [x] Prompt before writing in normal local usage.
  - [x] Ensure `sync --check` is a true dry run and never writes.
  - [x] Write `.env.example` atomically to avoid corrupting files on interruption.
  - [x] Add tests for prompt/no-prompt, `--yes`, `--check`, missing target file, and existing managed block replacement.

- [x] Wire config resolution and CLI flags end to end.
  - [x] Implement config resolution order: `--config`, config files, `package.json` field, defaults.
  - [x] Add global flags from the spec: `--config`, `--schema`, `--cwd`, `--silent`, `--json`.
  - [x] Add command flags from the spec: `sync --target`, `scan --include`, `scan --exclude`.
  - [x] Pass resolved config into `runSync`, `runScan`, `runCheck`, and `runInstall`.
  - [x] Add tests proving CLI flags override config values.

- [x] Make `check` match the spec.
  - [x] Do not force unused-schema detection by default.
  - [x] Add `check --strict` if strict unused-key checks are desired.
  - [x] Include sync drift, orphaned references, dynamic references, and unused schema keys in JSON output.
  - [x] Preserve exit codes: `0` healthy, `1` drift, `2` configuration/runtime error.

- [x] Fix TypeScript and lint failures.
  - [x] Resolve `exactOptionalPropertyTypes` errors in `check.ts` and `scan.ts`.
  - [x] Add explicit types for workspace scan reports instead of relying on broad inference.
  - [x] Replace empty catches in workspace discovery with intentional ignored-error handling.
  - [x] Fix `prefer-const` and unused variable warnings.
  - [x] Update `prepublishOnly` to run `typecheck`, `lint`, `build`, and `test`.

- [x] Fix package contents before publishing.
  - [x] Ensure `LICENSE` is included in the published `env-contract` package.
  - [x] Ensure `CHANGELOG.md` exists and is included in the package.
  - [x] Run `npm pack --dry-run` and verify the tarball contains only intended files.
  - [x] Add a script or CI step for package content inspection.

- [x] Update supported runtime versions.
  - [x] Revisit the Node support policy now that Node 18 and Node 20 are EOL as of 2026-05-20.
  - [x] Update `engines.node` to the actual supported range, likely Node 22+.
  - [x] Update CI and release workflows to test/use Node 22 and Node 24.
  - [x] Ensure the release workflow uses an npm version compatible with Trusted Publishing.

- [x] Clean up incorrect status claims.
  - [x] Remove claims that v0.1 and v0.2 are fully implemented until the release gates pass.
  - [x] Remove launch/community tasks marked complete unless they have actually happened.

---

## P1 - Core Product Correctness

- [x] Implement real `.env.example` drift detection.
  - [x] Extract keys only from the managed block.
  - [x] Compare schema keys, managed example keys, and scanned references in `check`.
  - [x] Report missing and extra managed-block keys separately.
  - [x] Add tests for absent markers, malformed markers, duplicate keys, comments, and manual content outside the block.

- [x] Harden AST scanning.
  - [x] Replace suffix matching with real include/exclude pattern support or clearly document the reduced matcher.
  - [x] Honor config `scan.include` and `scan.exclude`.
  - [x] Exclude generated and dependency directories by default: `node_modules`, `dist`, `.git`, `.next`, `.nuxt`, `coverage`, `build`.
  - [x] Detect `Object.keys(process.env)` and report it as dynamic.
  - [x] Detect optional chaining where the parser represents it differently.
  - [x] Keep warning on `process.env[someVar]` and `import.meta.env[someVar]`.
  - [x] Return parse errors as structured warnings instead of direct `console.warn` from core.
  - [x] Make reported file paths relative to the configured cwd.
  - [x] Add golden tests for every scanner pattern listed in the spec.

- [x] Improve schema loading reliability.
  - [x] Auto-detect `src/env.ts`, `src/env/index.ts`, and `env.ts`.
  - [x] Prefer explicit exported schema names such as `envSchema` for non-t3 projects.
  - [x] Document how users can avoid runtime validation crashes during introspection.
  - [x] Add fixtures for Zod v3 and Zod v4 internals.
  - [x] Add fixtures for t3-env server/client scopes and client prefixes.
  - [x] Decide whether Valibot and ArkType stay in v0.1 or move back to roadmap status.
  - [x] If Valibot/ArkType stay, mark support as experimental until tested against realistic schemas.

- [x] Tighten `.env.example` generation.
  - [x] Confirm final ordering: server first, client second, alphabetical inside each group or declaration order.
  - [x] Match optional/default comment formatting from the spec.
  - [x] Never write real default values as example values.
  - [x] Include the schema path in the generated block header where possible.
  - [x] Add tests for descriptions, defaults, optional/nullish schemas, enums, URLs, emails, and transforms.

- [x] Re-scope workspace support.
  - [x] For v0.1, prefer per-package usage through `--cwd` as described in the spec.
  - [x] Remove `--workspace` from the README if it is not production-ready.
  - [x] If keeping `--workspace`, discover packages from `pnpm-workspace.yaml`, npm/yarn workspaces, or explicit config.
  - [x] Avoid recursively treating unrelated nested `package.json` files as workspace packages.
  - [x] Add Windows, macOS, and Ubuntu tests for workspace paths.

- [x] Improve `install`.
  - [x] Detect package manager and print the right command: `pnpm exec`, `npm exec`, `yarn`, or `bunx`.
  - [x] Update Husky support for current Husky behavior instead of assuming the old `husky.sh` hook body.
  - [x] Keep simple-git-hooks edits idempotent.
  - [x] Decide whether lefthook should be written automatically or remain printed guidance.
  - [x] Add tests for Husky, simple-git-hooks, lefthook, no hook manager, and `--yes`.

---

## P2 - Programmatic API And Architecture

- [ ] Align exported API with the spec.
  - [ ] Support `loadSchema({ path, cwd })` in addition to the current positional form, or update the spec.
  - [ ] Export `scan`, `check`, and `generateExample` with options that match the public README.
  - [ ] Ensure API functions do not write to stdout/stderr.
  - [ ] Return structured reports from core functions.
  - [ ] Keep CLI formatting in reporters, not in core logic.

- [ ] Add reporter modules.
  - [ ] Create pretty reporter for human CLI output.
  - [ ] Create JSON reporter for stable machine-readable output.
  - [ ] Keep report types stable enough for CI integrations.

- [ ] Maintain the small dependency budget deliberately.
  - [ ] Re-evaluate whether glob support needs a fifth dependency.
  - [ ] If adding a glob library, document the tradeoff and choose a tiny maintained package.
  - [ ] Keep no telemetry, no postinstall scripts, and no network access.

---

## P2 - Tests And CI

- [ ] Add realistic fixtures.
  - [ ] `basic-zod`
  - [ ] `t3-env-nextjs`
  - [ ] `t3-env-with-presets`
  - [ ] `orphan-refs`
  - [ ] `empty-project`
  - [ ] `parse-error`
  - [ ] `monorepo` only if workspace mode is retained

- [ ] Add CLI E2E coverage.
  - [ ] `sync` creates a new `.env.example`.
  - [ ] `sync` preserves manual content outside the managed block.
  - [ ] `sync --check` exits `1` without writing when drift exists.
  - [ ] `scan` reports orphaned references.
  - [ ] `scan --strict` reports unused schema keys.
  - [ ] `check` reports sync drift and scan drift together.
  - [ ] `--json` output is valid JSON for success, drift, and runtime error cases.

- [ ] Add downstream package smoke tests.
  - [ ] Install from `npm pack` tarball in a fresh directory.
  - [ ] Test ESM import.
  - [ ] Test CommonJS require.
  - [ ] Test CLI bin execution.
  - [ ] Test type resolution in a downstream TypeScript project.

- [ ] Expand CI matrix.
  - [ ] Run on Ubuntu, macOS, and Windows.
  - [ ] Run on Node 22 and Node 24.
  - [ ] Keep `typecheck`, `lint`, `build`, `test`, and tarball smoke tests as required checks.
  - [ ] Consider package-manager smoke tests for pnpm, npm, yarn, and bun after v0.1.

---

## P2 - Documentation And Developer Experience

- [ ] Rewrite the README to match what is actually supported.
  - [ ] Lead with install and quick start in the first screen.
  - [ ] Add "Supported today", "Experimental", and "Roadmap" sections.
  - [ ] Remove or qualify Valibot, ArkType, watch mode, and workspace claims until they are production-ready.
  - [ ] Add CLI reference with all flags and exit codes.
  - [ ] Add config reference.
  - [ ] Add known limitations prominently.
  - [ ] Add troubleshooting for schema import/runtime validation failures.
  - [ ] Add a fair comparison table.

- [ ] Add framework recipes.
  - [ ] T3 / `@t3-oss/env-core`
  - [ ] Next.js
  - [ ] Vite / Astro using `import.meta.env`
  - [ ] Express or Hono with plain Zod
  - [ ] Turborepo per-package recipe

- [ ] Clean up repo documentation.
  - [ ] Make root `README.md` either the real docs or a short pointer to `packages/env-contract/README.md`.
  - [ ] Update `env-contract-spec.md` with decisions made during implementation.
  - [ ] Update `npm-package-launch-playbook.md` if any publishing assumptions change.
  - [ ] Decide whether spec/playbook docs should be committed; if yes, stop ignoring them in `.gitignore`.

- [ ] Prepare future docs site scope.
  - [ ] Defer full docs site until README grows large or users ask for deeper guides.
  - [ ] If needed, use Astro Starlight, Nextra, or VitePress.
  - [ ] Initial docs IA: Get Started, Commands, Config, Loaders, CI, Monorepos, API, Limitations.

---

## P2 - Governance, Security, And Repo Hygiene

- [ ] Replace placeholder governance files.
  - [ ] Replace placeholder text in `CODE_OF_CONDUCT.md` with the full Contributor Covenant text.
  - [ ] Replace placeholder email in `SECURITY.md` or point to GitHub Security Advisories.
  - [ ] Update `CONTRIBUTING.md` with real repo URL and required local checks.

- [ ] Clean tracked development artifacts.
  - [ ] Remove `packages/env-contract/test-output.txt` if it is only local output.
  - [ ] Remove `packages/env-contract/test_cli_fail.ts` if it is only a scratch script.
  - [ ] Remove `packages/env-contract/test_template.ts` if it is only a scratch script.
  - [ ] Ensure scratch files stay ignored.

- [ ] Add or verify changelog flow.
  - [ ] Ensure changesets generates package changelog entries.
  - [ ] Keep `.changeset` summaries honest and not ahead of implementation.
  - [ ] Confirm package version and changelog before every publish.

- [ ] Verify GitHub settings before launch.
  - [ ] Enable Dependabot alerts and security updates.
  - [ ] Protect `main` with required CI checks.
  - [ ] Enable Discussions only if you plan to monitor them.
  - [ ] Configure npm Trusted Publishing for the exact repository and workflow.

---

## P3 - Launch And Adoption

- [ ] Complete pre-publish checklist.
  - [ ] npm account has 2FA enabled.
  - [ ] GitHub account has 2FA enabled.
  - [ ] `npm whoami` returns the intended publisher.
  - [ ] Repository URL exactly matches npm Trusted Publishing configuration.
  - [ ] No `.env` files, secrets, internal docs, or accidental artifacts in tarball.

- [ ] Publish only after release gates pass.
  - [ ] `pnpm run typecheck`
  - [ ] `pnpm run lint`
  - [ ] `pnpm run build`
  - [ ] `pnpm run test`
  - [ ] `npm pack --dry-run`
  - [ ] Fresh install/import smoke test from tarball
  - [ ] CLI smoke test from tarball

- [ ] Prepare launch assets.
  - [ ] GitHub release notes for v0.1.0.
  - [ ] Short demo recording showing schema drift, sync, and scan.
  - [ ] Launch post with honest limitations.
  - [ ] T3 discussion framed as companion tooling, not competition.
  - [ ] Submissions to relevant newsletters and communities after the package is stable.

- [ ] Track adoption after launch.
  - [ ] Weekly downloads.
  - [ ] Issues opened and resolved.
  - [ ] Common user failures.
  - [ ] README conversion feedback.
  - [ ] Starter-template integration opportunities.

---

## Definition Of Publish Ready

- [ ] All P0 items are complete.
- [ ] README claims match implemented behavior.
- [ ] Fresh tarball install works in a clean project.
- [ ] CI passes on supported OS and Node versions.
- [ ] The package can run against at least one real T3 project and one plain Zod project.
- [ ] Known limitations are documented plainly.
