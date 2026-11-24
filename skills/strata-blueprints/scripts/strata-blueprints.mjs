#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Strata Blueprints tool: condense a stack (leave out each topic whose whole body is None.), or publish it as one document.
// usage: node strata-blueprints.mjs condense <file.md or folder> --out <path> [--force]
//        node strata-blueprints.mjs publish <file.md or folder> --out <file> [--force]
//        node strata-blueprints.mjs delete <id> <file.md or folder> [--apply] [--ack <handle>[,<handle>...]]
//        node strata-blueprints.mjs insert <id> <file.md or folder> [--text <text> | --text-file <path> | --needs <text>] [--apply]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MARKER = "<!-- strata-blueprints: condensed (generated; omitted topics read None.) -->";
export const PUBLISHED_MARKER = "<!-- strata-blueprints: condensed, published (generated; each omitted topic read None. or held only open questions) -->";
const MARKER_PREFIX = "<!-- strata-blueprints: condensed";
const PUBLISHED_PREFIX = "<!-- strata-blueprints: condensed, published";
export const IDCORE = String.raw`(?:(?:vision|structure|detail\.[a-z0-9]+)-[1-9]\d*(?:\.[1-9]\d*)+|view\.[a-z0-9]+-[1-9]\d*(?:\.[1-9]\d*)*)`;
const TOKEN = new RegExp(String.raw`(?<![\w.-])(${IDCORE})(?!\w|-|\.\d)`, "g");
export const NAMES = ["Vision", "Structure", "Detail"];
// A code span: a run of N backticks to the next run of N, on one line. The same line as in the lint.
const clean = (s) => s.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, " ");
// A fenced block opens at three or more backticks or tildes (a backtick row with another backtick after the run is text) and closes at a row of the same mark at least as long with nothing after it. The same lines as in the lint.
const fenceOpen = (t) => { const m = t.match(/^(`{3,}|~{3,})(.*)$/); return m && !(m[1][0] === "`" && m[2].includes("`")) ? { mark: m[1], lang: m[2].trim().split(/\s+/)[0] } : null; };
const fenceCloses = (t, fence) => t[0] === fence.mark[0] && t.length >= fence.mark.length && t === t[0].repeat(t.length);
export const TOPICS = {
  1: ["Need", "Target audience", "Value", "Focus", "Success measures", "Qualities and constraints", "Vocabulary", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  2: ["Parts", "Standing", "Seams between parts", "Seams with the outside", "Shared things", "Scenario paths", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  3: ["Responsibility", "Concepts and states", "Seams", "Rules", "Inside", "Limits", "Construction", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
};
const USAGE = "usage: node strata-blueprints.mjs condense <file.md or folder> --out <path> [--force]\n       node strata-blueprints.mjs publish <file.md or folder> --out <file> [--force]\n       node strata-blueprints.mjs delete <id> <file.md or folder> [--apply] [--ack <handle>[,<handle>...]]\n       node strata-blueprints.mjs insert <id> <file.md or folder> [--text <text> | --text-file <path> | --needs <text>] [--apply]";

const hasMarker = (line) => (line || "").trim().startsWith(MARKER_PREFIX);
const hasPublished = (line) => (line || "").trim().startsWith(PUBLISHED_PREFIX);

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
    const f = fenceOpen(t);
    if (fence) { if (fenceCloses(t, fence)) fence = null; return; }
    if (f) { fence = f; return; }
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
      unit.topics.push({ i: h.i, end: endOf(k, level), idx, name: m[2], no: +m[1] });
      return true;
    };
    if (h.level === 3) {
      const part = h.t.match(/^### (.+?) \(part\)\s*$/);
      if (layer.n === 3 && part) {
        entry = { i: h.i, end: endOf(k, 3), topics: [], name: part[1] };
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

// --- publish ------------------------------------------------------------------
// Open-question lines only: every non-blank line, after one list marker, starts with "Not supplied:".
const ITEM_MARK = /^(?:[-*+]|\d+\.) /;
const olMark = (k) => `${k}. `;
const bodyIsNotSupplied = (lines, t) => {
  const body = lines.slice(t.i + 1, t.end).map((l) => l.trim()).filter(Boolean);
  return body.length > 0 && body.every((l) => l.replace(ITEM_MARK, "").startsWith("Not supplied:"));
};
const cut = (s) => (s.length > 80 ? s.slice(0, 80) + "..." : s);
const base = (name) => path.basename(name);
const slugOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const anchorOf = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/ /g, "-");
const layerNo = (t) => {
  const m = t.match(/^## Layer (\d+): (.+)$/);
  return m && +m[1] >= 1 && +m[1] <= 3 && NAMES[m[1] - 1] === m[2].trim() ? +m[1] : 0;
};
// True for each line that is a fence line or sits inside a fenced block (the rule scan uses).
function fenceMask(lines) {
  let fence = null;
  return lines.map((line) => {
    const t = line.trim();
    const f = fenceOpen(t);
    if (fence) { if (fenceCloses(t, fence)) fence = null; return true; }
    if (f) { fence = f; return true; }
    return false;
  });
}
// The order of the parts named in the Parts topic of a structure file, as slugs.
function partOrder(text) {
  const { lines } = split(text);
  const mask = fenceMask(lines);
  const order = [];
  let topic = null;
  lines.forEach((line, i) => {
    if (mask[i]) return;
    const t = line.trim();
    if (/^## /.test(t)) { topic = null; return; }
    const h = t.match(/^### \d+\. (.+?)\s*$/);
    if (h) { topic = h[1]; return; }
    if (topic !== "Parts") return;
    const body = t.replace(/^(?:[-*+]|\d+[.)])\s+/, "").replace(/^\*+/, "");
    const m = body.match(/^(.+?)\s*\(part\)/);
    if (m) order.push(slugOf(m[1].replace(/\*+$/, "").trim()));
  });
  return order;
}
const EXPECT = (name) => { const b = base(name); return b === "sbp-vision.md" ? 1 : b === "sbp-structure.md" ? 2 : /^sbp-detail-.+\.md$/.test(b) ? 3 : 0; };
const trimBlank = (ls) => { let a = 0, b = ls.length; while (a < b && isBlank(ls[a])) a++; while (b > a && isBlank(ls[b - 1])) b--; return ls.slice(a, b); };

// publishFiles([{ name, text }], { single }): returns { text, dropped, open, files, questions }; throws Error with the refusal text.
export function publishFiles(input, opts = {}) {
  for (const f of input) if (hasPublished(split(f.text).lines[0])) throw new Error(`${f.name} is a published document; publish from the source files`);
  // order: vision, structure, then the detail files in the order of Parts (ties and unnamed files by name)
  const structure = input.find((f) => base(f.name) === "sbp-structure.md");
  const order = structure ? partOrder(structure.text) : [];
  const rank = (f) => {
    const b = base(f.name);
    if (b === "sbp-vision.md") return -2;
    if (b === "sbp-structure.md") return -1;
    if (!/^sbp-detail-.+\.md$/.test(b)) return order.length + 1;
    const i = order.indexOf(b.slice(11, -3));
    return i < 0 ? order.length : i;
  };
  const files = input.length > 1 ? [...input].sort((a, b) => rank(a) - rank(b) || (base(a.name) < base(b.name) ? -1 : base(a.name) > base(b.name) ? 1 : 0)) : [...input];
  const eol = files.some((f) => f.text.includes("\r\n")) ? "\r\n" : "\n";

  // phase 1: per file, find the topics to drop
  const parsed = files.map((f) => {
    const { lines } = split(f.text);
    const skip = new Set();
    if (hasMarker(lines[0])) { skip.add(0); if (lines.length > 1 && isBlank(lines[1])) skip.add(1); }
    const layers = scan(lines);
    if (!layers.length) throw new Error(`${f.name}: no layer heading found`);
    const want = opts.single ? 0 : EXPECT(f.name);
    if (want) for (const l of layers) if (l.n !== want) throw new Error(`${f.name}: '${lines[l.i].trim()}' does not belong in ${f.name}, which holds Layer ${want}`);
    const drop = new Set(), dropped = [];
    for (const layer of layers) {
      const units = layer.n === 3 ? (layer.entries.length ? layer.entries : [layer.bare]) : [layer.bare];
      for (const u of units) for (const t of u.topics) {
        const none = bodyIsNone(lines, t);
        if (!none && !bodyIsNotSupplied(lines, t)) continue;
        for (let i = t.i; i < t.end; i++) drop.add(i);
        const doc = layer.n === 1 ? "vision" : layer.n === 2 ? "structure" : u.name ? `detail.${u.name.toLowerCase()}` : "detail";
        const text = none ? "None." : cut(lines.slice(t.i + 1, t.end).map((l) => l.trim()).filter(Boolean).map((l) => l.replace(ITEM_MARK, "")).join(" "));
        dropped.push({ doc, no: t.no, name: t.name, kind: none ? "none" : "not-supplied", text });
      }
    }
    return { f, lines, skip, drop, dropped, mask: fenceMask(lines) };
  });

  // phase 2: a kept line must not cite an item of a topic that is left out
  const gone = new Map();
  for (const p of parsed) for (const d of p.dropped) gone.set(`${d.doc}-${d.no}`, d);
  const problems = [];
  for (const p of parsed) p.lines.forEach((line, i) => {
    if (p.skip.has(i) || p.drop.has(i) || p.mask[i]) return;
    for (const m of clean(line).matchAll(TOKEN)) {
      const id = m[1].match(/^(.+?)-(\d+)(?:\.\d+)+$/);
      const d = id && gone.get(`${id[1]}-${id[2]}`);
      if (d) problems.push(`${p.f.name} line ${i + 1}: cites ${m[1]}, which is in topic ${d.no}. ${d.name} of ${d.doc}, left out of the published document (${d.kind === "none" ? "None." : "Not supplied:"})`);
    }
  });
  if (problems.length) throw new Error(problems.join("\n"));

  // phase 3: merge
  let top = [];
  const layerBlocks = [], tailBlocks = [];
  let seenL3 = false;
  parsed.forEach((p, fi) => {
    const kept = [];
    p.lines.forEach((s, i) => { if (!p.skip.has(i) && !p.drop.has(i)) kept.push({ s, n: i + 1, m: p.mask[i] }); });
    const heads = kept.map((k, j) => (!k.m && /^## /.test(k.s.trim()) ? j : -1)).filter((j) => j >= 0);
    const first = heads.length ? heads[0] : kept.length;
    let pre = kept.slice(0, first);
    if (fi === 0) {
      top = trimBlank(pre.map((k) => k.s));
      // The published Status is the Vision's Blueprint status when it has one; its own Status line is then left out.
      if (top.some((l) => /^Blueprint status:/.test(l))) top = top.filter((l) => !/^Status:/.test(l)).map((l) => l.replace(/^Blueprint status:/, "Status:"));
    }
    else {
      const a = pre.findIndex((k) => !isBlank(k.s));
      if (a >= 0) {
        let rest = pre;
        if (/^# /.test(pre[a].s)) rest = pre.slice(a + 1);
        const b = rest.find((k) => !isBlank(k.s) && !/^(?:Version|Status|Blueprint status|Parent):/.test(k.s.trim()));
        if (b) throw new Error(`${p.f.name}: text before the first layer heading (line ${b.n}) cannot be merged; only the first file may hold it`);
      }
    }
    heads.forEach((h, k) => {
      const end = k + 1 < heads.length ? heads[k + 1] : kept.length;
      let ls = kept.slice(h, end).map((x) => x.s);
      const n = layerNo(ls[0].trim());
      if (n === 3) {
        if (seenL3) {
          let j = 1;
          while (j < ls.length && isBlank(ls[j])) j++;
          if (j < ls.length && ls[j].trim().startsWith("Scope:")) j++;
          ls = ls.slice(j);
        }
        seenL3 = true;
      }
      (n ? layerBlocks : tailBlocks).push(trimBlank(ls));
    });
  });

  // table of contents: every ## and ### heading outside fences, anchors by the GitHub rule
  const body = [];
  const join2 = (blocks) => { for (const b of blocks) { if (body.length) body.push(""); body.push(...b); } };
  join2(layerBlocks); join2(tailBlocks);
  const TOC = "\u0000";
  const merged = [...(top.length ? [...top, ""] : []), "## Contents", "", TOC, "", ...body];
  const mask = fenceMask(merged);
  const seen = new Map();
  const toc = [];
  let tocTop = 0, tocSub = 0;
  merged.forEach((line, i) => {
    if (mask[i]) return;
    const m = line.trim().match(/^(#{1,6}) (.*)$/);
    if (!m) return;
    const text = m[2].trim();
    const a = anchorOf(text);
    const c = seen.get(a) ?? 0;
    seen.set(a, c + 1);
    const anchor = c ? `${a}-${c}` : a;
    if (m[1].length > 3 || m[1].length === 1 || line === "## Contents") return;
    const label = `[${text.replace(/[\[\]]/g, "\\$&")}](#${anchor})`;
    if (m[1].length === 2) { tocTop++; tocSub = 0; toc.push(`${olMark(tocTop)}${label}`); }
    else { tocSub++; toc.push(`${" ".repeat(olMark(tocTop).length)}${olMark(tocSub)}${label}`); }
  });
  const at = merged.indexOf(TOC);
  const out = [PUBLISHED_MARKER, "", ...merged.slice(0, at), ...toc, ...merged.slice(at + 1)];
  while (isBlank(out.at(-1))) out.pop();

  // open questions, counted as the lint counts them
  const om = fenceMask(out);
  const open = [];
  let questions = 0;
  out.forEach((line, i) => {
    if (om[i] || /^## /.test(line.trim())) return;
    const c = (clean(line).match(/Not supplied:/g) || []).length;
    if (!c) return;
    questions += c;
    open.push({ line: i + 1, text: cut(line.trim()) });
  });
  return { text: join(out, eol), dropped: parsed.flatMap((p) => p.dropped), open, files: files.length, questions };
}

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

// --- insert and delete one list item, with its cascade (core guide, How to fill it out, id rule) -----------------------------
// Both commands print the impact of the item's id, shift every following item and nested item, rewrite every citation of a moved id in one pass,
// lint the result on a scratch copy, and only with --apply write every changed file or none.
const IDS_RE = new RegExp(TOKEN.source, "g");
const applyMap = (s, map) => s.replace(IDS_RE, (m) => map.get(m) ?? m);
const widthDelta = (oldN, newN) => String(newN).length - String(oldN).length;
const ackable = (c) => c.how !== "settles open concern";
const TMP_RE = /^\.(.+)\.strata-tmp-(\d+)$/;
const realIo = { writeFileSync: fs.writeFileSync, renameSync: fs.renameSync, accessSync: fs.accessSync, fsyncDir: (dir) => { try { const fd = fs.openSync(dir, "r"); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } } catch { /* a platform that cannot fsync a folder */ } } };
const LINT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "strata-blueprints-lint.mjs");
const lintRun = (...args) => spawnSync(process.execPath, [LINT_PATH, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const rawLines = (text) => text.match(/[^\n]*\n|[^\n]+$/g) || [];
const eolOf = (l) => (l.endsWith("\r\n") ? "\r\n" : l.endsWith("\n") ? "\n" : "");
const bodyOf = (l) => l.slice(0, l.length - eolOf(l).length);
const blankSpans = (s) => s.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, (m) => " ".repeat(m.length));
const findLeftovers = (target) => {
  const dir = fs.statSync(target).isDirectory() ? target : path.dirname(target);
  return fs.readdirSync(dir).filter((n) => TMP_RE.test(n)).sort().map((n) => ({ path: path.join(dir, n), for: path.join(dir, n.match(TMP_RE)[1]) }));
};
const leftoverMessage = (ls) => `interrupted run: ${ls.length} temp file(s) left by an earlier insert or delete: ${ls.map((l) => `${l.path} (for ${l.for})`).join(", ")}; nothing was written now. Delete each to undo that run, or rename each over its target, in the order listed, to finish it; then run the lint and run this command again`;
const blockedMessage = (u) => `apply blocked: ${u.length} unresolved reference(s); rewrite each by hand, or acknowledge it with --ack <handle>`;
const WRITTEN = [];
let LAST = "a file";
const writeTemp = (f, io) => {
  const tmp = path.join(path.dirname(f.abs), `.${path.basename(f.abs)}.strata-tmp-${process.pid}`);
  LAST = f.name;
  WRITTEN.push(tmp);
  try { io.writeFileSync(tmp, f.after, { flush: true }); } catch (e) { throw Object.assign(new Error(`write failed on ${f.name}; no file changed`), { refuse: true }); }
  return { tmp, f };
};
const restore = (file, bytes, io) => { const tmp = `${file}.strata-tmp-restore`; io.writeFileSync(tmp, bytes, { flush: true }); io.renameSync(tmp, file); };
const renameAll = (temps, io, done) => {
  for (const t of temps) { LAST = t.f.name; io.renameSync(t.tmp, t.f.abs); done.push([t.f.abs, t.f.before]); }
  for (const d of new Set(temps.map((t) => path.dirname(t.f.abs)))) io.fsyncDir(d);
};
function writePhase(plan, io) {
  try {
    const temps = plan.files.map((f) => writeTemp(f, io));
    return temps;
  } catch (e) {
    for (const p of WRITTEN) { try { fs.rmSync(p, { force: true }); } catch { /* best effort */ } }
    if (e.refuse) die(e.message);
    throw e;
  }
}
function commit(plan, io, log) {
  for (const f of plan.files) { try { io.accessSync(f.abs, fs.constants.W_OK); io.accessSync(path.dirname(f.abs), fs.constants.W_OK); } catch { die(`cannot write ${f.name}; nothing was written`); } }
  const done = [];
  WRITTEN.length = 0;
  const temps = writePhase(plan, io);
  try { renameAll(temps, io, done); } catch (e) {
    const failed = LAST;
    for (const [file, bytes] of done.reverse()) restore(file, bytes, io);
    for (const t of temps) { try { fs.rmSync(t.tmp, { force: true }); } catch { /* best effort */ } }
    die(`write failed on ${failed}; every file restored`);
  }
  log(`applied: ${plan.files.length} file(s) written`);
}

function parseCascade(cmd, rest) {
  const o = { apply: false, ack: [], text: null, textFile: null, needs: null };
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    const val = () => { if (i + 1 >= rest.length) die(`${a} needs a value`); return rest[++i]; };
    if (a === "--apply") o.apply = true;
    else if (a === "--ack" && cmd === "delete") o.ack = val().split(",").filter(Boolean);
    else if (a === "--text" && cmd === "insert") o.text = val();
    else if (a === "--text-file" && cmd === "insert") o.textFile = val();
    else if (a === "--needs" && cmd === "insert") o.needs = val();
    else if (a.startsWith("--")) die(`unknown option: ${a}`);
    else pos.push(a);
  }
  if (pos.length !== 2) die(pos.length > 2 ? "give one id and one file or folder" : `${cmd} needs an id and a file or folder`);
  if ([o.text, o.textFile, o.needs].filter((x) => x !== null).length > 1) die("give at most one of --text, --text-file and --needs");
  if (!new RegExp(`^${IDCORE}$`).test(pos[0])) die(`not an id: ${pos[0]}`);
  return { ...o, id: pos[0], target: pos[1] };
}

