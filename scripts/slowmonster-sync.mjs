#!/usr/bin/env node
// slowmonster-sync — extract a repo's public "vitals" for slow.monster.
//
// Runs inside a source repo (cwd = repo root) and prints a JSON document of
// git-derived, non-sensitive vitals: HEAD, latest commit subject, last-seen
// date, commit/file counts, a weekly commit pulse, and a language mix.
//
// It reveals NO source except what the disclose allowlist names. Aggregate git
// metadata always leaves; file CONTENT leaves only for paths listed in
// `disclose`, read from the HEAD commit (never the working tree), size-capped.
// slow.monster merges this (as `extracted`) under a hand-authored overrides
// layer, so nothing here can clobber a curated value.
//
// Config (env or a repo-local .slowmonster.json { id, repo, branch, disclose }):
//   SM_ID       stable specimen id (e.g. "lena")            [required]
//   SM_REPO     display slug (e.g. "studiohaze/lena")       [required]
//   SM_NOW      ISO date to anchor age/pulse (default: today)
//   SM_DISCLOSE comma-separated allowlist override (else cfg.disclose: [])
// Usage: node slowmonster-sync.mjs [--repo <path>] [--out <file>]

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { TextDecoder } from "node:util";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const cwd = opt("--repo") || process.cwd();
const out = opt("--out");

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim();
  } catch {
    return fallback;
  }
}

function gitRaw(args) {
  try {
    return execFileSync("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

function utf8Prefix(s, maxBytes) {
  let end = 0, used = 0;
  for (const ch of s) {
    const n = Buffer.byteLength(ch);
    if (used + n > maxBytes) break;
    used += n;
    end += ch.length;
  }
  return s.slice(0, end);
}

// config: env overrides a repo-local .slowmonster.json
let cfg = {};
try {
  const configPath = join(cwd, ".slowmonster.json");
  if (existsSync(configPath)) cfg = JSON.parse(readFileSync(configPath, "utf8"));
} catch {}
const id = process.env.SM_ID || cfg.id;
const repo = process.env.SM_REPO || cfg.repo;
if (!id || !repo) { console.error("slowmonster-sync: SM_ID and SM_REPO are required"); process.exit(2); }
const nowText = process.env.SM_NOW || cfg.now || new Date().toISOString().slice(0, 10);
const now = new Date(/^\d{4}-\d{2}-\d{2}$/.test(nowText) ? `${nowText}T00:00:00Z` : nowText);
if (Number.isNaN(now.getTime())) {
  console.error(`slowmonster-sync: invalid SM_NOW date: ${nowText}`);
  process.exit(2);
}

const WEEK = 604800; // seconds
const WEEKS = 14;

// commit timestamps (unix) newest-first
const stamps = git(["log", "--format=%ct"]).split("\n").filter(Boolean).map(Number).filter(Number.isFinite);
const nowSec = Math.floor(now.getTime() / 1000);
const pulse = new Array(WEEKS).fill(0);
for (const t of stamps) {
  const w = Math.floor((nowSec - t) / WEEK);
  if (w >= 0 && w < WEEKS) pulse[WEEKS - 1 - w]++; // oldest -> newest
}

const firstDate = git(["log", "--reverse", "--format=%cs"]).split("\n")[0] || "";
const lastCs = git(["log", "-1", "--format=%cs"]);
const ageMonths = firstDate
  ? Math.max(0, (now.getFullYear() - +firstDate.slice(0, 4)) * 12 + (now.getMonth() + 1 - +firstDate.slice(5, 7)))
  : 0;

const dot = (s) => s.replace(/-/g, "\u00b7"); // 2026-06-29 -> 2026·06·29

// language mix by tracked-file extension
const EXT = { ts: "TypeScript", tsx: "TSX", js: "JavaScript", mjs: "ESM", rs: "Rust", tpz: "Topaz",
  py: "Python", go: "Go", md: "Markdown", mdx: "MDX", json: "JSON", toml: "TOML", html: "HTML",
  css: "CSS", scss: "SCSS", svg: "SVG", png: "Assets", jpg: "Assets", webp: "Assets", sql: "SQL",
  lena: "Lena", lspx: "Lispex", lisp: "Lisp" };
const files = git(["ls-files"]).split("\n").filter(Boolean);
const langCount = {};
for (const f of files) {
  const m = f.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) continue;
  const name = EXT[m[1]];
  if (name) langCount[name] = (langCount[name] || 0) + 1;
}
const langs = Object.entries(langCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
  .map(([name, n]) => ({ name, files: n }));

// disclosed files: allowlisted paths published verbatim, read at HEAD (never
// the working tree) so the content matches the receipt's headHash exactly
const PER_FILE_CAP = 16 * 1024, TOTAL_CAP = 48 * 1024, MAX_FILES = 12;
const discloseList = (process.env.SM_DISCLOSE
  ? process.env.SM_DISCLOSE.split(",")
  : Array.isArray(cfg.disclose) ? cfg.disclose : [])
  .map((s) => String(s).trim()).filter(Boolean).slice(0, MAX_FILES);
const tracked = new Set(files);
const disclosed = [];
let totalBytes = 0;
const utf8 = new TextDecoder("utf-8", { fatal: true });
for (const rel of discloseList) {
  if (!/^[A-Za-z0-9._/-]{1,120}$/.test(rel) || rel.includes("..") || !tracked.has(rel)) continue;
  const raw = gitRaw(["show", `HEAD:${rel}`]);
  if (!raw || raw.includes(0)) continue; // missing, empty, or binary
  const bytes = raw.length;
  let content;
  try { content = utf8.decode(raw); } catch { continue; }
  let truncated = false;
  if (bytes > PER_FILE_CAP) { content = utf8Prefix(content, PER_FILE_CAP); truncated = true; }
  if (totalBytes + Buffer.byteLength(content) > TOTAL_CAP) break;
  totalBytes += Buffer.byteLength(content);
  disclosed.push({ path: rel, bytes, truncated, content });
}

const data = {
  id,
  repo,
  branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
  headHash: git(["rev-parse", "--short", "HEAD"]),
  lastSubject: git(["log", "-1", "--format=%s"]),
  lastSeen: dot(lastCs),
  firstDate,
  ageMonths,
  commits: Number(git(["rev-list", "--count", "HEAD"], "0")) || 0,
  files: files.length,
  custodians: new Set(git(["log", "--format=%an"]).split("\n").filter(Boolean)).size,
  pulse,
  langs,
  updatedAt: dot(now.toISOString().slice(0, 10)),
};
if (disclosed.length) data.disclosed = disclosed;

const json = JSON.stringify(data, null, 2);
if (out) { writeFileSync(out, json + "\n"); console.error(`slowmonster-sync: wrote ${out}`); }
else console.log(json);
