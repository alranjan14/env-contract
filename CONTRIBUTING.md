# Contributing to env-contract

Thank you for your interest in contributing to `env-contract`! We welcome contributions from everyone.

## How to Contribute

### 1. Report Bugs
If you find a bug, please open an issue on GitHub. Include steps to reproduce and any relevant environment details.

### 2. Suggest Features
Have an idea for a new feature? Open an issue to discuss it with the community.

### 3. Pull Requests
1. Fork the repository.
2. Create a new branch for your changes.
3. Make your changes and add tests if applicable.
4. Ensure all local checks pass (`pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, `pnpm run test`).
5. Run `pnpm changeset` to add a description of your changes for the changelog.
6. Submit a pull request.

## Local Development Setup

1. Clone the repo: `git clone https://github.com/alranjan14/env-contract.git`
2. Use Node 22 (the supported baseline — see `.nvmrc`: run `nvm use`).
3. Install dependencies: `pnpm install`
4. Build the project: `pnpm run build`
5. Run checks: `pnpm run typecheck`, `pnpm run lint`, `pnpm run format:check`, and `pnpm run test`

## Code Style

We use Prettier and (type-aware) ESLint to keep the code consistent. Run `pnpm run format` to auto-format and `pnpm run lint` before submitting a PR. A husky pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files) automatically.

**Line endings:** all files are normalized to **LF** via `.gitattributes` (`* text=auto eol=lf`), and `format:check` enforces this in CI — keep your editor and git on LF and don't reintroduce CRLF.

## License
By contributing to this project, you agree that your contributions will be licensed under the MIT License.