function cascade(cmd, rest, log, io) {
  const o = parseCascade(cmd, rest);
  const { id, target } = o;
  const st = lstat(target) || die(`no such file: ${target}`);
  if (st.isSymbolicLink()) die(`${target} is a symlink`);
  const isDir = st.isDirectory();
  if (!isDir && !st.isFile()) die(`not a file: ${target}`);
  const leftovers = findLeftovers(target);
  if (leftovers.length) die(leftoverMessage(leftovers));
  if (!fs.existsSync(LINT_PATH)) die(`the lint script is missing next to the tool: ${LINT_PATH}`);
  // The files of the target, each with its name as the report prints it.
  const files = [];
  if (isDir) {
    for (const n of fs.readdirSync(target).filter((x) => /^sbp-.*\.md$/.test(x)).sort()) {
      const abs = path.join(target, n), s = lstat(abs);
      if (s.isSymbolicLink()) die(`${abs} is a symlink`);
      if (s.isFile()) files.push({ name: n, abs });
    }
  } else files.push({ name: target, abs: target });
  for (const f of files) {
    f.before = fs.readFileSync(f.abs, "utf8");
    f.lines = rawLines(f.before);
    if (hasMarker(bodyOf(f.lines[0] || ""))) die(`${f.name} is a condensed copy or a published document; edit the source files`);
  }
  const before = lintRun(target);
  const beforeWarns = before.stdout.split("\n").filter((l) => l.startsWith("WARN "));
  if (beforeWarns.some((l) => l.startsWith("WARN list:"))) die("fix the list warnings first; a list that does not count 1, 2, 3 cannot be shifted");
  const ir = lintRun("--ids", target);
  if (ir.status !== 0) die(`the lint could not list the ids: ${ir.stderr.trim()}`);
  const rows = ir.stdout.split("\n").filter(Boolean).map((l) => { const [rid, file, line, end] = l.split("\t"); return { id: rid, file, line: +line, end: +end }; });
  const seenIds = new Set();
  for (const r of rows) { if (seenIds.has(r.id)) die(`${r.id} is defined twice; fix the repeated id first`); seenIds.add(r.id); }
  const byId = new Map(rows.map((r) => [r.id, r]));

  // The list the id sits in: items with the same prefix and no further place.
  const pm = id.match(/^(.*[.-])(\d+)$/);
  const prefix = pm[1], place = +pm[2];
  const sib = rows.filter((r) => { const m = r.id.match(/^(.*[.-])(\d+)$/); return m && m[1] === prefix; }).map((r) => ({ ...r, n: +r.id.match(/(\d+)$/)[1] }));
  const under = (r, p) => r.id.startsWith(`${prefix}${p}.`);
  const topicLevel = /^(?:vision|structure|detail\.[a-z0-9]+)-\d+\.$|^view\.[a-z0-9]+-$/.test(prefix);
  const topicOf = (r) => { const f = files.find((x) => x.name === r.file); for (let k = r.line - 1; f && k >= 0; k--) { const h = f.lines[k].match(/^#{3,4} \d+\. (.+?)\s*$/); if (h) return h[1]; } return "its topic"; };
  const map = new Map(), deleted = new Set();
  let target0 = byId.get(id), append = false, newAt = null;
  if (cmd === "delete") {
    if (!target0) die(`${id} is not defined in ${target}`);
    if (topicLevel && sib.length === 1) die(`${id} is the only item under ${topicOf(target0)}; write what the topic holds instead ('None.' or 'Not supplied: ...') by hand`);
    deleted.add(id);
    for (const r of rows) if (under(r, place)) deleted.add(r.id);
    for (const s of sib) if (s.n > place) { map.set(s.id, `${prefix}${s.n - 1}`); for (const r of rows) if (under(r, s.n)) map.set(r.id, `${prefix}${s.n - 1}.${r.id.slice(`${prefix}${s.n}.`.length)}`); }
  } else {
    const max = Math.max(0, ...sib.map((s) => s.n));
    if (place > max + 1 || place < 1) die(`${id} is not defined and is not one past the end of its list`);
    if (!sib.length) {
      if (topicLevel) die(`${id}: that topic holds no list; write the first item by hand`);
      if (!byId.has(prefix.slice(0, -1))) die(`${id}: its parent ${prefix.slice(0, -1)} is not defined`);
    }
    append = place === max + 1;
    for (const s of sib) if (s.n >= place) { map.set(s.id, `${prefix}${s.n + 1}`); for (const r of rows) if (under(r, s.n)) map.set(r.id, `${prefix}${s.n + 1}.${r.id.slice(`${prefix}${s.n}.`.length)}`); }
  }
  const dr = cmd === "delete" ? rows.filter((r) => deleted.has(r.id)) : [];
  const inDeleted = (file, ln) => dr.some((r) => r.file === file && ln >= r.line && ln <= r.end);

  log(`cascade ${cmd} ${id} in ${target}`);
  log("== impact ==");
  const impactIds = cmd === "delete" ? [...deleted] : rows.filter((r) => r.id === id || r.id.startsWith(`${id}.`)).map((r) => r.id);
  if (!impactIds.length) log(`none: ${id} is a new place at the end of its list; nothing cites it`);
  else { const im = lintRun("--impact", impactIds.join(","), target); for (const l of im.stdout.replace(/\n$/, "").split("\n")) log(l); }

  // Where the new item goes.
  const fileOf = (name) => files.find((f) => f.name === name);
  let insertion = null;
  if (cmd === "insert") {
    let row, at, indent;
    if (!append) { row = byId.get(id); at = row.line - 1; indent = bodyOf(fileOf(row.file).lines[at]).match(/^ */)[0].length; }
    else if (sib.length) { const last = sib.reduce((a, b) => (b.n > a.n ? b : a)); row = last; at = last.end; indent = bodyOf(fileOf(last.file).lines[last.line - 1]).match(/^ */)[0].length; }
    else { const par = byId.get(prefix.slice(0, -1)); row = par; at = par.end; const pl = bodyOf(fileOf(par.file).lines[par.line - 1]); const mm = pl.match(/^( *)(\d+)\.( +)/); indent = mm[1].length + mm[2].length + 1 + mm[3].length; }
    const f = fileOf(row.file);
    const marker = `${" ".repeat(indent)}${place}. `;
    let textLines;
    if (o.textFile !== null) textLines = fs.readFileSync(o.textFile, "utf8").replace(/\r?\n$/, "").split(/\r?\n/);
    else if (o.text !== null) textLines = [o.text];
    else textLines = [`Not supplied: ${o.needs !== null ? o.needs : "what this item says."}`];
    const col = marker.length;
    const newLines = textLines.map((t, k) => (k === 0 ? marker + t : " ".repeat(col) + t.trimStart()));
    // A blank line between items makes the list loose; a blank line after a heading does not.
    const prevBlank = (idx) => idx > 1 && bodyOf(f.lines[idx - 1]).trim() === "" && !/^#{1,6} /.test(bodyOf(f.lines[idx - 2]));
    if (!append) { if (prevBlank(at)) newLines.push(""); }
    else { const firstOfPrev = sib.length ? byId.get(`${prefix}${Math.max(...sib.map((s) => s.n))}`).line - 1 : -1; if (sib.length && prevBlank(firstOfPrev)) newLines.unshift(""); }
    insertion = { file: f, at, lines: newLines };
    newAt = { file: row.file, line: at + 1 };
  }

  log("== shift ==");
  if (cmd === "delete") for (const r of dr) log(`${r.id}  deleted  ${r.file} line ${r.line}-${r.end}`);
  else log(`${id}  new  ${newAt.file} line ${newAt.line}`);
  for (const r of rows) if (map.has(r.id)) log(`${r.id} -> ${map.get(r.id)}  ${r.file} line ${r.line}`);

  // Citations, read as the lint reads them: outside fenced blocks and code spans.
  const handleAt = (name, ln) => { const hit = rows.filter((r) => r.file === name && ln >= r.line && ln <= r.end).pop(); return hit ? hit.id : `${name}:${ln}`; };
  const sites = [], cited = [];
  for (const f of files) {
    const bodies = f.lines.map(bodyOf);
    const mask = fenceMask(bodies);
    f.edits = new Map();
    bodies.forEach((body, i) => {
      if (mask[i] || inDeleted(f.name, i + 1)) return;
      const blank = blankSpans(body);
      const found = [];
      for (const m of blank.matchAll(TOKEN)) found.push({ idx: m.index, old: m[1], settles: false });
      for (const m of blank.matchAll(/settles open concern (\d+(?:\.\d+)+)/g)) {
        const hit = rows.filter((r) => r.file === f.name && i + 1 >= r.line && i + 1 <= r.end).pop();
        if (!hit) continue;
        const doc = hit.id.slice(0, hit.id.lastIndexOf("-"));
        found.push({ idx: m.index + m[0].length - m[1].length, old: `${doc}-${m[1]}`, settles: true, num: m[1], doc });
      }
      for (const c of found) {
        const before = blank.slice(0, c.idx);
        const how = c.settles ? "settles open concern" : /Realizes\s*$/.test(before) ? "Realizes" : /Answered by [^.]*$/.test(before) ? "Answered by" : /\(Layer \d+,\s*$/.test(before) ? "(Layer N, id)" : "id";
        const handle = handleAt(f.name, i + 1);
        if (deleted.has(c.old)) { cited.push({ file: f.name, line: i + 1, handle, how, old: c.old, idx: c.idx }); continue; }
        if (map.has(c.old)) { const neu = map.get(c.old); sites.push({ file: f.name, line: i + 1, idx: c.idx, handle, how, old: c.old, neu, settles: c.settles, doc: c.doc, len: c.settles ? c.num.length : c.old.length }); }
      }
    });
  }
  sites.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line || a.idx - b.idx));
  log("== citations ==");
  for (const s of sites) log(`rewrite  ${s.file} line ${s.line}  ${s.handle}  ${s.how}  ${s.old} -> ${s.neu}`);
  for (const u of cited) log(`UNRESOLVED  ${u.file} line ${u.line}  ${u.handle}  ${u.how}  ${u.old} (deleted${ackable(u) ? "" : "; reword first"})`);

  // Acknowledged citations stay as written.
  for (const h of o.ack) {
    const hit = cited.filter((u) => u.handle === h);
    if (!hit.length) die(`cannot acknowledge ${h}: no unresolved citation has that handle`);
    for (const u of hit) { if (!ackable(u)) die(`cannot acknowledge ${h}: it settles an open concern this change deletes; reword that Decision to name the concern by its words, then run again`); }
  }
  const unresolved = cited.filter((u) => !o.ack.includes(u.handle));
  const opts = o;

  // The new text of every file, in memory.
  for (const s of sites) {
    const f = fileOf(s.file);
    (f.edits.get(s.line - 1) || f.edits.set(s.line - 1, []).get(s.line - 1)).push(s);
  }
  const out = new Map();
  for (const f of files) {
    const lines = f.lines.slice();
    for (const [i, list] of f.edits) {
      const body = bodyOf(lines[i]);
      // One pass: every id of the line goes through the map once; the settles-open-concern numbers through the same map.
      const spans = []; const protectedBody = body.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, (m) => { spans.push(m); return `\u0000${spans.length - 1}\u0000`; });
      let nb = applyMap(protectedBody, map);
      nb = nb.replace(/settles open concern (\d+(?:\.\d+)+)/g, (m, num) => { const row = rows.find((r) => r.file === f.name && i + 1 >= r.line && i + 1 <= r.end); const doc = row ? row.id.slice(0, row.id.lastIndexOf("-")) : null; const to = doc && map.get(`${doc}-${num}`); return to ? `settles open concern ${to.slice(doc.length + 1)}` : m; });
      nb = nb.replace(/\u0000(\d+)\u0000/g, (m, k) => spans[+k]);
      lines[i] = nb + eolOf(lines[i]);
    }
    out.set(f.name, lines);
  }
  // Marker lines of shifted items, and the width change of their later lines.
  for (const r of rows) {
    if (!map.has(r.id)) continue;
    const to = map.get(r.id);
    const isSibling = r.id.startsWith(prefix) && /^\d+$/.test(r.id.slice(prefix.length));
    if (!isSibling) continue;
    const lines = out.get(r.file); const li = r.line - 1;
    const body = bodyOf(lines[li]); const mm = body.match(/^( *)(\d+)\.( +)(.*)$/s);
    const newN = +to.slice(prefix.length), oldN = +mm[2];
    lines[li] = `${mm[1]}${newN}.${mm[3]}${mm[4]}` + eolOf(lines[li]);
    const d = widthDelta(oldN, newN);
    if (d !== 0) for (let k = li + 1; k <= r.end - 1; k++) { const b = bodyOf(lines[k]); if (b.trim() === "") continue; lines[k] = (d > 0 ? " ".repeat(d) + b : b.replace(new RegExp(`^ {0,${-d}}`), "")) + eolOf(lines[k]); }
  }
  // Structural edits, from the bottom of each file.
  if (cmd === "delete") {
    for (const f of files) {
      const mine = dr.filter((r) => r.file === f.name).sort((a, b) => b.line - a.line);
      const lines = out.get(f.name);
      for (const r of mine) {
        if (r.id.includes(".") && deleted.has(r.id) && mine.some((x) => x !== r && x.line <= r.line && x.end >= r.end)) continue;
        let from = r.line - 1, to = r.end;
        const blankBefore = from > 0 && bodyOf(f.lines[from - 1]).trim() === "", blankAfter = to < f.lines.length && bodyOf(f.lines[to]).trim() === "";
        if (blankBefore && blankAfter) to++;
        lines.splice(from, to - from);
      }
    }
  } else {
    const lines = out.get(insertion.file.name);
    const eol = eolOf(insertion.file.lines[Math.max(0, insertion.at - 1)] || "") || "\n";
    const ins = insertion.lines.map((l) => l + eol);
    // A last line with no ending gets one before text follows it.
    if (insertion.at > 0 && !eolOf(lines[insertion.at - 1])) lines[insertion.at - 1] += eol;
    lines.splice(insertion.at, 0, ...ins);
  }
  const changed = files.filter((f) => out.get(f.name).join("") !== f.before).map((f) => ({ ...f, after: out.get(f.name).join("") }));

  // The lint gate, on scratch copies, before any write.
  log("== lint ==");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-cascade-"));
  let newWarns = [];
  try {
    const mkCopy = (name, withChanges) => {
      const dir = path.join(scratch, name);
      if (isDir) { fs.cpSync(target, dir, { recursive: true }); if (withChanges) for (const f of changed) fs.writeFileSync(path.join(dir, f.name), f.after); return dir; }
      fs.mkdirSync(dir); const p = path.join(dir, path.basename(target)); fs.writeFileSync(p, withChanges ? (changed[0] ? changed[0].after : fs.readFileSync(target, "utf8")) : fs.readFileSync(target, "utf8")); return p;
    };
    const key = (l) => l.replace(/ \([^()]*\)$/, "");
    const bw = lintRun(mkCopy("before", false)).stdout.split("\n").filter((l) => l.startsWith("WARN ")).map((l) => applyMap(key(l), map));
    const aw = lintRun(mkCopy("after", true)).stdout.split("\n").filter((l) => l.startsWith("WARN ")).map(key);
    const count = (arr) => arr.reduce((m, k) => m.set(k, (m.get(k) || 0) + 1), new Map());
    const cb = count(bw), ca = count(aw);
    for (const [k, n] of ca) { const extra = n - (cb.get(k) || 0); for (let j = 0; j < extra; j++) newWarns.push(k); }
    log(`lint before: ${bw.length} warning(s)`);
    // A warning that names a deleted id some citation still holds is expected: the citing item reopens (acknowledged), or the apply is blocked (not yet).
    const expected = (w) => cited.some((u) => w.includes(u.old));
    const bad = newWarns.filter((w) => !expected(w));
    log(`lint after: ${aw.length} warning(s), ${newWarns.length} new`);
    for (const w of newWarns) log(`new  ${w}`);
    if (bad.length) {
      const named = cmd === "insert" && (o.text !== null || o.textFile !== null) && bad.some((w) => w.includes(id));
      die(`the change would add ${bad.length} lint warning(s); nothing was written` + (named ? "\nhint: an item that needs a path, a rule or a reason is added bare (insert <id> <path> with no text), then written by hand" : ""));
    }
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }

  log("== result ==");
  const plan = { files: changed };
  if (opts.apply) {
    if (unresolved.length) die(blockedMessage(unresolved));
  }
  if (opts.apply) commit(plan, io, log);
  if (!opts.apply) log("preview: no file written");
}

export function run(argv, log = console.log, io = realIo) {
  const [cmd, ...rest] = argv;
  if (cmd === "insert" || cmd === "delete") return cascade(cmd, rest, log, io);
  if (cmd !== "condense" && cmd !== "publish") die(`unknown subcommand: ${cmd}`);
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
  if (cmd === "publish") return publish({ input, out, force, isDir, ost, log });
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
    if (hasPublished(split(text).lines[0])) die(`${f.src} is a published document; condense the source files`);
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

// The files of a stack folder, the way condense finds them (flat; nested stacks ignored).
function stackNames(input) {
  const isFile = (n) => { try { return fs.statSync(path.join(input, n)).isFile(); } catch { return false; } };
  const all = fs.readdirSync(input).filter(isFile);
  const names = [];
  if (all.includes("sbp-vision.md")) names.push("sbp-vision.md");
  if (all.includes("sbp-structure.md")) names.push("sbp-structure.md");
  names.push(...all.filter((n) => /^sbp-detail-.+\.md$/.test(n)).sort());
  if (!names.length) die(`no sbp-vision.md, sbp-structure.md or sbp-detail-*.md in ${input}`);
  return names;
}

function publish({ input, out, force, isDir, ost, log }) {
  if (ost && ost.isDirectory()) die(`--out ${out} is a folder; give a file path`);
  const srcs = isDir ? stackNames(input).map((n) => path.join(input, n)) : [input];
  const files = srcs.map((src) => {
    try { return { name: src, text: fs.readFileSync(src, "utf8") }; } catch (e) { die(`cannot read ${src}: ${e.code || e.message}`); }
  });
  let r;
  try { r = publishFiles(files, { single: !isDir }); } catch (e) { die(e.message); }
  if (ost && !ost.isFile()) die(`${out} is not a file`);
  if (ost && !force) {
    let first = "";
    try { first = fs.readFileSync(out, "utf8").split(/\r?\n/, 1)[0]; } catch (e) { die(`cannot read ${out}: ${e.code || e.message}`); }
    if (!hasMarker(first)) die(`${out} exists and is not a condensed copy or a published document; use --force to overwrite it`);
  }
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, r.text);
  for (const d of r.dropped) log(`dropped ${d.doc} ${d.no}. ${d.name}: ${d.text}`);
  for (const o of r.open) log(`open ${out} line ${o.line}: ${o.text}`);
  const a = r.dropped.filter((d) => d.kind === "none").length;
  log(`published ${out}: ${r.files} file(s), dropped ${r.dropped.length} topic(s) (${a} None., ${r.dropped.length - a} Not supplied:), ${r.questions} open question(s) remain`);
}

export function main(argv) {
  if (!argv.length) { console.log(USAGE); return 0; }
  try { run(argv); return 0; } catch (e) {
    if (!(e instanceof Refuse)) throw e;
    for (const l of e.message.split("\n")) console.error(l.startsWith("hint: ") ? l : `strata-blueprints: ${l}`);
    return 2;
  }
}

const entry = (() => { try { return pathToFileURL(fs.realpathSync(process.argv[1])).href; } catch { return null; } })();
if (import.meta.url === entry) process.exitCode = main(process.argv.slice(2));
