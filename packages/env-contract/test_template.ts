import { scanSource } from "./src/core/scan-source.js";
import fs from "node:fs/promises";

async function test() {
  await fs.mkdir("test-scan", { recursive: true });
  await fs.writeFile("test-scan/test.ts", "const url = `API: ${process.env.API_URL}/users`;");
  
  const report = await scanSource("test-scan");
  console.log("Report:", JSON.stringify(report, null, 2));

  await fs.rm("test-scan", { recursive: true, force: true });
}

test();
