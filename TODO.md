# env-contract — Production-Hardening Roadmap

Derived from a principal-level architecture, TypeScript, security, and
operational review of the codebase (2026-06-27).

The structure here is good (clean `core`/`loaders`/`commands`/`reporters`
layering, adapter registry for schema loaders, strict tsconfig, atomic writes,
lazy-loaded subcommands, golden AST tests, OIDC trusted publishing). The gap is
between *looks* production-grade and *is* operationally sound: two automation
bugs mean CI and releases don't actually run, a versioning bug will ship a wrong
`--version`, and the lint config undoes the strict-TS guarantees at exactly the
boundaries where untyped external data enters.

Severity legend: 🔴 Critical · 🟠 High · 🟡 Recommended · ⚪ Optional

---

## Implementation status — 2026-06-27 (uncommitted working tree)

Critical + High tier implemented and verified green on Node 22
(`typecheck` incl. tests, `lint` with `no-explicit-any: error`, `build`, `test` →
123 passing). **Not committed.**

- ✅ **C2, H1, H3, H4, H5, H6** — complete (details checked off below).
- 🟡 **C1** — workflows/changeset fixed in-repo (CI/release now trigger on the
  real branch + `workflow_dispatch`); the branch rename + protection rule are
  manual GitHub steps that remain.
- ⏳ **H2** — deferred. The `no-explicit-any: error` half landed under the
  existing ESLint 8 config; the flat-config + type-aware (`recommendedTypeChecked`)
  migration is a self-contained ESLint 9 upgrade best done as its own change.

---

## 🔴 Critical — release/correctness blockers

- [ ] **C1 — Automation targets `main`, but the default branch is `master` → CI and releases never run.**
  - Files: `.github/workflows/ci.yml:5`, `.github/workflows/release.yml:5`, `.changeset/config.json:8`
  - Why: every push has run zero checks; `changeset publish` has never triggered. Green-checkmark social contract is broken.
  - [ ] Decide the branch model (trunk-based recommended) and standardize on one name.
  - [ ] If standardizing on `main`: `git branch -m master main` → `git push -u origin main` → `gh repo edit --default-branch main` → delete `master` after updating protection.
  - [ ] Reconcile the `origin/dev` branch with the chosen model.
  - [x] Add `workflow_dispatch:` to CI so it can be run manually.
  - [ ] Add a branch-protection rule requiring the CI check (this surfaces the misconfig immediately).

- [x] **C2 — `--version` will go stale after the first release.**
  - File: `packages/env-contract/src/index.ts:14` (hardcoded `version = "0.1.0"`, consumed by `cli.ts`).
  - Why: `changeset version` bumps only `package.json`; `--version` will print `0.1.0` forever after publishing `0.2.0`.
  - [ ] Inject the version at build time from `package.json` (tsup `define: { __VERSION__: ... }`) or read it at runtime.
  - [ ] Remove the hardcoded literal; make `package.json` the single source of truth.
  - [ ] Add a test asserting `--version` matches `package.json`.

---

## 🟠 High — type safety, correctness, enforcement

- [x] **H1 — `any` is enabled and present at every trust boundary; it defeats the strict tsconfig.**
  - Files: `.eslintrc.json:11` (`no-explicit-any: off`), `loaders/types.ts:5,15`, `core/scan-source.ts:162` (+ AST walk), `core/load-schema.ts:37`, ~20 `catch (e: any)`.
  - [ ] Add `utils/errors.ts` with `toError(e: unknown)` / `errCode(e: unknown)` helpers.
  - [ ] Convert all `catch (e: any)` → `catch (e: unknown)` + narrowing.
  - [ ] Type loader inputs as `unknown` and rely on `matches()` guards to narrow.
  - [ ] Change `SchemaEntry.default` from `any` → `unknown`.
  - [ ] Flip `@typescript-eslint/no-explicit-any` to `"error"`; allow only targeted, commented `eslint-disable` where genuinely unavoidable.

- [ ] **H2 — ESLint is legacy-format and not type-aware → misses real bugs.**
  - File: `.eslintrc.json` (eslint 8, `recommended` only — not `recommendedTypeChecked`).
  - Why: floating promises, `no-misused-promises`, unsafe-any rules are all off. Example latent bug: `setTimeout(async () => { await executeSync(...) })` in watch (`commands/sync.ts:80,120`) is an unhandled rejection.
  - [ ] Migrate to flat config (`eslint.config.js`) on ESLint 9 + `typescript-eslint`.
  - [ ] Enable `recommendedTypeChecked` (`projectService: true`).
  - [ ] Fix the batch of violations it surfaces (one-time cost = the point).

- [x] **H3 — Test files are never type-checked.**
  - File: `packages/env-contract/tsconfig.json:8` (`exclude: ["...","tests"]`); vitest strips types via esbuild.
  - [ ] Add `tsconfig.test.json` extending base, including `src` + `tests`.
  - [ ] Update `typecheck` script to also run `tsc -p tsconfig.test.json --noEmit`.

