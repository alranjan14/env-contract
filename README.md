# env-contract

Keep your env schema, your .env.example, and your code references honest with each other.

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
pnpm add -D env-contract
```

## Quick start

Given an existing `src/env.ts` (any Zod, Valibot, ArkType schema, or `@t3-oss/env-core` setup):

```bash
npx env-contract sync     # writes .env.example
npx env-contract scan     # finds process.env.* not in schema
npx env-contract check    # CI-friendly composite
```

## In CI (GitHub Actions)

```yaml
- run: pnpm env-contract check
```

## Monorepo / Workspace Support

If you have a monorepo, `env-contract` can automatically discover all your internal packages (by looking for `package.json` with an `env.ts` or `env-contract.config.ts`) and process them all at once!

```bash
npx env-contract check --workspace
npx env-contract sync --workspace --watch
```

## In a pre-commit hook

```bash
npx env-contract install
```

## What it doesn't do

*   Doesn't validate values (your schema does that)
*   Doesn't load .env files (your runtime does that)
*   Doesn't modify your schema or your .env files
*   Catches `process.env.LITERAL` only — not `process.env[someVariable]`

## License

MIT