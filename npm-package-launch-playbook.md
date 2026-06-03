# The npm Package Launch Playbook

> Everything from "I have an idea" to "people are downloading it." Written for someone shipping a TypeScript package in 2026.
>
> Walk top to bottom on first read. Use as a checklist on launch day. Revisit §10 every 30 days during the first six months.

---

## Table of Contents

1. [Naming: Repo, Package, Identity](#1-naming-repo-package-identity)
2. [Pre-Creation Availability Checks](#2-pre-creation-availability-checks)
3. [License & Legal Hygiene](#3-license--legal-hygiene)
4. [Setting Up the GitHub Repo](#4-setting-up-the-github-repo)
5. [package.json — Every Field That Matters](#5-packagejson--every-field-that-matters)
6. [Build & Tooling (2026 Edition)](#6-build--tooling-2026-edition)
7. [Pre-Publish Checklist](#7-pre-publish-checklist)
8. [Publishing: First Time (Manual)](#8-publishing-first-time-manual)
9. [Publishing: Going Forward (Trusted Publishing)](#9-publishing-going-forward-trusted-publishing)
10. [Reach & Adoption Plan](#10-reach--adoption-plan)
11. [Dos and Don'ts](#11-dos-and-donts)
12. [Common Mistakes That Tank Packages](#12-common-mistakes-that-tank-packages)
13. [Day 0 → Day 100 Timeline](#13-day-0--day-100-timeline)
14. [Appendix: Copy-Paste Snippets](#14-appendix-copy-paste-snippets)

---

## 1. Naming: Repo, Package, Identity

The name is the single most reversible-but-painful decision. Get it right before you commit a single file.

### 1.1 npm package name rules (technical)

- All lowercase. No spaces. Hyphens are fine, underscores discouraged.
- Max 214 characters total.
- Cannot start with `.` or `_`.
- Cannot contain non-URL-safe characters.
- Cannot match an existing package name (case-insensitive).
- Cannot be confusingly similar to an existing package (npm reserves the right to reject).

Two name shapes are valid:
- **Unscoped:** `env-contract`
- **Scoped:** `@your-username/env-contract` or `@your-org/env-contract`

### 1.2 Unscoped vs scoped — which to pick

| Factor | Unscoped (`env-contract`) | Scoped (`@username/env-contract`) |
|---|---|---|
| Discoverability | Higher — shorter, ranks better in search | Slightly lower |
| Squatting risk | High — if you don't claim it, someone else will | None |
| Free public publish | Yes | Yes (with `--access=public`) |
| Future flexibility | Hard to "rename into" a scope later | Trivial to add sub-packages: `@x/y-core`, `@x/y-cli` |
| Org branding | Weak | Strong (everything under your scope) |
| Trust signal | Neutral | Slightly positive — implies a maintainer/org |

**Recommendation for a flagship package:** unscoped if available, scoped fallback. For ecosystem packages (multiple coordinated packages), always scoped.

### 1.3 Naming criteria — what makes a good name

A good package name is:
1. **Descriptive of the *what*, not the *how*.** `env-contract` says what it gives you. `zod-env-toolkit` describes the implementation.
2. **One to three words.** Under 25 characters total. Anything longer dies in `npm install` lines.
3. **Pronounceable.** People will say it on podcasts, in standups, in talks.
4. **Searchable.** Type your candidate into npm and Google — if you compete with five other things named the same, pick differently.
5. **Free of trademark traps.** Don't name your tool "stripe-utils" or "react-x" if you're not affiliated.
6. **Memorable.** Bonus for slight wordplay (`zod-roll`, `env-contract`, `shadcn`) but never sacrifice clarity for cleverness.

**Avoid:**
- Pure abbreviations (`exu`, `zct`, `epkg`) — unsearchable.
- Generic words (`utils`, `core`, `tools`) without a qualifier.
- Names that imply scope you don't deliver (`universal-`, `complete-`, `the-`).
- Trailing version numbers in the name (`mypkg2`, `mypkg-v2`).
- Reserved words: `node`, `npm`, `js`, `javascript`, `node_modules`.
- Anything that could read as offensive in any major language. Search before you commit.

### 1.4 Repo name vs package name

**Default: identical.** `github.com/you/env-contract` publishes `env-contract` on npm.

**Exceptions:**
- **Monorepo:** repo name is the umbrella (`env-contract` repo contains `packages/env-contract`, `packages/env-contract-vite`, etc.). Top-level repo name matches your "primary" package.
- **Scoped:** repo `env-contract`, package `@yourname/env-contract`. Drop the `@yourname/` from the repo name — repos can't have `@` in the URL anyway.

### 1.5 Identity bundle (claim everything at once)

When a name is available, claim it everywhere in one sitting:

| Property | Why |
|---|---|
| **npm package name** | The actual deliverable |
| **GitHub repo name** | Source of truth |
| **GitHub Pages or custom domain** | If you'll have a docs site (often `pkgname.dev` or `.io`) |
| **Twitter/X handle** | Even if you don't use it, prevents impersonation |
| **Bluesky handle** | Same |
| **Discord server name** (if applicable) | For ecosystem packages |
| **JSR.io name** (optional) | The new JavaScript registry — claim if planning to dual-publish |

Cost of claiming: 15 minutes. Cost of not claiming and having to migrate two years in: weeks.

---

## 2. Pre-Creation Availability Checks

Run these before you write a single line of code.

### 2.1 npm availability

```bash
npm view env-contract
# 404 → free to use
# Returns metadata → taken (read it; sometimes a deprecated/empty squat)
```

If the name is "taken" but the package is empty, deprecated, or hasn't published in 5+ years, you can submit a [npm name dispute](https://docs.npmjs.com/policies/disputes) — but it's a slow process. Better: pick a different name.

### 2.2 GitHub availability

Check `https://github.com/USERNAME/REPO-NAME` returns 404. If you have a spare org, check there too.

### 2.3 Domain check (optional but recommended)

If you plan a docs site:

```bash
# Check .dev, .io, .com, .sh
whois env-contract.dev
```

Or use `instantdomainsearch.com`. `.dev` is the modern default for OSS dev tools (~$15/year, requires HTTPS).

### 2.4 Trademark / search engine sanity check

- Google your candidate name in quotes: `"env-contract"`. Look for unrelated companies, products, or controversial uses.
- USPTO check (if US): `tmsearch.uspto.gov`. Skip for personal-scale projects; do for any tool you might commercialize.
- Search GitHub for the name — see if there's an abandoned project that already exists.

### 2.5 Profanity and connotation check

For non-English speakers in your future user base: pop the name into Google Translate across major languages. Some projects have died because the name meant something embarrassing in Portuguese or German.

---

## 3. License & Legal Hygiene

### 3.1 Picking a license

For 95% of OSS JS packages, the answer is **MIT**. Permissive, universally understood, no friction for adoption.

| License | When to use |
|---|---|
| **MIT** | Default for OSS dev tools. Maximum adoption. |
| **Apache 2.0** | If patent protection matters to you (rare for utility libs). |
| **BSD-3-Clause** | Equivalent to MIT for practical purposes. Pick MIT instead. |
| **ISC** | npm's old default. Functionally MIT. Use MIT for clarity. |
| **GPL / AGPL** | Avoid unless you have specific anti-commercial-use intent. Will block enterprise adoption. |
| **BSL / Sustainable Use** | Only if you plan to commercialize and want to prevent cloud reselling. Not for your first package. |

**Pick MIT.** Add a `LICENSE` file at the repo root with the canonical text and your name + year.

### 3.2 Things that are not optional

- A `LICENSE` file at repo root. Without one, the code is technically "all rights reserved" and corporate users can't legally use it.
- The license name in `package.json`'s `license` field (must match SPDX identifier: `"MIT"`, not `"mit"` or `"MIT License"`).
- An attribution-friendly `README` if you copy any code, even a snippet, from another project.

### 3.3 Code of Conduct

Add `CODE_OF_CONDUCT.md`. Use the [Contributor Covenant 2.1](https://www.contributor-covenant.org/) — it's the de facto standard. GitHub has a one-click template. Takes 30 seconds.

### 3.4 Security disclosure policy

Add `SECURITY.md` describing how to report vulnerabilities. For small packages: a single email or GitHub Security Advisory link is enough. Don't accept security reports in public issues.

---

## 4. Setting Up the GitHub Repo

### 4.1 Files that must exist on day 1

```
your-package/
├── README.md                  # Your sales page (see §10.1)
├── LICENSE                    # MIT text
├── CODE_OF_CONDUCT.md         # Contributor Covenant
├── SECURITY.md                # Vuln reporting
├── CONTRIBUTING.md            # How to contribute
├── CHANGELOG.md               # Auto-generated by changesets
├── .gitignore                 # node_modules/, dist/, .env, etc.
├── .npmignore                 # Or use "files" in package.json (preferred)
├── .editorconfig              # Tabs/spaces consensus
├── package.json
├── tsconfig.json
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md
    │   └── feature_request.md
    ├── pull_request_template.md
    ├── FUNDING.yml            # (optional) GitHub Sponsors link
    └── workflows/
        ├── ci.yml             # Test on push/PR
        └── release.yml        # Publish on tag
```

### 4.2 .gitignore essentials

```
node_modules/
dist/
build/
coverage/
.env
.env.*
!.env.example
.DS_Store
*.log
.turbo/
.next/
.nuxt/
.cache/
```

### 4.3 GitHub repo settings to enable

In your repo settings (one-time):

- **General → Features:** Disable Wiki and Projects unless you'll use them. Keep Issues and Discussions on.
- **Branches → Branch protection rules** for `main`:
  - Require pull request before merging
  - Require status checks to pass (set after CI is green once)
  - Require conversation resolution before merging
  - Do NOT enable "Require signed commits" until you've set up signing locally — it'll lock you out of quick fixes.
- **Code security and analysis:** Enable Dependabot alerts and Dependabot security updates. Free, valuable, low signal-to-noise.
- **Pages:** Skip until you have a docs site to deploy.
- **Secrets and variables → Actions:** You'll add `NPM_TOKEN` here for v0 (later replaced by trusted publishing).

### 4.4 Issue and PR templates

Even tiny repos benefit. Templates lower the cost of filing a good issue, raise the quality of contributions.

Minimum bug template:

```markdown
**What happened?**

**What did you expect to happen?**

**Reproduction (link to repo or minimal example):**

**Environment:**
- OS:
- Node version:
- Package version:
```

PR template should ask: what does this change, what tested, any breaking changes.

### 4.5 README — the most important file

The README is your sales page, your docs, your trust signal. Treat it like product copy.

**Section order that converts:**

1. **Logo / hero (optional but recommended).** A simple SVG. Not required, but makes the README skim-able.
2. **Badges row** — npm version, CI status, license, optionally bundle size, downloads. Don't go overboard; 3–5 max.
3. **One-liner.** A single sentence that tells someone whether to keep reading.
4. **30-second pitch.** Two paragraphs: the problem, your answer.
5. **Install and quick start.** Copy-pasteable. Working in <60 seconds.
6. **Why** (link to a short rationale section).
7. **What it doesn't do** — honest scope. This is the trust builder.
8. **API / CLI reference** — concise; deep docs go to a docs site once warranted.
9. **Comparisons table** — vs. similar tools. Be fair.
10. **FAQ.**
11. **Contributing.**
12. **License.**

**README anti-patterns:**
- Wall of badges (>8) — looks insecure.
- A 2000-word essay before the first code example. Code in the first screen, always.
- "Why I built this" as a section before the user knows what *this* is.
- TOC longer than the content.
- Animated GIFs over 3MB — block on slow connections.
- Marketing-speak ("blazing fast," "revolutionary"). Show, don't claim.

---

## 5. package.json — Every Field That Matters

This is the file that determines whether your package shows up in search, installs cleanly, and works for downstream users. Every field below has a purpose.

### 5.1 Annotated example

```jsonc
{
  // Identity
  "name": "env-contract",
  "version": "0.1.0",
  "description": "Keep your env schema, .env.example, and process.env references honest with each other.",
  "keywords": ["env", "dotenv", "zod", "t3-env", "validation", "typescript", "monorepo", "ci"],

  // Discovery & links — all three matter for npm + GitHub linking
  "homepage": "https://github.com/you/env-contract#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/you/env-contract.git"
  },
  "bugs": "https://github.com/you/env-contract/issues",

  // Authorship
  "author": "Your Name <you@example.com>",
  "license": "MIT",

  // Module shape — modern dual ESM/CJS
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },

  // For CLI packages
  "bin": {
    "env-contract": "./dist/cli.js"
  },

  // What ships in the npm tarball — explicit allowlist
  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],

  // Engines — declare what you support, don't be lax
  "engines": {
    "node": ">=18.0.0"
  },

  // Side-effects flag — important for tree-shaking by bundlers
  "sideEffects": false,

  // Scripts
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "release": "changeset publish",
    "prepublishOnly": "npm run build && npm run test"
  },

  // Dependencies — only true runtime deps
  "dependencies": {
    "cac": "^6.7.14",
    "jiti": "^2.0.0",
    "oxc-parser": "^0.30.0",
    "picocolors": "^1.0.0"
  },

  "peerDependencies": {
    "zod": "^3.0.0 || ^4.0.0"
  },
  "peerDependenciesMeta": {
    "zod": { "optional": false }
  },

  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "@types/node": "^20.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^1.0.0"
  },

  // Publish configuration
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

### 5.2 Field-by-field rules

| Field | Why it matters |
|---|---|
| `name` | Must match npm. Lowercase. |
| `version` | Start at `0.1.0`, not `1.0.0`. Signals "early but real." Never `0.0.x` for a real release. |
| `description` | First impression on npm search results page. Make it specific and benefit-led. ≤120 chars. |
| `keywords` | Searchable on npm. Pick 5–10 actual user-search terms. **Don't keyword-stuff** — npm penalizes irrelevant ones. |
| `homepage`, `repository`, `bugs` | All three should be set. Trusted publishing requires `repository.url` to match exactly. |
| `license` | Must be SPDX identifier. Just `"MIT"`. |
| `type` | `"module"` for ESM-first packages (default in 2026). |
| `exports` | The single most important field for modern Node. Replaces `main`/`module`/`types` for users on modern bundlers. Always include `"./package.json"` exposure. |
| `files` | Allowlist what ships. **Always use this instead of `.npmignore`** — fewer surprises. Run `npm pack --dry-run` to verify. |
| `engines.node` | Set the actual minimum Node version. Don't pretend to support Node 14 if you've never tested it. |
| `sideEffects: false` | Critical for bundler tree-shaking. Set unless your package has actual side effects on import. |
| `dependencies` | ONLY runtime deps. If it's used in tests/build, it goes in `devDependencies`. |
| `peerDependencies` | Things you expect the user to provide. Declare ranges generously (`^3.0.0 \|\| ^4.0.0`). |
| `peerDependenciesMeta` | Mark optional peers — without this, npm 7+ will try to auto-install them. |
| `publishConfig.access` | `"public"` is required for scoped packages. Doesn't hurt for unscoped. |
| `publishConfig.provenance` | `true` = sign your published package via OIDC (see §9). |

### 5.3 What NOT to put in package.json

- `"private": true` — you're publishing! Remove this.
- `"preinstall"` / `"postinstall"` scripts — major red flag for security-conscious users since 2025. Do not add unless absolutely necessary.
- Test files / source files in `dependencies` (they belong in `devDependencies`).
- Personal API keys, internal URLs, or anything you wouldn't want on the public internet.
- Yarn `resolutions` field (npm doesn't use it; use `overrides` if needed).

---

## 6. Build & Tooling (2026 Edition)

The minimum viable toolchain. Don't over-engineer.

### 6.1 Recommended stack

| Tool | Purpose | Alternative |
|---|---|---|
| **TypeScript** (strict mode) | Source language | n/a |
| **tsup** | Bundle to ESM + CJS + .d.ts in one command | `unbuild`, `tshy` |
| **Vitest** | Test runner | Node's built-in `node:test` (lighter, fewer features) |
| **changesets** | Versioning + changelog | `semantic-release` (more magic) |
| **pnpm** | Package manager | `npm`, `bun` |
| **prettier + eslint** (flat config) | Code style | `biome` (faster, single tool) |

### 6.2 Module format decision (2026 default)

**ESM-first, CJS-compatible.** This is the modern default. tsup handles both with one config:

```ts
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  target: "node18",
  banner: ({ format }) =>
    format === "esm" ? { js: "" } : undefined,
});
```

**ESM-only is increasingly viable** in 2026 — most modern Node code is ESM. But a CJS export costs you almost nothing with tsup, and unlocks a lot of legacy users. Ship both.

### 6.3 TypeScript config baseline

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

The `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` flags will catch bugs your users would otherwise hit. Worth the strictness.

### 6.4 Versioning with changesets

Why changesets over `npm version` or `semantic-release`:
- Explicit (you choose the bump per change).
- Generates a changelog automatically.
- Works in monorepos.
- No magic commit message parsing.

Setup:
```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

Workflow:
1. Make changes.
2. Run `pnpm changeset` — interactive: pick patch/minor/major, write a one-line summary.
3. Commit the generated `.changeset/*.md` file with your changes.
4. On merge to `main`, a CI workflow opens a "Version Packages" PR that bumps versions.
5. Merge that PR → another CI workflow publishes to npm.

This separates "did the work" from "released the work" — cleaner history, fewer accidents.

---

## 7. Pre-Publish Checklist

Run this every release. Make it a script if you publish often.

### 7.1 Account hygiene

- [ ] **2FA enabled** on your npm account. Mandatory now for publishers; non-negotiable after the 2025 supply chain attacks. Use a hardware key (YubiKey) if you can.
- [ ] **2FA enabled** on your GitHub account, with hardware key.
- [ ] Email on npm and GitHub matches what you actually monitor.
- [ ] `npm whoami` returns the right account.

### 7.2 Package contents

- [ ] `npm pack --dry-run` shows exactly the files you intend to publish, nothing more.
- [ ] No source maps point to private file paths.
- [ ] No `.env` files, no secrets, no internal-only docs.
- [ ] `dist/` actually exists and is built fresh.
- [ ] Bundle size: run `npx package-size .` or check via [Packagephobia](https://packagephobia.com).

### 7.3 Metadata

- [ ] `package.json` `version` is the right bump (semver: patch/minor/major).
- [ ] `description` and `keywords` are present and accurate.
- [ ] `repository.url` matches the actual GitHub URL exactly (required for trusted publishing).
- [ ] `README.md` exists and renders correctly. Test on npm's preview if possible.
- [ ] `LICENSE` file exists.
- [ ] `CHANGELOG.md` reflects this release.

### 7.4 Functionality

- [ ] All tests pass on Node 18, 20, 22.
- [ ] `npm install` from a fresh dir + your tarball works:
  ```bash
  npm pack
  cd /tmp && mkdir test-install && cd test-install
  npm init -y
  npm install /path/to/your-package-0.1.0.tgz
  node -e "require('your-package')" # or import test
  ```
- [ ] CLI (if applicable) runs after install.
- [ ] Types resolve in a downstream project.
- [ ] Works on Windows (paths!) if you claim to.

### 7.5 Trust signals

- [ ] Provenance enabled (`publishConfig.provenance: true`).
- [ ] No `postinstall` script (or, if there must be one, it's documented and benign).
- [ ] `engines` field declared and accurate.

---

## 8. Publishing: First Time (Manual)

Trusted publishing requires the package to exist on npm first. So your **very first publish is manual**, then you switch to OIDC.

### 8.1 First publish flow

```bash
# Log in to npm (one time per machine)
npm login

# Verify
npm whoami

# Build fresh
pnpm build

# Dry-run — check the tarball contents
npm pack --dry-run

# Publish
npm publish --access=public
```

If the package is scoped (`@you/pkg`), `--access=public` is required for free public publishing. For unscoped packages, it's the default but harmless.

### 8.2 Tag the release on GitHub

```bash
git tag v0.1.0
git push origin v0.1.0
```

Then create a GitHub Release from the tag. Paste the changelog entry. This is your launch artifact — link it from your tweet/post.

### 8.3 Verify the publish

- Go to `https://npmjs.com/package/your-package`.
- Confirm: version is right, README renders, files list looks correct.
- Click through to the source repo from npm — the link should work (this is your `repository` field).

---

## 9. Publishing: Going Forward (Trusted Publishing)

After the first manual publish, **switch to OIDC trusted publishing immediately**. This is the 2026 industry standard. Using long-lived `NPM_TOKEN` secrets is now the insecure path.

### 9.1 Why OIDC (the case in three lines)

- No token to leak (no `NPM_TOKEN` in CI secrets).
- Cryptographic proof your package was built from your repo's specific workflow.
- Provenance attestations on by default — users can verify which commit your package came from.

### 9.2 One-time setup

**1. Configure trusted publishing on npm:**
- Go to `npmjs.com → your package → Settings → Trusted Publisher`
- Add: GitHub org/user, repo name, workflow filename (`release.yml`), environment name (optional but recommended).
- Set "Publishing access" → "Require two-factor authentication and disallow tokens."

**2. Update your release workflow:**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write
  id-token: write    # ← required for OIDC

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"

      # Update npm to a version that supports OIDC
      - run: npm install -g npm@latest

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test

      - name: Create release PR or publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # Note: NO NPM_TOKEN — OIDC handles auth
```

**3. Confirm `package.json` matches:**

```jsonc
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/you/env-contract.git"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

The `repository.url` must match the value you entered on npm exactly, or the OIDC handshake fails with a confusing 404.

### 9.3 Common OIDC pitfalls

| Symptom | Cause |
|---|---|
| `npm error code ENEEDAUTH` | npm CLI < 11.5.1. Add a step to upgrade npm. |
| `npm error 404 Not Found - PUT` | `repository.url` doesn't match what's configured on npmjs.com. |
| Provenance not generated | Repo is private (current OIDC limitation), or you set `NODE_AUTH_TOKEN` to empty (don't — leave the env block out entirely). |
| Workflow hangs | Missing `id-token: write` permission. |

### 9.4 Subsequent releases

```bash
# Local
pnpm changeset                # describe the change
git add . && git commit -m "feat: add scan command"
git push

# CI auto-creates a "Version Packages" PR
# Merge it → CI publishes to npm with provenance
```

---

## 10. Reach & Adoption Plan

A package with no audience is the same as no package. Plan adoption with the same rigor you plan the code.

### 10.1 The README as a sales page

Treat the README like landing-page copy:

- **Above-the-fold matters most.** The first screen (~25 lines on a laptop) decides whether someone scrolls.
- **Lead with the problem.** People skim looking for "is this for me?"
- **First code block within 15 lines.** Skeptical devs need to see the API to evaluate it.
- **Show comparison.** A small table of "vs alternative X" earns trust.
- **End with limits.** Section called "What this doesn't do" — counter-intuitive, but builds more trust than any feature list.

A great example to study: [`zod`](https://github.com/colinhacks/zod), [`shadcn/ui`](https://github.com/shadcn-ui/ui), [`tinyhttp`](https://github.com/tinyhttp/tinyhttp). Read their READMEs as a writer, not a user.

### 10.2 Launch day strategy

The day you publish v0.1.0, do all of these — within a 48-hour window so the momentum compounds.

**Channels worth your time:**

| Channel | Effort | Reach potential | Notes |
|---|---|---|---|
| **Hacker News (Show HN)** | 30 min | Highest variance — could go big or sink | Post Tuesday or Wednesday morning ET. Title: "Show HN: env-contract – keeps your env schema, .env.example, and code in sync." Be ready to engage in comments for 24h. |
| **r/typescript** | 15 min | Moderate, consistent | Lead with the problem, not the solution. Title: "Tired of .env.example drifting from your Zod schema?" |
| **r/nextjs** | 15 min | High if relevant to Next users | Frame around Next.js use case specifically. |
| **Dev.to article** | 2–3 hours | Long-tail SEO | "I built X to solve Y" format. Cross-post canonical to your own blog. |
| **Bytes newsletter** | 15 min to submit | High — 200K+ subscribers | [bytes.dev](https://bytes.dev) — submit via their form. |
| **This Week in React** | 15 min | Medium | If React-relevant. |
| **JavaScript Weekly** | 15 min | High — 130K+ subscribers | [javascriptweekly.com](https://javascriptweekly.com) — submit. |
| **Node Weekly** | 15 min | Medium | If Node-relevant. |
| **Reactiflux Discord** | 10 min | Low individually, compounds | `#showcase` channel. |
| **T3 Discord** | 10 min | Targeted if T3-adjacent | Be respectful — don't spam. |
| **e18e community** (`e18e.dev`) | 30 min | Targeted, high-signal | Submit if your tool reduces dependency bloat or helps the JS ecosystem. |
| **Twitter/X** | 30 min | Variable | Tag relevant maintainers (don't spam). 1 thread + 1 demo video. |
| **Bluesky** | 15 min | Growing audience | Same content, different platform. |
| **LinkedIn** | 15 min | Surprisingly underused | Devs in larger orgs read LinkedIn more than HN. |
| **Lobste.rs** | 15 min | Niche, high-signal | Need an invite. Saves for later. |

**Channels NOT worth your time:**
- Generic Facebook groups.
- Random Telegram channels (often bots).
- Paid Twitter promotion for OSS — terrible ROI.
- DMing influencers cold — almost always backfires.

### 10.3 The launch post template

What works (across all platforms):

```
Hey, I built [TOOL] to fix [SPECIFIC PAIN].

The problem: [2 sentences max, with a concrete example]

Most existing tools [X, Y, Z] solve [related thing] but don't [your gap].

What this does:
- [Specific feature 1]
- [Specific feature 2]
- [Specific feature 3]

What it doesn't do:
- [Honest scope limit]

Repo: [link]
npm: [link]

Feedback very welcome — especially edge cases I haven't thought of.
```

What doesn't work:
- "Excited to announce..."
- "Revolutionary new approach to..."
- Listing 12 features with no "why."
- Posting only in self-promotion subs.

### 10.4 Sustained reach (months 1–6)

The launch gives you a spike. The trajectory after the spike matters more.

**Weekly habits:**
- Respond to every issue within 48 hours, even just to acknowledge.
- Merge or comment on every PR within a week.
- Post one update/learning on Twitter/Bluesky per week (build-in-public works).

**Monthly habits:**
- Write one blog post about a specific use case, lesson, or technical detail. Cross-post to Dev.to.
- Submit to one curated list (`awesome-nodejs`, `awesome-typescript`, etc.) when you have one new thing to show.
- Review your npm download trend on `npmtrends.com` or `npm-stat.com`. Is it growing? If flat, your positioning is wrong.

**Quarterly habits:**
- Apply to speak at a meetup. Recorded talks become evergreen marketing.
- Reach out to one popular project that *should* be using your tool. Open a PR or discussion offering integration.
- Audit your README — does it still reflect what the tool does? Tools evolve faster than docs.

### 10.5 Awesome-list submissions

Curated lists are passive download machines. Submit when you have something to show:

- `awesome-nodejs`
- `awesome-typescript`
- `awesome-nextjs` (if applicable)
- `awesome-developer-experience`
- `awesome-vite` / `awesome-react` etc. (where relevant)
- Domain-specific lists (e.g. `awesome-environment-variables`, `awesome-supply-chain-security` — search GitHub for `awesome-<topic>`).

How to get accepted: PR with a one-line entry in the right alphabetical spot. Read the contribution guide. Make it boringly easy to merge.

### 10.6 Get into starter templates

This is the highest-leverage adoption move once your tool is mature.

- Identify the top 3–5 starter templates in your space (`create-t3-app`, `t3-turbo`, popular Next.js boilerplates).
- Open a thoughtful PR or issue suggesting your tool as an option, not a replacement.
- If the maintainer is uninterested: fork, maintain a "with-X" variant, link it back from your README.

### 10.7 Tracking metrics that matter

| Metric | Tool | What to watch for |
|---|---|---|
| Weekly downloads | `npmtrends.com`, `npm-stat.com` | Up-and-to-the-right; week-over-week growth |
| GitHub stars | GitHub itself | Less important than downloads, but social proof |
| Issues opened | GitHub | More issues = more users (good); fix-rate matters |
| Mentions | Google Alerts on package name | Where conversations happen |
| Bundle size over time | `bundlephobia` | Don't bloat over releases |

**What "success" looks like by phase:**
- **Week 1:** 200–2000 downloads (launch spike).
- **Month 1:** 100–500 downloads/week sustained.
- **Month 3:** 1000–5000 downloads/week if the niche fits.
- **Month 6:** 5000–20000 downloads/week with steady growth.

If you're stuck at <100/week after 8 weeks, the *positioning* is wrong, not the code. Re-pitch, don't re-engineer.

---

## 11. Dos and Don'ts

### Dos ✅

- **Do** ship a v0.1.0, not a v1.0.0 — leave room for breaking changes.
- **Do** write the README before the code.
- **Do** include TypeScript types in the package itself (not via `@types/`).
- **Do** test on the lowest Node version you claim to support.
- **Do** use `files` in package.json instead of `.npmignore`.
- **Do** enable npm 2FA with a hardware key.
- **Do** set up trusted publishing with OIDC after first publish.
- **Do** publish provenance attestations.
- **Do** declare peer deps with generous ranges.
- **Do** keep your runtime dep count low — every dep is trust + bundle size.
- **Do** respond to issues within 48 hours, even just "ack, looking into it."
- **Do** be honest about what your tool doesn't do.
- **Do** credit prior art and inspirations in the README.

### Don'ts ❌

- **Don't** use `postinstall` scripts unless absolutely necessary — major red flag in 2026.
- **Don't** include `node_modules`, `.env`, or build artifacts in the repo or npm tarball.
- **Don't** publish without testing the tarball locally first.
- **Don't** unpublish — you mostly can't anymore (npm policy), and even when you can, downstream users will notice.
- **Don't** rename your package — it's nearly impossible to migrate users.
- **Don't** ship a CommonJS-only package in 2026 unless you have a very specific reason.
- **Don't** keyword-stuff (`keywords: ["react", "vue", "svelte", "everything"]`) — npm penalizes irrelevant ones.
- **Don't** trash competitors in your README — even if you're right, you'll look unprofessional.
- **Don't** delete issues or close them with no explanation — even spam should get a public note.
- **Don't** force-push to `main` after others have started using the package.
- **Don't** add features that double the dependency count without thinking hard.
- **Don't** fake stars, downloads, or testimonials — npm will ban you. Detection is sophisticated.
- **Don't** use long-lived `NPM_TOKEN`s in CI when OIDC is available.
- **Don't** ship breaking changes in a patch version — semver matters.

---

## 12. Common Mistakes That Tank Packages

These are mistakes I've watched real packages die from. Avoid them deliberately.

1. **Naming the package after a *technology* you don't own.** `react-x` when you're not affiliated with React → cease-and-desist potential, plus user confusion. Use a generic name + frame as "for React" in the description.

2. **Releasing v1.0.0 too early.** Locks you into APIs you'll regret. Stay at 0.x until you have real users telling you what to keep.

3. **Skipping the docs site too long.** Once your README hits ~500 lines, users need a real docs site. Astro Starlight, Nextra, VitePress — pick one, deploy in an afternoon.

4. **Ignoring Windows.** "Works on my Mac" is a launch death warrant for tools that touch the filesystem. Test on Windows in CI from day 1.

5. **Bundling massive dependencies.** Every byte you ship someone else has to download, audit, and trust. Aim for tiny.

6. **Letting issues pile up unanswered.** 50 stale open issues looks worse than 5 closed-as-wontfix. Triage weekly.

7. **No CHANGELOG.** Users updating from 0.2 to 0.3 need to know what changed. changesets handles this for you.

8. **Misleading benchmarks.** Don't claim "10x faster than X" without a reproducible benchmark and an honest scope. People will check.

9. **Inconsistent ESM/CJS handling.** Half-ESM, half-CJS packages cause confusing errors. Use `tsup` and ship both formats consistently.

10. **Disappearing for 6 months after launch.** OSS users assume abandonment fast. Even if you can't add features, push a "still alive" commit (dependency bumps, README typos) every couple of months.

---

## 13. Day 0 → Day 100 Timeline

Concrete week-by-week. Treat as a default plan; adjust to your reality.

### Week -1 (before code)
- [ ] Decide name, check availability everywhere (§2)
- [ ] Reserve npm name with placeholder (`0.0.0-placeholder`)
- [ ] Create GitHub repo with README, LICENSE, basic scaffolding
- [ ] Write the README first

### Week 0–2 (build)
- [ ] Build v0.1 scope
- [ ] Set up CI (test on push/PR)
- [ ] First passing tests
- [ ] Self-dogfood on a real project

### Week 3 (launch prep)
- [ ] Pre-publish checklist (§7)
- [ ] First manual publish (§8)
- [ ] Set up trusted publishing (§9)
- [ ] Tag v0.1.0 on GitHub with release notes
- [ ] Final README polish

### Week 3, day 1 (launch day)
- [ ] Show HN
- [ ] r/typescript + relevant subs
- [ ] Twitter/Bluesky thread
- [ ] LinkedIn post
- [ ] Submit to Bytes, JavaScript Weekly, This Week in React
- [ ] Discord shares (Reactiflux, T3, etc.)
- [ ] Be online and responsive for 6 hours

### Week 3, day 2–7
- [ ] Respond to every comment, every issue
- [ ] Note feedback patterns; queue them as v0.2 work
- [ ] Don't start v0.2 yet — let feedback settle

### Week 4
- [ ] First post-launch retrospective: what landed, what didn't
- [ ] Open public roadmap as GitHub issues
- [ ] Plan v0.2 (1–2 weeks of work, focused on most-cited feedback)

### Week 5–8
- [ ] Ship v0.2 with patch releases as needed
- [ ] Submit to 1–2 awesome-lists
- [ ] Write a follow-up blog post: "What I learned launching X"
- [ ] Reach out to 1–2 starter templates with integration PRs

### Week 9–12
- [ ] Apply to speak at a local meetup
- [ ] Audit metrics: are downloads growing? If flat, re-pitch (don't re-build)
- [ ] Plan v0.3 — bigger scope if traction is good, smaller if not

### Week 13+ (Day 100 review)
- [ ] Honest assessment: is this getting traction?
- [ ] If yes → invest in docs site, more aggressive distribution
- [ ] If no → diagnose. Wrong audience? Wrong positioning? Crowded space?
- [ ] Either commit to year 1 or sunset gracefully — both are valid

---

## 14. Appendix: Copy-Paste Snippets

### 14.1 Minimal `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push: { branches: [main] }
  pull_request: { branches: [main] }

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

### 14.2 SECURITY.md template

```markdown
# Security Policy

## Reporting a Vulnerability

If you discover a security issue, please **do not** open a public issue.

Instead, report it via [GitHub Security Advisories](https://github.com/you/your-package/security/advisories/new) or email security@yourdomain.dev.

We aim to acknowledge reports within 48 hours and provide a fix or mitigation within 14 days for critical issues.

## Supported Versions

We provide security updates for the latest minor version only.
```

### 14.3 Release announcement template (Twitter/Bluesky)

```
🚀 Just shipped env-contract v0.1

It keeps your Zod env schema, your .env.example,
and your process.env.X references in lockstep.

If your team has ever broken CI because someone
forgot to update .env.example, this is for you.

Repo: github.com/you/env-contract
npm: npmjs.com/package/env-contract

Feedback welcome — esp. weird edge cases.
```

### 14.4 Hacker News title formulas that work

- `Show HN: <Tool> – <one-line value prop in plain language>`
- `<Tool> – <unexpected angle on a familiar problem>`
- Avoid: titles in ALL CAPS, marketing words ("revolutionary"), version numbers, emojis.

### 14.5 npm pack inspection

Before every publish:

```bash
npm pack --dry-run

# Or inspect the actual tarball
npm pack
tar -tzf your-package-0.1.0.tgz
```

Make sure you see only what you intended.

---

## Final Word

The hardest part isn't writing the code or even publishing it. It's the discipline of:

1. Naming honestly,
2. Documenting clearly,
3. Showing up consistently after launch.

Most packages die not from technical failure but from the maintainer disappearing. If you commit to 90 minutes/week of maintenance for the first 6 months, you'll outlast 90% of the competition by sheer endurance.

Ship something small. Ship it well. Show up every week. That's the playbook.

---

*Last updated: 2026. Practices in this doc — especially around publishing security — change yearly. Re-verify §7–9 before each major release cycle.*
