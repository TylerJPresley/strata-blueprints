// SPDX-License-Identifier: MIT
// Tests that every Strata Blueprints example traces values to paths to rules, lines up
// Run: node --test tests/strata-blueprints-examples.test.mjs
// seams, gives every part an entry, and keeps Layer 1 free of parts and means.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SKILL = process.env.STRATA_ROOT
  ? path.join(process.env.STRATA_ROOT, "skills", "strata-blueprints")
  : path.join(here, "..", "skills", "strata-blueprints");
const EXAMPLES_DIR = path.join(SKILL, "references");
const LINT = path.join(SKILL, "scripts", "strata-blueprints-lint.mjs");
const GUIDE = path.join(SKILL, "references", "strata-blueprints-guide.md");
const LAYER_FILES = [1, 2, 3].map((n) => path.join(SKILL, "references", `strata-blueprints-guide-layer-${n}.md`));

// --- Manifest: one entry per example file, keyed by file name (D4, D12). ---
// The idea example is the only example allowed no Layer 3.
const MANIFEST = {
  "strata-blueprints-example.md": {
    full: false,
    layer3: false,
    values: 3,
    notSupplied: [3, 3],
    lifecycle: false,
    allow: ["plot", "plots", "rota", "water", "waters"],
    means: ["barrel", "barrels", "hose"],
  },
  "strata-blueprints-example-todo-app": {
    folder: true,
    full: true,
    layer3: true,
    values: 7,
    notSupplied: [1, 5],
    lifecycle: true,
    allow: [],
    means: ["server", "servers", "client", "clients", "cloud", "database", "API",
      "HTTP", "HTTPS", "REST", "JSON", "SQL", "SQLite", "Postgres", "push",
      "WebSocket", "JavaScript", "TypeScript", "Swift", "Kotlin", "React", "token",
      "tokens", "bcrypt", "TLS", "OAuth", "cron", "queue", "iOS", "Android", "browser"],
  },
  "strata-blueprints-example-rfp.md": {
    full: false,
    layer3: true,
    // An RFP gives Detail only where the town fixes a limit or a rule, and leaves
    // Construction and Inside to the bidder: its title and path shape differ.
    rfp: true,
    minPathParts: 1,
    values: 6,
    notSupplied: [17, 17],
    lifecycle: false,
    allow: ["booking", "bookings", "desk"],
    means: ["server", "servers", "client", "clients", "cloud", "database", "API",
      "HTTP", "HTTPS", "REST", "JSON", "SQL", "SQLite", "Postgres", "push",
      "WebSocket", "JavaScript", "TypeScript", "Swift", "Kotlin", "React", "token",
      "tokens", "bcrypt", "TLS", "OAuth", "cron", "queue", "iOS", "Android", "browser"],
  },
};

// --- Guide topic names, read from the three **Contents:** lists (D12). ---
function readGuideTopics() {
  const lists = [];
  for (const file of LAYER_FILES) {
    const lines = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
    let current = null;
    for (const raw of lines) {
      const t = raw.trim();
      if (/^- \*\*Contents:\*\*$/.test(t)) { current = []; lists.push(current); continue; }
      if (current) {
        const m = t.match(/^\d+\.\s+\*\*([^:*]+?)[:.]?\*\*/);
        if (m) { current.push(m[1].trim()); continue; }
        // A non-numbered bullet or a new section ends the list.
        if (/^- \*\*/.test(t) || /^#/.test(t)) current = null;
      }
    }
  }
  return lists.filter((l) => l.length > 0);
}

const GUIDE_TOPICS = readGuideTopics();
const LAYER1_TOPICS = GUIDE_TOPICS[0];
const LAYER2_TOPICS = GUIDE_TOPICS[1];
const LAYER3_TOPICS = GUIDE_TOPICS[2];

// --- Parsing helpers. ---
// An item is written with its number, <topic>.<item>: 3.1, 6.1, 4.2. Its id puts the document in front, for a citation:
// vision-3.1, structure-6.1, detail.ledger-4.2.
const ID = String.raw`(?:vision|structure|detail\.[a-z0-9]+)-[1-9]\d*\.[1-9]\d*`;
const NUM = String.raw`[1-9]\d*\.[1-9]\d*`;
const OWN = String.raw`(?:${ID}|${NUM})`;
const SCEN = new RegExp(String.raw`^\s*(?:[-*+]|\d+[.)])\s+(?:${OWN}\.\s+)?(?:Realizes ${ID}\.\s+)?Given (.+?), when (.+?), then (.+)$`);
// A separate regex reads the scenario id off a line: the id after "Realizes " when there is one, else the written number.
const SCEN_ID = new RegExp(String.raw`^\s*(?:[-*+]|\d+[.)])\s+(?:${OWN}\.\s+Realizes\s+)?(${OWN})\.\s+Given `);
// A Layer 1 number read as the id it stands for.
const fid = (id) => (id && /^\d/.test(id) ? `vision-${id}` : id);

function normWs(s) { return s.replace(/\s+/g, " ").trim(); }

// Split a document into layer sections: { num, start, lines }.
// A layer runs from its "## Layer N:" heading to the next "## " heading.
function splitLayers(text) {
  const rows = text.split("\n");
  const layers = [];
  let fence = false;
  let cur = null;
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].trim();
    if (/^```/.test(t)) fence = !fence;
    if (!fence && /^## /.test(t)) {
      if (cur) layers.push(cur);
      const m = t.match(/^## Layer (\d+):/);
      cur = m ? { num: +m[1], heading: t, lines: [], headingLine: i } : null;
      if (cur) continue;
      // Non-layer "## " heading closes any open layer.
      cur = null;
      continue;
    }
    if (cur) cur.lines.push(rows[i]);
  }
  if (cur) layers.push(cur);
  return layers;
}

// Return lines that are outside fenced blocks.
function unfenced(lines) {
  const out = [];
  let fence = false;
  for (const l of lines) {
    if (/^```/.test(l.trim())) { fence = !fence; continue; }
    if (!fence) out.push(l);
  }
  return out;
}

// Collect scenario (G, W) pairs from a set of lines, outside fences.
function scenarioPairs(lines) {
  const out = [];
  for (const l of unfenced(lines)) {
    const m = l.match(SCEN);
    if (m) {
      const idm = l.match(SCEN_ID);
      out.push({ id: idm ? idm[1] : null, g: normWs(m[1]), w: normWs(m[2]), t: normWs(m[3]), raw: l });
    }
  }
  return out;
}

