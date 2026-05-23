import pc from "picocolors";
import { runSync } from "./sync.js";
import { runScan } from "./scan.js";
import type { Config } from "../config.js";

export async function runCheck(options: { strict?: boolean; json?: boolean; workspace?: boolean; cwd?: string; schema?: string }, config: Config = {}): Promise<{ code: number }> {
  if (!options.json) {
    console.log(pc.cyan("Running environment contract check..."));
  }

  // 1. Check sync drift
  const { code: syncCode, data: syncData } = await runSync({ 
    ...options,
    check: true, 
    silent: !!options.json 
  }, config);
  
  // 2. Check scan drift
  const { code: scanCode, data: scanData } = await runScan({ 
    ...options,
    strict: options.strict,
    json: options.json,
    silent: !!options.json,
    _internal: true
  }, config);

  if (options.json) {
    let combined: any;
    if (options.workspace) {
      combined = (Array.isArray(scanData) ? scanData : []).map(scanPkg => {
        const syncPkg = (Array.isArray(syncData) ? syncData : []).find(s => s.package === scanPkg.package);
        return {
          ...scanPkg,
          syncDrift: syncPkg ? syncPkg.syncDrift : false
        };
      });
    } else {
      combined = {
        ...(scanData || {}),
        syncDrift: syncData?.syncDrift || false
      };
    }
    console.log(JSON.stringify(combined, null, 2));
    
    if (syncCode === 2 || scanCode === 2) return { code: 2 };
    return { code: (syncCode === 0 && scanCode === 0) ? 0 : 1 };
  }

  if (syncCode === 2 || scanCode === 2) {
    return { code: 2 };
  }

  if (syncCode === 0 && scanCode === 0) {
    console.log(pc.green("\n✔ Environment contract is healthy."));
    return { code: 0 };
  }

  console.error(pc.red("\n✖ Environment contract check failed."));
  console.error(pc.yellow("👉 Suggestion: Fix this by running 'npx env-contract sync' locally and committing the result."));
  return { code: 1 };
}
