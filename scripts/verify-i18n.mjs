import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const requiredShellKeys = [
  "pageTitle",
  "pageDescription",
  "domainWar_title",
  "domainWar_description",
  "arcade_loading",
  "arcade_back",
  "arcade_restart",
  "arcade_sourceOpen",
  "arcade_sourceClose",
  "arcade_sourceFile",
  "kakao_disclaimer",
  "playDomainWarsButton",
];

function collectTopazTextKeys(source) {
  const keys = new Set();
  const keyRe = /"((?:domainCh\d+_scene\d+_(?:text|choice\d+_text)))"/g;
  let match;
  while ((match = keyRe.exec(source)) !== null) keys.add(match[1]);
  return [...keys].sort();
}

async function main() {
  const scenesSource = await readFile(path.join(repoRoot, "games", "domain-war", "data", "scenes.tpz"), "utf8");
  const keys = [...new Set([...requiredShellKeys, ...collectTopazTextKeys(scenesSource)])].sort();
  const locales = ["ko", "en"];
  let failures = 0;
  for (const locale of locales) {
    const filePath = path.join(repoRoot, "public", "locales", locale, "common.json");
    const messages = JSON.parse(await readFile(filePath, "utf8"));
    const missing = keys.filter((key) => typeof messages[key] !== "string" || messages[key] === "");
    if (missing.length > 0) {
      failures += 1;
      console.error(`${locale} missing ${missing.length} keys:`);
      for (const key of missing) console.error(`- ${key}`);
    } else {
      console.log(`${locale} i18n ok: ${keys.length} keys`);
    }
  }
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
