#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Advisory lint for Strata Blueprints documents: shape checks a program can decide. No model needed.
// usage: node strata-blueprints-lint.mjs <file.md> [--strict]
//        node strata-blueprints-lint.mjs <folder> [--strict]
//        node strata-blueprints-lint.mjs --impact <id>[,<id>...] <file.md or folder>
//        node strata-blueprints-lint.mjs --ids <file.md or folder>
import fs from "node:fs";
import path from "node:path";

const NAMES = ["Vision", "Structure", "Detail"];
const TOPICS = {
  1: ["Need", "Target audience", "Value", "Focus", "Success measures", "Qualities and constraints", "Vocabulary", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  2: ["Parts", "Standing", "Seams between parts", "Seams with the outside", "Shared things", "Scenario paths", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  3: ["Responsibility", "Concepts and states", "Seams", "Rules", "Inside", "Limits", "Construction", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
};
// Topics where a prose paragraph counts as an item (core guide, How to fill it out, list rule): each item is its own list item.
const NEEDS_ID = {
  1: ["Value", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  2: ["Scenario paths", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
  3: ["Rules", "Limits", "Construction", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"],
};
// A file whose first line starts with this is a condensed copy: omitted topics read None., so the topics check skips it.
const MARKER_PREFIX = "<!-- strata-blueprints: condensed";
const hasMarker = (firstLine) => (firstLine || "").trim().startsWith(MARKER_PREFIX);
const DOC_LAYER = (doc) => (doc === "vision" ? 1 : doc === "structure" ? 2 : doc.startsWith("view.") ? 4 : 3);
const topicNo = (layer, name) => (TOPICS[layer] ? TOPICS[layer].indexOf(name) + 1 || null : null);

// Every list is a Markdown ordered list. An item's id is its document, the topic's number from its heading and its place in the list,
// nested places joined by dots (core guide, How to fill it out, id rule). A citation writes the id in full.
const IDCORE = String.raw`(?:(?:vision|structure|detail\.[a-z0-9]+)-[1-9]\d*(?:\.[1-9]\d*)+|view\.[a-z0-9]+-[1-9]\d*(?:\.[1-9]\d*)*)`;
const TOKEN = new RegExp(String.raw`(?<![\w.-])(${IDCORE})(?!\w|-|\.\d)`, "g");
const viewId = (name, pos) => "view." + name.toLowerCase() + "-" + pos.join(".");
const parseId = (id) => {
  const v = id.match(/^(view\.[a-z0-9]+)-([1-9]\d*(?:\.[1-9]\d*)*)$/);
  if (v) { const pos = v[2].split(".").map(Number); return { id, doc: v[1], topic: null, item: pos[0], pos }; }
  const m = id.match(/^(.+?)-([1-9]\d*)((?:\.[1-9]\d*)+)$/); const pos = [m[2], ...m[3].slice(1).split(".")].slice(1).map(Number); return { id, doc: m[1], topic: +m[2], item: pos[0], pos }; };
const THEMATIC = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const clean = (s) => s.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, " ");
// A fenced block opens at three or more backticks or tildes (a backtick row with another backtick after the run is text) and closes at a row of the same mark at least as long with nothing after it. The same lines as in the lint.
const fenceOpen = (t) => { const m = t.match(/^(`{3,}|~{3,})(.*)$/); return m && !(m[1][0] === "`" && m[2].includes("`")) ? { mark: m[1], lang: m[2].trim().split(/\s+/)[0] } : null; };
const fenceCloses = (t, fence) => t[0] === fence.mark[0] && t.length >= fence.mark.length && t === t[0].repeat(t.length);
const docOf = (e) => (e.layer === 1 ? "vision" : e.layer === 2 ? "structure" : e.layer === 3 && e.entry !== null ? `detail.${e.entry.toLowerCase()}` : null);

const USAGE = "usage: node strata-blueprints-lint.mjs <file.md> [--strict] | <folder> [--strict] | --impact <id>[,<id>...] <file.md or folder> | --ids <file.md or folder>";
// A reader that closes the pipe early ends the run quietly, with the exit code the run would have had.
process.stdout.on("error", (e) => { if (e.code === "EPIPE") process.exit(process.exitCode ?? 0); else throw e; });
if (process.argv[2] === "--impact") await runImpact(process.argv.slice(3));
if (process.argv[2] === "--ids") await runIds(process.argv.slice(3));

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
const strict = process.argv.includes("--strict");
if (!file) { console.log(USAGE); process.exit(0); }
const target = loadTarget(file);
const rows = target.rows;
let count = 0, notSupplied = 0, statusInfo = null;
const warnAt = (check, detail, loc) => { count++; console.log(`WARN ${check}: ${detail} (${loc})`); };
const warn = (check, detail, n) => warnAt(check, detail, target.where(n));
if (target.folder) folderChecks(target.folder, warnAt);
const MARK = /^(?:[-*+]|\d+[.)])\s+/;

// status: Status and Blueprint status lines in each document's top matter (before its first ## heading).
const STATUS_VALUES = ["Draft", "Review", "Approved"];
{
  const docs = target.folder
    ? Object.entries(target.folder.files).map(([name, r]) => ({ name, rows: r, key: name === "sbp-vision.md" ? "vision" : name === "sbp-structure.md" ? "structure" : `detail.${name.slice(11, -3)}` }))
    : [{ name: null, rows, key: "doc" }];
  const found = {};
  let any = false;
  for (const d of docs) {
    for (let i = 0; i < d.rows.length; i++) {
      const t = d.rows[i].trim();
      if (/^## /.test(t)) break;
      const m = t.match(/^(Blueprint status|Status):\s*(.*?)\s*$/);
      if (!m) continue;
      any = true;
      if (!STATUS_VALUES.includes(m[2])) warnAt("status", `'${m[2]}' is not one of Draft, Review, Approved`, d.name ? `${d.name} line ${i + 1}` : `line ${i + 1}`);
      found[m[1] === "Status" ? d.key : `${d.key}:blueprint`] ??= m[2];
    }
  }
  if (any) {
    statusInfo = target.folder
      ? `INFO status: blueprint ${found["vision:blueprint"] ?? "-"}; ` + ["vision", "structure", ...docs.map((d) => d.key).filter((k) => k.startsWith("detail."))].map((k) => `${k} ${found[k] ?? "-"}`).join("; ")
      : `INFO status: ${found.doc ?? found["doc:blueprint"] ?? "-"}`;
  }
}

let fence = null;            // { lang, open } while inside a fenced block
let layer = null;            // current layer number, null outside any layer
let seen = [];               // layer numbers seen, in order
let pendingScope = null;     // line of a layer heading still awaiting its Scope: line
let lastTopic = -1;
let entry = null;            // current Detail entry's part name, or null
let lastEntryTopic = -1;     // last entry topic index seen
const units = [];            // written layers (1, 2) and Layer 3 entries: { layer, name, line, heads }, checked at the end
let unit = null;             // the open unit, or null

for (let i = 0; i < rows.length; i++) {
  const line = rows[i], n = i + 1, t = line.trim();

  const f = fenceOpen(t);
  if (fence === null && !f) {
    const mk = clean(line).match(/\b(TODO|TBD|FIXME)\b/);
    if (mk) warn("unfinished", `marker '${mk[1]}'`, n);
  }
  if (fence) { if (fenceCloses(t, fence)) fence = null; continue; }
  if (f) {
    fence = f;
    let j = i - 1; while (j >= 0 && rows[j].trim() === "") j--;
    const prev = j >= 0 ? rows[j].trim() : "";
    if (!prev.startsWith("Title:")) warn("diagram-title", "fenced block has no 'Title:' line before it", n);
    else if (fence.lang === "mermaid" && !prev.includes("Key:")) warn("diagram-key", "mermaid Title line has no 'Key:'", j + 1);
    continue;
  }

  const h2 = t.match(/^## (.*)$/);
  if (h2) {
    pendingScope = null; lastTopic = -1; layer = null;
    entry = null; lastEntryTopic = -1; unit = null;
    if (/^Layer\b/.test(h2[1])) {
      const m = h2[1].match(/^Layer (\d+): (.+)$/);
      if (!m || +m[1] < 1 || +m[1] > 3 || NAMES[m[1] - 1] !== m[2].trim()) {
        warn("layer-heading", `'${t}' should read '## Layer N: Name' where N is 1 to 3 and the names are ${NAMES.map((x, i) => `${i + 1} ${x}`).join(", ")}`, n);
      } else {
        const num = +m[1];
        if (seen.length && num <= seen.at(-1)) warn("layer-heading", `Layer ${num} is out of order`, n);
        seen.push(num); layer = num; pendingScope = n;
        if (num < 3) { unit = { layer: num, name: null, line: n, heads: new Set() }; units.push(unit); }
      }
    }
    continue;
  }

  if (t === "") continue;
  if (pendingScope !== null) {
    if (!t.startsWith("Scope:")) warn("scope-line", "first line after the layer heading must start with 'Scope:'", n);
    pendingScope = null;
  }

  const h3 = t.match(/^### (\d+)\. (.+?)\s*$/);
  if (h3 && layer && layer < 3 && unit) unit.heads.add(h3[2]);
  if (h3 && layer) {
    const idx = TOPICS[layer].indexOf(h3[2]);
    if (idx < 0) warn("topic-order", `'${h3[2]}' is not a Layer ${layer} topic`, n);
    else if (idx < lastTopic) warn("topic-order", `'${h3[2]}' is out of order in Layer ${layer}`, n);
    else lastTopic = idx;
  }

  const h3part = t.match(/^### (.+?) \(part\)\s*$/);
  if (t.startsWith("### ")) {
    if (layer === 3 && h3part) { entry = h3part[1]; lastEntryTopic = -1; unit = { layer: 3, name: entry, line: n, heads: new Set() }; units.push(unit); }
    else { entry = null; if (layer === 3) unit = null; }
  }

  if (entry !== null) {
    const h4 = t.match(/^#### (\d+)\. (.+?)\s*$/);
    if (h4) {
      if (unit) unit.heads.add(h4[2]);
      const idx = TOPICS[3].indexOf(h4[2]);
      if (idx < 0) warn("topic-order", `'${h4[2]}' is not a Layer 3 topic in the entry '${entry}'`, n);
      else if (idx < lastEntryTopic) warn("topic-order", `'${h4[2]}' is out of order in the entry '${entry}'`, n);
      else lastEntryTopic = idx;
    }
  }

  if (layer) for (const m of clean(line).matchAll(/\bLayer (\d+)\b/g)) {
    if (+m[1] > layer && !/^## /.test(t)) warn("ring", `Layer ${layer} refers outward to Layer ${m[1]}`, n);
  }

  notSupplied += (clean(line).match(/Not supplied:/g) || []).length;
}

// A fenced block still open at the end of a file hides every later row from the checks above; each such file warns once, at the row that opens it.
for (const [name, r] of target.folder ? Object.entries(target.folder.files) : [[null, rows]]) {
  const open = openFenceRow(r);
  if (open) warnAt("fence", "fenced block is never closed; the checks skip every row after it", name ? `${name} line ${open}` : `line ${open}`);
}

if (!seen.includes(1)) warn("layer-heading", "missing '## Layer 1: Vision'", 1);
if (!seen.includes(2)) warn("layer-heading", `missing '## Layer 2: ${NAMES[1]}'`, 1);

for (const u of units) {
  if (!u.heads.size) continue;
  if (target.condensedAt(u.line)) continue;
  for (const name of TOPICS[u.layer]) {
    if (!u.heads.has(name)) warn("topics", `topic '${name}' is missing in ${u.name === null ? `Layer ${u.layer}` : `the entry '${u.name}'`}`, u.line);
  }
}

// --- ids, citations, reasons, costs, risks and open concerns ---------------
const els = readElements(rows);
assignOwn(els);
for (const e of els) {
  e.cites = [];
  for (const c of e.body.matchAll(TOKEN)) if (c[1] !== (e.own && e.own.id)) e.cites.push({ id: c[1], at: c.index });
  e.topicNo = e.layer ? topicNo(e.layer, e.topic) : null;
}
// scenario-form: Given, when, then is required where tracing needs it: a Layer 1 Value scenario, a Layer 2 Scenario path
// and any item that says Realizes <id>. It reads after a Realizes sentence. A list item, a Realizes item or an item
// that starts with Given must read in full; None., Not supplied:, Title: and a table row are exempt, and so is a paragraph that does not start with Given. It reads depth-1 items only.
const REALIZES = new RegExp(String.raw`(?<![\w.-])Realizes\s+${IDCORE}(?!\w|-|\.\d)`);
const traced = (e) => (e.layer === 1 && (e.topic === "Value" || (e.own && e.own.topic === 3)))
  || (e.layer === 2 && (e.topic === "Scenario paths" || (e.own && e.own.topic === 6)))
  || REALIZES.test(e.body);
for (const e of els) {
  if (!traced(e)) continue;
  const scen = e.text.replace(/^\**/, "").replace(new RegExp(String.raw`^Realizes\s+${IDCORE}[.:)]*\s+`), "");
  const numbered = e.own;
  if (e.table || e.depth > 1 || /^(None\.|Not supplied:|Title:)/.test(scen)) continue;
  if ((numbered || REALIZES.test(e.body) || scen.startsWith("Given")) && !/^Given .+, when .+, then .+/.test(scen)) warn("scenario-form", "must read 'Given ..., when ..., then ...'", e.n);
}
// list: every list is a Markdown ordered list that counts 1, 2, 3 with no gap (core guide, How to fill it out, list rule).
const ID_START = /^\**((?:(?:vision|structure|detail\.[a-z0-9]+)-)?[1-9]\d*(?:\.[1-9]\d*)+\.)(?=\s|$)/;
for (const e of els) {
  if (!e.list) continue;
  const lead = e.text.match(ID_START);
  if (/^[-*+]$/.test(e.marker)) warn("list", `'${e.marker}' starts an unordered list item; write it as '${e.place}.'${lead ? " and drop the number from the text" : ""}`, e.n);
  else if (e.marker.endsWith(")")) warn("list", `'${e.written})' is not the list marker; write it as '${e.written}.'`, e.n);
  else if (e.written !== e.place) warn("list", `item number ${e.written} is not ${e.place}, its place in the list; a list counts 1, 2, 3 with no gap`, e.n);
}
for (const { n, t } of plainLines(rows)) {
  const vm = t.match(/^## View:\s*(.*?)\s*$/);
  if (vm && !/^[A-Za-z0-9]+$/.test(vm[1])) warn("id", `view name '${vm[1]}' is not one word`, n);
}
const live = els.filter((e) => e.layer !== null || e.view);
const defined = new Map();             // id -> element, any own id in layers 1 to 3
const slugsListed = [];                // part names from Layer 2 Parts
for (const e of live) if (e.own && !defined.has(e.own.id)) defined.set(e.own.id, e);
for (const e of live) {
  if (e.layer !== 2 || e.topic !== "Parts" || e.table) continue;
  if (e.depth > 1) continue;
  const pm = e.text.replace(/^\**/, "").match(/^(.+?)\s*\(part\)/);
  if (pm) slugsListed.push({ name: pm[1].replace(/\*+$/, "").trim(), n: e.n });
}
// A bracketed name is a template placeholder, not a part name.
for (const p of slugsListed) if (!/^[A-Za-z0-9]+$/.test(p.name) && !/^\[.*\]$/.test(p.name)) warn("id", `part name '${p.name}' is not one word`, p.n);
const partSlugs = new Set(slugsListed.map((p) => p.name.toLowerCase()));

const firstOf = new Map();
const headWarned = new Set();
for (const e of live) {
  if (e.list && e.headNo != null && e.topicNo !== null && e.headNo !== e.topicNo && !(e.layer === 3 && e.entry === null) && !headWarned.has(e.headN)) {
    headWarned.add(e.headN);
    warn("id", `${e.topic} is numbered ${e.headNo}, but it is topic ${e.topicNo} of Layer ${e.layer}; its items take ids for topic ${e.topicNo}`, e.headN);
  }
  if (!e.own) {
    const exempt = e.table || /^(None\.|Not supplied:|Title:)/.test(e.body);
    if (e.topic && e.topicNo !== null && !exempt && !e.list && !(e.layer === 3 && e.entry === null) && NEEDS_ID[e.layer].includes(e.topic)) warn("id", `an item under ${e.topic} has no number`, e.n);
    continue;
  }
  const { id, doc } = e.own;
  const lead = !/^[-*+]$/.test(e.marker) && e.text.match(ID_START);
  if (lead) warn("id", `the item starts with '${lead[1]}'; the list gives its number, so write the item without it`, e.n);
  if (e.layer === 3 && partSlugs.size && !partSlugs.has(doc.slice(7))) warn("id", `${id} names '${doc.slice(7)}', which is not a part in Layer 2 Parts`, e.n);
  if (firstOf.has(id)) warn("id", `${id} repeats the one on ${target.where(firstOf.get(id).n)}`, e.n);
  else firstOf.set(id, e);
}

// id-ref: each citation points to a defined id, inward, and never into another part.
for (const e of live) {
  const ab = e.body.indexOf("Answered by ");
  const risks = e.topic === "Risks";
  for (const c of e.cites) {
    const p = parseId(c.id);
    const answer = risks && ab >= 0 && c.at > ab;
    if (e.layer === 3 && e.entry !== null && p.doc.startsWith("detail.") && p.doc !== `detail.${e.entry.toLowerCase()}`) {
      warn("id-ref", `${c.id} belongs to another part, and the entry '${e.entry}' may not cite it`, e.n);
      continue;
    }
    if (answer) continue;
    if (e.view) { if (!defined.has(c.id)) warn("id-ref", `${c.id} is not defined`, e.n); continue; }
    if (!defined.has(c.id)) warn("id-ref", `${c.id} is not defined`, e.n);
    else if (DOC_LAYER(p.doc) > e.layer) warn("id-ref", `${c.id} is defined in ${p.doc}, which is outward of Layer ${e.layer}`, e.n);
  }
}

// count-ref: an item named by its count or place in words cannot move with its list; cite it by its id (core guide, How to fill it out, id rule).
const COUNT_ORD = "first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|previous|next";
const COUNT_KIND = "items?|qualit(?:y|ies)|constraints?|costs?|risks?|concerns?|scenarios?|decisions?|assumptions?|rules?|limits?|terms?|paths?|seams?";
const COUNT_REF = new RegExp(String.raw`\b(?:(?:${COUNT_ORD}) (?:[a-z-]+ )?(?:${COUNT_KIND})|items? \d+|(?:${COUNT_KIND}) (?:#|no\.? ?)\d+|(?:${COUNT_KIND}) (?:above|below)|(?:above|below) (?:${COUNT_KIND})|(?:see|cf\.?) \d+(?:\.\d+)+)\b`, "gi");
for (const { n, t } of plainLines(rows)) {
  if (t.startsWith("|") || t.startsWith("Title:")) continue;
  const text = clean(t).replace(/settles open concern \d+(?:\.\d+)*/gi, (m) => " ".repeat(m.length));
  for (const m of text.matchAll(COUNT_REF)) warn("count-ref", `'${m[0]}' names an item by its count or place; cite it by its id (for example vision-6.2)`, n);
}

// reasons: Assumptions need Basis and If wrong, Decisions need Reason; read from the id's topic number.
for (const e of live) {
  if (!e.own || e.depth !== 1 || e.body.includes("Not supplied:")) continue;
  const l = e.layer;
  const a = l === 2 ? 10 : 11, d = l === 2 ? 11 : 12;
  if (e.own.topic === a && !(e.body.includes("Basis:") && e.body.includes("If wrong:"))) warn("reasons", "assumption needs 'Basis:' and 'If wrong:'", e.n);
  if (e.own.topic === d && !e.body.includes("Reason:")) warn("reasons", "decision needs 'Reason:'", e.n);
}

// scenario-trace: a Layer 1 value scenario is traced by a Realizes sentence in Layer 2, and in Layer 3 where its path runs through a part that has an entry.
{
  const traced = { 2: new Set(), 3: new Set() };
  const pathText = new Map();   // scenario id -> text of the Layer 2 elements that realize it
  const pathIds = new Map();    // scenario id -> ids of the Layer 2 elements that realize it
  const hasEntry = new Set(units.filter((u) => u.layer === 3).map((u) => u.name.toLowerCase()));
  for (const e of live) {
    if (e.layer < 2) continue;
    for (const m of e.body.matchAll(new RegExp(String.raw`Realizes\s+(${IDCORE})(?!\w|-|\.\d)`, "g"))) {
      traced[e.layer].add(m[1]);
      if (e.layer === 2) {
        pathText.set(m[1], `${pathText.get(m[1]) || ""} ${e.text}`);
        if (e.own) pathIds.set(m[1], [...(pathIds.get(m[1]) || []), e.own.id]);
      }
    }
  }
  const named = (id) => slugsListed.filter((p) => /^[A-Za-z0-9]+$/.test(p.name) && new RegExp(String.raw`(?<![A-Za-z0-9])${p.name}(?![A-Za-z0-9])`).test(pathText.get(id) || ""));
  for (const e of live) {
    if (e.layer !== 1 || !e.own || e.depth !== 1 || e.own.topic !== 3 || e.body.startsWith("Not supplied:")) continue;
    if (seen.includes(2) && !traced[2].has(e.own.id)) warn("scenario-trace", `${e.own.id} has no path in Layer 2`, e.n);
    if (seen.includes(3) && !traced[3].has(e.own.id)) {
      const parts = named(e.own.id);
      const needed = parts.length ? parts.some((p) => hasEntry.has(p.name.toLowerCase())) : hasEntry.size > 0;
      if (needed) {
        const via = (pathIds.get(e.own.id) || []).join(", ");
        const why = parts.length ? `${via ? `path ${via}` : "its path"} names ${parts.length > 1 ? "parts" : "part"} ${parts.map((p) => p.name).join(", ")}` : `its path ${via ? `${via} ` : ""}names no part`;
        warn("scenario-trace", `${e.own.id} has no rule in Layer 3; ${why}`, e.n);
      }
    }
  }
}

// limit-quality: a Limit cites (Layer 1, <quality, topic or Layer 1 id>); the quality is named in bold in Layer 1 Qualities and constraints, or is a Layer 1 topic, or is a vision id.
{
  const norm = (x) => x.replace(/\s+/g, " ").trim().toLowerCase();
  const names = new Set();
  const plain = new Set();
  for (const e of live) {
    if (e.layer !== 1 || e.topic !== "Qualities and constraints" || e.table || e.depth > 1) continue;
    const t = e.text;
    const b = t.match(/\*\*(.+?)\*\*/);
    if (b) names.add(norm(b[1].replace(/:\s*$/, "")));
    const p = t.match(/^([^*:]+):(?:\s|$)/);
    if (p) plain.add(norm(p[1]));
  }
  if (names.size) for (const x of plain) names.add(x);
  if (names.size) {
    for (const t of TOPICS[1]) names.add(norm(t));
    for (const e of live) {
      if (e.layer !== 3 || e.entry === null || e.topic !== "Limits" || e.table || e.depth > 1) continue;
      const cites = [...e.body.matchAll(/\(Layer 1,\s*([^()]*?)\)/g)];
      if (!cites.length) continue;
      const x = cites.at(-1)[1].trim();
      if (x.startsWith("Not supplied:") || /^vision-[1-9]\d*(?:\.[1-9]\d*)+$/.test(x) || names.has(norm(x))) continue;
      warn("limit-quality", `'${x}' is not named in Layer 1 Qualities and constraints`, e.n);
    }
  }
}

// realizes-text: an item that says Realizes <id> keeps the Given and when text of that Layer 1 Value item word for word.
{
  const gw = (s) => {
    const t = s.replace(/\s+/g, " ").trim();
    const i = t.indexOf(", then ");
    return t.startsWith("Given") && i >= 0 ? t.slice(0, i) : null;
  };
  const RZ = new RegExp(String.raw`(?<![\w.-])Realizes\s+(${IDCORE})(?!\w|-|\.\d)[.:)]*\s*`);
  for (const e of live) {
    if (e.layer < 2 || e.table || e.depth > 1) continue;
    const m = e.body.match(RZ);
    if (!m) continue;
    const v = defined.get(m[1]);
    if (!v || v.layer !== 1 || !v.own || v.depth !== 1 || v.own.topic !== 3) continue;
    const mine = gw(e.text.replace(/^\**/, "").replace(RZ, ""));
    const theirs = gw(v.text.replace(/^\**/, ""));
    if (mine === null || theirs === null || mine === theirs) continue;
    warn("realizes-text", `does not keep the Given and when text of ${m[1]} word for word`, e.n);
  }
}

// --- costs and risks topics ----------------------------------------------
const AMOUNT = /^(?:[A-Za-z]+ )*[$€£¥]?(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s+[A-Za-z][^\n]*$/;
const validAmount = (s) => /^Not supplied:\s*\S/.test(s) || AMOUNT.test(s);
const SEVERITY = ["High", "Medium", "Low", "Not rated"];
const SHAPE = { Costs: { check: "cost-shape", no: { 1: 8, 2: 7, 3: 8 } }, Risks: { check: "risk-shape", no: { 1: 9, 2: 8, 3: 9 } }, "Open Concerns": { check: "concern-shape", no: { 1: 10, 2: 9, 3: 10 } } };

for (const e of live) {
  const sh = e.topic && SHAPE[e.topic];
  if (!sh || (e.layer === 3 && e.entry === null) || e.depth > 1) continue;
  const check = sh.check, label = e.topic, kind = e.topic;
  if (e.table) { warn(check, "a table line; write the topic as a list", e.n); continue; }
  if (e.body === "None." || /^Not supplied:\s*\S/.test(e.body)) continue;
  if (!e.own) {
    warn(check, `a line under ${label} must be 'None.' or a list item`, e.n);
    continue;
  }
  const rest = e.body.trim();
  if (kind === "Costs") {
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
    if (!ok) warn(check, `a cost must read 'Given <condition or volume>, when <the subject is built, run or changed>, then it costs <amount>. Paid by <who>.' with a valid amount (the older form '<What>: <amount>. Paid by <who>.' is also accepted)`, e.n);
  } else if (kind === "Open Concerns") {
    const rb = rest.indexOf(". Raised by ");
    const who = rb > 0 ? rest.slice(rb + 12) : "";
    if (rb <= 0 || !/^Given .+, when .+, then .+/.test(rest.slice(0, rb)) || !/^\S.*\.$/.test(who)) {
      warn(check, `an open concern must read 'Given ..., when ..., then .... Raised by <who>.'`, e.n);
    }
  } else {
    const sv = rest.indexOf(". Severity: "), ab = rest.indexOf(". Answered by ");
    const sev = sv > 0 && ab > sv ? rest.slice(sv + 12, ab) : "";
    const ans = ab > 0 ? rest.slice(ab + 14) : "";
    if (sv <= 0 || ab <= sv || !/^Given .+, when .+, then .+/.test(rest.slice(0, sv)) || !SEVERITY.includes(sev) || !/^\S.*\.$/.test(ans)) {
      warn(check, `a risk must read 'Given ..., when ..., then .... Severity: High, Medium, Low or Not rated. Answered by <answer>.'`, e.n);
      continue;
    }
    if (ans.startsWith("Not supplied:")) continue;
    const toks = [...ans.matchAll(TOKEN)].map((m) => m[1]);
    if (!toks.length) warn("risk-ref", "'Answered by' names no id and does not begin 'Not supplied:'", e.n);
    for (const tok of toks) {
      const at = defined.has(tok) ? DOC_LAYER(parseId(tok).doc) : null;
      if (at === null) warn("risk-ref", `${tok} is not defined in a layer`, e.n);
      else if (at > e.layer) warn("risk-ref", `${tok} is defined in Layer ${at}, outward of Layer ${e.layer}`, e.n);
    }
  }
}

if (statusInfo) console.log(statusInfo);
console.log(`INFO not-supplied: ${notSupplied}`);
console.log(`strata-blueprints-lint: ${count} warning(s)`);
process.exitCode = strict && count ? 1 : 0;

// =========================================================================
// Folder mode and impact mode. Function declarations, hoisted; they use no
// constant that is defined after the first call.
// =========================================================================

// The elements of a text: a bullet with its wrapped and nested lines, a paragraph, or a table row.
// Each carries its first line, its layer, topic and open entry, and whether it is a table row.
// The 1-based row that opens a fenced block still open at the end of rows, or 0.
function openFenceRow(rows) {
  let fence = null, at = 0;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].trim();
    if (fence) { if (fenceCloses(t, fence)) fence = null; continue; }
    const f = fenceOpen(t);
    if (f) { fence = f; at = i + 1; }
  }
  return fence ? at : 0;
}

// The elements of a text: a list item with its wrapped lines, a paragraph, or a table row. A list is the run of items at one depth under
// one parent (core guide, How to fill it out, list rule): the items under a topic heading count 1, 2, 3 across the topic, and an item
// nested in another restarts at 1. Each element carries its first and last line, its layer, topic and open entry, the heading it sits under,
// and for a list item its marker, written number, place and depth.
function readElements(rows) {
  const els = [];
  let cur = null, layer = null, topic = null, entry = null, fence = null, head = null, blank = false, view = null;
  let stack = [];                       // open items, outermost first: { el, col (its text column), count (places given to its children) }
  let root = 0;                         // places given at depth 1 under the open heading
  const close = () => { cur = null; };
  const ctx = () => ({ layer, topic, entry, view, headN: head ? head.n : null, headNo: head ? head.no : null });
  const para = (n, text, indent, table = false) => { cur = { n, end: n, text, indent, list: false, table, depth: 0, marker: null, written: null, place: null, pos: null, ...ctx() }; els.push(cur); };
  const append = (el, t, n) => { el.text += " " + t; el.end = n; for (const s of stack) s.el.end = Math.max(s.el.end, n); };
  for (let i = 0; i < rows.length; i++) {
    const line = rows[i].replace(/\r$/, ""), t = line.trim(), n = i + 1;
    const f = fenceOpen(t);
    if (fence) { if (fenceCloses(t, fence)) fence = null; continue; }
    if (f) { fence = f; close(); continue; }
    if (t === "") { close(); blank = true; continue; }
    const after = blank; blank = false;
    if (/^#{1,6}\s/.test(t)) {
      // A view is one list context: a heading inside it ends the open items but not the count.
      if (view && !/^## /.test(t)) { close(); stack = []; continue; }
      close(); stack = []; root = 0; head = null;
      if (/^## /.test(t)) {
        const m = t.match(/^## Layer ([123]): (.+)$/);
        const vm = t.match(/^## View:\s*(.*?)\s*$/);
        layer = m && NAMES[m[1] - 1] === m[2].trim() ? +m[1] : null;
        view = vm ? vm[1] : null;
        topic = null; entry = null;
      } else if (/^### /.test(t)) {
        const pe = t.match(/^### (.+?) \(part\)\s*$/);
        const tp = t.match(/^### (\d+)\. (.+?)\s*$/);
        if (layer === 3 && pe) { entry = pe[1]; topic = null; }
        else if (tp) { topic = tp[2]; head = { n, no: +tp[1] }; if (layer === 3) entry = null; }
        else { topic = null; if (layer === 3) entry = null; }
      } else if (/^#### /.test(t) && layer === 3 && entry !== null) {
        const tp = t.match(/^#### (\d+)\. (.+?)\s*$/);
        topic = tp ? tp[2] : null;
        if (tp) head = { n, no: +tp[1] };
      }
      continue;
    }
    if (t.startsWith("|")) {
      close();
      if (!/^\|[\s:|-]+\|?$/.test(t)) { para(n, t, 0, true); close(); }
      continue;
    }
    if (THEMATIC.test(line)) { close(); stack = []; continue; }
    const indent = line.length - line.trimStart().length;
    const mk = line.match(/^( *)(?:([-*+])|(\d{1,9})([.)]))( +|$)(.*)$/);
    // An indented code block (four spaces past the open item's text, or past the margin) is read as neither an item nor a paragraph.
    const codeCol = (stack.length ? stack.at(-1).col : 0) + 4;
    if (indent >= codeCol && (after || !cur)) { close(); continue; }
    // An ordered marker interrupts a paragraph only when its number is 1.
    const lazy = !!mk && !!cur && !cur.list && !after && !!mk[3] && +mk[3] !== 1;
    if (mk && !lazy) {
      while (stack.length && indent < stack.at(-1).col) stack.pop();
      if (indent >= (stack.length ? stack.at(-1).col : 0) + 4) { if (cur) append(cur, t, n); else close(); continue; }
      const parent = stack.at(-1) || null;
      const place = parent ? ++parent.count : ++root;
      const pos = parent ? [...parent.el.pos, place] : [place];
      const w = (mk[2] ? 1 : mk[3].length + 1);
      const sp = mk[5].length >= 1 && mk[5].length <= 4 ? mk[5].length : 1;
      cur = { n, end: n, text: mk[6], indent, list: true, table: false, depth: stack.length + 1, marker: mk[2] || mk[3] + mk[4], written: mk[3] ? +mk[3] : null, place, pos, ...ctx() };
      els.push(cur);
      stack.push({ el: cur, col: indent + w + sp, count: 0 });
      for (const s of stack.slice(0, -1)) s.el.end = Math.max(s.el.end, n);
      continue;
    }
    if (cur) { append(cur, t, n); continue; }
    // After a blank line, a line indented to an open item's text continues that item (a loose item); anything else ends the list.
    while (stack.length && indent < stack.at(-1).col) stack.pop();
    if (after && stack.length) { cur = stack.at(-1).el; append(cur, t, n); continue; }
    stack = [];
    para(n, t, indent);
  }
  for (const e of els) e.text = e.text.trim();
  return els;
}

// Each list item under a topic gets its full id: the document it sits in, the topic's number (canonical, from the layer guide) and its place,
// nested places joined by dots. With no document (outside a layer, in a view, in Layer 3 with no open entry) or no known topic an item has no id.
function assignOwn(els) {
  for (const e of els) {
    e.body = clean(e.text).trim();
    e.own = null;
    if (e.view && e.list) {
      if (/^[A-Za-z0-9]+$/.test(e.view)) e.own = { id: viewId(e.view, e.pos), doc: "view." + e.view.toLowerCase(), topic: null, item: e.pos[0], pos: e.pos, depth: e.depth };
      continue;
    }
    const doc = docOf(e);
    const tn = e.layer && e.topic ? topicNo(e.layer, e.topic) : null;
    if (!doc || !e.list || tn === null) continue;
    e.own = { id: `${doc}-${tn}.${e.pos.join(".")}`, doc, topic: tn, item: e.pos[0], pos: e.pos, depth: e.depth };
  }
}

function die(msg) { console.error(`strata-blueprints-lint: ${msg}`); process.exit(2); }

// Load a file or a folder. Returns { rows, where(n), folder }.
function loadTarget(arg) {
  if (!fs.existsSync(arg)) die(`no such file: ${arg}`);
  const st = fs.statSync(arg);
  if (st.isDirectory()) return loadFolder(arg);
  if (!st.isFile()) die(`not a file: ${arg}`);
  let text;
  try { text = fs.readFileSync(arg, "utf8"); } catch (e) { die(`cannot read ${arg}: ${e.code || e.message}`); }
  const rows = text.split("\n");
  return { rows, where: (n) => `line ${n}`, folder: null, condensedAt: () => hasMarker(rows[0]) };
}

function slugOf(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

// The lines of a text outside fenced blocks, as { n, t } (1-based line, trimmed text).
function* plainLines(rows) {
  let fence = null;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].trim();
    const f = fenceOpen(t);
    if (fence) { if (fenceCloses(t, fence)) fence = null; continue; }
    if (f) { fence = f; continue; }
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
  if (!hasVision && !hasStructure && !details.length) die(`no sbp-vision.md, sbp-structure.md or sbp-detail-*.md in ${dir}; to lint one document, pass the file`);
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
  const condensed = new Set();
  names.forEach((name, k) => {
    const src = files[name];
    const drop = new Set();
    if (hasMarker(src[0])) { condensed.add(name); drop.add(0); if (src.length > 1 && src[1].trim() === "") drop.add(1); }
    // Version, Status, Blueprint status and Parent lines in the top matter (before the first ## heading) are metadata, not items.
    const meta = new Set();
    for (let i = 0; i < src.length && !/^## /.test(src[i].trim()); i++) if (/^(?:Version|Status|Blueprint status|Parent):/.test(src[i].trim())) { drop.add(i); meta.add(i); }
    const nextNonBlank = (from) => { let j = from; while (j < src.length && (src[j].trim() === "" || meta.has(j))) j++; return j; };
    if (k > 0) {
      let j = nextNonBlank(drop.has(1) ? 2 : drop.has(0) ? 1 : 0);
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
  const condensedAt = (n) => !!map[n - 1] && condensed.has(map[n - 1].file);
  return { rows, where, map, condensedAt, folder: { dir, files, details, hasStructure, structure } };
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

// --ids <file or folder>: one line per defined id, <id>\t<file>\t<line>\t<end>, in document order. Read-only; no warning is printed.
async function runIds(args) {
  const opts = args.filter((a) => a.startsWith("--"));
  if (opts.length) die(`unknown option in --ids mode: ${opts[0]}`);
  if (args.length < 1) die("--ids needs a file or folder");
  if (args.length > 1) die(`unexpected extra argument: ${args[1]}`);
  const target = loadTarget(args[0]);
  const els = readElements(target.rows);
  assignOwn(els);
  const at = (n) => (target.map && target.map[n - 1] ? target.map[n - 1] : { file: args[0], line: n });
  const out = [];
  for (const e of els) if (e.own) out.push(`${e.own.id}\t${at(e.n).file}\t${at(e.n).line}\t${at(e.end).line}`);
  process.exitCode = 0;
  await new Promise((done) => process.stdout.write(out.length ? out.join("\n") + "\n" : "", done));
  process.exit(0);
}

// --impact <id>[,<id>...] <file or folder>
async function runImpact(args) {
  const opts = args.filter((a) => a.startsWith("--"));
  if (opts.length) die(`unknown option in --impact mode: ${opts[0]}`);
  if (args.length < 1) die("--impact needs an id and a file or folder");
  const [idList, arg] = args;
  const ids = [];
  for (const id of idList.split(",")) {
    if (!new RegExp(`^${IDCORE}$`).test(id)) die(`not an id: ${id}`);
    if (!ids.includes(id)) ids.push(id);
  }
  if (arg === undefined) die("--impact needs a file or folder after the id");
  if (args.length > 2) die(`unexpected extra argument: ${args[2]}`);
  const target = loadTarget(arg);
  const els = readElements(target.rows);
  // Element facts: label, own id, cites.
  for (const e of els) {
    e.label = e.view ? `View ${e.view}` : e.layer === null ? "Other"
      : `Layer ${e.layer} > ${e.entry !== null ? (e.topic ? `${e.entry} (part) > ${e.topic}` : `${e.entry} (part)`) : (e.topic || "-")}`;
  }
  assignOwn(els);
  for (const e of els) {
    e.id = e.own ? e.own.id : null;
    e.cites = [...new Set([...e.body.matchAll(TOKEN)].map((m) => m[1]).filter((x) => x !== e.id))];
  }
  const defs = new Map(), dups = [];
  for (const e of els) if (e.id) { if (defs.has(e.id)) dups.push([e.id, defs.get(e.id), e]); else defs.set(e.id, e); }
  const place = (e) => target.where(e.n);
  const cut = (s) => (s.length > 80 ? s.slice(0, 80) + "..." : s);
  const blocks = [];
  let code = 0;
  for (const id of ids) {
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
    if (seed) out.push(`impact ${id}: defined in ${seed.view ? `View ${seed.view}` : seed.layer === null ? "Other" : `Layer ${seed.layer}`}, ${place(seed)}`);
    else { out.push(`WARN impact: ${id} is not defined in ${arg}`); code = 1; }
    out.push(id);
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
    blocks.push(out.join("\n"));
  }
  // Wait for the write to finish so a slow pipe reader still receives every byte, then exit before the rest of the script runs.
  process.exitCode = code;
  await new Promise((done) => process.stdout.write(blocks.join("\n\n") + "\n", done));
  process.exit(code);
}
