import readline from "node:readline/promises";

export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`${message} `);
    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
  } finally {
    rl.close();
  }
}
