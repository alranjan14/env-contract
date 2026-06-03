# env-contract — Project Specification

> A small, opinionated companion to `@t3-oss/env-core` (and any Standard-Schema validator) that keeps your environment **schema**, your **`.env.example`**, and your **codebase references to `process.env`** in lockstep.
>
> Three commands. Read-only by default. Zero runtime overhead.

---

## Table of Contents

1. [The Pitch](#1-the-pitch)
2. [Problem Statement](#2-problem-statement)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Design Principles](#4-design-principles)
5. [Architecture Overview](#5-architecture-overview)
6. [CLI Surface](#6-cli-surface)
7. [Programmatic API](#7-programmatic-api)
8. [Technical Specifications](#8-technical-specifications)
9. [Project Structure](#9-project-structure)
10. [Tech Stack & Dependencies](#10-tech-stack--dependencies)
11. [Testing Strategy](#11-testing-strategy)
12. [Edge Cases & Known Limitations](#12-edge-cases--known-limitations)
13. [Roadmap](#13-roadmap)
14. [Distribution & Adoption Plan](#14-distribution--adoption-plan)
15. [Public README Template](#15-public-readme-template)
16. [Open Decisions](#16-open-decisions)

---

## 1. The Pitch

**One-liner:** Keep your env schema, your `.env.example`, and your `process.env.*` references honest with each other.

**For:** TypeScript developers using Zod (or Valibot, ArkType) to validate environment variables — especially T3 stack, Next.js, Remix, Hono, and Node backend devs.

**Not for:**
- Plain JavaScript projects without a typed schema (no value to add).
- Teams that don't commit `.env.example` (the whole point of the tool is sync).
- Replacing `@t3-oss/env-core` or `envalid` — this **complements** them.

**The promise:** If you put it in your pre-commit hook and CI, your team will never again ship a PR where a new env var was added to code or schema but not to `.env.example`. New devs cloning your repo will get a generated, accurate `.env.example` for free.

---

## 2. Problem Statement

### The three artifacts that always drift

In any non-trivial Node/TypeScript project, three things must agree about which environment variables exist:

| Artifact | Maintained by | Drift consequence |
|---|---|---|
| **Validation schema** (`env.ts` with Zod) | Whoever added the var | App crashes on boot if missing |
| **`.env.example`** | Whoever remembers | New devs and CI fail mysteriously |
| **`process.env.X` references** in code | Anyone, anywhere | Silent runtime `undefined` bugs, "works in CI but not locally" |

Today these drift independently. The popular validators (`@t3-oss/env-core`, `envalid`) handle artifact #1 brilliantly but explicitly punt on the other two.

> From the official t3-env docs: *"Optional: Add the environment variable to .env.example..."*

That word **Optional** is the gap. Optional in docs = forgotten in practice = broken onboarding and CI.

### Real-world failure modes this prevents

1. **The "works on my machine"** — Dev A adds `STRIPE_SECRET` to `env.ts` and `.env`. Forgets `.env.example`. Dev B pulls main, runs `pnpm dev`, gets a cryptic Zod error and slacks the team.
2. **The orphaned reference** — Old code references `process.env.LEGACY_API_URL`. The schema doesn't include it. CI sets it. Local dev does not. Nobody notices because the code path is rarely hit, until it is.
3. **The CI ghost** — A var is set in CI environment but missing from both schema and `.env.example`. Code that uses it works in production. Six months later, a new dev tries to run integration tests locally and nothing works.
4. **The leftover** — A var was removed from the schema but `process.env.X` still appears in three files. TypeScript doesn't catch it because `process.env` is `Record<string, string | undefined>`.

### What we don't try to solve

- We don't validate values at runtime — `@t3-oss/env-core` already does that.
- We don't load `.env` files — `dotenv` and Node 20+ already do.
- We don't manage secrets — that's Doppler, Infisical, 1Password.
- We don't lint `.env` files for syntax — `dotenv-linter` does.

---

## 3. Competitive Landscape

| Tool | Validates schema | Auto-generates `.env.example` | Detects unused/missing `process.env` refs | Standard Schema |
|---|---|---|---|---|
| `dotenv` | ❌ | ❌ | ❌ | ❌ |
| `@t3-oss/env-nextjs` (~1.2M wk) | ✅ | ❌ | ❌ | ✅ |
| `envalid` (~650K wk) | ✅ | ❌ | ❌ | ❌ |
| `env-schema` (Fastify) | ✅ | ❌ | ❌ | ❌ |
| `dotenv-linter` (Rust) | ❌ | ❌ | ❌ | ❌ |
| `dotenv-checker` | ❌ (file-only) | partial | ❌ | ❌ |
| `env-check-ts` (small) | ✅ Zod | ✅ | ❌ | ❌ |
| **env-contract (this)** | ❌ (delegates) | ✅ | ✅ | ✅ (planned) |

**The defensible position:** the only tool that does the sync + scan trifecta and treats the existing validator (whichever one) as the source of truth.

---

## 4. Design Principles

These are non-negotiable. Every PR should respect them.

1. **Schema is the source of truth.** Never the `.env.example`, never the code. If you want to add a var, you add it to the schema.
2. **Read-only by default.** No command modifies user files unless the user runs `sync`. No postinstall scripts. No telemetry. Earns trust.
3. **Compose, don't compete.** Users keep their existing `@t3-oss/env-core` setup. We never wrap, replace, or fork the validator.
4. **Fail loud in CI, fail soft locally.** `check` exits non-zero in CI; `sync` is interactive locally.
5. **Explicit over magical.** Users opt in to scanning. Users mark which `.env.example` we manage. No hidden state.
6. **Be honest about limits.** Document what AST scanning does and doesn't catch. Over-promising kills trust faster than under-delivering.
7. **Stay tiny.** v1.0 target: < 800 LOC core, ≤ 4 runtime dependencies.

---

## 5. Architecture Overview

```
                       ┌──────────────────────┐
                       │  env.ts              │
                       │  (Standard Schema    │
                       │   compatible)        │
                       └──────────┬───────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                 ▼                 ▼
        ┌───────────────┐ ┌───────────────┐ ┌──────────────┐
        │ schema-loader │ │ schema-loader │ │ schema-loader│
        │ (introspector)│ │ (introspector)│ │ (introspector)│
        └───────┬───────┘ └───────┬───────┘ └──────┬───────┘
                ▼                 ▼                 ▼
         ┌─────────────┐    ┌──────────┐     ┌──────────┐
         │  generate   │    │   scan   │     │  check   │
         │ .env.example│    │ src/ AST │     │  diff    │
         └──────┬──────┘    └─────┬────┘     └─────┬────┘
                │                 │                │
                ▼                 ▼                ▼
         .env.example      orphan/missing      exit code
         (managed block)   ref report          + report
```

### Key components

- **`schema-loader`** — dynamically imports the user's `env.ts`, introspects the validator (Zod first, others later) to get the list of keys, types, descriptions, defaults.
- **`generator`** — writes `.env.example` content inside a managed block (see §8.2).
- **`scanner`** — walks `src/`, parses TS/JS files with a fast parser, finds `process.env.X` and `import.meta.env.X` references.
- **`differ`** — compares schema vs example vs scan results, emits a structured report.
- **`cli`** — thin orchestrator wrapping the above.

### Data flow for `env-contract check`

```
load schema  ──►  parse .env.example  ──►  scan src/
                                              │
                                              ▼
                                          merge & diff
                                              │
                                              ▼
                                       structured report
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                         exit code                     stdout (pretty
                       (0 ok, 1 drift)                 or --json)
```

---

## 6. CLI Surface

The CLI is the primary user touchpoint. Keep the command count small. Prefer flags over subcommand explosion.

### Commands

#### `env-contract sync`
Generate or update `.env.example` from the schema. Modifies one file. Always shows a diff before writing unless `--yes`.

```bash
env-contract sync
env-contract sync --yes              # non-interactive
env-contract sync --check            # exit non-zero if would change anything (dry-run)
env-contract sync --target .env.example.local
```

#### `env-contract scan`
Walk source tree and report `process.env.*` and `import.meta.env.*` references that aren't in the schema, and schema entries that aren't referenced anywhere.

```bash
env-contract scan
env-contract scan --strict           # also flag schema entries unused in code
env-contract scan --json             # machine-readable
env-contract scan --include 'src/**/*.{ts,tsx}'
env-contract scan --exclude 'src/**/*.test.ts'
```

#### `env-contract check`
The CI-friendly composite command. Runs sync (in `--check` mode) + scan, exits non-zero on any drift.

```bash
env-contract check
env-contract check --json            # for CI annotations
```

#### `env-contract install`
Idempotent setup helper. Adds a pre-commit hook (using whatever the user has — Husky, simple-git-hooks, lefthook) and prints a GitHub Actions snippet. Asks before writing.

```bash
env-contract install
env-contract install --hook pre-push
```

### Global flags

| Flag | Purpose |
|---|---|
| `--config <path>` | Override config file location (default: `env-contract.config.ts` or `package.json` field) |
| `--schema <path>` | Override schema file (default: auto-detect `src/env.ts`, `src/env/index.ts`, `env.ts`) |
| `--cwd <path>` | Run from a different working directory (useful in monorepos) |
| `--silent` | Suppress non-error output |
| `--json` | Machine-readable output for the relevant command |

### Exit codes

- `0` — Success / no drift
- `1` — Drift detected (CI-blocking issue)
- `2` — Configuration or runtime error (couldn't load schema, etc.)

---

## 7. Programmatic API

For people who want to embed env-contract in their own tooling (build plugins, custom CI scripts).

```ts
import { loadSchema, generateExample, scan, check } from "env-contract";

// Load and introspect a schema file
const schema = await loadSchema({ path: "./src/env.ts" });
// → { entries: [{ key, type, description?, default?, optional, scope: "server"|"client" }, ...] }

// Generate .env.example content (returns string, doesn't write)
const content = generateExample(schema, { managedBlock: true });

// Scan source for env references
const refs = await scan({ root: "./src", patterns: ["**/*.{ts,tsx,js,jsx}"] });
// → { references: [{ key, file, line, column }], grouped: { ... } }

// Run the full check, return a report (no exit, no stdout)
const report = await check({ cwd: process.cwd() });
// → { ok: boolean, exampleDrift: [...], orphanedRefs: [...], unusedSchemaKeys: [...] }
```

This API is what enables eventual integrations like `vite-plugin-env-contract`, IDE extensions, etc.

---

## 8. Technical Specifications

### 8.1 Schema introspection

**Goal:** Given a path to `env.ts`, return a normalized list of schema entries.

**v0.1 strategy: Zod-only, via `@t3-oss/env-core` introspection.**

The `createEnv` function from `@t3-oss/env-core` returns a proxy-wrapped object, but it also exposes the raw schemas. We need to load the user's file and access them.

```ts
// User's env.ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().describe("Postgres connection string"),
    PORT: z.coerce.number().default(3000).describe("HTTP port"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

**Loading approach:** use `tsx` or `jiti` to require the file at runtime in the user's project. This means the tool runs in the user's environment with their dependencies — no transpilation gymnastics on our end.

**Introspection approach:** v0.1 detects the t3-env shape (presence of `_def`, `_server`, `_client` properties on the exported object) and reads the schemas. For non-t3 projects, fall back to looking for an exported `envSchema: z.ZodObject` directly.

For Zod schemas, we extract:
- Key name (from object shape)
- Type (string, number, boolean, enum, url, email, etc. — from `._def.typeName` or `.def.type` depending on Zod version)
- Description (from `.description`)
- Default value (from `._def.defaultValue?.()`)
- Optional flag (from presence of `ZodOptional` or `ZodDefault`)

**Future: Standard Schema adapter pattern.**

```ts
// packages/core/src/loaders/zod.ts
export const zodLoader: SchemaLoader = {
  matches: (mod) => isZodSchema(mod),
  introspect: (mod) => { /* ... */ },
};

// packages/core/src/loaders/valibot.ts
export const valibotLoader: SchemaLoader = { /* ... */ };
```

Loaders are tried in order. First match wins. Add ArkType, Valibot in v0.3+.

### 8.2 `.env.example` generation with managed blocks

**The core problem:** if we overwrite `.env.example` wholesale, we destroy any human-added comments or sections (e.g., "# Local secrets you'll need to ask the team for"). If we never overwrite, we drift.

**Solution: managed block markers.** We only own the content between markers; everything outside is preserved verbatim.

```bash
# Local-only secrets — ask the team
SLACK_WEBHOOK_URL=

# >>> env-contract:start (do not edit this block manually)
# Generated from src/env.ts. Run `env-contract sync` to update.

# Postgres connection string
DATABASE_URL=

# HTTP port (default: 3000)
PORT=

# Public API URL
NEXT_PUBLIC_API_URL=
# <<< env-contract:end

# Optional: enable verbose logging
DEBUG=
```

**Algorithm for `sync`:**
1. Read existing `.env.example`. If absent, create with just the managed block.
2. Locate `>>> env-contract:start` and `<<< env-contract:end`. If absent, append a managed block at end.
3. Replace content between markers with freshly generated content.
4. Show diff. Prompt unless `--yes`.
5. Write atomically.

**Generation rules:**
- Server keys grouped first, then client keys (matching t3-env mental model).
- Each key prefixed by a comment line: `# <description>` if present, else `# <type-name>`.
- Optional keys get `# Optional:` prefix.
- Defaults shown in comment: `# (default: 3000)`.
- Empty value (`KEY=`) — never include real default values, since `.env.example` is committed.

### 8.3 AST-based code scanning

**Goal:** find every `process.env.X` and `import.meta.env.X` reference in the codebase, with file/line info.

**v0.1 scope (strict mode only):**

| Pattern | Detected? | Notes |
|---|---|---|
| `process.env.FOO` | ✅ | Member access |
| `process.env["FOO"]` | ✅ | String literal subscript |
| `process.env['FOO']` | ✅ | Same |
| `import.meta.env.VITE_FOO` | ✅ | Vite/Astro |
| `const { FOO } = process.env` | ✅ | Destructuring |
| `process.env[someVar]` | ⚠️ Flagged as "dynamic — cannot resolve" | Reported separately |
| `Object.keys(process.env)` | ⚠️ Warned | Report file location |
| `process["env"].FOO` | ❌ | Out of scope; rare |

**Parser choice:** [`oxc-parser`](https://www.npmjs.com/package/oxc-parser) (Rust-backed, fast, handles TS+JSX out of the box). Fallback: `@babel/parser` if oxc proves too unstable for some files.

**Walker:** simple AST visitor, no full type checking. We don't need types — we just need lexical references.

**Performance target:** scan a 1000-file repo in under 2 seconds on a modern laptop.

**Output structure:**

```ts
type ScanReport = {
  references: Array<{
    key: string;
    file: string;       // relative to cwd
    line: number;
    column: number;
    kind: "process.env" | "import.meta.env" | "destructure";
  }>;
  dynamic: Array<{      // process.env[someVar] or Object.keys
    file: string;
    line: number;
    snippet: string;
  }>;
};
```

### 8.4 Drift detection (the `check` command)

Given:
- `S` = set of keys in schema
- `E` = set of keys in `.env.example` managed block
- `R` = set of keys referenced in code (from `scan`)

Report categories:
1. **Example out of date:** `S != E` (sync needed).
2. **Orphaned references:** `R \ S` — code references vars not in schema.
3. **Unused schema entries (strict only):** `S \ R` — schema declares vars that are never used.

The `--strict` flag opts into category 3, which is noisy in real codebases (libraries, generated code, indirect access) and shouldn't be CI-default.

### 8.5 Monorepo support

Real users live in Nx, Turborepo, and pnpm workspaces. Don't ship without addressing this.

**v0.1 approach: per-package, explicit.**

In a monorepo, each package defines its own `env-contract.config.ts` and runs the CLI from its own directory. The `--cwd` flag and `cwd` option exist for orchestration scripts.

```bash
# In Turborepo, add to turbo.json:
{
  "tasks": {
    "env:check": { "cache": false }
  }
}

# In each package's package.json:
"scripts": { "env:check": "env-contract check" }

# Then:
pnpm turbo env:check
```

**v0.5+ stretch: workspace mode.**

```bash
env-contract check --workspace
# Auto-discovers packages, runs check in each, aggregates report
```

This is significantly more work — defer until users ask.

### 8.6 Configuration file

```ts
// env-contract.config.ts
import { defineConfig } from "env-contract";

export default defineConfig({
  schema: "./src/env.ts",
  exampleFile: ".env.example",
  scan: {
    include: ["src/**/*.{ts,tsx,js,jsx,mjs,cjs}"],
    exclude: ["**/*.test.{ts,tsx}", "**/node_modules/**"],
  },
  ignoreKeys: ["NODE_ENV"],   // never report drift on these
});
```

Config resolution order:
1. `--config` CLI flag
2. `env-contract.config.ts` (or `.js`, `.mjs`)
3. `"env-contract"` field in `package.json`
4. Sensible defaults

---

## 9. Project Structure

Single package to start, monorepo-ready folder structure.

```
env-contract/
├── packages/
│   └── env-contract/
│       ├── src/
│       │   ├── cli.ts                  # CLI entry — bin
│       │   ├── index.ts                # Programmatic API entry
│       │   ├── config.ts               # defineConfig + resolution
│       │   ├── commands/
│       │   │   ├── sync.ts
│       │   │   ├── scan.ts
│       │   │   ├── check.ts
│       │   │   └── install.ts
│       │   ├── core/
│       │   │   ├── load-schema.ts      # dynamic import + introspect
│       │   │   ├── generate-example.ts
│       │   │   ├── parse-example.ts    # read managed blocks
│       │   │   ├── scan-source.ts      # AST walking
│       │   │   └── diff.ts
│       │   ├── loaders/
│       │   │   ├── zod.ts
│       │   │   ├── t3-env.ts
│       │   │   └── types.ts            # SchemaLoader interface
│       │   ├── reporters/
│       │   │   ├── pretty.ts
│       │   │   └── json.ts
│       │   └── utils/
│       │       ├── managed-block.ts
│       │       └── markers.ts
│       ├── tests/
│       │   ├── fixtures/
│       │   │   ├── basic-zod/
│       │   │   ├── t3-env-nextjs/
│       │   │   └── monorepo/
│       │   ├── unit/
│       │   └── e2e/
│       ├── package.json
│       ├── tsconfig.json
│       ├── tsup.config.ts              # bundler
│       └── README.md
├── examples/
│   ├── nextjs-app/
│   ├── express-api/
│   └── turborepo/
├── docs/
│   └── ... (Astro Starlight or Nextra)
├── .changeset/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md                           # top-level — points to package README
```

**Why monorepo from day one:** future expansion (`@env-contract/vite`, `@env-contract/react-native`, framework presets) is trivial. Cost is low — one extra file (`pnpm-workspace.yaml`) and one extra layer.

---

## 10. Tech Stack & Dependencies

### Runtime dependencies (keep minimal)

| Package | Purpose | Notes |
|---|---|---|
| `commander` or `cac` | CLI parsing | `cac` is smaller; either works |
| `oxc-parser` | Fast TS/JSX parser | Rust-backed, ESM-friendly |
| `picocolors` | Terminal colors | Tiny, dep-free |
| `jiti` or `tsx` | Runtime TS file loading | `jiti` recommended (no fork) |

**Total runtime deps target: ≤ 4.**

Avoid: `chalk` (deps), `commander` if `cac` works, `@babel/parser` (slower than oxc), anything that needs a `postinstall` script.

### Peer dependencies

| Package | Why peer | Range |
|---|---|---|
| `zod` | User must already have it | `^3.0.0 \|\| ^4.0.0` |
| `@t3-oss/env-core` | Optional — only if user uses t3-env | `>=0.10.0`, optional peer |

### Dev dependencies

- `typescript` (strict mode)
- `tsup` (bundler — ESM + CJS dual output)
- `vitest` (unit + e2e)
- `prettier`, `eslint` (with `eslint-config-flat`)
- `@changesets/cli` (versioning + changelogs)
- `pnpm` (workspace manager)

### Module format

- ESM-first, CJS shipped via tsup
- Node 18+ (for native `fetch` and built-in test runner if helpful)
- Bin entry: `#!/usr/bin/env node` shebang on `cli.js`

---

## 11. Testing Strategy

### Unit tests
- Schema introspection — fixtures of various Zod patterns (string, number, enum, optional, default, refine, transform)
- Managed block parsing — round-trip through serialize/parse
- AST scanner — golden files for each detection pattern
- Diff logic — pure function, table-driven tests

### E2E tests
- Spin up tmp dirs with realistic project structures (basic Zod, t3-env Next.js, monorepo)
- Run the CLI as a subprocess via `execa`
- Assert on file contents and exit codes

### Fixtures to maintain
```
tests/fixtures/
├── basic-zod/              # plain Zod schema, no t3-env
├── t3-env-nextjs/          # canonical t3 stack setup
├── t3-env-with-presets/    # uses extends: [vercel()]
├── valibot/                # Valibot schema (v0.3+)
├── monorepo/               # workspace with 2 packages
├── empty-project/          # no schema yet — should fail gracefully
└── orphan-refs/             # has process.env.X not in schema
```

### CI matrix
- Node 18, 20, 22
- macOS, Ubuntu, Windows (paths matter for the scanner)
- pnpm, npm, yarn, bun (the CLI should work in all)

---

## 12. Edge Cases & Known Limitations

**Document these prominently in the README.** Honesty about limits builds more trust than over-promising.

### Things env-contract intentionally does NOT do

1. **Validate `.env` values.** That's the schema's job at runtime.
2. **Resolve dynamic `process.env[expr]` access.** Reported as a warning; not analyzed.
3. **Cross-package schema unification in monorepos** (v0.1).
4. **Edit `.env` files** — only `.env.example`.
5. **Modify the user's schema file** — schema is the source of truth, never written to.
6. **Telemetry, postinstall scripts, network access** — none, ever.

### Tricky cases to handle gracefully

| Case | Behavior |
|---|---|
| Schema file fails to load (TS error) | Exit 2 with the underlying error verbatim |
| `.env.example` is in `.gitignore` | Warn — likely user mistake |
| Managed block markers absent | Append a fresh block at end of file |
| User added keys inside managed block manually | Overwrite (it's "managed"); document this loudly |
| Nested `process.env` (e.g., in template literals) | Detect what we can; ignore the rest |
| Generated files (e.g., `.next/`) | Excluded by default in scan |
| Files with parse errors | Skip + warn; don't fail the whole scan |
| Symlinks | Follow once, don't loop |
| Very large repos (10k+ files) | Should still complete in < 10s |

### Zod version skew

Zod v3 and v4 have different internal shapes (`._def` vs `.def`). The introspector must handle both. Test fixtures must include both.

---

## 13. Roadmap

Each milestone is a published version. Gates between milestones are real user feedback, not feature lists.

### v0.1 — MVP (target: 2–3 weekends)

**Scope:**
- `sync`, `check`, `scan` commands
- Zod + t3-env introspection only
- Single-package projects
- `.env.example` managed block
- AST scan in strict mode (literal keys only)
- Pretty + JSON reporters

**Done when:**
- Works on a fresh `create-t3-app` clone
- Works on a vanilla Express + Zod project
- Has a README with copy-paste install + GitHub Action snippet
- 80%+ test coverage on core
- Published to npm under `env-contract@0.1.0`

### v0.2 — Polish (1–2 weekends after launch)

- `install` command (Husky + simple-git-hooks detection)
- Better error messages with suggestions
- Watch mode (`env-contract sync --watch`)
- Configurable `ignoreKeys`
- Bug fixes from early adopters

### v0.3 — Standard Schema

- Valibot loader
- ArkType loader
- Generic Standard Schema adapter
- Documentation site (Astro Starlight)

### v0.4 — Monorepo first-class

- `--workspace` flag for pnpm/yarn/npm workspaces
- Aggregated reports
- Turborepo integration recipe
- Nx integration recipe

### v0.5 — Editor integration

- VS Code extension that surfaces drift inline
- LSP for unknown env keys

### v1.0

- API stability promise
- 6+ months of stability
- Production users you can name

---

## 14. Distribution & Adoption Plan

Building it is half the job. Getting people to find it is the other half. **Plan this before launch, not after.**

### Pre-launch (during build)

- [ ] Reserve npm name `env-contract`. Squat with a placeholder readme.
- [ ] Create GitHub repo with progressive commits (good for archaeology).
- [ ] Write the README first, before any code (if the README is hard to write, the API is wrong).
- [ ] Set up GitHub Actions for tests and changesets release.

### Launch day

- [ ] Tag v0.1.0 on npm.
- [ ] Open a GitHub Discussion on `t3-oss/t3-env` linking to the tool, framed as: *"Hey, I built a companion that handles the .env.example sync your docs say is optional. Would love feedback."* — never as competition.
- [ ] Tweet at @t3dotgg with a 30-second screencast.
- [ ] Submit to the `e18e.dev` resources list (curated by community focused on JS ecosystem cleanup).
- [ ] Post on r/typescript and r/nextjs. NOT r/node — too noisy.
- [ ] Submit to *This Week in React* and *Bytes* newsletters (they take pitches).
- [ ] Write a launch blog post: "I built a tool to fix the one thing t3-env doesn't" — be specific, link to your README.

### Month 1–3

- [ ] Get into 2–3 popular starter templates (search "create-t3-turbo", Next.js boilerplates).
- [ ] PR a recipe into the t3-env docs.
- [ ] Respond to every issue within 48 hours, even just to acknowledge.
- [ ] Track adoption: weekly downloads, GitHub stars, issues opened. If <100 downloads/week after 8 weeks, the positioning is wrong — re-pitch, don't re-build.

### Year 1

- [ ] Speak at a small meetup (your local Node/JS group). Recorded talks are evergreen.
- [ ] Contribute back upstream — fix real bugs in t3-env, jiti, oxc-parser. Be a known name in the surrounding ecosystem.

---

## 15. Public README Template

This is the *user-facing* README. Drop into `packages/env-contract/README.md` and edit.

```markdown
# env-contract

Keep your env schema, your .env.example, and your code references honest with each other.

[![npm](https://img.shields.io/npm/v/env-contract)](https://www.npmjs.com/package/env-contract)
[![CI](https://github.com/YOU/env-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/YOU/env-contract/actions)

## Why

If you're using `@t3-oss/env-core`, `envalid`, or any Zod-based env validator,
runtime validation is solved. The thing that *isn't* solved is keeping your
`.env.example` and your `process.env.*` references in sync with that schema.

env-contract does three things:

1. **Generates `.env.example`** from your schema (managed block — keeps your manual edits).
2. **Scans your code** for `process.env.X` references and flags ones not in the schema.
3. **Fails CI** when any of these drift.

It does *not* replace your validator. It plugs into the one you have.

## Install

\`\`\`bash
pnpm add -D env-contract
\`\`\`

## Quick start

Given an existing `src/env.ts` (any Zod schema or `@t3-oss/env-core` setup):

\`\`\`bash
npx env-contract sync     # writes .env.example
npx env-contract scan     # finds process.env.* not in schema
npx env-contract check    # CI-friendly composite
\`\`\`

## In CI (GitHub Actions)

\`\`\`yaml
- run: pnpm env-contract check
\`\`\`

## In a pre-commit hook

\`\`\`bash
npx env-contract install
\`\`\`

## What it doesn't do

- Doesn't validate values (your schema does that)
- Doesn't load .env files (your runtime does that)
- Doesn't modify your schema or your .env files
- Catches `process.env.LITERAL` only — not `process.env[someVariable]`

## License

MIT
```

---

## 16. Open Decisions

Things to decide during implementation. Don't pre-optimize — let real fixtures inform the choices.

1. **CLI library.** `cac` (smaller) vs `commander` (more standard). Lean `cac`.
2. **Loader fallback strategy.** If we can't detect t3-env, do we look for any exported `ZodObject`, or require an explicit `export const envSchema`? Lean explicit — magic guessing causes confusing errors.
3. **`.env.example` ordering.** Schema declaration order, alphabetical, or grouped by server/client? Lean: server first (alphabetical inside), then client (alphabetical inside) — matches t3-env's mental model.
4. **Description source.** Zod's `.describe()` only, or also support a comment convention like `// @env <description>` above the schema entry? Lean `.describe()` only for v0.1 — comment parsing is a tar pit.
5. **Watch mode.** Built-in or defer to user's task runner? Defer to v0.2.
6. **Reporter pluggability.** Pretty + JSON in v0.1 is enough. SARIF (for GitHub code scanning) in v0.4.
7. **Telemetry.** None, ever. Decided.
8. **Monorepo workspace mode.** Defer until 5 users ask for it. v0.1 ships per-package only.
9. **Bun support.** Should Just Work via Node compat. Test it; don't special-case.
10. **License.** MIT is the right answer for adoption.

---

## Appendix A: Worked example

### Input

`src/env.ts`:
```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().describe("Postgres connection string"),
    PORT: z.coerce.number().default(3000).describe("HTTP port"),
    STRIPE_SECRET: z.string().startsWith("sk_"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().describe("Public API endpoint"),
  },
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
});
```

`src/services/payment.ts`:
```ts
const apiKey = process.env.STRIPE_SECRET;
const webhook = process.env.STRIPE_WEBHOOK_SECRET; // <- not in schema!
```

### Running `env-contract check`

```
$ env-contract check

✗ .env.example is out of date
  Run `env-contract sync` to update.

✗ Found 1 reference to a variable not in the schema:
  src/services/payment.ts:2:25  process.env.STRIPE_WEBHOOK_SECRET

Drift detected. Exit 1.
```

### After running `env-contract sync` (and adding the missing var to schema)

`.env.example` after sync:

```bash
# >>> env-contract:start (managed — run `env-contract sync` to update)
# Generated from src/env.ts.

# Postgres connection string
DATABASE_URL=

# HTTP port (default: 3000) — Optional
PORT=

# string starting with "sk_"
STRIPE_SECRET=

# Stripe webhook signing secret
STRIPE_WEBHOOK_SECRET=

# Public API endpoint
NEXT_PUBLIC_API_URL=
# <<< env-contract:end
```

---

## Appendix B: Day-1 checklist

Concrete first-day tasks to set up the repo:

- [ ] `pnpm init` with workspace config
- [ ] Initialize TS project with strict tsconfig
- [ ] Add tsup, vitest, changeset
- [ ] Set up GitHub Actions for CI on push + PR
- [ ] Set up release workflow gated on changesets
- [ ] Reserve npm package name (publish a `0.0.0-placeholder`)
- [ ] Write the README before writing the code
- [ ] Create the `examples/nextjs-app` fixture and use it as the dogfooding target
- [ ] Open issues for v0.1 features as a public roadmap
- [ ] Add `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` (use covenant)

---

*Last updated: this is the v0 spec. Treat it as a living document — first PR you should send to your own repo is the one that updates this file as decisions get made.*
