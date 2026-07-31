import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import readline from "node:readline";
import { ExitCode } from "../utils/exit-code.js";
import { makeLogger } from "../utils/logger.js";
import type { Config } from "../config.js";

interface PackageJsonShape {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  "simple-git-hooks"?: Record<string, string>;
}

async function ask(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(pc.cyan(`${question} (y/N) `), (answer) => {
      rl.close();
      resolve(answer.toLowerCase().startsWith("y"));
    });
  });
}

export type PackageManagerCommand = "pnpm exec" | "bunx" | "yarn exec" | "npm exec";

export async function detectPackageManager(cwd: string): Promise<PackageManagerCommand> {
  const ua = process.env.npm_config_user_agent || "";
  if (ua.startsWith("pnpm")) return "pnpm exec";
  if (ua.startsWith("bun")) return "bunx";
  if (ua.startsWith("yarn")) return "yarn exec";
  if (ua.startsWith("npm")) return "npm exec";

  const candidates: { file: string; cmd: PackageManagerCommand }[] = [
    { file: "pnpm-lock.yaml", cmd: "pnpm exec" },
    { file: "bun.lockb", cmd: "bunx" },
    { file: "yarn.lock", cmd: "yarn exec" },
    { file: "package-lock.json", cmd: "npm exec" },
  ];

  for (const c of candidates) {
    try {
      await fs.access(path.join(cwd, c.file));
      return c.cmd;
    } catch {
      // ignore
    }
  }

  return "npm exec";
}

export async function runInstall(
  options: { hook?: string; yes?: boolean; cwd?: string; silent?: boolean; json?: boolean },
  config: Config = {},
): Promise<{ code: ExitCode }> {
  const hookName = options.hook || "pre-commit";
  const cwd = options.cwd || process.cwd();
  const rootDir = config.rootDir ? path.resolve(cwd, config.rootDir) : cwd;
  // Route status output through the logger so --silent / --json suppress the
  // human chatter (install produces no JSON payload; it's a setup helper). The
  // interactive prompt below is unaffected — it only runs without --yes.
  const logger = makeLogger({ json: options.json, silent: options.silent });

  logger.info(pc.bold("env-contract setup helper\n"));

  let hookManager: "husky" | "simple-git-hooks" | "lefthook" | null = null;
  const packageJsonPath = path.join(rootDir, "package.json");
  let packageJson: PackageJsonShape | null = null;

  try {
    const pkgContent = await fs.readFile(packageJsonPath, "utf-8");
    packageJson = JSON.parse(pkgContent) as PackageJsonShape;
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps["husky"]) hookManager = "husky";
    else if (deps["simple-git-hooks"]) hookManager = "simple-git-hooks";
    else if (deps["lefthook"]) hookManager = "lefthook";
  } catch {
    // package.json might not exist, ignore
  }

  // Also check for lefthook.yml / lefthook.yaml directly
  let lefthookFile: string | null = null;
  if (!hookManager) {
    for (const file of ["lefthook.yml", "lefthook.yaml"]) {
      try {
        await fs.access(path.join(rootDir, file));
        hookManager = "lefthook";
        lefthookFile = file;
        break;
      } catch {
        // ignore
      }
    }
  } else if (hookManager === "lefthook") {
    lefthookFile = "lefthook.yml";
  }

  const pmCommand = await detectPackageManager(rootDir);
  const command = `${pmCommand} env-contract check`;

  if (hookManager === "husky") {
    const hookPath = path.join(rootDir, ".husky", hookName);
    logger.info(`Detected ${pc.cyan("husky")}.`);

    let existingHook = "";
    try {
      existingHook = await fs.readFile(hookPath, "utf-8");
    } catch {
      // Hook doesn't exist yet
    }

    if (existingHook.includes("env-contract check")) {
      logger.info(pc.green(`✔ ${hookPath} already contains env-contract check.`));
    } else {
      if (options.yes || (await ask(`Add env-contract to .husky/${hookName}?`))) {
        const newHook = existingHook
          ? (existingHook.endsWith("\n") ? existingHook : existingHook + "\n") + command + "\n"
          : `#!/usr/bin/env sh\n\n${command}\n`;

        // Ensure .husky dir exists
        await fs.mkdir(path.join(rootDir, ".husky"), { recursive: true });
        await fs.writeFile(hookPath, newHook, "utf-8");
        // Make executable
        await fs.chmod(hookPath, 0o755);
        logger.info(pc.green(`✔ Added to .husky/${hookName}`));
      }
    }
  } else if (hookManager === "simple-git-hooks") {
    logger.info(`Detected ${pc.cyan("simple-git-hooks")}.`);

    if (packageJson) {
      const hooks = packageJson["simple-git-hooks"] || {};
      const existing = hooks[hookName] || "";

      if (existing.includes("env-contract check")) {
        logger.info(
          pc.green(`✔ package.json already contains env-contract in simple-git-hooks.${hookName}.`),
        );
      } else {
        if (options.yes || (await ask(`Add env-contract to simple-git-hooks in package.json?`))) {
          const newCommand = existing ? `${existing} && ${command}` : command;
          packageJson["simple-git-hooks"] = { ...hooks, [hookName]: newCommand };
          await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf-8");
          logger.info(pc.green(`✔ Updated package.json.`));
          logger.info(
            pc.yellow(`👉 Run \`npx simple-git-hooks\` to update your local git config.`),
          );
        }
      }
    }
  } else if (hookManager === "lefthook") {
    logger.info(`Detected ${pc.cyan("lefthook")}.`);
    const fileToEdit = lefthookFile || "lefthook.yml";
    const lefthookPath = path.join(rootDir, fileToEdit);

    let lefthookContent = "";
    try {
      lefthookContent = await fs.readFile(lefthookPath, "utf-8");
    } catch {
      // lefthook.yml doesn't exist yet, we will create it if they agree
    }

    if (
      lefthookContent.includes("env-contract") ||
      lefthookContent.includes("env-contract check")
    ) {
      logger.info(pc.green(`✔ ${fileToEdit} already contains env-contract check.`));
    } else {
      if (options.yes || (await ask(`Add env-contract to ${fileToEdit}?`))) {
        const commandBlock = `\n${hookName}:\n  commands:\n    env-contract:\n      run: ${command}\n`;
        const updatedContent = lefthookContent
          ? (lefthookContent.endsWith("\n") ? lefthookContent : lefthookContent + "\n") +
            commandBlock
          : `# Lefthook configuration\n${commandBlock}`;

        await fs.writeFile(lefthookPath, updatedContent, "utf-8");
        logger.info(pc.green(`✔ Updated ${fileToEdit}.`));
        logger.info(pc.yellow(`👉 Run \`npx lefthook install\` to update your git hooks.`));
      }
    }
  } else {
    logger.info(`No supported git hook manager found (husky, simple-git-hooks, lefthook).`);
    logger.info(
      `To run env-contract before commits, please configure one of them and add:\n\n  ${pc.cyan(command)}\n`,
    );
  }

  const ciCommand = pmCommand.startsWith("npm")
    ? "npm run env-contract check"
    : `${pmCommand.split(" ")[0]} env-contract check`;
  logger.info("\n" + pc.bold("GitHub Actions CI Snippet"));
  logger.info("Add this step to your testing workflow:\n");
  logger.info(pc.cyan(`      - name: Check Environment Contract\n        run: ${ciCommand}`));
  logger.info("");

  return { code: ExitCode.Ok };
}
