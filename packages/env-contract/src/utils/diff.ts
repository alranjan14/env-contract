import pc from "picocolors";

export function showDiff(oldContent: string, newContent: string) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  let i = 0;
  let j = 0;

  console.log("");
  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++;
      j++;
    } else {
      let matchI = -1;
      let matchJ = -1;
      
      // Lookahead window to re-sync
      for (let offset = 1; offset < 20; offset++) {
        if (i + offset < oldLines.length && j < newLines.length && oldLines[i + offset] === newLines[j]) {
          matchI = i + offset;
          matchJ = j;
          break;
        }
        if (j + offset < newLines.length && i < oldLines.length && oldLines[i] === newLines[j + offset]) {
          matchI = i;
          matchJ = j + offset;
          break;
        }
      }

      if (matchI !== -1 && matchJ !== -1) {
        while (i < matchI) console.log(pc.red(`- ${oldLines[i++]}`));
        while (j < matchJ) console.log(pc.green(`+ ${newLines[j++]}`));
      } else {
        if (i < oldLines.length) console.log(pc.red(`- ${oldLines[i++]}`));
        if (j < newLines.length) console.log(pc.green(`+ ${newLines[j++]}`));
      }
    }
  }
  console.log("");
}
