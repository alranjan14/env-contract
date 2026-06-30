# Example: Turborepo / pnpm workspace

A monorepo with two packages, each owning its own env schema and `.env.example`.
`env-contract` checks them all in one pass with `--workspace`.

```
apps/web         → NEXT_PUBLIC_API_URL, SESSION_SECRET
packages/api     → DATABASE_URL, PORT, REDIS_URL
```

## Try it

```bash
pnpm install

# Check every package's contract in one command (run from the repo root):
pnpm env:check                 # → env-contract check --workspace

# Or drive it through Turborepo's task graph:
pnpm env:check:turbo           # → turbo run env:check  (each package's "env:check")
```

`--workspace` auto-discovers packages from `pnpm-workspace.yaml`. Each package is
checked against its own `src/env.ts`; drift in any one fails the whole run.

See the per-package files: [`apps/web`](apps/web) and [`packages/api`](packages/api).
The root [`turbo.json`](turbo.json) declares the `env:check` task so it can run
across the graph.
