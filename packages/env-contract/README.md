# env-contract

Keep your env schema, your `.env.example`, and your code references honest with each other.

[![npm](https://img.shields.io/npm/v/env-contract)](https://www.npmjs.com/package/env-contract)
[![CI](https://github.com/alranjan14/env-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/alranjan14/env-contract/actions)

## Why

If you're using `@t3-oss/env-core`, `envalid`, or any Zod, Valibot, or ArkType-based env validator, runtime validation is solved. The thing that *isn't* solved is keeping your `.env.example` and your `process.env.*` references in sync with that schema.

`env-contract` does three things:

1.  **Generates `.env.example`** from your schema (managed block — keeps your manual edits).
2.  **Scans your code** for `process.env.X` references and flags ones not in the schema.
3.  **Fails CI** when any of these drift.

It does *not* replace your validator. It plugs into the one you have.

## Install

```bash
npm install -D env-contract
# or
pnpm add -D env-contract
# or
yarn add -D env-contract
```

## Quick start

Given an existing `src/env.ts` (any Zod, Valibot, ArkType schema, or `@t3-oss/env-core` setup):

```bash
npx env-contract sync     # writes .env.example
npx env-contract scan     # finds process.env.* not in schema
npx env-contract check    # CI-friendly composite
```

## CLI Commands

### `sync`
Generates or updates `.env.example` from your schema.
*   `--yes`: Non-interactive mode (automatically applies changes)
*   `--check`: Fails with non-zero exit code if changes are needed (useful for CI)
*   `--watch`: Watches your schema file for changes and updates `.env.example` automatically
*   `--workspace`: Runs across all workspace packages

### `scan`
Walks your source tree and reports `process.env` references.
*   `--strict`: Also flags schema entries that are never used in your code
*   `--json`: Outputs results in machine-readable JSON format
*   `--workspace`: Runs across all workspace packages

### `check`
A CI-friendly composite command that runs `sync --check` and `scan`.
*   `--json`: Outputs results in machine-readable JSON format
*   `--workspace`: Runs across all workspace packages

### `install`
Idempotent setup helper for git hooks and CI.
*   `--hook <name>`: Git hook to install to (default: `pre-commit`)
*   `--yes`: Non-interactive mode

## Configuration

You can configure `env-contract` by creating an `env-contract.config.ts` (or `.js`, `.mjs`, `.cjs`) file at the root of your project or workspace package.

```typescript
import { defineConfig } from "env-contract";

export default defineConfig({
  // Path to your env schema file (automatically discovered if omitted)
  schema: "./src/env.ts",
  
  // Path to your example env file
  exampleFile: "./.env.example",
  
  // Root directory to scan for process.env references
  rootDir: "./src",
  
  scan: {
    include: ["**/*.{ts,tsx,js,jsx}"],
    exclude: ["**/*.test.ts", "**/__tests__/**"]
  },
  
  // Keys to ignore during scanning
  ignoreKeys: ["NODE_ENV"]
});
```

## Monorepo / Workspace Support

If you have a monorepo, `env-contract` can automatically discover all your internal packages (by looking for `package.json` with an `env.ts` or `env-contract.config.ts`) and process them all at once!

```bash
npx env-contract check --workspace
npx env-contract sync --workspace --watch
```

## In CI (GitHub Actions)

```yaml
- run: npx env-contract check
```

## In a pre-commit hook

```bash
npx env-contract install
```

## Supported Schema Libraries

`env-contract` automatically detects and parses the following validators/schemas:

*   **Zod** (Full support for Zod v3 and v4)
*   **t3-env** (`@t3-oss/env-core` / `@t3-oss/env-nextjs`)
*   **Valibot** (⚠️ Experimental support)
*   **ArkType** (⚠️ Experimental support)

## Avoiding Validation Crashes during Introspection / Build

When `env-contract` imports your schema file (e.g. `src/env.ts`), any immediate evaluation/validation that runs automatically at runtime can fail if required environment variables are not set (common in CI/CD pipelines or clean checkouts).

To bypass runtime validation during builds or introspection, you can conditionally skip validation using the `SKIP_ENV_VALIDATION` environment variable.

### Example Setup (Zod / t3-env)

In your `src/env.ts` file, check for `process.env.SKIP_ENV_VALIDATION`:

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
});

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
  // Skip environment validation during build/introspection
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

Then, run your check with:

```bash
SKIP_ENV_VALIDATION=1 npx env-contract check
```

## What it doesn't do

*   Doesn't validate values (your schema does that)
*   Doesn't load .env files (your runtime does that)
*   Doesn't modify your schema or your .env files (except for `.env.example`)
*   Catches `process.env.LITERAL` only — not dynamic properties like `process.env[someVariable]`

## License

MIT
