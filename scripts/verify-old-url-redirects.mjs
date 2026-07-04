import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const routeUtilPath = path.join(repoRoot, "utils", "domainWarRoutes.ts");

async function importRouteUtils() {
  const source = await readFile(routeUtilPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

async function main() {
  const { getLegacyDomainWarRedirect, withLocalePrefix } = await importRouteUtils();
  const cases = [
    { slug: ["domain-ch1", "0"], expected: "/play/domain-war?at=ch1_scene0" },
    { slug: ["domain-ch4", "4"], expected: "/play/domain-war?at=ch4_scene4" },
    { slug: ["domain-ch9", "2"], expected: "/play/domain-war?at=ch9_scene2" },
    { slug: ["domain-ch10", "0"], expected: null },
    { slug: ["domain-ch1", "6"], expected: null },
    { slug: ["not-domain", "0"], expected: null },
  ];

  let failures = 0;
  for (const item of cases) {
    const actual = getLegacyDomainWarRedirect(item.slug);
    if (actual !== item.expected) {
      failures += 1;
      console.error(`${item.slug.join("/")}: expected ${item.expected}, got ${actual}`);
    }
  }
  const localized = withLocalePrefix("/play/domain-war?at=ch9_scene2", "en", "ko");
  if (localized !== "/en/play/domain-war?at=ch9_scene2") {
    failures += 1;
    console.error(`locale redirect: expected /en/play/domain-war?at=ch9_scene2, got ${localized}`);
  }
  if (failures > 0) process.exit(1);
  console.log(`old-url redirects ok: ${cases.length + 1} cases`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
