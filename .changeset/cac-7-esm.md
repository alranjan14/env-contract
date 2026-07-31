---
"env-contract": patch
---

Upgrade `cac` to `7.x`. cac 7 is ESM-only, so the CLI bin (`dist/cli.js`) is now built ESM-only — it is executed as the `bin` entry, never `require()`d, so it never needed a CJS build. The library entry (`env-contract`) keeps its dual ESM + CJS output unchanged. No change to CLI behavior or the public API.
