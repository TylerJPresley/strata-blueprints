#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Strata Blueprints tool: condense a stack (leave out each topic whose whole body is None.).
// usage: node strata-blueprints.mjs condense <file.md or folder> --out <path> [--force]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MARKER = "<!-- strata-blueprints: condensed (generated; omitted topics read None.) -->";
const MARKER_PREFIX = "<!-- strata-blueprints: condensed";
export const NAMES = ["Vision", "Structure", "Detail"];
export const TOPICS = {
  1: ["Need", "Target audience", "Value", "Focus", "Success measures", "Qualities and constraints", "Vocabulary", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  2: ["Parts", "Standing", "Seams between parts", "Seams with the outside", "Shared things", "Scenario paths", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  3: ["Responsibility", "Concepts and states", "Seams", "Rules", "Inside", "Limits", "Construction", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
};
const USAGE = "usage: node strata-blueprints.mjs condense <file.md or folder> --out <path> [--force]";

const hasMarker = (line) => (line || "").trim().startsWith(MARKER_PREFIX);

// Split text into lines without line endings, and remember the line ending to write back.
function split(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return { lines, eol };
}
const join = (lines, eol) => lines.join(eol) + eol;
const isBlank = (s) => s.trim() === "";

// Read the structure the lint reads: layers, units (a layer, or a Layer 3 part entry) and topic blocks.
function scan(lines) {
  const heads = [];
  let fence = null;
  lines.forEach((line, i) => {
    const t = line.trim();
    const f = t.match(/^(```|~~~)/);
    if (fence) { if (t.startsWith(fence) && t.slice(3).trim() === "") fence = null; return; }
    if (f) { fence = f[1]; return; }
    const h = t.match(/^(#{1,6}) /);
    if (h) heads.push({ i, level: h[1].length, t });
  });
  const endOf = (k, maxLevel) => {
    for (let j = k + 1; j < heads.length; j++) if (heads[j].level <= maxLevel) return heads[j].i;
    return lines.length;
  };
  const layers = [];
  let layer = null, entry = null;
  heads.forEach((h, k) => {
    if (h.level === 2) {
      entry = null; layer = null;
      const m = h.t.slice(3).match(/^Layer (\d+): (.+)$/);
      if (m && +m[1] >= 1 && +m[1] <= 3 && NAMES[m[1] - 1] === m[2].trim()) {
        layer = { n: +m[1], i: h.i, end: endOf(k, 2), bare: { topics: [] }, entries: [] };
        layers.push(layer);
      }
      return;
    }
    if (!layer) return;
    const topic = (re, unit, level) => {
      const m = h.t.match(re);
      if (!m) return false;
      const idx = TOPICS[layer.n].indexOf(m[2]);
      if (idx < 0) return false;
      unit.topics.push({ i: h.i, end: endOf(k, level), idx, name: m[2] });
      return true;
    };
    if (h.level === 3) {
      const part = h.t.match(/^### (.+?) \(part\)\s*$/);
      if (layer.n === 3 && part) {
        entry = { i: h.i, end: endOf(k, 3), topics: [] };
        layer.entries.push(entry);
      } else {
        entry = null;
        topic(/^### (\d+)\. (.+?)\s*$/, layer.bare, 3);
      }
    } else if (h.level === 4 && layer.n === 3 && entry) {
      topic(/^#### (\d+)\. (.+?)\s*$/, entry, 4);
    }
  });
  return layers;
}

const bodyIsNone = (lines, t) => {
  const body = lines.slice(t.i + 1, t.end).filter((l) => !isBlank(l));
  return body.length === 1 && body[0].trim() === "None.";
};

// condense: returns { text, count }.
export function condenseResult(text) {
  const { lines: raw, eol } = split(text);
  let lines = raw;
  if (hasMarker(lines[0])) lines = lines.slice(lines.length > 1 && isBlank(lines[1]) ? 2 : 1);
  const layers = scan(lines);
  if (!layers.length) throw new Error("no layer heading found");
  const drop = new Set();
  let count = 0;
  for (const layer of layers) {
    const units = layer.n === 3 ? (layer.entries.length ? layer.entries : [layer.bare]) : [layer.bare];
    for (const u of units) for (const t of u.topics) {
      if (!bodyIsNone(lines, t)) continue;
      count++;
      for (let i = t.i; i < t.end; i++) drop.add(i);
    }
  }
  const kept = lines.filter((_, i) => !drop.has(i));
  while (kept.length && isBlank(kept.at(-1))) kept.pop();
  return { text: join([MARKER, "", ...kept], eol), count };
}
export const condenseText = (text) => condenseResult(text).text;

// --- command line -------------------------------------------------------------
class Refuse extends Error {}
const die = (msg) => { throw new Refuse(msg); };

// The real path of p, resolving symlinks in the nearest existing parent.
function realish(p) {
  let cur = path.resolve(p);
  const rest = [];
  for (;;) {
    try { return path.join(fs.realpathSync(cur), ...rest.reverse()); } catch {
      const up = path.dirname(cur);
      if (up === cur) return path.resolve(p);
      rest.push(path.basename(cur)); cur = up;
    }
  }
}
const lstat = (p) => { try { return fs.lstatSync(p); } catch { return null; } };
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);

export function run(argv, log = console.log) {
  const [cmd, ...rest] = argv;
  if (cmd !== "condense") die(`unknown subcommand: ${cmd}`);
  let out = null, force = false;
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--out") { if (i + 1 >= rest.length) die("--out needs a path"); out = rest[++i]; }
    else if (a === "--force") force = true;
    else if (a.startsWith("--")) die(`unknown option: ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 1) die(pos.length ? "give one file or folder" : `${cmd} needs a file or a folder`);
  if (out === null) die(`${cmd} needs --out <path>`);
  const input = pos[0];
  const st = fs.existsSync(input) ? fs.statSync(input) : die(`no such file: ${input}`);
  const isDir = st.isDirectory();
  if (!isDir && !st.isFile()) die(`not a file: ${input}`);

  // Safety: the source is never written.
  const rin = realish(input), rout = realish(out);
  if (rout === rin || (isDir && inside(rout, rin)) || inside(rin, rout)) die(`--out ${out} overlaps the input ${input}`);
  const ost = lstat(out);
  if (ost && ost.isSymbolicLink()) die(`--out ${out} is a symlink`);
  if (isDir && ost && !ost.isDirectory()) die(`--out ${out} is a file; give a folder for a folder input`);
  if (!isDir && ost && ost.isDirectory()) die(`--out ${out} is a folder; give a file path for a file input`);

  // Read everything and compute every result before the first write.
  const jobs = [];
  const files = [];
  if (isDir) {
    const isFile = (n) => { try { return fs.statSync(path.join(input, n)).isFile(); } catch { return false; } };
    const all = fs.readdirSync(input).filter(isFile);
    const names = [];
    if (all.includes("sbp-vision.md")) names.push("sbp-vision.md");
    if (all.includes("sbp-structure.md")) names.push("sbp-structure.md");
    names.push(...all.filter((n) => /^sbp-detail-.+\.md$/.test(n)).sort());
    if (!names.length) die(`no sbp-vision.md, sbp-structure.md or sbp-detail-*.md in ${input}`);
    for (const n of names) files.push({ src: path.join(input, n), dest: path.join(out, n) });
  } else files.push({ src: input, dest: out });
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f.src, "utf8"); } catch (e) { die(`cannot read ${f.src}: ${e.code || e.message}`); }
    let r;
    try { r = condenseResult(text); } catch (e) { die(`${f.src}: ${e.message}`); }
    const dst = lstat(f.dest);
    if (dst) {
      if (dst.isSymbolicLink()) die(`${f.dest} is a symlink`);
      if (!dst.isFile()) die(`${f.dest} is not a file`);
      if (!force) {
        let first = "";
        try { first = fs.readFileSync(f.dest, "utf8").split(/\r?\n/, 1)[0]; } catch (e) { die(`cannot read ${f.dest}: ${e.code || e.message}`); }
        if (!hasMarker(first)) die(`${f.dest} exists and is not a condensed copy; use --force to overwrite it`);
      }
    }
    jobs.push({ ...f, r });
  }
  if (isDir) fs.mkdirSync(out, { recursive: true });
  else fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  for (const j of jobs) {
    fs.writeFileSync(j.dest, j.r.text);
    log(`condensed ${j.dest}: dropped ${j.r.count} topic(s)`);
  }
}

export function main(argv) {
  if (!argv.length) { console.log(USAGE); return 0; }
  try { run(argv); return 0; } catch (e) {
    if (!(e instanceof Refuse)) throw e;
    console.error(`strata-blueprints: ${e.message}`);
    return 2;
  }
}

const entry = (() => { try { return pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return null; } })();
if (import.meta.url === entry) process.exitCode = main(process.argv.slice(2));
