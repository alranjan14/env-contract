---
"env-contract": minor
---

Production-hardening: diagnostics, a versioned `--json` contract, a safer CLI, and a glob fix.

- **`--debug` / `DEBUG=env-contract*`**: new diagnostics channel that prints resolved paths and timings to **stderr** (never stdout, so `--json` output stays clean to parse).
- **Versioned `--json` output**: every `--json` payload now carries a top-level `schemaVersion` (currently `1`) so downstream parsers can detect and adapt to shape changes. Single-project output stays a flat object; workspace output now nests its per-package results under a `packages` array. If you parse workspace `--json`, read `.packages[]` instead of a top-level array.
- **Top-level error safety net**: an error that escapes a command — e.g. a malformed config that throws during resolution — now prints a clean one-line message to stderr and exits `2`, instead of a raw stack trace.
- **Fix**: mid-path `/**/` glob patterns such as `src/**/*.{ts,tsx}` (the documented config example) now match correctly. They previously compiled to a double-slash regex that matched no files, so a custom `scan.include` using `/**/` could silently scan nothing.
- **Fix**: real `@t3-oss/env-nextjs` / `@t3-oss/env-core` support. The t3-env loader previously only matched a mocked `_server`/`_client` shape; real `createEnv()` exposes validated values, not schemas, so introspection failed. It now introspects the `{ server, client }` schema records you export alongside `createEnv` (export them as `envSchema` — see the T3 recipe), with full server/client scope and metadata. The `@t3-oss/*` peer range is widened to `>=0.9.0`.
- **Generic Standard Schema adapter**: any [Standard Schema](https://standardschema.dev) validator without a dedicated loader is now introspected — required keys are recovered via an empty-object validation probe (optional keys aren't discoverable through validation alone). Registered after the Zod/Valibot/ArkType loaders, so those still win for their vendors.
- **Examples**: added runnable `examples/` reference projects — Express + Zod, Next.js + Zod, and a Turborepo monorepo — each with a generated `.env.example`.
