# Framework & Library Integration Recipes

This document provides step-by-step integration guides and configurations for using `env-contract` with popular frameworks, libraries, and monorepo pipelines.

---

## 1. T3 / `@t3-oss/env-core`

When using `@t3-oss/env-core` for runtime validation, you want to ensure your validation schemas and code references stay in sync. 

### Avoid Introspection Crashes
Since `env-contract` dynamically loads your schema file to introspect the keys, any immediate validation checks executing during module loading will crash if required variables are missing (which is common in clean CI environments or docker builds). 

To prevent this, use `skipValidation: !!process.env.SKIP_ENV_VALIDATION` in your T3 schema initialization.

### Schema Configuration (`src/env.ts`)

```typescript
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Export the schema *records* so env-contract can introspect them. `createEnv`'s
// return value exposes only validated *values* (not your schemas), so this
// `envSchema` export is what env-contract reads (it's auto-detected by name).
export const envSchema = {
  server: {
    DATABASE_URL: z.string().url().describe("Main PostgreSQL connection URL"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  client: {},
};

export const env = createEnv({
  ...envSchema,
  clientPrefix: "NEXT_PUBLIC_",
  runtimeEnv: process.env,
  // Bypass runtime validation during build or CLI introspection
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

### Running the Check
In your CI script, run the check command while injecting the skip flag:

```bash
SKIP_ENV_VALIDATION=1 npx env-contract check
```

---

## 2. Next.js

Next.js separates environment variables into server-side (private) and client-side (public, prefixed with `NEXT_PUBLIC_`). You can use `@t3-oss/env-nextjs` or a plain Zod schema to enforce validation.

### Schema Configuration (`src/env.ts`)

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Export the `{ server, client }` schema records — env-contract introspects
// these (the `createEnv` result only carries validated values).
export const envSchema = {
  server: {
    API_SECRET_KEY: z.string().min(1).describe("Private API authentication key"),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.string().url().describe("Public API endpoint URL"),
  },
};

export const env = createEnv({
  ...envSchema,
  runtimeEnv: {
    API_SECRET_KEY: process.env.API_SECRET_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
```

### `env-contract` Configuration (`env-contract.config.ts`)

```typescript
import { defineConfig } from "env-contract";

export default defineConfig({
  schema: "src/env.ts",
  scan: {
    // Exclude Next.js internal build directories from code scanning
    exclude: [".next/**", "node_modules/**", "out/**", "dist/**"]
  }
});
```

---

## 3. Vite / Astro (using `import.meta.env`)

Vite and Astro applications reference environment variables using the `import.meta.env` namespace (typically prefixed with `VITE_` or `PUBLIC_`). `env-contract`'s AST scanner automatically parses these references.

### Schema Configuration (`src/env.ts`)
Since Vite/Astro don't run a standard Node server environment at runtime, a plain Zod schema is often preferred.

```typescript
import { z } from "zod";

export const envSchema = z.object({
  VITE_API_URL: z.string().url().describe("Vite Public API URL"),
  VITE_DEBUG_MODE: z.coerce.boolean().default(false).describe("Enable verbose debug logs"),
});

// Optional: Validate on runtime load (except in CI/Builds)
if (!import.meta.env.SSR && !process.env.SKIP_ENV_VALIDATION) {
  envSchema.parse(import.meta.env);
}
```

### `env-contract` Configuration (`env-contract.config.ts`)

```typescript
import { defineConfig } from "env-contract";

export default defineConfig({
  schema: "src/env.ts",
  scan: {
    include: ["src/**/*.{ts,tsx,js,jsx,vue,svelte}"],
    exclude: ["dist/**", "node_modules/**"]
  }
});
```

---

## 4. Express or Hono (with plain Zod)

For backend microservices (Express, Hono, Fastify) built on standard Node environments, you can expose and validate environment variables using a plain Zod schema.

### Schema Configuration (`src/env.ts`)

```typescript
import { z } from "zod";

export const envSchema = z.object({
  PORT: z.coerce.number().default(8080).describe("Server listening port"),
  DATABASE_URL: z.string().url().describe("Database connection URI"),
  JWT_SECRET: z.string().min(12).describe("Token encryption secret"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv() {
  if (process.env.SKIP_ENV_VALIDATION) return;
  
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.format());
    process.exit(1);
  }
}
```

### Application Initialization (`src/index.ts`)

```typescript
import express from "express";
import { validateEnv, envSchema } from "./env.js";

// Validate env vars before starting the server
validateEnv();

const app = express();
const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

### `env-contract` Resolution
`env-contract` automatically discovers `envSchema` when importing `src/env.ts`. No additional configuration is required.

---

## 5. Turborepo (per-package recipe)

In monorepos managed by Turborepo, the recommended approach is to define package-specific `env-contract` configurations and run validations within each package. This enables Turborepo to leverage caching.

### Package Configuration (`apps/web/package.json`)
Define an script command to execute validation checks:

```json
{
  "name": "@my-app/web",
  "scripts": {
    "env:check": "SKIP_ENV_VALIDATION=1 env-contract check"
  }
}
```

### Workspace Pipeline (`turbo.json`)
Configure your `turbo.json` file in the workspace root. Declare the inputs so that tasks are correctly cached and re-run only when the schema, configuration, or source files change:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "env:check": {
      "inputs": [
        "src/env.ts",
        "env-contract.config.ts",
        "package.json",
        "src/**/*.ts",
        "src/**/*.tsx"
      ],
      "outputs": [],
      "cache": true
    }
  }
}
```

### Running Checks Workspace-Wide
To verify all workspace packages, run the task from the monorepo root:

```bash
pnpm turbo run env:check
```

---

## 6. Nx (per-project recipe)

Like Turborepo, each Nx project owns its schema and `.env.example`. Add an `env-check` target per project and run it across the graph.

### Project Target (`apps/web/project.json`)

```json
{
  "name": "web",
  "targets": {
    "env-check": {
      "executor": "nx:run-commands",
      "options": {
        "command": "env-contract check",
        "cwd": "apps/web"
      }
    }
  }
}
```

### Running Checks

```bash
# A single project:
nx run web:env-check

# Every project that defines the target:
nx run-many -t env-check
```

Alternatively, skip per-project targets and use env-contract's built-in workspace mode from the repo root — it discovers packages from your workspace config and checks each:

```bash
env-contract check --workspace
```
