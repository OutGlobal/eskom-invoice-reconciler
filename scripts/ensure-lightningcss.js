import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

if (process.platform === "darwin" && process.arch === "x64") {
  const binaryName = "lightningcss.darwin-x64.node";
  const sourcePkgDir = path.join(projectRoot, "node_modules", "@tailwindcss", "node", "node_modules", "lightningcss-darwin-x64");
  const topPkgDir = path.join(projectRoot, "node_modules", "lightningcss-darwin-x64");

  if (fs.existsSync(sourcePkgDir) && !fs.existsSync(topPkgDir)) {
    try {
      fs.symlinkSync("@tailwindcss/node/node_modules/lightningcss-darwin-x64", topPkgDir);
      console.log(`Linked top-level lightningcss-darwin-x64 package directory`);
    } catch {
      // ignore
    }
  }

  const targetDir1 = path.join(projectRoot, "node_modules", "@tailwindcss", "node", "node_modules", "lightningcss");
  const targetDir2 = path.join(projectRoot, "node_modules", "lightningcss");

  for (const targetDir of [targetDir1, targetDir2]) {
    if (fs.existsSync(targetDir)) {
      const targetFile = path.join(targetDir, binaryName);
      if (!fs.existsSync(targetFile)) {
        try {
          fs.symlinkSync("../lightningcss-darwin-x64/" + binaryName, targetFile);
          console.log(`Linked ${binaryName} in ${path.relative(projectRoot, targetDir)}`);
        } catch {
          // ignore
        }
      }
    }
  }
}