// Within a layer's lines, return the body lines of one topic by name.
// Handles both "### N. Name" and "#### N. Name" and unnumbered "### Name (part)".
function topicBody(layerLines, topicName) {
  const out = [];
  let inTopic = false;
  for (const l of layerLines) {
    const t = l.trim();
    const h = t.match(/^(#{3,4})\s+(?:\d+\.\s+)?(.+?)\s*$/);
    if (h) {
      inTopic = h[2] === topicName;
      continue;
    }
    if (inTopic) out.push(l);
  }
  return out;
}

// Parse Layer 2 parts: "- Name (part): responsibility" in topic "Parts".
function parseParts(layer2) {
  const body = topicBody(layer2.lines, "Parts");
  const parts = [];
  for (const l of unfenced(body)) {
    const m = l.match(new RegExp(String.raw`^\s*[-*+]\s+(?:${NUM}\.\s+)?(.+?)\s+\(part\):\s*(.*)$`));
    if (m) parts.push({ name: m[1].trim(), resp: m[2].trim() });
  }
  return parts;
}

// Layer 2 seam names: text before first ": " in bullets of the two seam topics.
function layer2SeamNames(layer2) {
  const names = [];
  for (const topic of ["Seams between parts", "Seams with the outside"]) {
    for (const l of unfenced(topicBody(layer2.lines, topic))) {
      const m = l.match(new RegExp(String.raw`^\s*[-*+]\s+(?:${NUM}\.\s+)?(.+?):\s`));
      if (m) names.push(m[1].trim());
    }
  }
  return names;
}

// Whole-word, case-sensitive check that a path names a part.
function namesPart(text, part) {
  const re = new RegExp("\\b" + part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
  return re.test(text);
}

// Build the list of Layer 1 forbidden part-name word variants (name, +s, -s).
function partVariants(name) {
  const set = new Set([name, name + "s"]);
  if (name.endsWith("s")) set.add(name.slice(0, -1));
  return [...set];
}

// Does a line (lowercased) contain a word, whole-word, any case?
function hasWord(lineLower, word) {
  const re = new RegExp("\\b" + word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
  return re.test(lineLower);
}

// Is a Layer 3 section in the multi-entry form (has "### X (part)" headings)?
function layer3Entries(layer3) {
  const entries = [];
  let cur = null;
  for (const l of layer3.lines) {
    const t = l.trim();
    const he = t.match(/^###\s+(.+?)\s+\(part\)\s*$/);
    if (he) { if (cur) entries.push(cur); cur = { name: he[1].trim(), lines: [] }; continue; }
    // A single-entry form has no "(part)" entry headings.
    if (cur) cur.lines.push(l);
  }
  if (cur) entries.push(cur);
  return entries;
}

// Single-entry form: entry name taken out of the "Scope: one part, <Name>." line.
function singleEntryName(layer3) {
  for (const l of layer3.lines) {
    const m = l.trim().match(/^Scope:\s*one part,\s*(.+?)\.\s*$/);
    if (m) return m[1].trim();
  }
  return null;
}

// --- Folder examples: one virtual document by the folder rule (the lint's D2 rule, in test code). ---
function assemble(folder) {
  const names = fs.readdirSync(folder);
  const read = (n) => fs.readFileSync(path.join(folder, n), "utf8").replace(/\r\n/g, "\n");
  // Drops the title and the metadata lines (Version, Status, Blueprint status, Parent) that follow it, as the lint's loadFolder does.
  const dropTitle = (t) => t.replace(/^# [^\n]*\n\n?(?:(?:Version|Status|Blueprint status|Parent):[^\n]*\n)*\n?/, "");
  const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const structure = read("sbp-structure.md");
  const order = parseParts(splitLayers(structure).find((l) => l.num === 2) || { lines: [] }).map((p) => slug(p.name));
  const details = names.filter((n) => /^sbp-detail-.+\.md$/.test(n)).sort((a, b) => {
    const ia = order.indexOf(a.slice(11, -3)), ib = order.indexOf(b.slice(11, -3));
    if (ia < 0 && ib < 0) return a < b ? -1 : 1;
    if (ia < 0) return 1;
    if (ib < 0) return -1;
    return ia - ib;
  });
  const out = [read("sbp-vision.md"), dropTitle(structure)];
  details.forEach((n, i) => {
    let t = dropTitle(read(n));
    if (i > 0) t = t.replace(/^## Layer 3: Detail\n\n?/, "").replace(/^Scope:[^\n]*\n\n?/, "");
    out.push(t);
  });
  return out.map((t) => t.replace(/\n+$/, "")).join("\n\n") + "\n";
}

// The text the checks read: a file as is; a folder assembled, with its README's notice section at the end.
function readExample(target) {
  if (!fs.statSync(target).isDirectory()) return fs.readFileSync(target, "utf8");
  const readme = fs.readFileSync(path.join(target, "README.md"), "utf8");
  const i = readme.indexOf("## What to notice");
  return assemble(target) + (i < 0 ? "" : "\n" + readme.slice(i).replace(/\n+$/, "\n"));
}

// --- The checks. Returns an array of {code, msg}; throws nothing for content. ---
function checkExample(file, spec) {
  const findings = [];
  const add = (code, msg) => findings.push({ code, msg });
  const text = readExample(file);
  const rows = text.split("\n");

  // lint: --strict exit 0 and last line "strata-blueprints-lint: 0 warning(s)".
  let lintOut = "";
  let lintCode = 0;
  try {
    lintOut = execFileSync(process.execPath, [LINT, file, "--strict"], { encoding: "utf8" });
  } catch (e) {
    lintCode = e.status ?? 1;
    lintOut = (e.stdout || "") + (e.stderr || "");
  }
  const lintLines = lintOut.trimEnd().split("\n");
  const lastLine = lintLines[lintLines.length - 1] || "";
  if (lintCode !== 0 || lastLine !== "strata-blueprints-lint: 0 warning(s)") {
    add("lint", `lint did not pass clean (exit ${lintCode}, last line: ${lastLine})`);
  }
  const nsMatch = lintOut.match(/INFO not-supplied: (\d+)/);
  const notSupplied = nsMatch ? +nsMatch[1] : -1;

  // title: line 1 "# Example: <subject> (companion to the Strata Blueprints guide)".
  const titleRe = spec.rfp ? /^# .+ \(RFP\)\s*$/ : /^# Example: .+ \(companion to the Strata Blueprints guide\)\s*$/;
  if (!titleRe.test(rows[0] || "")) {
    add("title", `line 1 is not a well-formed Example title: ${rows[0] || ""}`);
  }

  const layers = splitLayers(text);
  const l1 = layers.find((l) => l.num === 1);
  const l2 = layers.find((l) => l.num === 2);
  const l3 = layers.find((l) => l.num === 3);

  // topics: Layers 1 and 2 as numbered ###; names and order exact; non-empty.
  function checkNumberedTopics(layer, names, label) {
    if (!layer) { add("topics", `${label} is missing`); return; }
    const found = [];
    let lastHeadingIdx = -1;
    let bodyLines = [];
    for (const l of layer.lines) {
      const t = l.trim();
      const h = t.match(/^###\s+(\d+)\.\s+(.+?)\s*$/);
      if (h) {
        if (found.length) {
          // Previous topic's body must be non-empty.
          if (bodyLines.filter((b) => b.trim() !== "").length === 0) {
            add("topics", `${label} topic '${found[found.length - 1]}' has an empty body`);
          }
        }
        found.push(h[2]);
        bodyLines = [];
      } else if (found.length) bodyLines.push(l);
    }
    if (found.length && bodyLines.filter((b) => b.trim() !== "").length === 0) {
      add("topics", `${label} topic '${found[found.length - 1]}' has an empty body`);
    }
    if (found.join("|") !== names.join("|")) {
      add("topics", `${label} topics are ${JSON.stringify(found)}, expected ${JSON.stringify(names)}`);
    }
  }
  checkNumberedTopics(l1, LAYER1_TOPICS, "Layer 1");
  checkNumberedTopics(l2, LAYER2_TOPICS, "Layer 2");

  // Layer 3 topics: entries as numbered ####, or ### in the single-entry form.
  const parts = l2 ? parseParts(l2) : [];
  let entries = l3 ? layer3Entries(l3) : [];
  const multiEntry = entries.length > 0;
  // A unified entry list for seam and limits checks: the multi-entry entries,
  // or the single entry (its lines are the whole Layer 3 body, named by Scope).
  const checkEntries = l3
    ? (multiEntry ? entries : [{ name: singleEntryName(l3) || "", lines: l3.lines }])
    : [];
  if (l3) {
    if (multiEntry) {
      for (const e of entries) {
        const found = [];
        const bodies = {};
        let last = null;
        for (const l of e.lines) {
          const h = l.trim().match(/^####\s+(\d+)\.\s+(.+?)\s*$/);
          if (h) { found.push(h[2]); last = h[2]; bodies[last] = []; }
          else if (last) bodies[last].push(l);
        }
        const want3 = spec.layer3Topics || LAYER3_TOPICS;
        if (found.join("|") !== want3.join("|")) {
          add("topics", `Layer 3 entry '${e.name}' topics are ${JSON.stringify(found)}, expected ${JSON.stringify(want3)}`);
        }
        for (const [name, body] of Object.entries(bodies)) {
          const content = body.filter((b) => b.trim() !== "");
          if (content.length === 0) {
            add("topics", `Layer 3 entry '${e.name}' topic '${name}' has an empty body`);
          } else {
            const onlyNone = content.length === 1 && content[0].trim() === "None.";
            const idx = LAYER3_TOPICS.indexOf(name);
            if (onlyNone && ![1, 4, 5, 6, 7, 8, 9, 10, 11].includes(idx)) {
              add("topics", `Layer 3 entry '${e.name}' topic '${name}' may not be 'None.'`);
            }
          }
        }
      }
    } else {
      // Single-entry form: topics at ###.
      const found = [];
      let last = null;
      const bodies = {};
      for (const l of l3.lines) {
        const h = l.trim().match(/^###\s+(\d+)\.\s+(.+?)\s*$/);
        if (h) { found.push(h[2]); last = h[2]; bodies[last] = []; }
        else if (last) bodies[last].push(l);
      }
      if (found.join("|") !== LAYER3_TOPICS.join("|")) {
        add("topics", `Layer 3 topics are ${JSON.stringify(found)}, expected ${JSON.stringify(LAYER3_TOPICS)}`);
      }
      for (const [name, body] of Object.entries(bodies)) {
        if (body.filter((b) => b.trim() !== "").length === 0) {
          add("topics", `Layer 3 topic '${name}' has an empty body`);
        }
      }
    }
  } else {
    // An example the manifest marks as an idea (layer3 false) is allowed no
    // Layer 3; a full example missing it is a topics finding.
    if (spec.layer3 !== false) add("topics", "Layer 3 is missing");
  }
  // idea-layer3: an idea example must not carry a Layer 3 section.
  if (spec.layer3 === false && l3) {
    add("idea-layer3", "Layer 3 present in an example the manifest marks as an idea");
  }

  // parts: at least one; names unique; responsibility non-empty.
  if (parts.length === 0) add("parts", "no parts found in Layer 2");
  const partNames = parts.map((p) => p.name);
  if (new Set(partNames).size !== partNames.length) add("parts", "part names are not unique");
  for (const p of parts) if (p.resp === "") add("parts", `part '${p.name}' has no responsibility`);

  // value-count: Layer 1 Value scenarios equal spec.values.
  const valuePairs = l1 ? scenarioPairs(topicBody(l1.lines, "Value")) : [];
  if (valuePairs.length !== spec.values) {
    add("value-count", `Layer 1 has ${valuePairs.length} Value scenarios, expected ${spec.values}`);
  }

  // scenario-id (every example): Layer 1 Value numbers are exactly 3.1..3.n in order
  // and every Value line carries one.
  for (let i = 0; i < valuePairs.length; i++) {
    const want = `3.${i + 1}`;
    if (valuePairs[i].id === null) {
      add("scenario-id", `Layer 1 Value line ${i + 1} has no scenario id: ${valuePairs[i].raw.trim()}`);
    } else if (valuePairs[i].id !== want) {
      add("scenario-id", `Layer 1 Value id is '${valuePairs[i].id}', expected '${want}'`);
    }
  }

  // path-for-value: multiset of (id,G,W) in Layer 1 Value equals Layer 2 paths; no dup.
  const pathPairs = l2 ? scenarioPairs(topicBody(l2.lines, "Scenario paths")) : [];
  const key = (p) => (fid(p.id) || "") + "\u0000" + p.g + "\u0000" + p.w;
  const vKeys = valuePairs.map(key).sort();
  const pKeys = pathPairs.map(key).sort();
  if (new Set(pKeys).size !== pKeys.length) add("path-for-value", "a Layer 2 path (id,G,W) tuple is duplicated");
  if (vKeys.join("\u0001") !== pKeys.join("\u0001")) {
    add("path-for-value", "Layer 1 Value (id,G,W) tuples do not match Layer 2 Scenario paths");
  }

  // path-parts: each path names at least two parts (case-sensitive whole words).
  for (const p of pathPairs) {
    const named = partNames.filter((n) => namesPart(p.t, n));
    if (named.length < (spec.minPathParts || 2)) add("path-parts", `a Layer 2 path names fewer than two parts: ${p.raw.trim()}`);
  }

  // part-in-path (full only): every part named in at least one path.
  if (spec.full) {
    const allPathText = pathPairs.map((p) => p.t).join(" ");
    for (const n of partNames) {
      if (!namesPart(allPathText, n)) add("part-in-path", `part '${n}' is named in no Layer 2 path`);
    }
  }

  // entry-per-part: full => entries equal parts each once; every example => no
  // entry for a non-part.
  if (l3) {
    if (multiEntry) {
      const entryNames = entries.map((e) => e.name);
      for (const en of entryNames) {
        if (!partNames.includes(en)) add("entry-per-part", `Layer 3 entry '${en}' is not a Layer 2 part`);
      }
      if (spec.full) {
        for (const n of partNames) {
          const c = entryNames.filter((x) => x === n).length;
          if (c !== 1) add("entry-per-part", `part '${n}' has ${c} Layer 3 entries, expected 1`);
        }
      }
    } else {
      const en = singleEntryName(l3);
      if (en && !partNames.includes(en)) add("entry-per-part", `Layer 3 entry '${en}' is not a Layer 2 part`);
      // A full example needs one entry for every part; the single-entry form
      // covers only its own part, so every other part has zero entries.
      if (spec.full) {
        for (const n of partNames) {
          const c = n === en ? 1 : 0;
          if (c !== 1) add("entry-per-part", `part '${n}' has ${c} Layer 3 entries, expected 1`);
        }
      }
    }
  }

  // rule-for-path (full examples and the RFP, D3b): every value has a rule with
  // same (G,W) in an entry of a part that path names.
  if ((spec.full || spec.rfp) && l3 && multiEntry) {
    for (const v of valuePairs) {
      const path = pathPairs.find((p) => fid(p.id) === fid(v.id) && p.g === v.g && p.w === v.w);
      const pathParts = path ? partNames.filter((n) => namesPart(path.t, n)) : [];
      let matched = false;
      for (const e of entries) {
        if (!pathParts.includes(e.name)) continue;
        const rules = scenarioPairs(topicBody(e.lines, "Rules"));
        if (rules.some((r) => fid(r.id) === fid(v.id) && r.g === v.g && r.w === v.w)) { matched = true; break; }
      }
      if (!matched) add("rule-for-path", `value ${v.id || "(no id)"} has no matching Layer 3 rule in a named part: Given ${v.g}, when ${v.w}`);
    }
  }

  // Seam checks (both forms): each entry's Seams topic names Layer 2 seams.
  if (l3 && l2) {
    const l2Names = layer2SeamNames(l2);
    for (const e of checkEntries) {
      // An entry with no Seams topic has no seams to match. The topic-order
      // check above fails a full example that lacks the heading, so this skip
      // never hides a deleted Seams heading there.
      if (!e.lines.some((x) => /^#{3,4}\s+\d+\.\s+Seams\s*$/.test(x.trim()))) continue;
      const seamBody = unfenced(topicBody(e.lines, "Seams"));
      const seamNames = [];
      for (const l of seamBody) {
        const m = l.match(new RegExp(String.raw`^\s*[-*+]\s+(?:${NUM}\.\s+)?(.+?),\s+(offers and needs|offers|needs)\b`));
        if (m) seamNames.push(m[1].trim());
        else if (/^\s*[-*+]\s+\S/.test(l)) add("seam-form", `Layer 3 seam bullet is malformed in '${e.name}': ${l.trim()}`);
      }
      // seams-named: every listed seam name matches a Layer 2 seam name exactly.
      for (const sn of seamNames) {
        if (!l2Names.includes(sn)) add("seams-named", `Layer 3 seam '${sn}' in '${e.name}' matches no Layer 2 seam`);
      }
      // seam-missing: every Layer 2 seam whose name contains this part's name is listed.
      for (const l2n of l2Names) {
        if (namesPart(l2n, e.name) && !seamNames.includes(l2n)) {
          add("seam-missing", `entry '${e.name}' omits Layer 2 seam '${l2n}'`);
        }
      }
    }
  }

  // limits-trace: every Limits bullet names its source as "(Layer 1, ...)".
  if (l3) {
    for (const e of checkEntries) {
      for (const l of unfenced(topicBody(e.lines, "Limits"))) {
        if (/^\s*[-*+]\s+\S/.test(l) && !/\(Layer 1,[^)]*\)/.test(l)) {
          add("limits-trace", `Limits bullet in '${e.name}' names no '(Layer 1, ...)' source: ${l.trim()}`);
        }
      }
    }
  }

  // layer1-no-parts: Layer 1 names no part variant (any case, whole word), minus allow.
  if (l1) {
    const allow = new Set(spec.allow.map((a) => a.toLowerCase()));
    const forbidden = [];
    for (const p of partNames) for (const v of partVariants(p)) {
      if (!allow.has(v.toLowerCase())) forbidden.push(v);
    }
    for (const l of unfenced(l1.lines)) {
      const low = l.toLowerCase();
      for (const w of forbidden) {
        if (hasWord(low, w)) { add("layer1-no-parts", `Layer 1 names part word '${w}': ${l.trim()}`); break; }
      }
    }
  }

  // layer1-no-means: Layers 1 and 2 use no means word (any case, whole word).
  for (const layer of [l1, l2].filter(Boolean)) {
    for (const l of layer.lines) {
      const low = l.toLowerCase();
      for (const w of spec.means) {
        if (hasWord(low, w)) { add("layer1-no-means", `Layer ${layer.num} uses means word '${w}': ${l.trim()}`); break; }
      }
    }
  }

  // scope-form (full only): Layer 3 Scope line is the exact D1 text.
  if (spec.full && l3) {
    const want = "Scope: one part in each entry below; there is one entry for every part listed in Layer 2.";
    const scopeLine = l3.lines.map((l) => l.trim()).find((t) => t.startsWith("Scope:"));
    if (scopeLine !== want) add("scope-form", `Layer 3 Scope line is '${scopeLine}', expected '${want}'`);
  }

  // ids-unique: every number that opens an item is unique in its document (Layer 1, Layer 2, or one Layer 3 part).
  {
    const ids = [];
    let fence = false, doc = null;
    for (const l of rows) {
      const t = l.trim();
      if (/^```/.test(t)) fence = !fence;
      if (fence) continue;
      const lh = t.match(/^## Layer (\d)/);
      if (lh) doc = lh[1] === "1" ? "vision" : lh[1] === "2" ? "structure" : null;
      const pe = t.match(/^### (.+?) \(part\)\s*$/);
      if (pe && doc !== "vision" && doc !== "structure") doc = `detail.${pe[1].toLowerCase()}`;
      if (/^### /.test(t) && !pe && (doc || "").startsWith("detail.")) doc = null;
      const m = t.match(new RegExp(String.raw`^(?:[-*+]|\d+[.)])\s+(${NUM})\.`));
      if (m && doc) ids.push(`${doc}-${m[1]}`);
    }
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) add("ids-unique", `id '${id}' appears more than once`);
      seen.add(id);
    }
  }

  // not-supplied-count: within spec.notSupplied range.
  if (notSupplied < spec.notSupplied[0] || notSupplied > spec.notSupplied[1]) {
    add("not-supplied-count", `not-supplied is ${notSupplied}, expected ${spec.notSupplied[0]}..${spec.notSupplied[1]}`);
  }

  // lifecycle: "## View: Lifecycle" with >=4 Given/when/then lines (D10).
  if (spec.lifecycle) {
    const lcIdx = rows.findIndex((l) => /^## View: Lifecycle\s*$/.test(l.trim()));
    if (lcIdx < 0) add("lifecycle", "no '## View: Lifecycle' heading");
    else {
      let end = rows.length;
      for (let i = lcIdx + 1; i < rows.length; i++) if (/^## /.test(rows[i].trim())) { end = i; break; }
      const lc = scenarioPairs(rows.slice(lcIdx + 1, end));
      if (lc.length < 4) add("lifecycle", `Lifecycle view has ${lc.length} scenario lines, expected at least 4`);
    }
  }

  // notice: "## What to notice" with at least 3 bullets.
  {
    const nIdx = rows.findIndex((l) => /^## What to notice\s*$/.test(l.trim()));
    if (nIdx < 0) add("notice", "no '## What to notice' heading");
    else {
      let end = rows.length;
      for (let i = nIdx + 1; i < rows.length; i++) if (/^## /.test(rows[i].trim())) { end = i; break; }
      const bullets = rows.slice(nIdx + 1, end).filter((l) => /^\s*[-*+]\s+\S/.test(l));
      if (bullets.length < 3) add("notice", `'## What to notice' has ${bullets.length} bullets, expected at least 3`);
    }
  }

  return findings;
}

function reportFindings(findings) {
  return findings.map((f) => `FINDING ${f.code}: ${f.msg}`).join("\n");
}

// --- Mutation helpers: each returns new text or throws if the target is absent. ---
function mustReplace(text, find, repl, desc) {
  if (text.indexOf(find) === -1) throw new Error(`mutation target not found: ${desc}`);
  return text.replace(find, repl);
}

function firstLineMatching(rows, re) {
  for (let i = 0; i < rows.length; i++) if (re.test(rows[i])) return i;
  return -1;
}

function layerRange(rows, num) {
  const start = firstLineMatching(rows, new RegExp(`^## Layer ${num}:`));
  if (start < 0) return null;
  let end = rows.length;
  for (let i = start + 1; i < rows.length; i++) if (/^## /.test(rows[i])) { end = i; break; }
  return [start, end];
}

const MUTATIONS = {
  lint(text) { return text.replace(/\n$/, "") + "\nTODO finish\n"; },
  "path-for-value"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 2);
    if (!r) throw new Error("no Layer 2 for path-for-value");
    let inScen = false;
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+\d+\.\s+Scenario paths\s*$/.test(rows[i].trim())) { inScen = true; continue; }
      if (inScen && /^###/.test(rows[i].trim())) break;
      if (inScen && SCEN.test(rows[i])) { rows.splice(i, 1); return rows.join("\n"); }
    }
    throw new Error("no Layer 2 path line to delete");
  },
  "rule-for-path"(text) {
    const rows = text.split("\n");
    const layers = splitLayers(text);
    const l1 = layers.find((l) => l.num === 1);
    const r = layerRange(rows, 3);
    if (!r || !l1) throw new Error("no Layer 1/3 for rule-for-path");
    const firstValue = scenarioPairs(topicBody(l1.lines, "Value"))[0];
    if (!firstValue) throw new Error("no first value for rule-for-path");
    // Change every Layer 3 rule that matches the first value's (G, W) so the
    // value loses its trace.
    let changed = false;
    for (let i = r[0]; i < r[1]; i++) {
      const m = rows[i].match(SCEN);
      if (m && normWs(m[1]) === firstValue.g && normWs(m[2]) === firstValue.w) {
        rows[i] = rows[i].replace(`Given ${m[1]}, when`, "Given a changed situation, when");
        changed = true;
      }
    }
    if (!changed) throw new Error("no Layer 3 rule matched the first value for rule-for-path");
    return rows.join("\n");
  },
  "rule-delete"(text) {
    // Delete one Layer 3 rule that cites a V id.
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for rule-delete");
    for (let i = r[0]; i < r[1]; i++) {
      if (new RegExp(String.raw`^\s*[-*+]\s+${OWN}\.\s+Realizes ${ID}\.\s+Given `).test(rows[i])) { rows.splice(i, 1); return rows.join("\n"); }
    }
    throw new Error("no Layer 3 rule that realizes a scenario for rule-delete");
  },
  "seams-heading"(text) {
    // Delete the Seams heading of the first Layer 3 entry.
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for seams-heading");
    for (let i = r[0]; i < r[1]; i++) {
      if (/^#{3,4}\s+\d+\.\s+Seams\s*$/.test(rows[i].trim())) { rows.splice(i, 1); return rows.join("\n"); }
    }
    throw new Error("no Seams heading for seams-heading");
  },
  "entry-per-part"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for entry-per-part");
    let lastEntry = -1;
    for (let i = r[0]; i < r[1]; i++) if (/^###\s+.+\(part\)\s*$/.test(rows[i].trim())) lastEntry = i;
    if (lastEntry < 0) throw new Error("no Layer 3 entry to delete");
    let end = r[1];
    for (let i = lastEntry + 1; i < r[1]; i++) if (/^###\s+.+\(part\)\s*$/.test(rows[i].trim())) { end = i; break; }
    rows.splice(lastEntry, end - lastEntry);
    return rows.join("\n");
  },
  "entry-per-part-single"(text) {
    // Collapse a multi-entry Layer 3 into single-entry form naming the first
    // part: keep that entry's topics (as ###), drop every other entry. A full
    // example then has zero entries for its other parts.
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for entry-per-part-single");
    const starts = [];
    for (let i = r[0]; i < r[1]; i++) {
      const m = rows[i].trim().match(/^###\s+(.+?)\s+\(part\)\s*$/);
      if (m) starts.push({ i, name: m[1].trim() });
    }
    if (starts.length < 2) throw new Error("need two Layer 3 entries for entry-per-part-single");
    const first = starts[0];
    const firstEnd = starts[1].i;
    // Topic lines of the first entry, demoted from #### to ###.
    const kept = rows.slice(first.i + 1, firstEnd)
      .map((l) => l.replace(/^(\s*)####(\s)/, "$1###$2"));
    const scope = `Scope: one part, ${first.name}.`;
    const out = rows.slice(0, first.i).concat([scope, ""], kept, rows.slice(r[1]));
    return out.join("\n");
  },
  "part-in-path"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 2);
    if (!r) throw new Error("no Layer 2 for part-in-path");
    for (let i = r[0]; i < r[1]; i++) {
      if (/^\s*[-*+]\s+.+\(part\):/.test(rows[i])) {
        rows.splice(i + 1, 0, "- 1.99. Ghost (part): a part nothing uses.");
        return rows.join("\n");
      }
    }
    throw new Error("no Layer 2 part bullet for part-in-path");
  },
  parts(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 2);
    if (!r) throw new Error("no Layer 2 for parts");
    for (let i = r[0]; i < r[1]; i++) {
      if (/^\s*[-*+]\s+.+\(part\):/.test(rows[i])) { rows.splice(i, 0, rows[i]); return rows.join("\n"); }
    }
    throw new Error("no Layer 2 part bullet to duplicate");
  },
  "seam-form"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for seam-form");
    for (let i = r[0]; i < r[1]; i++) {
      const m = rows[i].match(/^(\s*[-*+]\s+.+?),(\s+(?:offers and needs|offers|needs)\b.*)$/);
      if (m) { rows[i] = m[1] + m[2]; return rows.join("\n"); }
    }
    throw new Error("no Layer 3 seam bullet for seam-form");
  },
  "seams-named"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for seams-named");
    for (let i = r[0]; i < r[1]; i++) {
      const m = rows[i].match(new RegExp(String.raw`^(\s*[-*+]\s+(?:${NUM}\.\s+)?)(.+?)(,\s+(?:offers and needs|offers|needs)\b.*)$`));
      if (m) { rows[i] = m[1] + "Ghost " + m[2] + m[3]; return rows.join("\n"); }
    }
    throw new Error("no Layer 3 seam bullet for seams-named");
  },
  "seam-missing"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for seam-missing");
    for (let i = r[0]; i < r[1]; i++) {
      if (/^\s*[-*+]\s+.+,\s+(?:offers and needs|offers|needs)\b/.test(rows[i])) { rows.splice(i, 1); return rows.join("\n"); }
    }
    throw new Error("no Layer 3 seam bullet to delete");
  },
  "layer1-no-parts"(text, spec, parts) {
    const rows = text.split("\n");
    const r = layerRange(rows, 1);
    if (!r) throw new Error("no Layer 1 for layer1-no-parts");
    const first = parts[0] && parts[0].name;
    if (!first) throw new Error("no part name for layer1-no-parts");
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+1\.\s+Need\s*$/.test(rows[i].trim())) {
        for (let j = i + 1; j < r[1]; j++) {
          if (rows[j].trim() !== "" && !/^###/.test(rows[j].trim())) {
            rows[j] = rows[j].replace(/\s*$/, "") + ` The ${first} is involved.`;
            return rows.join("\n");
          }
        }
      }
    }
    throw new Error("no Layer 1 Need body for layer1-no-parts");
  },
  "layer1-no-means"(text, spec) {
    const rows = text.split("\n");
    const r = layerRange(rows, 1);
    if (!r) throw new Error("no Layer 1 for layer1-no-means");
    const first = spec.means[0];
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+1\.\s+Need\s*$/.test(rows[i].trim())) {
        for (let j = i + 1; j < r[1]; j++) {
          if (rows[j].trim() !== "" && !/^###/.test(rows[j].trim())) {
            rows[j] = rows[j].replace(/\s*$/, "") + ` It uses ${first}.`;
            return rows.join("\n");
          }
        }
      }
    }
    throw new Error("no Layer 1 Need body for layer1-no-means");
  },
  "topics-missing"(text, spec) {
    const rows = text.split("\n");
    // The idea has no Layer 3, so mutate Layer 2 topic 5; a full example
    // mutates Layer 3 topic 6 in its first entry.
    if (spec && spec.layer3 === false) {
      const r = layerRange(rows, 2);
      if (!r) throw new Error("no Layer 2 for topics-missing");
      for (let i = r[0]; i < r[1]; i++) {
        if (/^###\s+5\.\s+/.test(rows[i].trim())) { rows.splice(i, 1); return rows.join("\n"); }
      }
      throw new Error("no Layer 2 topic 5 heading for topics-missing");
    }
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for topics-missing");
    // Delete the heading of topic 6 in the first entry (#### or ###).
    let inFirstEntry = false;
    let entrySeen = false;
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+.+\(part\)\s*$/.test(rows[i].trim())) {
        if (entrySeen) break;
        entrySeen = true; inFirstEntry = true; continue;
      }
      const scope = inFirstEntry || !entrySeen;
      if (scope && /^#{3,4}\s+6\.\s+/.test(rows[i].trim())) { rows.splice(i, 1); return rows.join("\n"); }
    }
    throw new Error("no Layer 3 topic 6 heading for topics-missing");
  },
  "topics-order"(text, spec) {
    const rows = text.split("\n");
    // The idea swaps Layer 2 headings 2 and 3; a full example swaps Layer 3
    // headings 2 and 3 in its first entry.
    if (spec && spec.layer3 === false) {
      const r = layerRange(rows, 2);
      if (!r) throw new Error("no Layer 2 for topics-order");
      let i2 = -1, i3 = -1;
      for (let i = r[0]; i < r[1]; i++) {
        if (/^###\s+2\.\s+/.test(rows[i].trim())) i2 = i;
        if (/^###\s+3\.\s+/.test(rows[i].trim())) i3 = i;
      }
      if (i2 < 0 || i3 < 0) throw new Error("no Layer 2 topic 2/3 headings for topics-order");
      const h2 = rows[i2], h3 = rows[i3];
      rows[i2] = h2.replace(/(###\s+)2\.(\s+)(.+)/, (_, a, b) => a + "2." + b + h3.replace(/^###\s+3\.\s+/, ""));
      rows[i3] = h3.replace(/(###\s+)3\.(\s+)(.+)/, (_, a, b) => a + "3." + b + h2.replace(/^###\s+2\.\s+/, ""));
      return rows.join("\n");
    }
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for topics-order");
    let inFirstEntry = false, entrySeen = false;
    let i2 = -1, i3 = -1;
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+.+\(part\)\s*$/.test(rows[i].trim())) {
        if (entrySeen) break;
        entrySeen = true; inFirstEntry = true; continue;
      }
      const scope = inFirstEntry || !entrySeen;
      if (scope && /^#{3,4}\s+2\.\s+/.test(rows[i].trim())) i2 = i;
      if (scope && /^#{3,4}\s+3\.\s+/.test(rows[i].trim())) i3 = i;
      if (i2 >= 0 && i3 >= 0) break;
    }
    if (i2 < 0 || i3 < 0) throw new Error("no topic 2/3 headings for topics-order");
    const h2 = rows[i2], h3 = rows[i3];
    rows[i2] = h2.replace(/(#{3,4}\s+)2\.(\s+)(.+)/, (_, a, b) => a + "2." + b + h3.replace(/^#{3,4}\s+3\.\s+/, ""));
    rows[i3] = h3.replace(/(#{3,4}\s+)3\.(\s+)(.+)/, (_, a, b) => a + "3." + b + h2.replace(/^#{3,4}\s+2\.\s+/, ""));
    return rows.join("\n");
  },
  "limits-trace"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for limits-trace");
    for (let i = r[0]; i < r[1]; i++) {
      if (/\(Layer 1,[^)]*\)/.test(rows[i])) { rows[i] = rows[i].replace("Layer 1", "Layer one"); return rows.join("\n"); }
    }
    throw new Error("no Limits bullet with a source for limits-trace");
  },
  "scope-form"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for scope-form");
    for (let i = r[0]; i < r[1]; i++) {
      if (/^Scope:/.test(rows[i].trim())) { rows[i] = "Scope: x."; return rows.join("\n"); }
    }
    throw new Error("no Layer 3 Scope line for scope-form");
  },
  "ids-unique"(text) {
    const rows = text.split("\n");
    for (let i = 0; i < rows.length; i++) {
      if (new RegExp(String.raw`^(?:[-*+]|\d+[.)])\s+(?:12|11)\.\d+\.`).test(rows[i].trim())) { rows.splice(i, 0, rows[i]); return rows.join("\n"); }
    }
    throw new Error("no decision id line for ids-unique");
  },
  "not-supplied-count"(text) {
    if (!/Not supplied:/.test(text)) throw new Error("no 'Not supplied:' for not-supplied-count");
    return text.replace(/Not supplied:/g, "Known:");
  },
  lifecycle(text) {
    return mustReplace(text, "## View: Lifecycle", "## View: Life", "lifecycle heading");
  },
  notice(text) {
    return mustReplace(text, "## What to notice", "## What was noticed", "notice heading");
  },
  "value-count"(text) {
    const rows = text.split("\n");
    const r = layerRange(rows, 1);
    if (!r) throw new Error("no Layer 1 for value-count");
    let inValue = false, last = -1;
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+3\.\s+Value\s*$/.test(rows[i].trim())) { inValue = true; continue; }
      if (inValue && /^###/.test(rows[i].trim())) break;
      if (inValue && SCEN.test(rows[i])) last = i;
    }
    if (last < 0) throw new Error("no Layer 1 Value scenario to delete");
    rows.splice(last, 1);
    return rows.join("\n");
  },
  "scenario-id"(text) {
    // Remove the id from the first Layer 1 Value line.
    const rows = text.split("\n");
    const r = layerRange(rows, 1);
    if (!r) throw new Error("no Layer 1 for scenario-id");
    let inValue = false;
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+3\.\s+Value\s*$/.test(rows[i].trim())) { inValue = true; continue; }
      if (inValue && /^###/.test(rows[i].trim())) break;
      if (inValue && SCEN_ID.test(rows[i])) {
        rows[i] = rows[i].replace(new RegExp(String.raw`(\s*(?:[-*+]|\d+[.)])\s+)${OWN}\.\s+(Given )`), "$1$2");
        return rows.join("\n");
      }
    }
    throw new Error("no Layer 1 Value line with an id for scenario-id");
  },
  "path-id-wrong"(text) {
    // Rename the id the first Layer 2 path realizes to vision-3.99.
    const rows = text.split("\n");
    const r = layerRange(rows, 2);
    if (!r) throw new Error("no Layer 2 for path-id-wrong");
    let inScen = false;
    for (let i = r[0]; i < r[1]; i++) {
      if (/^###\s+\d+\.\s+Scenario paths\s*$/.test(rows[i].trim())) { inScen = true; continue; }
      if (inScen && /^###/.test(rows[i].trim())) break;
      if (inScen && SCEN_ID.test(rows[i])) {
        rows[i] = rows[i].replace(new RegExp(String.raw`(Realizes )${ID}(\.\s+Given )`), "$1vision-3.99$2");
        return rows.join("\n");
      }
    }
    throw new Error("no Layer 2 path with an id for path-id-wrong");
  },
  "rule-id-wrong"(text) {
    // Rename the first value's id to vision-3.99 on every Layer 3 line that realizes it.
    const rows = text.split("\n");
    const layers = splitLayers(text);
    const l1 = layers.find((l) => l.num === 1);
    const r = layerRange(rows, 3);
    if (!r || !l1) throw new Error("no Layer 1/3 for rule-id-wrong");
    const firstValue = scenarioPairs(topicBody(l1.lines, "Value"))[0];
    if (!firstValue || !firstValue.id) throw new Error("no first value id for rule-id-wrong");
    const id = fid(firstValue.id);
    let changed = false;
    for (let i = r[0]; i < r[1]; i++) {
      const idm = rows[i].match(SCEN_ID);
      if (idm && fid(idm[1]) === id) {
        rows[i] = rows[i].replace(new RegExp(`(Realizes )${id.replace(".", "\\.")}(\\.\\s+Given )`), "$1vision-3.99$2");
        changed = true;
      }
    }
    if (!changed) throw new Error("no Layer 3 rule carried the first value id for rule-id-wrong");
    return rows.join("\n");
  },
  "layer3-missing"(text) {
    // Delete the whole Layer 3 section.
    const rows = text.split("\n");
    const r = layerRange(rows, 3);
    if (!r) throw new Error("no Layer 3 for layer3-missing");
    rows.splice(r[0], r[1] - r[0]);
    return rows.join("\n");
  },
  "idea-layer3"(text) {
    // Append a Layer 3 section an idea must not have.
    return text.replace(/\n$/, "") + "\n\n## Layer 3: Detail\n\nScope: one part, X.\n";
  },
};

// Rows: [mutation id, expected finding code].
const FULL_ROWS = [
  ["lint", "lint"],
  ["path-for-value", "path-for-value"],
  ["rule-for-path", "rule-for-path"],
  ["entry-per-part", "entry-per-part"],
  ["entry-per-part-single", "entry-per-part"],
  ["part-in-path", "part-in-path"],
  ["parts", "parts"],
  ["seam-form", "seam-form"],
  ["seams-named", "seams-named"],
  ["seam-missing", "seam-missing"],
  ["layer1-no-parts", "layer1-no-parts"],
  ["layer1-no-means", "layer1-no-means"],
  ["topics-missing", "topics"],
  ["topics-order", "topics"],
  ["limits-trace", "limits-trace"],
  ["scope-form", "scope-form"],
  ["ids-unique", "ids-unique"],
  ["not-supplied-count", "not-supplied-count"],
  ["lifecycle", "lifecycle"],
  ["notice", "notice"],
  ["value-count", "value-count"],
  ["scenario-id", "scenario-id"],
  ["path-id-wrong", "path-for-value"],
  ["rule-id-wrong", "rule-for-path"],
  ["layer3-missing", "topics"],
  ["seams-heading", "topics"],
];

const GARDEN_ROWS = [
  ["lint", "lint"],
  ["path-for-value", "path-for-value"],
  ["parts", "parts"],
  ["layer1-no-parts", "layer1-no-parts"],
  ["layer1-no-means", "layer1-no-means"],
  ["topics-missing", "topics"],
  ["topics-order", "topics"],
  ["ids-unique", "ids-unique"],
  ["not-supplied-count", "not-supplied-count"],
  ["notice", "notice"],
  ["value-count", "value-count"],
  ["scenario-id", "scenario-id"],
  ["path-id-wrong", "path-for-value"],
  ["idea-layer3", "idea-layer3"],
];

// An RFP has Layer 3 (no idea-layer3 mutation applies) and a twelve-topic entry.
const RFP_ROWS = [...GARDEN_ROWS.filter(([id]) => id !== "idea-layer3"), ["rule-delete", "rule-for-path"]];

let TMP;
function tmpDir() {
  if (!TMP) TMP = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-examples-"));
  return TMP;
}
process.on("exit", () => { if (TMP) { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} } });

// --- Guide topics test. ---
test("guide topic lists have 12, 11 and 12 topics", () => {
  assert.equal(LAYER1_TOPICS.length, 12, `Layer 1 topics: ${JSON.stringify(LAYER1_TOPICS)}`);
  assert.equal(LAYER2_TOPICS.length, 11, `Layer 2 topics: ${JSON.stringify(LAYER2_TOPICS)}`);
  assert.equal(LAYER3_TOPICS.length, 12, `Layer 3 topics: ${JSON.stringify(LAYER3_TOPICS)}`);
});

// --- Manifest discovery test. ---
test("manifest covers every example file and no extra", () => {
  const dir = tmpDir();
  const findings = [];
  // Real files on disk.
  const onDisk = fs.readdirSync(EXAMPLES_DIR).filter((f) => /^strata-blueprints-example.*\.md$/.test(f) || (/^strata-blueprints-example/.test(f) && fs.statSync(path.join(EXAMPLES_DIR, f)).isDirectory()));
  for (const f of onDisk) if (!MANIFEST[f]) findings.push(`manifest: ${f} is on disk but not in the MANIFEST`);
  for (const f of Object.keys(MANIFEST)) {
    if (!fs.existsSync(path.join(EXAMPLES_DIR, f))) findings.push(`manifest: ${f} is in the MANIFEST but not on disk`);
  }
  // Discovery logic proven against a temp dir: an extra file and a missing one.
  fs.writeFileSync(path.join(dir, "extra-example.md"), "# extra\n");
  const tmpFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  assert.ok(tmpFiles.includes("extra-example.md"), "discovery lists a file not in the manifest");
  assert.ok(!MANIFEST["extra-example.md"], "manifest does not cover the extra file (would be a manifest finding)");
  assert.ok(!fs.existsSync(path.join(dir, "strata-blueprints-example.md")), "a manifest file absent from the dir would be a finding");
  if (findings.length) assert.fail(findings.join("\n"));
});

// --- A folder example lints the same as its assembled single document (file labels stripped). ---
const FOLDER_STATUS = {
  "strata-blueprints-example-todo-app": "INFO status: blueprint Review; vision Approved; structure Approved; " +
    ["access", "ledger", "folders", "timing", "notifier", "presence"].map((p) => `detail.${p} Review`).join("; "),
};
test("folder lint equals assembled-document lint", () => {
  for (const [name, spec] of Object.entries(MANIFEST)) {
    if (!spec.folder) continue;
    const real = path.join(EXAMPLES_DIR, name);
    const doc = path.join(tmpDir(), `${name}-assembled.md`);
    fs.writeFileSync(doc, assemble(real));
    const norm = (f) => {
      let out;
      try { out = execFileSync(process.execPath, [LINT, f], { encoding: "utf8" }); } catch (e) { out = (e.stdout || "") + (e.stderr || ""); }
      // The INFO status line lists one status per file in a folder and one in a document, by design; both exact lines are asserted below.
      const lines = out.split("\n").filter(Boolean);
      return {
        status: lines.filter((l) => l.startsWith("INFO status:")),
        rest: lines.filter((l) => !l.startsWith("INFO status:")).map((l) => l.replace(/\s*\((?:\S+ )?line \d+\)/g, "")),
      };
    };
    const folderOut = norm(real);
    const docOut = norm(doc);
    assert.deepEqual(folderOut.status, [FOLDER_STATUS[name]], `${name}: folder status line`);
    assert.deepEqual(docOut.status, ["INFO status: Approved"], `${name}: assembled document status line`);
    assert.deepEqual(folderOut.rest, docOut.rest, name);
  }
});

// --- Only the idea example is allowed no Layer 3. ---
test("manifest: only the idea example has no Layer 3", () => {
  const ideas = Object.entries(MANIFEST)
    .filter(([, s]) => s.layer3 === false)
    .map(([f]) => f)
    .sort();
  assert.deepEqual(ideas, ["strata-blueprints-example.md"],
    `the only example allowed no Layer 3 is the idea; got ${JSON.stringify(ideas)}`);
});

// --- Baseline and mutation tests per example that exists on disk. ---
for (const [fileName, spec] of Object.entries(MANIFEST)) {
  const real = path.join(EXAMPLES_DIR, fileName);
  const rows = spec.full ? FULL_ROWS : spec.rfp ? RFP_ROWS : GARDEN_ROWS;

  test(`baseline: ${fileName} has no findings`, { skip: fs.existsSync(real) ? false : `missing: ${fileName}` }, () => {
    const findings = checkExample(real, spec);
    if (findings.length) assert.fail(reportFindings(findings));
  });

  for (const [mutId, expected] of rows) {
    test(`mutation ${mutId} => ${expected}: ${fileName}`, { skip: fs.existsSync(real) ? false : `missing: ${fileName}` }, () => {
      const dir = tmpDir();
      const original = readExample(real);
      const parts = parseParts(splitLayers(original).find((l) => l.num === 2) || { lines: [] });
      const mutated = MUTATIONS[mutId](original, spec, parts); // throws if target absent
      const target = path.join(dir, spec.folder ? `${fileName}.md` : fileName);
      fs.writeFileSync(target, mutated);
      const findings = checkExample(target, spec);
      const codes = findings.map((f) => f.code);
      assert.ok(codes.includes(expected),
        `expected finding '${expected}' from mutation '${mutId}', got: ${codes.join(", ") || "none"}`);
    });
  }
}

// --- Guide how-to blocks: every topic (and Lifecycle) has For, Write, Example, Mistake. ---
const HOWTO_LINE = "- **Topics:**";
const HOWTO_LABELS = ["For", "Write", "Example", "Mistake"];

// The core guide and the three layer files, joined: one text the how-to checks read.
function guideText() {
  return [GUIDE, ...LAYER_FILES].map((f) => fs.readFileSync(f, "utf8")).join("\n");
}

// Range [start, end) of Layer n's file inside the joined guide text, or null.
function guideLayerRange(rows, num) {
  const start = firstLineMatching(rows, new RegExp(`^# Strata Blueprints guide: Layer ${num},`));
  if (start < 0) return null;
  let end = rows.length;
  for (let i = start + 1; i < rows.length; i++) if (/^# Strata Blueprints guide: Layer /.test(rows[i])) { end = i; break; }
  return [start, end];
}

// Body range [start, end) of a how-to block in rows, or null when absent.
// which is a layer number (1 to 3) or "lifecycle".
function howToRange(rows, which) {
  let secStart;
  let secEnd;
  let anchor;
  if (which === "lifecycle") {
    secStart = firstLineMatching(rows, /^### Lifecycle view\s*$/);
    if (secStart < 0) return null;
    secEnd = rows.length;
    for (let i = secStart + 1; i < rows.length; i++) if (/^#{1,3} /.test(rows[i])) { secEnd = i; break; }
    anchor = -1;
    for (let i = secStart; i < secEnd; i++) if (rows[i].startsWith("- **Lifecycle:**")) { anchor = i; break; }
  } else {
    const r = guideLayerRange(rows, which);
    if (!r) return null;
    [secStart, secEnd] = r;
    anchor = -1;
    for (let i = secStart; i < secEnd; i++) if (rows[i].trimEnd() === HOWTO_LINE) { anchor = i; break; }
  }
  if (anchor < 0) return null;
  let end = secEnd;
  for (let i = anchor + 1; i < secEnd; i++) {
    if (rows[i].trim() !== "" && /^\S/.test(rows[i])) { end = i; break; }
  }
  return { start: anchor + 1, end };
}

// Parse a block's lines into entries { name, labels: [{label, text}], samples: [line] }.
function parseHowToEntries(rows, range, lifecycle) {
  const entries = [];
  const labelRe = lifecycle ? /^ {2}- (For|Write|Example|Mistake):(.*)$/ : /^ {6}- (For|Write|Example|Mistake):(.*)$/;
  const sampleRe = lifecycle ? /^ {4}(?:- |\d+\. )(.*)$/ : /^ {8}(?:- |\d+\. )(.*)$/;
  let cur = lifecycle ? { name: "Lifecycle", labels: [], samples: [] } : null;
  if (cur) entries.push(cur);
  for (let i = range.start; i < range.end; i++) {
    const l = rows[i];
    const t = !lifecycle && l.match(/^ {2}- \*\*(.+?)\*\*\s*$/);
    if (t) { cur = { name: t[1], labels: [], samples: [] }; entries.push(cur); continue; }
    if (!cur) continue;
    const lab = l.match(labelRe);
    if (lab) { cur.labels.push({ label: lab[1], text: lab[2].trim() }); continue; }
    const s = l.match(sampleRe);
    if (s) cur.samples.push(s[1]);
  }
  return entries;
}

// Returns an array of {code, msg} for the how-to blocks in the guide text.
function checkHowTo(text) {
  const findings = [];
  const add = (code, msg) => findings.push({ code, msg });
  const rows = text.split("\n");
  const todo = "strata-blueprints-example-todo-app";
  const todoText = readExample(path.join(EXAMPLES_DIR, todo));
  const todoParts = parseParts(splitLayers(todoText).find((l) => l.num === 2) || { lines: [] });
  const means = MANIFEST[todo].means;
  const allow = MANIFEST[todo].allow.map((w) => w.toLowerCase());
  const partWords = todoParts
    .flatMap((p) => partVariants(p.name))
    .filter((w) => !allow.includes(w.toLowerCase()));

  const groups = [];
  for (const n of [1, 2, 3]) {
    const range = howToRange(rows, n);
    if (!range) { add("howto-topics", `Layer ${n} has no how-to block`); continue; }
    const entries = parseHowToEntries(rows, range, false);
    const names = entries.map((e) => e.name);
    const expected = GUIDE_TOPICS[n - 1];
    if (names.join("|") !== expected.join("|")) {
      add("howto-topics", `Layer ${n} how-to entries are ${JSON.stringify(names)}, expected ${JSON.stringify(expected)}`);
    }
    groups.push({ layer: n, label: `Layer ${n}`, entries });
  }
  const lr = howToRange(rows, "lifecycle");
  if (!lr) add("howto-labels", "Lifecycle has no how-to entry");
  else groups.push({ layer: 0, label: "Lifecycle", entries: parseHowToEntries(rows, lr, true) });

  for (const g of groups) {
    for (const e of g.entries) {
      const where = `${g.label} '${e.name}'`;
      const seq = e.labels.map((x) => x.label);
      if (seq.join(",") !== HOWTO_LABELS.join(",")) {
        add("howto-labels", `${where} labels are ${JSON.stringify(seq)}, expected ${JSON.stringify(HOWTO_LABELS)}`);
      }
      for (const x of e.labels) {
        if (x.label === "Example" ? x.text !== "" : x.text === "") {
          add("howto-labels", `${where} '${x.label}' has ${x.label === "Example" ? "text after the colon" : "empty text"}`);
        }
      }
      if (e.samples.length < 2 || e.samples.length > 3) {
        add("howto-example-size", `${where} Example has ${e.samples.length} sample line(s), expected 2 or 3`);
      }
      for (const s of e.samples) {
        if (new RegExp(String.raw`^${ID}\.`).test(s)) {
          add("howto-form", `${where} sample starts with a full id, write the local number: ${s}`);
        }
        const body = s.replace(new RegExp(String.raw`^(?:${NUM}\.\s+)?(?:Realizes ${ID}\.\s+)?`), "");
        if (/^Given/.test(body) && !/^Given .+, when .+, then .+/.test(body)) {
          add("howto-form", `${where} sample is not Given, when, then: ${s}`);
        }
        const assumptionTopic = { 1: 11, 2: 10, 3: 11 }[g.layer];
        const decisionTopic = { 1: 12, 2: 11, 3: 12 }[g.layer];
        if (assumptionTopic && e.name === "Assumptions" && !(body.includes("Basis:") && body.includes("If wrong:"))) {
          add("howto-form", `${where} assumption sample lacks Basis: or If wrong:: ${s}`);
        }
        if (decisionTopic && e.name === "Decisions" && !body.includes("Reason:")) {
          add("howto-form", `${where} decision sample lacks Reason:: ${s}`);
        }
        const lower = s.toLowerCase();
        if (g.layer === 1 || g.layer === 2) {
          for (const w of means) {
            if (hasWord(lower, w)) add("howto-means", `${where} sample names the means '${w}': ${s}`);
          }
        }
        if (g.layer === 1) {
          for (const w of partWords) {
            if (hasWord(lower, w)) add("howto-parts", `${where} sample names the part '${w}': ${s}`);
          }
        }
      }
    }
  }
  return findings;
}

// Mutations on the in-memory guide text; each throws when its target is absent.
function mutateHowTo(text, which, fn, desc) {
  const rows = text.split("\n");
  const range = howToRange(rows, which);
  if (!range) throw new Error(`mutation target not found: ${desc}`);
  const entries = parseHowToEntries(rows, range, which === "lifecycle");
  const out = fn(rows, range, entries);
  if (!out) throw new Error(`mutation target not found: ${desc}`);
  return rows.join("\n");
}

// Index of the first row in [range.start, range.end) matching re, or -1.
function rowIn(rows, range, re) {
  for (let i = range.start; i < range.end; i++) if (re.test(rows[i])) return i;
  return -1;
}

const HOWTO_MUTATIONS = [
  ["a Mistake line removed", "howto-labels", (t) => mutateHowTo(t, 1, (rows, r) => {
    const i = rowIn(rows, r, /^ {6}- Mistake:/);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  }, "Layer 1 Mistake line")],
  ["a topic renamed", "howto-topics", (t) => mutateHowTo(t, 1, (rows, r) => {
    const i = rowIn(rows, r, /^ {2}- \*\*[^*]+\*\*\s*$/);
    if (i < 0) return false;
    rows[i] = rows[i].replace(/\*\*$/, " renamed**");
    return true;
  }, "Layer 1 topic entry")],
  ["the Layer 2 block deleted", "howto-topics", (t) => mutateHowTo(t, 2, (rows, r) => {
    rows.splice(r.start - 1, r.end - r.start + 1);
    return true;
  }, "Layer 2 block")],
  ["a fourth Example line added", "howto-example-size", (t) => mutateHowTo(t, 1, (rows, r, entries) => {
    const e = entries.find((x) => x.samples.length >= 2);
    if (!e) return false;
    const first = rowIn(rows, r, /^ {6}- Example:\s*$/);
    if (first < 0) return false;
    // Pad the first Example with sample lines until it has four.
    const extra = [];
    for (let n = entries[0].samples.length; n < 4; n++) extra.push("        - One more sample line.");
    rows.splice(first + 1, 0, ...extra);
    return true;
  }, "a Layer 1 Example")],
  ["an Example cut to one line", "howto-example-size", (t) => mutateHowTo(t, 1, (rows, r) => {
    const i = rowIn(rows, r, /^ {6}- Example:\s*$/);
    if (i < 0 || !/^ {8}(?:- |\d+\. )/.test(rows[i + 2] || "")) return false;
    rows.splice(i + 2, 1);
    return true;
  }, "Layer 1 Example with two or more lines")],
  [", then removed from a Given sample", "howto-form", (t) => mutateHowTo(t, 1, (rows, r) => {
    const i = rowIn(rows, r, /^ {8}(?:- |\d+\. )Given .+, when .+, then /);
    if (i < 0) return false;
    rows[i] = rows[i].replace(", then", "");
    return true;
  }, "Layer 1 Given sample")],
  ["If wrong: removed from an A sample", "howto-form", (t) => mutateHowTo(t, 1, (rows, r) => {
    const i = rowIn(rows, r, /^ {8}\d+\. .*If wrong:/);
    if (i < 0) return false;
    rows[i] = rows[i].replace(" If wrong:", "");
    return true;
  }, "Layer 1 A sample")],
  ["a means word added to a Layer 1 sample", "howto-means", (t) => mutateHowTo(t, 1, (rows, r) => {
    const i = rowIn(rows, r, /^ {8}- /);
    if (i < 0) return false;
    rows[i] += " The server holds it.";
    return true;
  }, "Layer 1 sample line")],
  ["a part name added to a Layer 1 sample", "howto-parts", (t) => mutateHowTo(t, 1, (rows, r) => {
    const i = rowIn(rows, r, /^ {8}- /);
    if (i < 0) return false;
    rows[i] += " Ledger keeps it.";
    return true;
  }, "Layer 1 sample line")],
  ["the Lifecycle Mistake line removed", "howto-labels", (t) => mutateHowTo(t, "lifecycle", (rows, r) => {
    const i = rowIn(rows, r, /^ {2}- Mistake:/);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  }, "Lifecycle Mistake line")],
  ["a Layer 3 Mistake line removed", "howto-labels", (t) => mutateHowTo(t, 3, (rows, r) => {
    const i = rowIn(rows, r, /^ {6}- Mistake:/);
    if (i < 0) return false;
    rows.splice(i, 1);
    return true;
  }, "Layer 3 Mistake line")],
];

test("guide how-to: the real guide has no findings", () => {
  const findings = checkHowTo(guideText());
  if (findings.length) assert.fail(reportFindings(findings));
});

for (const [title, expected, mutate] of HOWTO_MUTATIONS) {
  test(`guide how-to: ${title} => ${expected}`, () => {
    const mutated = mutate(guideText()); // throws if target absent
    const codes = checkHowTo(mutated).map((f) => f.code);
    assert.ok(codes.includes(expected),
      `expected finding '${expected}', got: ${codes.join(", ") || "none"}`);
  });
}

// --- Guide files: the core and three layer files hold what the plan says (plan 5b item 11). ---
const LAYER_NAMES = ["Vision", "Structure", "Detail"];
const REFS_DIR = path.join(SKILL, "references");

test("guide files: each layer file has its title, a Load line, matching Contents and Topics, and the three labels in order", () => {
  LAYER_FILES.forEach((file, i) => {
    const n = i + 1;
    const rows = fs.readFileSync(file, "utf8").split("\n");
    assert.equal(rows[0], `# Strata Blueprints guide: Layer ${n}, ${LAYER_NAMES[i]}`);
    assert.match(rows[1], /^Load /);
    assert.deepEqual(GUIDE_TOPICS[i], rows.length ? topicsOf(rows) : [], `Layer ${n} Contents equals its Topics`);
    assert.ok(rows.some((l) => /^- \*\*Check \(whole layer\):\*\*$/.test(l)), `Layer ${n} lacks Check (whole layer)`);
    const t0 = rows.findIndex((l) => l.trimEnd() === "- **Topics:**");
    assert.ok(t0 >= 0, `Layer ${n} lacks Topics`);
    const entries = [];
    for (let k = t0 + 1; k < rows.length; k++) {
      if (/^\S/.test(rows[k])) break;
      const t = rows[k].match(/^ {2}- \*\*(.+?)\*\*\s*$/);
      if (t) { entries.push({ name: t[1], labels: [], check: 0 }); continue; }
      const cur = entries[entries.length - 1];
      if (!cur) continue;
      const lab = rows[k].match(/^ {4}- \*\*(How to write it|Ask the owner|Check):\*\*(.*)$/);
      if (lab) { cur.labels.push(lab[1]); cur.ask = lab[1] === "Ask the owner" ? lab[2].trim() : cur.ask; continue; }
      if (/^ {6}- \[ \] \S/.test(rows[k]) && cur.labels[cur.labels.length - 1] === "Check") cur.check++;
    }
    assert.deepEqual(entries.map((e) => e.name), GUIDE_TOPICS[i]);
    for (const e of entries) {
      assert.deepEqual(e.labels, ["How to write it", "Ask the owner", "Check"], `Layer ${n} '${e.name}' labels`);
      assert.ok(e.check > 0, `Layer ${n} '${e.name}' has an empty Check`);
      assert.ok(e.ask && e.ask.length > 0, `Layer ${n} '${e.name}' has an empty Ask the owner`);
    }
  });
});

function topicsOf(rows) {
  const out = [];
  let on = false;
  for (const l of rows) {
    const t = l.trim();
    if (/^- \*\*Topics:\*\*$/.test(t)) { on = true; continue; }
    if (on && /^\S/.test(l)) break;
    const m = on && l.match(/^ {2}- \*\*(.+?)\*\*\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

test("guide files: SKILL.md names every file and folder in references/ and assets/, and every path it names exists", () => {
  const skill = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8");
  for (const dir of ["references", "assets"]) {
    for (const name of fs.readdirSync(path.join(SKILL, dir))) {
      assert.ok(skill.includes(name), `SKILL.md does not name ${dir}/${name}`);
    }
  }
  const named = [...new Set([...skill.matchAll(/(?:references|assets)\/[A-Za-z0-9._\/-]*[A-Za-z0-9]/g)].map((m) => m[0]))];
  assert.ok(named.length > 0);
  for (const n of named) assert.ok(fs.existsSync(path.join(SKILL, n)), `SKILL.md names missing ${n}`);
});

test("guide files: no removed file name appears in skills/, tests/, gate.mjs or scripts/", () => {
  const removed = ["question" + "-bank", "inter" + "view.md", "layer-3-" + "howto", "views-and-" + "diagrams"];
  const root = path.join(SKILL, "..", "..");
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else files.push(f);
    }
  };
  for (const d of ["skills", "tests", "scripts"]) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
  const gate = path.join(root, "gate.mjs");
  if (fs.existsSync(gate)) files.push(gate);
  assert.ok(files.length > 5);
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const r of removed) assert.ok(!text.includes(r), `${path.relative(root, f)} names the removed ${r}`);
  }
});

// --- Every shipped example reports its INFO status line (values: the idea is a Draft, the RFP is in Review, the to-do stack has an Approved Vision and Structure and Details in Review). ---
test("every shipped example reports its INFO status line", () => {
  const want = {
    "strata-blueprints-example.md": "INFO status: Draft",
    "strata-blueprints-example-rfp.md": "INFO status: Review",
    "strata-blueprints-example-todo-app": "INFO status: blueprint Review; vision Approved; structure Approved; " +
      ["access", "ledger", "folders", "timing", "notifier", "presence"].map((p) => `detail.${p} Review`).join("; "),
  };
  for (const [name, line] of Object.entries(want)) {
    const out = execFileSync(process.execPath, [LINT, path.join(EXAMPLES_DIR, name), "--strict"], { encoding: "utf8" });
    const got = out.split("\n").find((l) => l.startsWith("INFO status:"));
    // The details follow the Parts order, compared in order.
    assert.equal(got, line, name);
  }
});

// --- The guide says every document carries `Version: 0.1.0` under its title: the single-file examples and the to-do Vision do. ---
test("every shipped example carries Version: 0.1.0 as the first metadata line under its title", () => {
  const files = [
    "strata-blueprints-example.md",
    "strata-blueprints-example-rfp.md",
    path.join("strata-blueprints-example-todo-app", "sbp-vision.md"),
  ];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(EXAMPLES_DIR, f), "utf8").split("\n").filter((l) => l.trim() !== "");
    assert.ok(lines[0].startsWith("# "), `${f} opens with a title`);
    assert.equal(lines[1], "Version: 0.1.0", `${f} has Version: 0.1.0 right under the title`);
  }
});

// --- ordered: every list item is numbered, so the four templates draw no 'has no number' warning once their (optional) marks are removed. ---
test("ordered: the four templates draw no 'has no number' warning", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-tpl-"));
  try {
    for (const name of ["template", "template-layer-1", "template-layer-2", "template-layer-3"]) {
      const text = fs.readFileSync(path.join(SKILL, "assets", `strata-blueprints-${name}.md`), "utf8").replace(/ \(optional\)/g, "");
      const f = path.join(dir, `${name}.md`);
      fs.writeFileSync(f, text);
      let out;
      try { out = execFileSync(process.execPath, [LINT, f], { encoding: "utf8" }); } catch (e) { out = (e.stdout || "") + (e.stderr || ""); }
      assert.deepEqual(out.split("\n").filter((l) => /has no number/.test(l)), [], name);
      assert.ok(/^strata-blueprints-lint: /m.test(out), `${name} lints`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
