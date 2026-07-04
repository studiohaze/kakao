import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import init, { run_with_modules } from "../public/topaz/topaz_wasm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const appRoot = path.join(repoRoot, "games", "domain-war");
const gameContentRoot = path.join(repoRoot, "data", "gameContent");
const fixturesRoot = path.join(repoRoot, "fixtures", "domain-war-golden");
const fixturePath = path.join(fixturesRoot, "all-reachable-edges.txt");
const wasmPath = path.join(repoRoot, "public", "topaz", "topaz_wasm_bg.wasm");

const mode = process.argv[2] || "verify";
if (mode !== "record" && mode !== "verify") {
  console.error("Usage: node scripts/domain-war-replay.mjs <record|verify>");
  process.exit(2);
}

function sceneId(chapter, scene) {
  return `ch${chapter}_scene${scene}`;
}

function parseSceneId(id) {
  const match = /^ch(\d+)_scene(\d+)$/.exec(id);
  if (!match) throw new Error(`Invalid scene id: ${id}`);
  return { chapter: Number(match[1]), scene: Number(match[2]) };
}

function resolveOldTarget(chapter, oldNext, chapterNumbers) {
  if (oldNext === 999) {
    const nextChapter = chapter + 1;
    return chapterNumbers.includes(nextChapter) ? sceneId(nextChapter, 0) : sceneId(1, 0);
  }
  if ((chapter === 4 || chapter === 9) && oldNext === 0) return sceneId(1, 0);
  return sceneId(chapter, oldNext);
}

async function loadGraph() {
  const chapters = new Map();
  for (let chapter = 1; chapter <= 9; chapter += 1) {
    const file = path.join(gameContentRoot, `domain-ch${chapter}.json`);
    chapters.set(chapter, JSON.parse(await readFile(file, "utf8")));
  }
  const chapterNumbers = [...chapters.keys()];
  const graph = new Map();
  for (const chapter of chapterNumbers) {
    const scenes = chapters.get(chapter);
    scenes.forEach((scene, sceneIndex) => {
      graph.set(sceneId(chapter, sceneIndex), {
        id: sceneId(chapter, sceneIndex),
        choices: (scene.choices || []).map((choice, index) => {
          const oldNext = Number(choice.next);
          return {
            index,
            event: `choice_${index}`,
            oldNext,
            target: choice.target ?? resolveOldTarget(chapter, oldNext, chapterNumbers),
          };
        }),
      });
    });
  }
  return graph;
}

async function loadModules() {
  const manifest = JSON.parse(await readFile(path.join(appRoot, "modules.json"), "utf8"));
  const sources = {};
  for (const file of manifest.files) {
    sources[file] = await readFile(path.join(appRoot, file), "utf8");
  }
  const ordered = {};
  for (const file of manifest.files) ordered[file] = sources[file];
  return {
    entry: manifest.entry,
    root: manifest.root || "",
    sourcesJson: JSON.stringify(ordered),
  };
}

function shortestPaths(graph) {
  const start = "ch1_scene0";
  const paths = new Map([[start, []]]);
  const queue = [start];
  while (queue.length) {
    const id = queue.shift();
    const scene = graph.get(id);
    if (!scene) continue;
    const prefix = paths.get(id);
    for (const choice of scene.choices) {
      if (!paths.has(choice.target)) {
        paths.set(choice.target, [...prefix, choice.event]);
        queue.push(choice.target);
      }
    }
  }
  return paths;
}

