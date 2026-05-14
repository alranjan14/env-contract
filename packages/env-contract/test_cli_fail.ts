import { execSync } from "child_process";
import path from "path";

const cliPath = path.resolve("dist/cli.js");
const wsDir = path.resolve("tmp-e2e/workspace");

try {
  execSync(`node ${cliPath} sync --workspace --yes`, { cwd: wsDir });
} catch (e: any) {
  console.log("STDOUT:", e.stdout?.toString());
  console.log("STDERR:", e.stderr?.toString());
  console.error("FAILED");
}