- [x] **H4 — `loadConfig` swallows all errors → silent misconfiguration.**
  - File: `packages/env-contract/src/config.ts:26` (and the `package.json` read at `:45-52`).
  - [ ] Distinguish "file absent" (→ `{}`, only in the discovery loop) from "file present but failed to load" (→ throw with the underlying cause).
  - [ ] In the `package.json` path, tolerate only `ENOENT` / JSON parse absence; surface malformed `package.json`.
  - [ ] Add a test: a config with a syntax error must fail loudly, not fall back to defaults.

- [x] **H5 — `--workspace --watch` only ever watches the first package.**
  - File: `packages/env-contract/src/commands/sync.ts:73-91` (the `for await (event of watcher)` blocks the outer `for` loop forever).
  - [ ] Extract a `watchOne(target)` helper and start all watchers concurrently (`Promise.all`).
  - [ ] Wrap the debounced `executeSync` in `.catch` to kill the floating promise.
  - [ ] Add a test (or document the limitation) for multi-package watch.

- [x] **H6 — Drift logic is duplicated in three places; the canonical `core/diff.ts` is bypassed.**
  - Files: `core/diff.ts:13` (canonical, unused by commands), `commands/sync.ts:181-206`, `core/check-programmatic.ts:49-63`.
  - [ ] Add a single `computeKeyDrift(schemaKeys, presentKeys, ignore)` in `core/diff.ts`.
  - [ ] Make `executeSync` and `check` call it (managed-block keys as `presentKeys`).
  - [ ] Delete the inline copies; ensure `diff()` tests cover the shared path.

---

## 🟡 Recommended

- [ ] **M1 — `export *` from core leaks internals into the public (semver-locked) API.**
  - File: `packages/env-contract/src/index.ts:11-12` (leaks `globToRegex`, `parseEnvKeys`, internal types).
  - [ ] Replace `export *` with curated named exports (public functions + stable types only).
  - [ ] Add an API-surface snapshot test (keys of `import * as api`) so additions are deliberate.

- [ ] **M2 — Add an injectable logger; remove the ~15 repeated `!options.json && !options.silent` checks.**
  - Files: all of `commands/*` and `reporters/*` call `console.*` directly.
  - Why: one missed mode-check corrupts `--json` output; output is currently untestable.
  - [ ] Add `makeLogger({ json, silent })` encapsulating the policy (errors always surface).
  - [ ] Thread one `Logger` through commands; pass it into reporters.
  - [ ] Use a capturing logger in tests instead of spying on `console`.

- [ ] **M3 — Glob regex is recompiled for every path walked.**
  - File: `packages/env-contract/src/core/scan-source.ts:81-87` (`globToRegex` inside `.some()`).
  - [ ] Precompile include/exclude patterns to `RegExp[]` once before the walk; reuse.

- [ ] **M4 — The `JSON.parse(result.program)` round-trip is both a perf cost and the root cause of the `any` AST walk.**
  - File: `packages/env-contract/src/core/scan-source.ts:154` (+ `walkAst` visiting every key, `:318`).
  - [ ] Check whether the pinned `oxc-parser` version can return a structured `program` object + AST types; if so, drop `JSON.parse` and type the visitor.
  - [ ] Make the walker descend only known child fields (skip `start`/`end`/`type`).

- [ ] **M5 — Three different Node baselines.**
  - `engines.node: >=22` (both `package.json`), `tsup target: node18` (`tsup.config.ts:10`), `@types/node: ^20` (root).
  - [ ] Pick one floor (CI matrix is 22/24 → choose 22).
  - [ ] Set tsup `target: "node22"`; reassess whether `shims` is still needed.
  - [ ] Bump `@types/node` to match; add `.nvmrc` / `.node-version`.

- [ ] **M6 — Prettier and dogfooded hooks are present in spirit, absent in practice.**
  - [ ] Add `.prettierrc` + `format` / `format:check` scripts; add `format:check` to CI.
  - [ ] Dogfood: add `.husky/pre-commit` running `lint-staged` (eslint --fix + prettier) and `env-contract check` in this repo.
  - [ ] (Optional) Add `commitlint` + a `commit-msg` hook for Conventional Commits.

