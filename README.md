# env-contract

Keep your env **schema**, your **`.env.example`**, and your **`process.env` code references** honest with each other.

[![npm](https://img.shields.io/npm/v/env-contract)](https://www.npmjs.com/package/env-contract)
[![CI](https://github.com/alranjan14/env-contract/actions/workflows/ci.yml/badge.svg)](https://github.com/alranjan14/env-contract/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/env-contract)](./LICENSE)

`env-contract` plugs into your existing validator (Zod, `@t3-oss/env-*`, Valibot, ArkType) and keeps three things in sync:

- **Schema → `.env.example`** — generates and updates a managed block so the example never drifts.
- **Code → schema** — scans `process.env` / `import.meta.env` usage and flags references missing from the schema.
- **Schema → code** — with `--strict`, flags schema keys no longer used anywhere.

It does **not** validate values at runtime — that stays your validator's job. `env-contract` closes the developer-workflow gap your runtime validator can't see.

## Install

```bash
npm install -D env-contract   # or: pnpm add -D env-contract · yarn add -D env-contract · bun add -d env-contract
```

## Quick start

```bash
npx env-contract sync     # update .env.example from your schema
npx env-contract scan     # find untracked process.env references
npx env-contract check    # CI gate — exits non-zero if anything is out of sync
npx env-contract install  # add a pre-commit hook (husky / simple-git-hooks / lefthook)
```

## Documentation

- **[Full package docs](./packages/env-contract/README.md)** — CLI reference, configuration, exit codes, and a comparison table.
- **[Framework recipes](./packages/env-contract/docs/recipes.md)** — T3, Next.js, Vite/Astro, Express/Hono, Turborepo.
- **[Examples](./examples)** — runnable reference projects: Express + Zod, Next.js + Zod, and a Turborepo monorepo.
- **[Contributing](./CONTRIBUTING.md)** · **[Security policy](./SECURITY.md)**

## Repository layout

This is a pnpm monorepo; the published package lives in [`packages/env-contract`](./packages/env-contract). Standalone, copy-pasteable reference projects live in [`examples/`](./examples).

## License

[MIT](./LICENSE)
