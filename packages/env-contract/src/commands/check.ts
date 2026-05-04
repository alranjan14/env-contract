import pc from "picocolors";
import { runSync } from "./sync.js";
import { runScan } from "./scan.js";
import type { Config } from "../config.js";

export async function runCheck(options: {}, config: Config = {}) {
  console.log(pc.cyan("Running environment contract check..."));

  // 1. Check sync drift
  const syncCode = await runSync({ check: true }, config);
  
  // 2. Check scan drift
  const scanCode = await runScan({ strict: true }, config);

  if (syncCode === 0 && scanCode === 0) {
    console.log(pc.green("\n✔ Environment contract is healthy."));
    return 0;
  }

  console.error(pc.red("\n✖ Environment contract check failed."));
  return 1;
}