- [ ] **M7 — Weak types at the command seams.**
  - [ ] Replace `{ code: number; data?: any }` return types with the typed report unions (`commands/sync.ts:21`, `scan.ts`).
  - [ ] Define a `SyncOptions` interface; remove `options: any` (`commands/sync.ts:152`).
  - [ ] Introduce an `ExitCode` const-union (`Ok=0`, `Drift=1`, `RuntimeError=2`) and use it everywhere; document it in the README (a CLI's exit codes are an API).

- [ ] **M8 — Config is never validated; `defineConfig` is the identity function.**
  - File: `packages/env-contract/src/config.ts:16`.
  - [ ] Add a small hand-written `assertConfig(c): asserts c is Config` (keep zero-runtime-dep budget; zod is a peer dep).
  - [ ] Emit one clear, actionable error for bad shapes (e.g. `ignoreKeys` not an array).

- [ ] **M9 — No coverage gate; coverage not collected in CI.**
  - [ ] Add `vitest.config.ts` with v8 coverage + thresholds (e.g. lines 80 / branches 75).
  - [ ] Run `pnpm -r test --coverage` in CI.

- [ ] **Security hardening (mostly documentation).**
  - [ ] In `SECURITY.md`, state that `loadSchema`/`loadConfig` **execute** target-repo code (`core/load-schema.ts:31`, `config.ts:21`) — same trust model as ESLint/Vite configs; warn against pointing `check` at untrusted PRs in privileged CI.
  - [ ] Add `pnpm audit --prod` (or Dependabot/Renovate) to CI.
  - [ ] Document the "keys-only, never reads secret values" property as a deliberate guarantee.

---

## ⚪ Optional / opportunistic

- [ ] **L1 — `getPosition` linear scan → binary search over `lineStarts`** (`core/scan-source.ts:272`).
- [ ] **L2 — `writeAtomically` leaves the temp file on failure; no `fsync`** (`utils/file.ts:5`); wrap in try/finally.
- [ ] **L3 — Naming collision:** `core/diff.ts` (contract diff) vs `utils/diff.ts` (terminal line-renderer). Rename the latter to `reporters/render-diff.ts`.
- [ ] **L4 — Scan files with bounded concurrency** instead of sequential `await` (`core/scan-source.ts:107-133`) — only if profiling shows a need.
- [ ] **L5 — `parseEnvKeys` doesn't handle `export KEY=`** (`core/diff.ts:64`).
- [ ] **L6 — `detectPackageManager` returns `string`; make it a union** (`commands/install.ts:21`).
- [ ] Harden hand-rolled utilities with adversarial tests (the deliberate zero-dep trade-off means you own the edge cases): `globToRegex`, `parsePnpmWorkspaceYaml` (document its supported YAML subset and fail loudly outside it), `showDiff`.

---

## Production readiness — tailored to a CLI

Metrics / monitoring / feature-flags / Prometheus are **N/A** for an offline CLI; adding them would be over-engineering. What actually matters:

- [ ] **Exit codes are the API** — formalize (`ExitCode` enum, M7) and document them.
- [ ] **`--json` is the machine interface** — add a `schemaVersion` field so downstream parsers can adapt to shape changes.
- [ ] **Debug channel, not telemetry** — honor `DEBUG=env-contract*` (or `--debug`) to print timings + resolved paths.
- [ ] **Top-level safety net** — ensure `cli.parse()` (`cli.ts:75`) has a final `.catch` → clean message + exit `2` instead of a raw stack.
- [ ] Keep: no telemetry, no postinstall, no network access, tiny dep tree.

---

## Documentation

- [ ] **ADRs** in `docs/adr/` for the decisions worth not re-litigating:
  - [ ] 0001 — adapter registry for schema loaders.
  - [ ] 0002 — hand-rolled glob/YAML/diff instead of deps (capture the trade-off so nobody "helpfully" adds `picomatch`).
  - [ ] 0003 — managed-block injection vs full-file ownership of `.env.example`.
  - [ ] 0004 — exit-code semantics (0/1/2).
- [ ] **README** — add an Exit Codes table, a `--json` schema section, and the "schema/config files are executed" security note.
- [ ] **CONTRIBUTING** — document the local loop once `.nvmrc` + dogfooded hooks land (`pnpm i → typecheck → lint → test`).

---

## Suggested sequencing

1. **Today (Critical):** C1, C2 — without these nothing is CI-verifiable.
2. **This week (High):** H2 + H1 (type-aware lint, kill `any`), H3 (type-check tests), H4 (config errors), H6 (de-dupe drift), H5 (workspace watch).
3. **Next (Recommended):** M2 (logger), M1 (public API + surface test), M8 (config validation), M6 (Prettier + dogfood hooks), M9 (coverage), M5 (Node baseline), M4 (parser), M3 (glob precompile), M7 (typed seams).
4. **Opportunistic (Optional):** ADRs, L1–L6, adversarial tests.

---

## Definition of done

- [ ] CI and Release run on every push/PR to the real default branch and are required checks.
- [ ] `--version` matches `package.json` after a `changeset version` bump.
- [ ] `tsc --noEmit` (src + tests) and type-aware ESLint pass with `no-explicit-any: error`.
- [ ] One drift rule implementation, called by both `sync` and `check`.
- [ ] All output flows through an injectable logger; `--json` is provably uncontaminated.
- [ ] Public API is curated and snapshot-guarded.
- [ ] Coverage gate enforced in CI; tests pass on supported OS × Node matrix.
