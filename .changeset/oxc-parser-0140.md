---
"env-contract": patch
---

Upgrade `oxc-parser` to `0.140.x`. The source scanner now walks the ESTree-compatible AST object directly instead of round-tripping the AST through `JSON.parse`, and its node predicates were updated to the ESTree shape (`MemberExpression` + `computed`, `Literal`, `Property`). No change to what the scanner detects — the golden `scan`/`e2e` tests are unchanged.
