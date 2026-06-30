# 0001 — Adapter registry for schema loaders

- Status: Accepted
- Date: 2026-06-29

## Context

`env-contract` introspects an existing env schema to learn its keys. Those
schemas come from several unrelated libraries — Zod, `@t3-oss/env-core`,
Valibot, ArkType — each with a different runtime shape. We do not want the core
engine to know about any specific library, and we want adding a new library to
be an additive change rather than an edit to a growing `if/else`.

## Decision

Schema support is expressed as a registry of adapters implementing a common
`SchemaLoader` interface (`src/loaders/types.ts`):

- `matches(mod)` — a cheap structural guard that decides whether this loader
  understands a given imported module.
- `load(mod)` — extracts the normalized `Schema` (`{ entries: SchemaEntry[] }`).

`loadSchema` (`src/core/load-schema.ts`) imports the user's schema file and
picks the **first** registered loader whose `matches()` returns true. Adding a
new library means adding one file under `src/loaders/` and registering it — no
change to the core or to the commands.

Order encodes a preference: the vendor-specific loaders (t3-env, Zod, Valibot,
ArkType) come first, and a generic **Standard Schema** adapter
(`src/loaders/standard-schema.ts`) is registered **last** as the catch-all.
Because Zod/Valibot/ArkType are all Standard-Schema-compliant, the specific
loaders win for their vendors (richer key/type/default/description info); the
generic adapter only fires for vendors we don't otherwise recognize. It recovers
**required** keys by validating an empty object and reading each issue's `path`
— Standard Schema exposes validation, not introspection, so optional keys are
not discoverable that way (a documented limitation).

## Consequences

- **+** New schema libraries are isolated, self-contained additions.
- **+** The core engine depends only on the normalized `Schema` type.
- **−** Loaders necessarily navigate untyped third-party internals, so they are
  the one place we accept `unknown`-heavy code and quarantine the
  `@typescript-eslint/no-unsafe-*` family (see `eslint.config.js`).
- **−** First-match ordering is significant; guards must be specific enough not
  to collide (e.g. t3-env vs. plain Zod).
