---
"env-contract": patch
---

`install` now respects the global `--silent` and `--json` flags. Its status output is routed through the shared logger instead of writing to the console directly, so both flags now suppress the human chatter (previously `install` printed unconditionally, which also meant `--json` could emit non-JSON to stdout). The `sync` interactive preview and the `showDiff` renderer were moved onto the same logger as well — no behavior change there.
