import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const gameContentRoot = path.join(repoRoot, "data", "gameContent");
const topazScenesPath = path.join(repoRoot, "games", "domain-war", "data", "scenes.tpz");

function sceneId(chapter, scene) {
  return `ch${chapter}_scene${scene}`;
}

function textKey(chapter, scene) {
  return `domainCh${chapter}_scene${scene}_text`;
}

function choiceKey(chapter, scene, choice) {
  return `domainCh${chapter}_scene${scene}_choice${choice}_text`;
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

async function loadOldGraph() {
  const files = (await readdir(gameContentRoot))
    .filter((file) => /^domain-ch\d+\.json$/.test(file))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  const chapters = new Map();
  for (const file of files) {
    const chapter = Number(file.match(/domain-ch(\d+)\.json/)[1]);
    const scenes = JSON.parse(await readFile(path.join(gameContentRoot, file), "utf8"));
    chapters.set(chapter, scenes);
  }
  return chapters;
}

function parseTopazGraph(source) {
  const scenes = new Map();
  const sceneRe = /case "([^"]+)" => 장면만들기\("([^"]+)", "([^"]+)", \[([\s\S]*?)\]\)/g;
  let sceneMatch;
  while ((sceneMatch = sceneRe.exec(source)) !== null) {
    const [, caseId, recordId, sceneTextKey, choicesBlock] = sceneMatch;
    const choices = [];
    const choiceRe = /선택\("([^"]+)", "([^"]+)", (-?\d+)\)/g;
    let choiceMatch;
    while ((choiceMatch = choiceRe.exec(choicesBlock)) !== null) {
      choices.push({
        textKey: choiceMatch[1],
        target: choiceMatch[2],
        oldNext: Number(choiceMatch[3]),
      });
    }
    scenes.set(caseId, {
      id: recordId,
      textKey: sceneTextKey,
      choices,
    });
  }
  return scenes;
}

function buildExpectedGraph(oldGraph) {
  const chapterNumbers = [...oldGraph.keys()].sort((a, b) => a - b);
  const expected = new Map();
  for (const chapter of chapterNumbers) {
    const scenes = oldGraph.get(chapter);
    scenes.forEach((scene, sceneIndex) => {
      const id = sceneId(chapter, sceneIndex);
      expected.set(id, {
        id,
        textKey: textKey(chapter, sceneIndex),
        choices: (scene.choices || []).map((choice, choiceIndex) => {
          const oldNext = Number(choice.next);
          return {
            textKey: choiceKey(chapter, sceneIndex, choiceIndex),
            target: choice.target ?? resolveOldTarget(chapter, oldNext, chapterNumbers),
            oldNext,
          };
        }),
      });
    });
  }
  return expected;
}

function compareGraphs(expected, actual) {
  const errors = [];
  for (const [id, expectedScene] of expected) {
    const actualScene = actual.get(id);
    if (!actualScene) {
      errors.push(`missing Topaz scene ${id}`);
      continue;
    }
    if (actualScene.id !== expectedScene.id) errors.push(`${id}: record id ${actualScene.id} != ${expectedScene.id}`);
    if (actualScene.textKey !== expectedScene.textKey) errors.push(`${id}: text key ${actualScene.textKey} != ${expectedScene.textKey}`);
    if (actualScene.choices.length !== expectedScene.choices.length) {
      errors.push(`${id}: choice count ${actualScene.choices.length} != ${expectedScene.choices.length}`);
      continue;
    }
    expectedScene.choices.forEach((expectedChoice, index) => {
      const actualChoice = actualScene.choices[index];
      if (actualChoice.textKey !== expectedChoice.textKey) {
        errors.push(`${id} choice ${index}: text key ${actualChoice.textKey} != ${expectedChoice.textKey}`);
      }
      if (actualChoice.oldNext !== expectedChoice.oldNext) {
        errors.push(`${id} choice ${index}: oldNext ${actualChoice.oldNext} != ${expectedChoice.oldNext}`);
      }
      if (actualChoice.target !== expectedChoice.target) {
        errors.push(`${id} choice ${index}: target ${actualChoice.target} != ${expectedChoice.target}`);
      }
    });
  }
  for (const id of actual.keys()) {
    if (!expected.has(id)) errors.push(`extra Topaz scene ${id}`);
  }
  return errors;
}

function graphReport(expected) {
  const sceneIds = [...expected.keys()];
  const edges = [];
  const dangling = [];
  for (const [id, scene] of expected) {
    const { chapter } = parseSceneId(id);
    scene.choices.forEach((choice, index) => {
      edges.push({ from: id, index, to: choice.target, oldNext: choice.oldNext });
      if (!expected.has(choice.target)) dangling.push(`${id} choice ${index} -> ${choice.target}`);
      if (choice.oldNext === 999) return;
      if ((chapter === 4 || chapter === 9) && choice.oldNext === 0) return;
      if (!expected.has(choice.target)) dangling.push(`${id} choice ${index} old next ${choice.oldNext}`);
    });
  }

  const reachable = new Set(["ch1_scene0"]);
  const queue = ["ch1_scene0"];
  while (queue.length) {
    const id = queue.shift();
    const scene = expected.get(id);
    if (!scene) continue;
    for (const choice of scene.choices) {
      if (!reachable.has(choice.target)) {
        reachable.add(choice.target);
        queue.push(choice.target);
      }
    }
  }
  const dead = sceneIds.filter((id) => !reachable.has(id));
  const restartEdges = edges.filter((edge) => edge.to === "ch1_scene0" && edge.from !== "ch1_scene0");
  return { sceneCount: sceneIds.length, edgeCount: edges.length, dangling, dead, restartEdges };
}

async function main() {
  const oldGraph = await loadOldGraph();
  const expected = buildExpectedGraph(oldGraph);
  const actual = parseTopazGraph(await readFile(topazScenesPath, "utf8"));
  const errors = compareGraphs(expected, actual);
  const report = graphReport(expected);

  if (errors.length > 0) {
    console.error("Scene parity failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  if (report.dangling.length > 0) {
    console.error("Dangling scene edges:");
    for (const item of report.dangling) console.error(`- ${item}`);
    process.exit(1);
  }

  console.log(`scene parity ok: ${report.sceneCount} scenes, ${report.edgeCount} choices`);
  console.log(`dead scenes: ${report.dead.length ? report.dead.join(", ") : "none"}`);
  console.log(
    `restart edges: ${
      report.restartEdges.length
        ? report.restartEdges.map((edge) => `${edge.from}/choice_${edge.index}`).join(", ")
        : "none"
    }`
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