function buildScenarios(graph) {
  const paths = shortestPaths(graph);
  const scenarios = [
    { name: "restart packet", events: [{ event: "restart" }] },
    { name: "back on empty path", events: [{ event: "restart" }, { event: "back" }] },
    { name: "deep link render ch7_scene2", events: [{ event: "back", state: "v1:ch7_scene2:" }] },
    {
      name: "choice stack and back",
      events: [{ event: "restart" }, { event: "choice_0" }, { event: "choice_1" }, { event: "back" }],
    },
  ];
  const edgeKeys = new Set();
  for (const [from, scene] of graph) {
    const prefix = paths.get(from);
    if (!prefix) continue;
    for (const choice of scene.choices) {
      edgeKeys.add(`${from}#${choice.index}`);
      scenarios.push({
        name: `edge ${from} choice_${choice.index} to ${choice.target}`,
        edge: { from, index: choice.index, to: choice.target },
        events: [{ event: "restart" }, ...prefix.map((event) => ({ event })), { event: choice.event }],
      });
    }
  }
  return { scenarios, coveredEdges: edgeKeys.size };
}

function packet(state, eventName) {
  return `DW1\nSTATE:${state}\nEVENT:${eventName}`;
}

function stateFromOutput(output) {
  for (const line of output.split("\n")) {
    if (line.startsWith("STATE:")) return line.slice("STATE:".length);
  }
  throw new Error("Output packet has no STATE line");
}

function stepHeader(index, spec) {
  const stateTag = spec.state ? ` state=${spec.state}` : "";
  return `>>> step ${index} event=${spec.event}${stateTag}`;
}

async function runScenario(modules, scenario) {
  let state = "";
  const lines = [`>>> scenario ${scenario.name}`];
  for (let index = 0; index < scenario.events.length; index += 1) {
    const spec = scenario.events[index];
    const inputState = typeof spec.state === "string" ? spec.state : state;
    const raw = run_with_modules(modules.entry, modules.root, modules.sourcesJson, packet(inputState, spec.event));
    const result = JSON.parse(raw);
    if (result.ok === false) {
      const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics.join("\n") : raw;
      throw new Error(`${scenario.name} step ${index} failed:\n${diagnostics}`);
    }
    const output = result.output || "";
    state = stateFromOutput(output);
    lines.push(stepHeader(index, spec));
    lines.push(output);
    lines.push(`<<< step ${index}`);
  }
  lines.push(`<<< scenario ${scenario.name}`);
  return lines.join("\n");
}

async function buildReplay() {
  const graph = await loadGraph();
  const modules = await loadModules();
  const { scenarios, coveredEdges } = buildScenarios(graph);
  const chunks = [
    "# domain-war golden replay",
    `# scenarios: ${scenarios.length}`,
    `# reachable edges covered: ${coveredEdges}`,
  ];
  for (const scenario of scenarios) {
    chunks.push(await runScenario(modules, scenario));
  }
  return `${chunks.join("\n")}\n`;
}

function firstDiffLine(expected, actual) {
  const a = expected.split("\n");
  const b = actual.split("\n");
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    if (a[i] !== b[i]) {
      return {
        line: i + 1,
        expected: a[i] === undefined ? "<missing>" : a[i],
        actual: b[i] === undefined ? "<missing>" : b[i],
      };
    }
  }
  return null;
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

async function main() {
  await init({ module_or_path: await readFile(wasmPath) });
  const actual = await buildReplay();
  if (mode === "record") {
    await mkdir(fixturesRoot, { recursive: true });
    await writeFile(fixturePath, actual, "utf8");
    console.log(`recorded domain-war golden replay: ${fixturePath}`);
    return;
  }
  const expected = await readFile(fixturePath, "utf8");
  const normalizedExpected = normalizeLineEndings(expected);
  const normalizedActual = normalizeLineEndings(actual);
  if (normalizedExpected !== normalizedActual) {
    const diff = firstDiffLine(normalizedExpected, normalizedActual);
    console.error(`domain-war replay diff at line ${diff.line}`);
    console.error(`expected: ${diff.expected}`);
    console.error(`actual:   ${diff.actual}`);
    process.exit(1);
  }
  const edgeLine = normalizedActual.split("\n").find((line) => line.startsWith("# reachable edges covered:")) || "";
  console.log(`domain-war replay ok: ${edgeLine.replace("# ", "")}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
