# env-contract

Keep your env schema, your `.env.example`, and your code references honest with each other.

[![npm](https://img.shields.io/npm/v/env-contract)](https://www.npmjs.com/package/env-contract)
[![CI](https://github.com/alranjan14/env-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/alranjan14/env-contract/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/env-contract)](./LICENSE)

---

## Why

If you are using `@t3-oss/env-core`, `@t3-oss/env-nextjs`, `envalid`, or Zod/Valibot/ArkType schemas for runtime validation, your application startup safety is solved. 

However, **runtime validation does not solve the developer workflow drift:**
1. Your `.env.example` file gets outdated because team members forget to add new keys.
2. Developers add references like `process.env.NEW_VAR` directly into code without adding them to the validation schema, causing silent production bugs.
3. Obsolete keys remain in the schema or `.env.example` long after the code using them has been deleted.

`env-contract` bridges this gap. It does not replace your validator; it plugs into it to keep your schema, `.env.example`, and source code references in sync.

---

## Install

```bash
npm install -D env-contract
# or
pnpm add -D env-contract
# or
yarn add -D env-contract
# or
bun add -d env-contract
```

> **Requires Node ≥ 22** (the current LTS line) — chosen over older floors for native APIs and a smaller shim surface.

---

## Quick Start

Assuming you have an existing env schema file (e.g., `src/env.ts` using Zod or `@t3-oss/env-core`):

```bash
# 1. Generate or update your .env.example with the schema's keys
npx env-contract sync

# 2. Scan your codebase to find untracked process.env or import.meta.env references
npx env-contract scan

# 3. Check for drift (combines sync --check and scan; exits non-zero if out of sync)
npx env-contract check

# 4. Set up pre-commit hooks to automate checks locally
npx env-contract install
```

---

## Feature Status & Support Matrix

`env-contract` divides features by production readiness to set honest expectations:

### 1. Supported Today (Production-Ready)
*   **Zod**: Full support for Zod v3 and v4 schemas.
*   **t3-env** (`@t3-oss/env-core` / `@t3-oss/env-nextjs`): export your `{ server, client }` schema records alongside `createEnv` and env-contract introspects them with full server/client scope + metadata. (`createEnv`'s return value exposes only validated values, so the records are the source of truth — see the [T3 recipe](./docs/recipes.md#1-t3--t3-ossenv-core).)
*   **Managed Blocks**: Smart updates to `.env.example` that keep human comments and custom configurations outside the `env-contract` markers.

### 2. Experimental Features (Qualifiers Applied)
*   **Valibot & ArkType**: Basic schema introspection support. Tested on common schemas, but complex refinements or transforms may have edge cases.
*   **Standard Schema (generic)**: Any [Standard Schema](https://standardschema.dev) validator without a dedicated loader is handled by a generic adapter. It recovers **required** keys by validating an empty object; optional keys aren't discoverable through validation alone (Standard Schema exposes validation, not introspection), so prefer a dedicated loader where one exists.
*   **Watch Mode (`sync --watch`)**: Uses Node's native file watching. Works well in simple directory trees but might behave differently depending on OS-level file system behaviors.
*   **Workspace Mode (`--workspace`)**: Automatically finds multiple workspace packages (via `pnpm-workspace.yaml`, npm/yarn workspace configs, or explicit package list) and runs per-package checks.

### 3. Future Roadmap
*   **v0.3**: Richer Standard Schema introspection — full type/default/description metadata for arbitrary vendors, beyond the required-key recovery shipped today.
*   **v0.4**: Improved Monorepo optimizations and caching support.
*   **v0.5**: VS Code Extension & Language Server Protocol (LSP) for editor diagnostics.

---

## CLI Reference

`env-contract` exposes a compact CLI surface.

### Global Flags
These flags apply to all commands:

| Flag | Description |
| --- | --- |
| `--config <path>` | Path to the config file (defaults to `env-contract.config.ts` or similar). |
| `--schema <path>` | Path to the schema file (defaults to auto-detecting `src/env.ts`, `src/env/index.ts`, `env.ts`). |
| `--cwd <path>` | Override the current working directory. |
| `--silent` | Suppress all stdout reporter logs except errors. |
| `--json` | Force the reporter to print structured JSON. |
| `--debug` | Print resolved paths and timings to stderr (also enabled via `DEBUG=env-contract*`). |

### Exit Codes

Exit codes are a stable part of the CLI contract (see [ADR 0004](./docs/adr/0004-exit-code-semantics.md)):

-   `0`: Healthy. No drift found.
-   `1`: Drift detected (mismatch between schema and `.env.example`, or orphaned/untracked references in code).
-   `2`: Configuration/Runtime error (e.g., compile issues in the schema file, invalid configuration).

### Machine Output (`--json`)

Every command accepts `--json` and prints a single JSON object to stdout. The payload is **versioned** so downstream parsers can detect and adapt to shape changes:

-   **`schemaVersion`** (number): the output schema version. It is currently `1` and is incremented only on a backward-incompatible change to the shape below.

Single-project mode is a flat object (e.g. `env-contract check --json`):

```json
{
  "schemaVersion": 1,
  "syncDrift": false,
  "exampleDrift": { "missingInExample": [], "extraInExample": [] },
  "orphanedRefs": [],
  "unusedSchemaKeys": [],
  "dynamicRefs": [],
  "warnings": []
}
```

Workspace mode (`--workspace`) wraps the per-package results under `packages`:

```json
{
  "schemaVersion": 1,
  "packages": [
    { "package": "packages/api", "syncDrift": false, "orphanedRefs": [], "...": "..." }
  ]
}
```

When a target fails to process, its object carries an `error` string instead of results, and the process exits `2`. Human status text and `--debug` diagnostics go to **stderr**, never stdout, so a `--json` stream is always clean to parse.

---

### Commands

#### `sync`
Generates or updates `.env.example` from your schema. Modifies only the managed block.
```bash
npx env-contract sync [options]
```
*   `--yes`: Non-interactive mode (automatically writes changes without showing a diff/prompt).
*   `--check`: Performs a dry-run check. Exits with code `1` if changes are needed without writing any files.
*   `--watch`: Watches the schema file for changes and updates `.env.example` dynamically.
*   `--target <path>`: Specifies an alternative output file path instead of `.env.example`.
*   `--workspace`: Run across all packages in a monorepo workspace.

#### `scan`
Scans the source code for environment variable references (e.g. `process.env.API_KEY`).
```bash
npx env-contract scan [options]
```
*   `--include <pattern>`: Glob patterns to include (e.g. `src/**/*.ts`). Can be specified multiple times.
*   `--exclude <pattern>`: Glob patterns to ignore (e.g. `src/**/*.test.ts`). Can be specified multiple times.
*   `--strict`: Stricter scanning. Also flags schema keys that are defined but never referenced in the codebase.
*   `--workspace`: Run across all packages in a monorepo workspace.

#### `check`
A CI-friendly composite command. Equivalent to running `sync --check` and `scan` together.
```bash
npx env-contract check [options]
```
*   `--strict`: Runs the code scan in strict mode (fails on unused schema keys).
*   `--workspace`: Run across all packages in a monorepo workspace.

#### `install`
Installs git pre-commit hooks to verify contract status before committing.
```bash
npx env-contract install [options]
```
*   `--hook <name>`: Installs to a custom hook (defaults to `pre-commit`). Integrates automatically with `husky`, `simple-git-hooks`, or `lefthook` if they are present.
*   `--yes`: Non-interactive mode (installs without prompting).

---

## Configuration

You can configure `env-contract` by creating an `env-contract.config.ts` (or `.js`, `.mjs`, `.cjs`) at the root of your project:

```typescript
import { defineConfig } from "env-contract";

export default defineConfig({
  // Path to your env schema file (auto-detected if omitted)
  schema: "./src/env.ts",
  
  // Path to the example environment file to manage
  exampleFile: "./.env.example",
  
  // Base directory for scanning code files
  rootDir: "./",
  
  scan: {
    // Glob patterns to scan
    include: ["src/**/*.{ts,tsx,js,jsx}"],
    // Folders automatically excluded: node_modules, dist, .git, .next, etc.
    exclude: ["**/*.test.{ts,tsx}", "**/__tests__/**"]
  },
  
  // Env variables that should be ignored during code scan
  ignoreKeys: ["NODE_ENV"]
});
```

You can also specify this under the `"env-contract"` field in your `package.json`.

---

## Programmatic API

Embed env-contract in your own tooling (build plugins, custom CI scripts). Every export is typed, and the export surface is snapshot-guarded by a test (`tests/api-surface.test.ts`) so additions are deliberate.

```typescript
import {
  loadSchema, // (path | { path, cwd? }) => Promise<Schema>
  generateExample, // (schema) => string  (managed-block content; does not write)
  scan, // ({ root, patterns?, exclude?, cwd? }) => Promise<{ references, dynamic, warnings, grouped }>
  check, // ({ cwd?, strict?, schema? }) => Promise<{ ok, exampleDrift, orphanedRefs, unusedSchemaKeys, dynamicRefs, warnings }>
  scanSource, // lower-level AST scan
  diff,
  computeKeyDrift,
  parseEnvKeys, // core engine primitives
  defineConfig,
  version,
} from "env-contract";

// Introspect a schema file into normalized entries.
const schema = await loadSchema("./src/env.ts");
// → { entries: [{ key, type, optional, default?, description?, scope }, ...] }

// Generate .env.example content (string; does not touch disk).
const content = generateExample(schema);

// Scan source for process.env / import.meta.env references.
const { references, dynamic, warnings } = await scan({
  root: "./src",
  patterns: ["**/*.{ts,tsx}"],
});

// Run the full check with no process.exit and no stdout.
const report = await check({ cwd: process.cwd() });
if (!report.ok) {
  console.error(report.orphanedRefs, report.exampleDrift);
}
```

---

## Security

`env-contract` discovers your schema and config files by **importing** them, which **executes that code** in the current Node process — the same trust model as `eslint.config.js`, `vite.config.ts`, or Jest config files. Practical implications:

-   Run `env-contract` only against repositories you trust. In CI, treat it like any other step that runs repository code — avoid pointing `check` at untrusted pull requests in a privileged context.
-   It reads env **variable names** only (from your schema and the managed block of `.env.example`). It never reads, prints, or stores secret **values**.
-   No telemetry, no network access, no postinstall scripts.

See [SECURITY.md](../../SECURITY.md) for the full policy and how to report a vulnerability.

---

## Troubleshooting: Avoiding Validation Crashes in CI/Builds

Because `env-contract` dynamically imports your schema file to introspect it, any immediate validation checks that execute at runtime on module import can crash if required environment variables are missing (e.g., in a clean CI environment).

To prevent this, you should conditionally bypass validation.

### Recommended Setup (t3-env / Zod)

Check for a `SKIP_ENV_VALIDATION` flag in your schema loader file:

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  // Conditionally skip validation during build or introspection
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

Then run `env-contract` checks by injecting the variable:

```bash
SKIP_ENV_VALIDATION=1 npx env-contract check
```

---

## Known Limitations

*   **No Runtime Value Validation**: `env-contract` does not validate whether env values conform to the schema rules (e.g. validating database URLs or checking formats). That is the job of your schema validator library at application startup.
*   **Static Reference Limitations**: The code scanner uses an AST parser (`oxc-parser`). It can resolve:
    *   Direct properties: `process.env.FOO` / `import.meta.env.FOO`
    *   Subscripts: `process.env["FOO"]`
    *   Destructuring: `const { FOO } = process.env`
*   **Dynamic Access Ignored**: It *cannot* resolve dynamic expressions like `process.env[getVarName()]` or `const key = "FOO"; process.env[key]`. These will trigger a warning during scan but cannot be cross-checked against the schema automatically.
*   **Read-Only Safety**: `env-contract` is read-only by default. It will never modify your schema files or actual `.env` files. It only updates the managed block in `.env.example`.

---

## Comparison Table

| Feature | `env-contract` | `dotenv-safe` | `@t3-oss/env-core` |
| --- | :---: | :---: | :---: |
| **Primary Goal** | Schema-Code-Example Sync | Ensure `.env` matches `.env.example` | Runtime validation |
| **Generates `.env.example`** | ✅ Yes (Managed block) | ❌ No | ❌ No |
| **Scans codebase for refs** | ✅ Yes (AST scanner) | ❌ No | ❌ No |
| **Checks for unused schema keys**| ✅ Yes (with `--strict`) | ❌ No | ❌ No |
| **Validates values at runtime** | ❌ No (delegates to schema) | ✅ Yes | ✅ Yes |
| **Monorepo / Workspace Support**| ✅ Yes | ❌ No | ❌ No |

---

## Framework Recipes

Looking for specific setup instructions? Check out our step-by-step [Framework & Library Integration Recipes](./docs/recipes.md) for:
- [T3 / @t3-oss/env-core](./docs/recipes.md#1-t3---t3-ossenv-core)
- [Next.js](./docs/recipes.md#2-nextjs)
- [Vite / Astro (using import.meta.env)](./docs/recipes.md#3-vite--astro-using-importmetaenv)
- [Express or Hono (with plain Zod)](./docs/recipes.md#4-express-or-hono-with-plain-zod)
- [Turborepo (per-package recipe)](./docs/recipes.md#5-turborepo-per-package-recipe)

---

## License

MIT
