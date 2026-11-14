#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Advisory lint for Strata Blueprints documents: shape checks a program can decide. No model needed.
// usage: node strata-blueprints-lint.mjs <file.md> [--strict]
//        node strata-blueprints-lint.mjs <folder> [--strict]
//        node strata-blueprints-lint.mjs --impact <id> <file.md or folder>
import fs from "node:fs";
import path from "node:path";

const NAMES = ["Vision", "Structure", "Detail"];
const TOPICS = {
  1: ["Need", "Target audience", "Value", "Focus", "Success measures", "Qualities and constraints", "Vocabulary", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  2: ["Parts", "Standing", "Seams between parts", "Seams with the outside", "Shared things", "Scenario paths", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  3: ["Responsibility", "Concepts and states", "Seams", "Rules", "Inside", "Limits", "Construction", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
};
const REASON_TOPICS = ["Assumptions", "Decisions"];

const USAGE = "usage: node strata-blueprints-lint.mjs <file.md> [--strict] | <folder> [--strict] | --impact <id> <file.md or folder>";
if (process.argv[2] === "--impact") runImpact(process.argv.slice(3));

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const strict = process.argv.includes("--strict");
if (!file) { console.log(USAGE); process.exit(0); }
const target = loadTarget(file);
const rows = target.rows;
let count = 0, notSupplied = 0;
const warnAt = (check, detail, loc) => { count++; console.log(`WARN ${check}: ${detail} (${loc})`); };
const warn = (check, detail, n) => warnAt(check, detail, target.where(n));
if (target.folder) folderChecks(target.folder, warnAt);
const MARK = /^(?:[-*+]|\d+[.)])\s+/;
const indentOf = (s) => s.length - s.trimStart().length;
const ID = /^\**(?:([AD])|(Assumption|Decision)\s+[AD]?)(\d+(?:\.\d+)*)([.:)]*\**[.:)]*)(?=\s|$)/;
const idOf = (s) => { const m = s.match(ID); return m ? { kind: m[1] || m[2][0], num: m[3], closed: /[.:)]/.test(m[4]) } : null; };
const itemText = (i) => {
  const base = indentOf(rows[i]);
  let text = rows[i];
  for (let j = i + 1; j < rows.length; j++) {
    const r = rows[j], rt = r.trim();
    if (rt === "" || /^#{1,6}\s/.test(rt) || rt.startsWith("```") || rt.startsWith("~~~")) break;
    const lead = rt.replace(MARK, "");
    if (idOf(lead) || (indentOf(r) <= base && MARK.test(rt))) break;
    text += " " + rt;
  }
  return text;
};

let fence = null;            // { lang, open } while inside a fenced block
let layer = null;            // current layer number, null outside any layer
let seen = [];               // layer numbers seen, in order
let pendingScope = null;     // line of a layer heading still awaiting its Scope: line
let lastTopic = -1;
let inReasons = false;
let entry = null;            // current Detail entry's part name, or null
let lastEntryTopic = -1;     // last entry topic index seen
const l1Ids = new Map();     // scenario id -> Layer 1 definition line
const l2Cites = new Set();   // ids cited in Layer 2
const l3Cites = new Set();   // ids cited in Layer 3
const defined = new Map();   // A and D ids defined in a layer, as 'A1.2' -> layer
let cr = null;               // open Costs or Risks topic: { kind, layer, items }
const crTopics = [];         // every Costs and Risks topic, checked at the end
const crIds = new Map();     // C and R id -> line
const crLast = {};           // last count used per kind and layer
const riskRefs = [];         // answering ids cited by risks, checked at the end

for (let i = 0; i < rows.length; i++) {
  const line = rows[i], n = i + 1, t = line.trim();

  if (/\b(TODO|TBD|FIXME)\b/.test(line)) warn("unfinished", `marker '${line.match(/\b(TODO|TBD|FIXME)\b/)[1]}'`, n);

  const f = t.match(/^(```|~~~)\s*(\S*)/);
  if (fence) { if (t.startsWith(fence.mark) && t.slice(3).trim() === "") fence = null; continue; }
  if (f) {
    fence = { lang: f[2], mark: f[1] };
    let j = i - 1; while (j >= 0 && rows[j].trim() === "") j--;
    const prev = j >= 0 ? rows[j].trim() : "";
    if (!prev.startsWith("Title:")) warn("diagram-title", "fenced block has no 'Title:' line before it", n);
    else if (fence.lang === "mermaid" && !prev.includes("Key:")) warn("diagram-key", "mermaid Title line has no 'Key:'", j + 1);
    continue;
  }

  const h2 = t.match(/^## (.*)$/);
  if (h2) {
    pendingScope = null; lastTopic = -1; layer = null; inReasons = false;
    entry = null; lastEntryTopic = -1; cr = null;
    if (/^Layer\b/.test(h2[1])) {
      const m = h2[1].match(/^Layer (\d+): (.+)$/);
      if (!m || +m[1] < 1 || +m[1] > 3 || NAMES[m[1] - 1] !== m[2].trim()) {
        warn("layer-heading", `'${t}' should read '## Layer N: Name' where N is 1 to 3 and the names are ${NAMES.map((x, i) => `${i + 1} ${x}`).join(", ")}`, n);
      } else {
        const num = +m[1];
        if (seen.length && num <= seen.at(-1)) warn("layer-heading", `Layer ${num} is out of order`, n);
        seen.push(num); layer = num; pendingScope = n;
      }
    }
    continue;
  }

  if (t === "") continue;
  if (pendingScope !== null) {
    if (!t.startsWith("Scope:")) warn("scope-line", "first line after the layer heading must start with 'Scope:'", n);
    pendingScope = null;
  }

  if (/^#{1,6}\s/.test(t)) {
    cr = null;
    const m = t.match(/^(###|####)\s+\d+\.\s+(Costs|Risks|Open Concerns)\s*$/);
    if (m && layer && (layer < 3 ? m[1] === "###" : m[1] === "####" && entry !== null)) {
      cr = { kind: m[2] === "Open Concerns" ? "O" : m[2][0], layer, items: [] }; crTopics.push(cr);
    }
  } else if (cr) {
    const prev = cr.items.at(-1);
    if (prev && !MARK.test(t) && !t.startsWith("|") && prev.t.length && !prev.t.startsWith("|")) prev.t += " " + t;
    else cr.items.push({ n, t });
  }

  if (/^#{3,6}\s/.test(t)) inReasons = REASON_TOPICS.includes(t.replace(/^#{3,6}\s+(?:\d+\.\s+)?/, ""));
  const h3 = t.match(/^### (\d+)\. (.+?)\s*$/);
  if (h3 && layer) {
    const idx = TOPICS[layer].indexOf(h3[2]);
    if (idx < 0) warn("topic-order", `'${h3[2]}' is not a Layer ${layer} topic`, n);
    else if (idx < lastTopic) warn("topic-order", `'${h3[2]}' is out of order in Layer ${layer}`, n);
    else lastTopic = idx;
  }

  const h3part = t.match(/^### (.+?) \(part\)\s*$/);
  if (t.startsWith("### ")) {
    if (layer === 3 && h3part) { entry = h3part[1]; lastEntryTopic = -1; }
    else { entry = null; }
  }

  if (entry !== null) {
    const h4 = t.match(/^#### (\d+)\. (.+?)\s*$/);
    if (h4) {
      const idx = TOPICS[3].indexOf(h4[2]);
      if (idx < 0) warn("topic-order", `'${h4[2]}' is not a Layer 3 topic in the entry '${entry}'`, n);
      else if (idx < lastEntryTopic) warn("topic-order", `'${h4[2]}' is out of order in the entry '${entry}'`, n);
      else lastEntryTopic = idx;
    }
  }

  if (layer) for (const m of line.matchAll(/\bLayer (\d+)\b/g)) {
    if (+m[1] > layer && !/^## /.test(t)) warn("ring", `Layer ${layer} refers outward to Layer ${m[1]}`, n);
  }

  const body = t.replace(/^(?:[-*+]|\d+[.)])\s+/, "");
  const idMatch = body.match(/^(V\d+)\.\s+(Given .*)$/);
  if (idMatch) {
    const id = idMatch[1];
    if (layer === 1) { if (!l1Ids.has(id)) l1Ids.set(id, n); }
    else if (layer === 2) l2Cites.add(id);
    else if (layer === 3) l3Cites.add(id);
  }
  const scenText = idMatch ? idMatch[2] : body;
  if (scenText.startsWith("Given") && !/^Given .+, when .+, then .+/.test(scenText)) warn("scenario-form", "must read 'Given ..., when ..., then ...'", n);

  const id = idOf(body);
  if (layer && id && (id.closed || inReasons) && id.kind) { const k = id.kind + id.num; if (!defined.has(k)) defined.set(k, layer); };
  if (id && (id.closed || inReasons) && !itemText(i).includes("Not supplied:")) {
    const text = itemText(i);
    if (id.kind === "A" && !(text.includes("Basis:") && text.includes("If wrong:"))) warn("reasons", "assumption needs 'Basis:' and 'If wrong:'", n);
    if (id.kind === "D" && !text.includes("Reason:")) warn("reasons", "decision needs 'Reason:'", n);
  }

  notSupplied += (line.replace(/`[^`]*`/g, "").match(/Not supplied:/g) || []).length;
}

if (!seen.includes(1)) warn("layer-heading", "missing '## Layer 1: Vision'", 1);
if (!seen.includes(2)) warn("layer-heading", `missing '## Layer 2: ${NAMES[1]}'`, 1);

if (l1Ids.size) {
  for (const [id, n] of l1Ids) {
    if (seen.includes(2) && !l2Cites.has(id)) warn("scenario-trace", `${id} has no path in Layer 2`, n);
    if (seen.includes(3) && !l3Cites.has(id)) warn("scenario-trace", `${id} has no rule in Layer 3`, n);
  }
}

// --- costs and risks topics ----------------------------------------------
const AMOUNT = /^(?:[A-Za-z]+ )*[$€£¥]?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s+[A-Za-z][^\n]*$/;
const validAmount = (s) => /^Not supplied:\s*\S/.test(s) || AMOUNT.test(s);
const ANSWER_ID = /\b(?:[AD]\d+(?:\.\d+)*|V\d+)\b/g;
const SEVERITY = ["High", "Medium", "Low", "Not rated"];

function checkCr(topic) {
  const check = { C: "cost-shape", R: "risk-shape", O: "concern-shape" }[topic.kind];
  const label = { C: "Costs", R: "Risks", O: "Open Concerns" }[topic.kind];
  for (const { n, t } of topic.items) {
    const body = t.replace(MARK, "");
    if (t.startsWith("|")) { warn(check, "a table line; write the topic as a list", n); continue; }
    if (body === "None." || /^Not supplied:\s*\S/.test(body)) continue;
    const idm = body.match(/^([CRO])(\d+)\.(\d+)\.\s+(.*)$/);
    if (!idm || idm[1] !== topic.kind) {
      warn(check, `a line under ${label} must be 'None.' or start '${topic.kind}${topic.layer}.<n>.'`, n);
      continue;
    }
    const key = idm[1] + idm[2] + "." + idm[3];
    if (+idm[2] !== topic.layer) warn("cr-id", `${key} does not carry the layer number ${topic.layer}`, n);
    else {
      const last = crLast[idm[1] + topic.layer] || 0;
      if (crIds.has(key)) warn("cr-id", `${key} repeats the one on line ${crIds.get(key)}`, n);
      else if (+idm[3] !== last + 1) warn("cr-id", `${key} should be ${idm[1]}${topic.layer}.${last + 1} (ids count up in document order)`, n);
      if (!crIds.has(key)) crIds.set(key, n);
      crLast[idm[1] + topic.layer] = Math.max(last, +idm[3]);
    }
    const rest = idm[4].trim();
    if (topic.kind === "C") {
      const pb = rest.indexOf(". Paid by ");
      const head = pb > 0 ? rest.slice(0, pb) : "";
      const payer = pb > 0 ? rest.slice(pb + 10) : "";
      let ok = /^\S.*\.$/.test(payer);
      const gwt = head.match(/^Given .+, when .+, then it costs (.+)$/);
      if (gwt) ok = ok && validAmount(gwt[1].trim());
      else if (ok) {
        ok = false;
        for (let k = head.indexOf(": "); k >= 0; k = head.indexOf(": ", k + 1)) if (validAmount(head.slice(k + 2).trim())) { ok = true; break; }
      }
      if (!ok) warn(check, "a cost must read 'C<n>. Given <condition or volume>, when <the subject is built, run or changed>, then it costs <amount>. Paid by <who>.' with a valid amount (the older form 'C<n>. <What>: <amount>. Paid by <who>.' is also accepted)", n);
    } else if (topic.kind === "O") {
      const rb = rest.indexOf(". Raised by ");
      const who = rb > 0 ? rest.slice(rb + 12) : "";
      if (rb <= 0 || !/^Given .+, when .+, then .+/.test(rest.slice(0, rb)) || !/^\S.*\.$/.test(who)) {
        warn(check, "an open concern must read 'O<n>. Given ..., when ..., then .... Raised by <who>.'", n);
      }
    } else {
      const sv = rest.indexOf(". Severity: "), ab = rest.indexOf(". Answered by ");
      const sev = sv > 0 && ab > sv ? rest.slice(sv + 12, ab) : "";
      const ans = ab > 0 ? rest.slice(ab + 14) : "";
      if (sv <= 0 || ab <= sv || !/^Given .+, when .+, then .+/.test(rest.slice(0, sv)) || !SEVERITY.includes(sev) || !/^\S.*\.$/.test(ans)) {
        warn(check, "a risk must read 'R<n>. Given ..., when ..., then .... Severity: High, Medium, Low or Not rated. Answered by <answer>.'", n);
        continue;
      }
      if (ans.startsWith("Not supplied:")) continue;
      const toks = ans.match(ANSWER_ID) || [];
      if (!toks.length) warn("risk-ref", "'Answered by' names no id and does not begin 'Not supplied:'", n);
      for (const tok of toks) riskRefs.push({ tok, n, layer: topic.layer });
    }
  }
}
for (const topic of crTopics) checkCr(topic);
for (const { tok, n, layer: from } of riskRefs) {
  const at = tok[0] === "V" ? (l1Ids.has(tok) ? 1 : null) : (defined.get(tok) ?? null);
  if (at === null) warn("risk-ref", `${tok} is not defined in a layer`, n);
  else if (at > from) warn("risk-ref", `${tok} is defined in Layer ${at}, outward of Layer ${from}`, n);
}

console.log(`INFO not-supplied: ${notSupplied}`);
console.log(`strata-blueprints-lint: ${count} warning(s)`);
process.exit(strict && count ? 1 : 0);

// =========================================================================
// Folder mode and impact mode. Function declarations, hoisted; they use no
// constant that is defined after the first call.
// =========================================================================

function die(msg) { console.error(`strata-blueprints-lint: ${msg}`); process.exit(2); }

// Load a file or a folder. Returns { rows, where(n), folder }.
function loadTarget(arg) {
  if (!fs.existsSync(arg)) die(`no such file: ${arg}`);
  const st = fs.statSync(arg);
  if (st.isDirectory()) return loadFolder(arg);
  if (!st.isFile()) die(`not a file: ${arg}`);
  let text;
  try { text = fs.readFileSync(arg, "utf8"); } catch (e) { die(`cannot read ${arg}: ${e.code || e.message}`); }
  return { rows: text.split("\n"), where: (n) => `line ${n}`, folder: null };
}

function slugOf(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

// The lines of a text outside fenced blocks, as { n, t } (1-based line, trimmed text).
function* plainLines(rows) {
  let fence = null;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].trim();
    const f = t.match(/^(```|~~~)/);
    if (fence) { if (t.startsWith(fence) && t.slice(3).trim() === "") fence = null; continue; }
    if (f) { fence = f[1]; continue; }
    yield { n: i + 1, t };
  }
}

// Parts and Standing lines of the structure file.
function readStructure(rows) {
  const parts = [], standing = [];
  let topic = null;
  for (const { n, t } of plainLines(rows)) {
    if (/^## /.test(t)) { topic = null; continue; }
    const h = t.match(/^### \d+\. (.+?)\s*$/);
    if (h) { topic = h[1]; continue; }
    const body = t.replace(/^(?:[-*+]|\d+[.)])\s+/, "").replace(/^\*+/, "");
    if (topic === "Parts") {
      const m = body.match(/^(.+?)\s*\(part\)/);
      if (m) parts.push({ name: m[1].replace(/\*+$/, "").trim(), n });
    } else if (topic === "Standing") {
      const m = body.match(/^(.+?)\*{0,2}:\s*\**\s*(.+?)\s*$/);
      if (m) standing.push({ part: m[1].trim(), text: m[2].replace(/\.$/, "").trim(), n });
    }
  }
  return { parts, standing };
}

function loadFolder(dir) {
  const isFile = (n) => { try { return fs.statSync(path.join(dir, n)).isFile(); } catch { return false; } };
  const all = fs.readdirSync(dir).filter(isFile);
  const names = [];
  const hasVision = all.includes("sbp-vision.md"), hasStructure = all.includes("sbp-structure.md");
  const details = all.filter((n) => /^sbp-detail-.+\.md$/.test(n)).sort();
  if (!hasVision && !hasStructure && !details.length) die(`no sbp-vision.md, sbp-structure.md or sbp-detail-*.md in ${dir}`);
  const read = (n) => {
    try { return fs.readFileSync(path.join(dir, n), "utf8").split("\n"); } catch (e) { die(`cannot read ${path.join(dir, n)}: ${e.code || e.message}`); }
  };
  const files = {};
  if (hasVision) { names.push("sbp-vision.md"); files["sbp-vision.md"] = read("sbp-vision.md"); }
  let structure = { parts: [], standing: [] };
  if (hasStructure) { names.push("sbp-structure.md"); files["sbp-structure.md"] = read("sbp-structure.md"); structure = readStructure(files["sbp-structure.md"]); }
  const order = structure.parts.map((p) => slugOf(p.name));
  const rank = (n) => { const i = order.indexOf(n.slice(11, -3)); return i < 0 ? order.length : i; };
  const ordered = [...details].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
  for (const n of ordered) { names.push(n); files[n] = read(n); }
  // Assemble one virtual document and keep a map from each virtual row to (file, line).
  const rows = [], map = [];
  let firstDetail = true;
  names.forEach((name, k) => {
    const src = files[name];
    const drop = new Set();
    const nextNonBlank = (from) => { let j = from; while (j < src.length && src[j].trim() === "") j++; return j; };
    if (k > 0) {
      let j = nextNonBlank(0);
      if (j < src.length && /^# /.test(src[j])) { drop.add(j); if (j + 1 < src.length && src[j + 1].trim() === "") drop.add(j + 1); j = nextNonBlank(j + 1); }
      if (name.startsWith("sbp-detail-")) {
        if (!firstDetail) {
          if (j < src.length && /^## Layer 3\b/.test(src[j].trim())) { drop.add(j); j = nextNonBlank(j + 1); }
          if (j < src.length && src[j].trim().startsWith("Scope:")) drop.add(j);
        }
      }
    }
    if (name.startsWith("sbp-detail-")) firstDetail = false;
    if (k > 0) { rows.push(""); map.push({ file: name, line: 1 }); }
    src.forEach((r, i) => { if (!drop.has(i)) { rows.push(r); map.push({ file: name, line: i + 1 }); } });
  });
  const where = (n) => { const m = map[n - 1]; return m ? `${m.file} line ${m.line}` : `line ${n}`; };
  return { rows, where, map, folder: { dir, files, details, hasStructure, structure } };
}

// Checks that only a folder has: layer headings per file, one entry per detail file, Standing.
function folderChecks(f, warnAt) {
  const expect = (name) => (name === "sbp-vision.md" ? 1 : name === "sbp-structure.md" ? 2 : 3);
  for (const [name, rows] of Object.entries(f.files)) {
    const entries = [];
    for (const { n, t } of plainLines(rows)) {
      const lh = t.match(/^## Layer (\d+)\b/);
      if (lh && +lh[1] !== expect(name)) warnAt("layer-heading", `'${t}' does not belong in ${name}, which holds Layer ${expect(name)}`, `${name} line ${n}`);
      const e = t.match(/^### (.+?) \(part\)\s*$/);
      if (e && name.startsWith("sbp-detail-")) entries.push({ name: e[1], n });
    }
    if (name.startsWith("sbp-detail-") && entries.length !== 1) {
      warnAt("layer-heading", `${name} must hold exactly one '### <Part> (part)' entry; it holds ${entries.length}`, `${name} line ${entries.length > 1 ? entries[1].n : 1}`);
    }
    f.files[name].entries = entries;
  }
  if (!f.hasStructure) return;
  const { parts, standing } = f.structure;
  const bySlug = new Map();
  for (const p of parts) {
    const s = slugOf(p.name);
    if (bySlug.has(s)) warnAt("standing", `parts '${bySlug.get(s).name}' and '${p.name}' share the file slug '${s}'`, `sbp-structure.md line ${p.n}`);
    else bySlug.set(s, p);
  }
  const named = new Set();
  for (const s of standing) {
    const loc = `sbp-structure.md line ${s.n}`;
    const file = s.text.match(/^(sbp-detail-[^\s,]+\.md)$/);
    const own = s.text.match(/^own stack, (.+?)\/?$/);
    if (file) {
      named.add(file[1]);
      if (!f.details.includes(file[1])) warnAt("standing", `${s.part} names ${file[1]}, which is not in the folder`, loc);
    } else if (own) {
      let ok = false;
      try { ok = fs.statSync(path.join(f.dir, own[1].replace(/\/+$/, ""))).isDirectory(); } catch { ok = false; }
      if (!ok) warnAt("standing", `${s.part} names its own stack ${own[1]}/, which is not a folder here`, loc);
    } else if (/^described here$/i.test(s.text)) {
      warnAt("standing", `${s.part} says 'described here'; in a stack of separate files name the part's file or its own stack`, loc);
    }
  }
  for (const d of f.details) {
    if (!named.has(d)) warnAt("standing", `${d} is named by no Standing line`, `${d} line 1`);
    const slug = d.slice(11, -3);
    const part = bySlug.get(slug);
    if (!part) { warnAt("standing", `${d}: '${slug}' is not the slug of a part in Parts`, `${d} line 1`); continue; }
    const e = f.files[d].entries[0];
    if (e && e.name !== part.name) warnAt("standing", `the entry '${e.name}' differs from the Parts name '${part.name}'`, `${d} line ${e.n}`);
  }
}

// --impact <id> <file or folder>
function runImpact(args) {
  const IDTOK = String.raw`(?:V\d+|[ACDOR]\d+(?:\.\d+)*)`;
  const tokRe = new RegExp(String.raw`(?<![\w.])${IDTOK}(?!\w|\.\d)`, "g");
  const opts = args.filter((a) => a.startsWith("--"));
  if (opts.length) die(`unknown option in --impact mode: ${opts[0]}`);
  if (args.length < 1) die("--impact needs an id and a file or folder");
  const [id, arg] = args;
  if (!new RegExp(`^${IDTOK}$`).test(id)) die(`not an id: ${id}`);
  if (arg === undefined) die("--impact needs a file or folder after the id");
  if (args.length > 2) die(`unexpected extra argument: ${args[2]}`);
  const target = loadTarget(arg);
  const els = [];
  let cur = null, layer = null, topic = null, entry = null, fence = null;
  const close = () => { cur = null; };
  const start = (n, text, indent, list) => { cur = { n, text, indent, list, layer, label: null, topic, entry }; els.push(cur); };
  const rows = target.rows;
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i], t = line.trim(), n = i + 1;
    const f = t.match(/^(```|~~~)/);
    if (fence) { if (t.startsWith(fence) && t.slice(3).trim() === "") fence = null; continue; }
    if (f) { fence = f[1]; close(); continue; }
    if (t === "") { close(); continue; }
    if (/^#{1,6}\s/.test(t)) {
      close();
      if (/^## /.test(t)) {
        const m = t.match(/^## Layer ([123]): (.+)$/);
        layer = m && NAMES[m[1] - 1] === m[2].trim() ? +m[1] : null;
        topic = null; entry = null;
      } else if (/^### /.test(t)) {
        const pe = t.match(/^### (.+?) \(part\)\s*$/);
        const tp = t.match(/^### \d+\. (.+?)\s*$/);
        if (layer === 3 && pe) { entry = pe[1]; topic = null; }
        else if (tp) { topic = tp[1]; if (layer === 3) entry = null; }
        else { topic = null; if (layer === 3) entry = null; }
      } else if (/^#### /.test(t) && layer === 3 && entry !== null) {
        const tp = t.match(/^#### \d+\. (.+?)\s*$/);
        topic = tp ? tp[1] : null;
      }
      continue;
    }
    if (t.startsWith("|")) {
      close();
      if (!/^\|[\s:|-]+\|?$/.test(t)) { start(n, t, 0, false); close(); }
      continue;
    }
    const indent = line.length - line.trimStart().length;
    const mk = t.match(/^(?:[-*+]|\d+[.)])\s+(.*)$/);
    if (mk && indent <= 1) { start(n, mk[1], indent, true); continue; }
    if (cur) { cur.text += " " + t; continue; }
    if (mk) start(n, mk[1], indent, true); else start(n, t, indent, false);
  }
  // Element facts: label, own id, cites.
  const clean = (s) => s.replace(/`[^`]*`/g, " ");
  for (const e of els) {
    const text = e.text.trim();
    e.text = text;
    e.label = e.layer === null ? "Other"
      : `Layer ${e.layer} > ${e.entry !== null ? (e.topic ? `${e.entry} (part) > ${e.topic}` : `${e.entry} (part)`) : (e.topic || "-")}`;
    const c = clean(text);
    const first = c.match(new RegExp(String.raw`^\**(?:(?:Assumption|Decision)\s+)?(${IDTOK})(?!\w|\.\d)`));
    e.id = first && !(first[1][0] === "V" && e.layer !== 1) ? first[1] : null;
    e.cites = [...new Set((c.match(tokRe) || []).filter((x) => x !== e.id))];
  }
  const defs = new Map(), dups = [];
  for (const e of els) if (e.id) { if (defs.has(e.id)) dups.push([e.id, defs.get(e.id), e]); else defs.set(e.id, e); }
  const place = (e) => target.where(e.n);
  const seed = defs.get(id) || null;
  const citers = (x) => els.filter((e) => e.cites.includes(x));
  // Breadth first by depth; each element once, under the earliest parent at the smallest depth.
  const parent = new Map(), depth = new Map(), kids = new Map();
  const cycles = [], seenCycle = new Set();
  let level = [{ e: seed, id }], d = 0;
  const onPath = (e, p) => { for (let x = p; x; x = parent.get(x)) if (x === e) return true; return false; };
  while (level.length) {
    d++;
    const next = [];
    for (const { e: p, id: pid } of level) {
      for (const c of citers(pid)) {
        if (c === p) continue;
        if (seed && (c === seed || onPath(c, p))) {
          const key = `${c.id}>${pid}`;
          if (!seenCycle.has(key)) { seenCycle.add(key); cycles.push(`WARN impact: cycle ${c.id} ... ${pid}`); }
          continue;
        }
        if (depth.has(c)) continue;
        depth.set(c, d); parent.set(c, p);
        if (!kids.has(p)) kids.set(p, []);
        kids.get(p).push(c);
        if (c.id) next.push({ e: c, id: c.id });
      }
    }
    next.sort((a, b) => els.indexOf(a.e) - els.indexOf(b.e));
    level = next;
  }
  const out = [];
  let code = 0;
  if (seed) out.push(`impact ${id}: defined in ${seed.layer === null ? "Other" : `Layer ${seed.layer}`}, ${place(seed)}`);
  else { out.push(`WARN impact: ${id} is not defined in ${arg}`); code = 1; }
  out.push(id);
  const cut = (s) => (s.length > 80 ? s.slice(0, 80) + "..." : s);
  const walk = (p, dd) => {
    for (const c of (kids.get(p) || []).sort((a, b) => els.indexOf(a) - els.indexOf(b))) {
      out.push(`${"  ".repeat(dd)}d${dd}  ${place(c)}  ${c.label}  ${c.id || "-"}  ${cut(c.text)}`);
      walk(c, dd + 1);
    }
  };
  walk(seed, 1);
  for (const [dupId, a, b] of dups) if (dupId === id) out.push(`WARN impact: ${id} is defined on lines ${a.n} and ${b.n}`);
  out.push(...cycles);
  const deepest = Math.max(0, ...depth.values());
  out.push(`INFO impact: ${depth.size} element(s) reached, deepest ${deepest}`);
  console.log(out.join("\n"));
  process.exit(code);
}
