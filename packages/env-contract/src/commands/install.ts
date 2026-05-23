import fs from "node:fs/promises";
import path from "node:path";
import pc from "picocolors";
import readline from "node:readline";
import type { Config } from "../config.js";

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

export async function runInstall(options: { hook?: string; yes?: boolean; cwd?: string }, config: Config = {}): Promise<{ code: number }> {
  const hookName = options.hook || "pre-commit";
  const cwd = options.cwd || process.cwd();
  const rootDir = config.rootDir ? path.resolve(cwd, config.rootDir) : cwd;
  
  console.log(pc.bold("env-contract setup helper\n"));

  let hookManager: "husky" | "simple-git-hooks" | "lefthook" | null = null;
  let packageJsonPath = path.join(rootDir, "package.json");
  let packageJson: any = null;

  try {
    const pkgContent = await fs.readFile(packageJsonPath, "utf-8");
    packageJson = JSON.parse(pkgContent);
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps["husky"]) hookManager = "husky";
    else if (deps["simple-git-hooks"]) hookManager = "simple-git-hooks";
    else if (deps["lefthook"]) hookManager = "lefthook";
  } catch (e) {
    // package.json might not exist, ignore
  }

  // Also check for lefthook.yml directly
  if (!hookManager) {
    try {
      await fs.stat(path.join(rootDir, "lefthook.yml"));
      hookManager = "lefthook";
    } catch {
      // ignore
    }
  }

  const command = "npx env-contract check";

  if (hookManager === "husky") {
    const hookPath = path.join(rootDir, ".husky", hookName);
    console.log(`Detected ${pc.cyan("husky")}.`);
    
    let existingHook = "";
    try {
      existingHook = await fs.readFile(hookPath, "utf-8");
    } catch {
      // Hook doesn't exist yet
    }

    if (existingHook.includes(command)) {
      console.log(pc.green(`✔ ${hookPath} already contains env-contract check.`));
    } else {
      if (options.yes || await ask(`Add env-contract to .husky/${hookName}?`)) {
        const newHook = existingHook 
          ? (existingHook.endsWith("\n") ? existingHook : existingHook + "\n") + command + "\n"
          : `#!/usr/bin/env sh\n. "$(dirname -- "$0")/_/husky.sh"\n\n${command}\n`;
        
        // Ensure .husky dir exists
        await fs.mkdir(path.join(rootDir, ".husky"), { recursive: true });
        await fs.writeFile(hookPath, newHook, "utf-8");
        // Make executable
        await fs.chmod(hookPath, 0o755);
        console.log(pc.green(`✔ Added to .husky/${hookName}`));
      }
    }
  } else if (hookManager === "simple-git-hooks") {
    console.log(`Detected ${pc.cyan("simple-git-hooks")}.`);
    
    if (packageJson) {
      const hooks = packageJson["simple-git-hooks"] || {};
      const existing = hooks[hookName] || "";
      
      if (existing.includes(command)) {
        console.log(pc.green(`✔ package.json already contains env-contract in simple-git-hooks.${hookName}.`));
      } else {
        if (options.yes || await ask(`Add env-contract to simple-git-hooks in package.json?`)) {
          const newCommand = existing ? `${existing} && ${command}` : command;
          packageJson["simple-git-hooks"] = { ...hooks, [hookName]: newCommand };
          await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n", "utf-8");
          console.log(pc.green(`✔ Updated package.json.`));
          console.log(pc.yellow(`👉 Run \`npx simple-git-hooks\` to update your local git config.`));
        }
      }
    }
  } else if (hookManager === "lefthook") {
    console.log(`Detected ${pc.cyan("lefthook")}.`);
    console.log(pc.yellow(`Please add the following to your lefthook.yml under ${hookName}:`));
    console.log(`\n${hookName}:\n  commands:\n    env-contract:\n      run: ${command}\n`);
  } else {
    console.log(`No supported git hook manager found (husky, simple-git-hooks, lefthook).`);
    console.log(`To run env-contract before commits, please configure one of them and add:\n\n  ${pc.cyan(command)}\n`);
  }

  console.log("\n" + pc.bold("GitHub Actions CI Snippet"));
  console.log("Add this step to your testing workflow:\n");
  console.log(pc.cyan(`      - name: Check Environment Contract\n        run: pnpm env-contract check`));
  console.log();

  return { code: 0 };
}
