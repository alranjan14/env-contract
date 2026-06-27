# Security Policy

## Security model

`env-contract` discovers your env **schema** and **config** files by importing
them, which **executes that code** in the current Node process (via
[jiti](https://github.com/unjs/jiti)). This is the same trust model as tools like
ESLint, Vite, or Jest that load `*.config.ts` files.

Practical implications:

- Only run `env-contract` against repositories you trust. In CI, treat it like
  any other step that runs repository code — avoid running it against untrusted
  pull requests in a privileged context.
- `env-contract` reads only env **variable names** (from your schema and the
  managed block of `.env.example`). It never reads, prints, or stores secret
  **values**.
- No telemetry, no network access, and no postinstall scripts.

## Reporting a Vulnerability

We take the security of this project seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please send an email to alranjan14@gmail.com.

### What to include in your report

* A description of the vulnerability.
* Steps to reproduce the issue.
* Potential impact.
* Any suggested fixes or mitigations.

### Our Response Process

1. We will acknowledge receipt of your report within 48 hours.
2. We will investigate the issue and confirm its validity.
3. If valid, we will work on a fix and coordinate a release.
4. We will keep you updated throughout the process.

Thank you for helping keep this project secure!
