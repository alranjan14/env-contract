import pc from "picocolors";
import { runSync } from "./sync.js";
import { runScan } from "./scan.js";
import type { Config } from "../config.js";

export async function runCheck(options: { json?: boolean; workspace?: boolean }, config: Config = {}) {
  if (!options.json) {
    console.log(pc.cyan("Running environment contract check..."));
  }

  // 1. Check sync drift
  const syncCode = await runSync({ check: true, workspace: options.workspace }, config);
  
  // 2. Check scan drift
  const scanCode = await runScan({ 
    strict: true, 
    workspace: options.workspace,
    ...(options.json !== undefined ? { json: options.json } : {})
  }, config);

  if (options.json) {
    // The JSON was already printed by runScan
    return (syncCode === 0 && scanCode === 0) ? 0 : 1;
  }

  if (syncCode === 0 && scanCode === 0) {
    console.log(pc.green("\n✔ Environment contract is healthy."));
    return 0;
  }

  console.error(pc.red("\n✖ Environment contract check failed."));
  console.error(pc.yellow("👉 Suggestion: Fix this by running 'npx env-contract sync' locally and committing the result."));
  return 1;
}
