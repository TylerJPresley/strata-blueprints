// SPDX-License-Identifier: MIT
// Tests for strata-blueprints-lint.mjs. Run: node --test tests/strata-blueprints-lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = process.env.STRATA_LINT || path.join(here, "..", "skills", "strata-blueprints", "scripts", "strata-blueprints-lint.mjs");
const example = path.join(here, "..", "skills", "strata-blueprints", "references", "strata-blueprints-example.md");

function run(file, ...flags) {
  const r = spawnSync(process.execPath, [script, file, ...flags], { encoding: "utf8" });
  return { out: r.stdout, code: r.status, lines: r.stdout.split("\n").filter(Boolean) };
}
function lintText(md, ...flags) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  const f = path.join(dir, "doc.md"); fs.writeFileSync(f, md);
  try { return run(f, ...flags); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const warns = (r, check) => r.lines.filter((l) => l.startsWith(`WARN ${check}:`));
const L1 = "## Layer 1: Vision\n\nScope: all.\n\n";
const L2 = "## Layer 2: Structure\n\nScope: all.\n\n";

test("clean pass on the example", () => {
  const r = run(example);
  assert.equal(r.code, 0);
  assert.equal(r.lines.filter((l) => l.startsWith("WARN")).length, 0);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
  assert.match(r.out, /^INFO not-supplied: 3$/m);
});

test("output shape and strict exit", () => {
  const md = L1 + L2 + "TODO later\n";
  const r = lintText(md);
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-2), /^INFO not-supplied: 0$/);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 1 warning\(s\)$/);
  assert.equal(lintText(md, "--strict").code, 1);
  assert.equal(lintText(L1 + L2, "--strict").code, 0);
});

test("layer-heading: bad name, wrong order, missing layer", () => {
  assert.equal(warns(lintText(L1 + "## Layer 2: Plans\n\nScope: x.\n"), "layer-heading").filter((l) => /Plans/.test(l)).length, 1);
  assert.equal(warns(lintText(L2 + L1), "layer-heading").length >= 1, true);
  const miss = warns(lintText(L2), "layer-heading");
  assert.equal(miss.some((l) => /Layer 1/.test(l)), true);
  assert.equal(warns(lintText(L1), "layer-heading").some((l) => /Layer 2/.test(l)), true);
  assert.equal(warns(lintText(L1 + L2 + "## Layer 5: Extra\n\nScope: x.\n"), "layer-heading").length, 1);
});

test("scope-line", () => {
  const r = lintText("## Layer 1: Vision\n\nSomething else.\n\n" + L2);
  assert.equal(warns(r, "scope-line").length, 1);
  assert.match(warns(r, "scope-line")[0], /\(line 3\)$/);
});

test("topic-order: unknown and out of order; omission and unnumbered allowed", () => {
  assert.equal(warns(lintText(L1 + L2 + "### 1. Parts\n### 2. Seams between parts\n### 3. Assumptions\n### 4. Decisions\n### Diagrams\n"), "topic-order").length, 0);
  assert.equal(warns(lintText(L1 + "### 1. Need\n### 2. Value\n### 3. Target audience\n" + L2), "topic-order").length, 1);
  assert.equal(warns(lintText(L1 + "### 1. Needs\n" + L2), "topic-order").length, 1);
  assert.equal(warns(lintText(L1 + "### 1. Parts\n" + L2), "topic-order").length, 1);
});

test("ring: outward reference warns, inward does not; fences ignored", () => {
  assert.equal(warns(lintText(L1 + "See Layer 3 for more.\n" + L2), "ring").length, 1);
  assert.equal(warns(lintText(L1 + L2 + "See Layer 1 and Layer 2.\n"), "ring").length, 0);
  assert.equal(warns(lintText(L1 + "```\nLayer 3\n```\n" + L2), "ring").length, 0);
});

test("scenario-form", () => {
  assert.equal(warns(lintText(L1 + "### 3. Value\n\n- 3.1. Given a cat it sleeps.\n\n" + L2), "scenario-form").length, 1);
  assert.equal(warns(lintText(L1 + "- Given a cat, when it is fed, then it sleeps.\n" + L2), "scenario-form").length, 0);
  assert.equal(warns(lintText(L1 + "```\nGiven bad\n```\n" + L2), "scenario-form").length, 0);
});

test("diagram-title", () => {
  assert.equal(warns(lintText(L1 + L2 + "text\n```\nx\n```\n"), "diagram-title").length, 1);
  assert.equal(warns(lintText(L1 + L2 + "Title: Tree.\n```\nx\n```\n"), "diagram-title").length, 0);
});

test("diagram-key", () => {
  assert.equal(warns(lintText(L1 + L2 + "Title: Map.\n```mermaid\nflowchart LR\n```\n"), "diagram-key").length, 1);
  assert.equal(warns(lintText(L1 + L2 + "Title: Map. Key: arrows give.\n```mermaid\nflowchart LR\n```\n"), "diagram-key").length, 0);
});

test("reasons", () => {
  assert.equal(warns(lintText(L1 + "11.1. Fact. If wrong: x.\n" + L2), "reasons").length, 1);
  assert.equal(warns(lintText(L1 + "11.1. Fact. Basis: y. If wrong: x.\n" + L2), "reasons").length, 0);
  assert.equal(warns(lintText(L1 + "12.1. Choice.\n" + L2), "reasons").length, 1);
  assert.equal(warns(lintText(L1 + "12.1. Choice. Reason: z.\n" + L2), "reasons").length, 0);
});

test("unfinished", () => {
  for (const w of ["TODO", "TBD", "FIXME"]) assert.equal(warns(lintText(L1 + `${w} here\n` + L2), "unfinished").length, 1);
  assert.equal(warns(lintText(L1 + L2), "unfinished").length, 0);
});

// --- three-layer rules (D18) ---------------------------------------------
const todoApp = path.join(here, "..", "skills", "strata-blueprints", "references", "strata-blueprints-example-todo-app");
const L3 = "## Layer 3: Detail\n\nScope: one part.\n\n";
// Topics for fixtures: fxT writes the named topics in order, each None. unless given content.
const fxT = (h, names, have = {}) => names.map((n, i) => `${h} ${i + 1}. ${n}\n\n${have[n] ?? "None."}\n`).join("\n");
const T1 = ["Need", "Target audience", "Value", "Focus", "Success measures", "Qualities and constraints", "Vocabulary", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"];
const T2 = ["Parts", "Standing", "Seams between parts", "Seams with the outside", "Shared things", "Scenario paths", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"];
const T3 = ["Responsibility", "Concepts and states", "Seams", "Rules", "Inside", "Limits", "Construction", "Costs", "Risks", "Open Concerns", "Assumptions", "Decisions"];

test("topic-order: Layer 3 accepts Construction in order; unknown names and misorder warn", () => {
  // Construction (topic 7) after Limits (topic 6) is accepted.
  assert.equal(warns(lintText(L1 + L2 + L3 + "### 6. Limits\n### 7. Construction\n### 8. Assumptions\n### 9. Decisions\n"), "topic-order").length, 0);
  // A name that is not a Layer 3 topic warns.
  for (const name of ["Materials", "Checks"]) {
    const r = warns(lintText(L1 + L2 + L3 + `### 7. ${name}\n`), "topic-order");
    assert.equal(r.length, 1);
    assert.match(r[0], new RegExp(`'${name}' is not a Layer 3 topic`));
  }
  // Construction out of order (before Limits) warns.
  assert.equal(warns(lintText(L1 + L2 + L3 + "### 6. Construction\n### 7. Limits\n"), "topic-order").length, 1);
});

test("layer-heading: any Layer heading outside the three layers warns once and names the three", () => {
  for (const heading of ["## Layer 5: Extra", "## Layer 0: Vision", "## Layer 3: Vision", "## Layer: Notes"]) {
    const r = lintText(L1 + L2 + L3 + heading + "\n\nScope: x.\n\n### 1. Anything\n");
    const lh = warns(r, "layer-heading");
    assert.equal(lh.length, 1);
    assert.match(lh[0], /1 Vision, 2 Structure, 3 Detail/);
    assert.doesNotMatch(lh[0], /removed/);
    assert.equal(r.lines.filter((l) => l.startsWith("WARN")).length, 1);
  }
});

test("clean pass on the to-do app example", () => {
  const r = run(todoApp);
  assert.equal(r.code, 0);
  assert.equal(r.lines.filter((l) => l.startsWith("WARN")).length, 0);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
  assert.match(r.out, /^INFO not-supplied: 5$/m);
});

test("layer-heading: the three names pass strict and a wrong name for a number warns once", () => {
  // (a) The three current names pass strict with no warning.
  assert.equal(lintText(L1 + L2 + L3, "--strict").code, 0);
  // (b) A wrong name at Layer 2 warns once, with the heading text, plus a missing-Layer-2 line.
  const b = lintText(L1 + "## Layer 2: Notes\n\nScope: x.\n");
  const bHeading = warns(b, "layer-heading");
  assert.equal(bHeading.filter((l) => l.includes("Notes")).length, 1);
  assert.equal(bHeading.some((l) => /missing '## Layer 2: Structure'/.test(l)), true);
  // (c) A wrong name at Layer 3 warns once.
  const c = lintText(L1 + L2 + "## Layer 3: Notes\n\nScope: x.\n");
  assert.equal(warns(c, "layer-heading").filter((l) => l.includes("Notes")).length, 1);
});

// --- entry topic order inside a Detail entry (D5, D8) ---------------------

test("entry topic-order: wrong order inside an entry warns", () => {
  const md = L1 + L2 + L3 + "### Brakes (part)\n\n#### 1. Responsibility\n#### 2. Rules\n#### 3. Seams\n";
  const r = warns(lintText(md), "topic-order");
  assert.equal(r.length, 1);
  assert.match(r[0], /'Seams' is out of order in the entry 'Brakes'/);
});

test("entry topic-order: unknown topic warns, and omission and a second entry pass", () => {
  // An unknown topic inside an entry warns, naming the entry.
  const bad = warns(lintText(L1 + L2 + L3 + "### Brakes (part)\n\n#### 1. Materials\n"), "topic-order");
  assert.equal(bad.length, 1);
  assert.match(bad[0], /'Materials' is not a Layer 3 topic in the entry 'Brakes'/);
  // Omitted topics are fine, and a second entry starts its own order.
  const ok = L1 + L2 + L3 +
    "### Brakes (part)\n\n#### 1. Responsibility\n#### 4. Rules\n" +
    "### Frame (part)\n\n#### 1. Responsibility\n#### 2. Concepts and states\n";
  assert.equal(warns(lintText(ok), "topic-order").length, 0);
});

// --- scenario id traces down the layers (D6, D8) --------------------------

test("scenario-trace: ids absent add no warnings", () => {
  const md = L1 + "- Given a rider, when braking, then stops.\n" + L2 + "- A path with no id.\n";
  assert.equal(warns(lintText(md), "scenario-trace").length, 0);
});

test("scenario-trace: an id without a path in Layer 2 warns", () => {
  const md = L1 + "- 3.1. Given a rider, when braking, then stops.\n" + L2 + "- No citation here.\n";
  const r = warns(lintText(md), "scenario-trace");
  assert.equal(r.length, 1);
  assert.match(r[0], /vision-3\.1 has no path in Layer 2/);
});

test("scenario-trace: an id without a rule in Layer 3 warns", () => {
  const md = L1 + "- 3.1. Given a rider, when braking, then stops.\n" +
    L2 + "- 6.1. Realizes vision-3.1. Given a rider, when braking, then stops.\n" +
    L3 + "### Brakes (part)\n\n#### 4. Rules\n- A rule with no id.\n";
  const r = warns(lintText(md), "scenario-trace");
  assert.equal(r.length, 1);
  assert.match(r[0], /vision-3\.1 has no rule in Layer 3/);
});

test("scenario-trace: ids cited pass, and Layers 1 and 2 only with ids on both pass strict", () => {
  const full = L1 + "- 3.1. Given a rider, when braking, then stops.\n" +
    L2 + "- 6.1. Realizes vision-3.1. Given a rider, when braking, then stops.\n" +
    L3 + "### Brakes (part)\n\n#### 4. Rules\n- 4.1. Realizes vision-3.1. Given a rider, when braking, then stops.\n";
  assert.equal(warns(lintText(full), "scenario-trace").length, 0);
  const idea = L1 + "- 3.1. Given a rider, when braking, then stops.\n" + L2 + "- 6.1. Realizes vision-3.1. Given a rider, when braking, then stops.\n";
  assert.equal(lintText(idea, "--strict").code, 0);
  assert.equal(warns(lintText(idea), "scenario-trace").length, 0);
});

test("scenario-trace: an id'd line must still read Given, when, then", () => {
  const md = L1 + "- 3.1. Given a cat it sleeps.\n" + L2 + "- 6.1. Realizes vision-3.1. Given a cat, when fed, then sleeps.\n";
  assert.equal(warns(lintText(md), "scenario-form").length, 1);
});

// --- own-stack and view sections lint clean (D8) --------------------------

test("own-stack: a Parent line before Layer 1 and an own-stack Standing line lint clean", () => {
  const md = "# Example: brakes (part)\n\nParent: bicycle, part Brakes\n\n" +
    L1 + "- 3.1. Given a rider, when braking, then stops.\n" +
    "## Layer 2: Structure\n\nScope: all.\n\n### 1. Parts\n\nNone.\n\n### 2. Standing\nStanding: own stack, brakes/brakes.md\n\n" +
    fxT("###", T2.slice(2), { "Scenario paths": "- 6.1. Realizes vision-3.1. Given a rider, when braking, then stops." });
  const r = lintText(md, "--strict");
  assert.equal(r.code, 0);
  assert.equal(r.lines.filter((l) => l.startsWith("WARN")).length, 0);
});

test("view: a View section after the last layer lints clean", () => {
  const md = L1 + L2 + L3 + "### Brakes (part)\n\n#### 1. Responsibility\n\nStops.\n\n" + fxT("####", T3.slice(1)) + "\n" +
    "## View: Lifecycle\n\n- Given a bicycle, when built, then shipped.\n";
  const r = lintText(md, "--strict");
  assert.equal(r.code, 0);
  assert.equal(r.lines.filter((l) => l.startsWith("WARN")).length, 0);
});

// --- reasons: every id shape (scope-and-ids D14) ---------------------------
const ADH = "### 8. Assumptions\n\n";
const rs = (md) => warns(lintText(md), "reasons");
const A_IDS = ["11.1.", "vision-11.1", "11.1:", "11.12.", "vision-11.10", "11.1)", "**11.1.**", "**11.1**"];
const D_IDS = ["12.1.", "vision-12.3", "12.1:", "12.10.", "**12.1.**", "12.2)"];

test("reasons-ids: assumption id shapes without both labels warn", () => {
  for (const id of A_IDS) {
    const r = rs(L1 + ADH + "- " + id + " Fact.\n" + L2);
    assert.equal(r.length, 1, id);
    assert.match(r[0], /assumption needs 'Basis:' and 'If wrong:'/, id);
    assert.match(r[0], /\(line 7\)$/, id);
  }
  for (const prefix of ["* ", "1. ", ""]) {
    assert.equal(rs(L1 + ADH + prefix + "11.1 Fact.\n" + L2).length, 1, JSON.stringify(prefix));
  }
  assert.equal(rs(L1 + ADH + "- 11.1 Fact. Basis: y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- 11.1 Fact. If wrong: x.\n" + L2).length, 1);
});

test("reasons-ids: decision id shapes without Reason warn", () => {
  for (const id of D_IDS) {
    const r = rs(L1 + ADH + "- " + id + " Choice.\n" + L2);
    assert.equal(r.length, 1, id);
    assert.match(r[0], /decision needs 'Reason:'/, id);
    assert.match(r[0], /\(line 7\)$/, id);
  }
  assert.equal(rs(L1 + ADH + "- 12.1 Choice. Why: y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- 12.1 Choice. Reason it is.\n" + L2).length, 1);
});

test("reasons-ids: the same shapes pass with their labels", () => {
  for (const id of A_IDS) assert.equal(rs(L1 + ADH + "- " + id + " Fact. Basis: y. If wrong: x.\n" + L2).length, 0, id);
  for (const id of D_IDS) assert.equal(rs(L1 + ADH + "- " + id + " Choice. Reason: z.\n" + L2).length, 0, id);
  assert.equal(rs(L1 + "- 11.1 Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
});

test("reasons-ids: labels inside a ~~~ fenced block are not credited to the item above", () => {
  const r = rs(L1 + ADH + "- 11.1. Fact.\n~~~\nBasis: y. If wrong: x.\n~~~\n" + L2);
  assert.equal(r.length, 1);
  assert.match(r[0], /assumption needs 'Basis:' and 'If wrong:'/);
});

test("reasons-ids: only the guide's labels count", () => {
  assert.equal(rs(L1 + ADH + "- 11.1 Fact. We think so because y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- 12.1 Choice. Why: y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- 12.1 Choice, so that z.\n" + L2).length, 1);
});

test("reasons-ids: an unclosed id is checked only inside the topic", () => {
  assert.equal(rs(L1 + "- A4 paper is used.\n- D2 cable is long.\n- 3.1 Fact.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- 11.1. Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "- 12.2: Choice.\n" + L2).length, 1);
});

test("reasons-ids: the topic ends at the next heading, and Detail entries are covered", () => {
  assert.equal(rs(L1 + ADH + "- 11.1 Fact. Basis: y. If wrong: x.\n\n### Diagrams\n\n- 3.2 Fact.\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + "- 11.1 Fact.\n" + L2 + "- 3.1 Fact.\n").length, 1);
  assert.equal(rs(L1 + "### Assumptions\n\n- 11.1 Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 8. Assumption notes\n\n- 3.1 Fact.\n" + L2).length, 0);
  assert.equal(rs(L1 + L2 + L3 + "### Brakes (part)\n\n#### 8. Assumptions\n\n- 11.1 Fact.\n\n#### 9. Decisions\n\n- 12.1 Choice.\n\n### Frame (part)\n\n- 3.1 Fact.\n").length, 2);
});

test("reasons-ids: items with no id are not checked", () => {
  const md = L1 + fxT("###", T1.slice(0, 10)) + "\n" + ADH + "- Not supplied: who decides.\n- None.\n\n### 12. Decisions\n\nNone.\n\n" + L2;
  assert.equal(rs(md).length, 0);
  assert.equal(lintText(md, "--strict").code, 0);
});

test("reasons-ids: wrapped and nested lines count, the next item's do not", () => {
  const doc = (text) => rs(L1 + ADH + text + L2);
  assert.equal(doc("- 11.1. Fact.\n  Basis: y. If wrong: x.\n").length, 0);
  assert.equal(doc("- 11.1. Fact.\n  - Basis: y\n  - If wrong: x\n").length, 0);
  assert.equal(doc("- 11.1. Fact.\n  Basis: y.\n").length, 1);
  const two = doc("- 12.1. Choice.\n- 11.1. Fact. Basis: y. If wrong: x. Reason: z.\n");
  assert.equal(two.length, 1);
  assert.match(two[0], /decision needs 'Reason:'/);
  assert.match(two[0], /\(line 7\)$/);
  const plain = doc("12.1. Choice.\nvision-11.1. Fact. Basis: y. If wrong: x. Reason: z.\n");
  assert.equal(plain.length, 1);
  assert.match(plain[0], /decision needs 'Reason:'/);
  assert.match(plain[0], /\(line 7\)$/);
  assert.equal(doc("- 12.1. Choice.\n\nReason: later.\n").length, 1);
});

test("reasons-ids: each example engages the check", () => {
  const refs = path.join(here, "..", "skills", "strata-blueprints", "references");
  const names = ["strata-blueprints-example.md", "strata-blueprints-example-todo-app"];
  for (const name of names) {
    const file = path.join(refs, name);
    const isDir = fs.statSync(file).isDirectory();
    // Single file: one entry with no label. Folder: one entry per sbp file, labelled by file name.
    const docs = isDir
      ? fs.readdirSync(file).filter((f) => /^sbp-.*\.md$/.test(f)).sort().map((f) => ({ label: f, lines: fs.readFileSync(path.join(file, f), "utf8").split("\n") }))
      : [{ label: null, lines: fs.readFileSync(file, "utf8").split("\n") }];
    assert.equal(warns(run(file), "reasons").length, 0, name);
    const mutate = (find, edit) => {
      const doc = docs.find((d) => d.lines.some((l) => find.test(l)));
      if (!doc) throw new Error(`${name}: no target line for ${find}`);
      const idx = doc.lines.findIndex((l) => find.test(l));
      const copy = doc.lines.slice(); copy[idx] = edit(copy[idx]);
      let r;
      if (isDir) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-copy-"));
        try {
          fs.cpSync(file, tmp, { recursive: true });
          fs.writeFileSync(path.join(tmp, doc.label), copy.join("\n"));
          r = warns(run(tmp), "reasons");
        } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
      } else {
        r = warns(lintText(copy.join("\n")), "reasons");
      }
      assert.equal(r.length, 1, name);
      const where = doc.label ? `${doc.label.replace(/\./g, "\\.")} line ` : "line ";
      assert.match(r[0], new RegExp(`\\(${where}${idx + 1}\\)$`), name);
    };
    mutate(/^- (?:11|10)\.\d+\. .*Basis:.*If wrong:/, (l) => l.replace(" If wrong:", ""));
    mutate(/^- (?:12|11)\.\d+\. .*Reason:/, (l) => l.replace(" Reason:", " Because:"));
  }
});

test("fence: a ~~~ block hides its content like a backtick block, and each closes only with its own marker", () => {
  const body = "- 11.1. Inside tilde fence with no reasons.\n";
  assert.equal(rs(L1 + ADH + "Title: t.\n~~~\n" + body + "~~~\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + "Title: t.\n```\n" + body + "```\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + "Title: t.\n~~~\n```\n" + body + "~~~\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + "Title: t.\n```\n~~~\n" + body + "```\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + body + L2).length, 1);
});

// --- split-assumptions-decisions D15 ---------------------------------------
const tp = (md) => warns(lintText(md), "topic-order");

test("split-topics: Assumptions then Decisions are accepted as the last two topics of every layer", () => {
  assert.equal(tp(L1 + "### 8. Assumptions\n### 9. Decisions\n" + L2 + "### 7. Assumptions\n### 8. Decisions\n" + L3 + "### 8. Assumptions\n### 9. Decisions\n").length, 0);
  assert.equal(tp(L1 + L2 + L3 + "### Brakes (part)\n\n#### 8. Assumptions\n#### 9. Decisions\n").length, 0);
  assert.equal(tp(L1 + "### 8. Assumptions\n" + L2).length, 0);
  assert.equal(tp(L1 + "### 9. Decisions\n" + L2).length, 0);
});

test("split-topics: Decisions before Assumptions is out of order", () => {
  const a = tp(L1 + "### 9. Decisions\n### 8. Assumptions\n" + L2);
  assert.equal(a.length, 1);
  assert.match(a[0], /'Assumptions' is out of order in Layer 1/);
  const b = tp(L1 + L2 + L3 + "### Brakes (part)\n\n#### 9. Decisions\n#### 8. Assumptions\n");
  assert.equal(b.length, 1);
  assert.match(b[0], /'Assumptions' is out of order in the entry 'Brakes'/);
});

test("split-topics: reasons are checked under both topics", () => {
  assert.equal(rs(L1 + "### 8. Assumptions\n\n- 11.1 Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- 12.1 Choice.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- 11.2 Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 8. Assumptions\n\n- 11.1 Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- 12.1 Choice. Reason: z.\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- 11.2 Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
  assert.equal(rs(L1 + L2 + L3 + "### Brakes (part)\n\n#### 8. Assumptions\n\n- 11.1 Fact.\n\n#### 9. Decisions\n\n- 12.1 Choice.\n").length, 2);
  assert.equal(rs(L1 + "### 8. Assumptions\n\n- 11.1 Fact. Basis: y. If wrong: x.\n\n### 9. Decisions\n\n- 12.1 Choice. Reason: z.\n\n### Diagrams\n\n- 3.2 Fact.\n" + L2).length, 0);
});

test("split-topics: None. under either topic passes strict", () => {
  const r = lintText(L1 + fxT("###", T1.slice(0, 10)) + "\n### 11. Assumptions\n\nNone.\n\n### 12. Decisions\n\nNone.\n\n" + L2 + fxT("###", T2.slice(0, 9)) + "\n### 10. Assumptions\n\nNone.\n\n### 11. Decisions\n\n- 11.1. Choice. Reason: z.\n\n", "--strict");
  assert.equal(r.code, 0);
  assert.equal(r.lines.some((l) => l.startsWith("WARN")), false);
});

test("split-topics: the combined name is not a topic in any layer", () => {
  const tp = (md) => warns(lintText(md), "topic-order");
  const a = tp(L1 + "### 8. Assumptions and decisions\n" + L2);
  const b = tp(L1 + L2 + "### 7. Assumptions and decisions\n");
  const c = tp(L1 + L2 + L3 + "### 8. Assumptions and decisions\n");
  for (const w of [a, b, c]) {
    assert.equal(w.length, 1);
    assert.match(JSON.stringify(w), /'Assumptions and decisions' is not a Layer [123] topic/);
  }
  const d = tp(L1 + L2 + L3 + "### Brakes (part)\n\n#### 8. Assumptions and decisions\n");
  assert.equal(d.length, 1);
  assert.match(JSON.stringify(d), /not a Layer 3 topic in the entry 'Brakes'/);
  assert.equal(rs(L1 + "### 8. Assumptions and decisions\n\n- 3.1 Fact.\n" + L2).length, 0);
});

// --- reasons: a "Not supplied:" gap is exempt --------------------------------
test("reasons-ids: Not supplied gap in a bullet is exempt", () => {
  assert.equal(rs(L1 + "- 11.3. Not supplied: the deployment target.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- 11.2. Expiry policy: Not supplied: whether and when a link expires.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- 12.2. Not supplied: the storage choice.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- 12.2. Expiry policy: Not supplied: whether a link expires.\n" + L2).length, 0);
});

test("reasons-ids: Not supplied gap wrapped over two lines is exempt", () => {
  assert.equal(rs(L1 + "- 11.3. Deployment target.\n  Not supplied: the deployment target.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- 12.3. Storage choice.\n  Not supplied: which store.\n" + L2).length, 0);
});
test("reasons-ids: Not supplied gap in Assumptions and Decisions topics is exempt", () => {
  assert.equal(rs(L1 + ADH + "- 11.3. Not supplied: the deployment target.\n\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + "- 11.1 Target.\n  Not supplied: the deployment target.\n\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- 12.1 Not supplied: the store.\n\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- 12.1 Store.\n  Not supplied: which store.\n\n" + L2).length, 0);
});
test("reasons-ids: items without labels or gap still warn; complete item passes", () => {
  assert.equal(rs(L1 + "- 11.3. Deployment target is cloud.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- 11.1 Deployment target is cloud.\n\n" + L2).length, 1);
  assert.equal(rs(L1 + "- 11.3. Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
});

// --- costs and risks topics (plan costs-risks-topics, step 2) -------------
const mk = (o = {}) => {
  const d = { c1: "None.", r1: "None.", o1: "None.", c2: "None.", r2: "None.", o2: "None.", c3: "None.", r3: "None.", o3: "None.", ...o };
  return "## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\nA need.\n\n### 2. Target audience\n\nMembers.\n\n### 3. Value\n\n- 3.1. Given a, when b, then c.\n\n### 4. Focus\n\nSheds.\n\n### 5. Success measures\n\nNone.\n\n### 6. Qualities and constraints\n\nNone.\n\n### 7. Vocabulary\n\nNone.\n\n" +
    `### 8. Costs\n\n${d.c1}\n\n### 9. Risks\n\n${d.r1}\n\n### 10. Open Concerns\n\n${d.o1}\n\n### 11. Assumptions\n\n- 11.1. Fact. Basis: b. If wrong: w.\n\n### 12. Decisions\n\n- 12.1. Choice. Reason: r.\n\n` +
    "## Layer 2: Structure\n\nScope: all.\n\n### 1. Parts\n\nP.\n\n### 2. Standing\n\nNone.\n\n### 3. Seams between parts\n\nNone.\n\n### 4. Seams with the outside\n\nNone.\n\n### 5. Shared things\n\nNone.\n\n### 6. Scenario paths\n\n- 6.1. Realizes vision-3.1. Given a, when b, then c.\n\n" +
    `### 7. Costs\n\n${d.c2}\n\n### 8. Risks\n\n${d.r2}\n\n### 9. Open Concerns\n\n${d.o2}\n\n### 10. Assumptions\n\nNone.\n\n### 11. Decisions\n\n- 11.1. Choice. Reason: r.\n\n` +
    "## Layer 3: Detail\n\nScope: one part.\n\n### Shed (part)\n\n#### 1. Responsibility\n\nR.\n\n#### 2. Concepts and states\n\nNone.\n\n#### 3. Seams\n\nNone.\n\n#### 4. Rules\n\n- 4.1. Realizes vision-3.1. Given a, when b, then c.\n\n#### 5. Inside\n\nNone.\n\n#### 6. Limits\n\n- 6.1. L.\n\n#### 7. Construction\n\nNone.\n\n" +
    `#### 8. Costs\n\n${d.c3}\n\n#### 9. Risks\n\n${d.r3}\n\n#### 10. Open Concerns\n\n${d.o3}\n\n#### 11. Assumptions\n\nNone.\n\n#### 12. Decisions\n\n- 12.1. Choice. Reason: r.\n`;
};
const crWarns = (r) => r.lines.filter((l) => /^WARN (cost-shape|risk-shape|risk-ref|concern-shape):/.test(l));
// The number an item is written with: the document in a full id is dropped.
const num = (id) => id.replace(/^(?:vision|structure|detail\.[a-z0-9]+)-/, "");
const C = (id, amt = "40 USD per month", rest = "Paid by the club") => `- ${num(id)}. Upkeep: ${amt}. ${rest}.`;
const R = (id, sev = "High", ans = "vision-12.1") => `- ${num(id)}. Given a flood, when the shed fills, then tools rust. Severity: ${sev}. Answered by ${ans}.`;

test("topics: well-formed costs and risks pass --strict in every layer; Not supplied counts", () => {
  const r = lintText(mk({
    c1: C("vision-8.1", "Not supplied: the hours") + "\n" + C("vision-8.2", "1,200.50 USD one-off", "Paid by the club; driven by the tool count"),
    r1: R("vision-9.1") + "\n" + R("vision-9.2", "Not rated", "Not supplied: who covers"),
    c2: C("structure-7.1", "16 hours per year"), r2: R("structure-8.1", "Low", "vision-3.1"),
    c3: C("detail.shed-8.1", "3 days") + "\n" + C("detail.shed-8.2"), r3: R("detail.shed-9.1", "Medium", "structure-11.1"),
  }), "--strict");
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.match(r.out, /^INFO not-supplied: 2$/m);
});

test("topics: None. and a bare Not supplied: bullet pass", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: "- Not supplied: what it costs.", r1: "- Not supplied: the risks." }))), []);
  assert.equal(lintText(mk(), "--strict").code, 0);
});

test("cost-shape: a cost needs a valid amount and Paid by", () => {
  assert.equal(warns(lintText(mk({ c1: C("vision-8.1", "40 USD per month", "Paid by the club; driven by use") })), "cost-shape").length, 0);
  assert.equal(warns(lintText(mk({ c1: "- 8.1. Upkeep: 40 USD per month." })), "cost-shape").length, 1);
  for (const amt of ["lots", "40", ""]) {
    assert.equal(warns(lintText(mk({ c1: C("vision-8.1", amt) })), "cost-shape").length, 1, amt);
  }
  assert.equal(warns(lintText(mk({ c1: "- 8.1. Upkeep: 40 USD. Paid by ." })), "cost-shape").length, 1);
  assert.equal(warns(lintText(mk({ c1: "- 8.1. Upkeep: Not supplied: . Paid by the club." })), "cost-shape").length, 1);
  assert.equal(warns(lintText(mk({ c1: "Upkeep is dear." })), "cost-shape").length, 1);
  assert.equal(warns(lintText(mk({ c1: "- 9.1. Upkeep: 40 USD. Paid by the club." })), "cost-shape").length, 1);
});

test("cost-shape: a wrapped cost bullet is read whole", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: "- 8.1. Upkeep: 40 USD per month.\n  Paid by the club." }))), []);
});

test("risk-shape: Given/when/then, severity and Answered by", () => {
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1") })), "risk-shape").length, 0);
  for (const sev of ["High", "Medium", "Low", "Not rated"]) assert.equal(warns(lintText(mk({ r1: R("vision-9.1", sev) })), "risk-shape").length, 0, sev);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "Severe") })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- 9.1. Given a flood, when the shed fills, then tools rust. Answered by vision-12.1." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- 9.1. Given a flood, then tools rust. Severity: High. Answered by vision-12.1." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- 9.1. Given a flood, when the shed fills, then tools rust. Severity: High." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- 9.1. Floods rust tools." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- 8.1. Given a flood, when the shed fills, then tools rust. Severity: High. Answered by vision-12.1." })), "risk-shape").length, 1);
});

test("risk-ref: Answered by names an id that exists, or Not supplied:", () => {
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "vision-11.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "vision-3.1; vision-12.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "vision-12.9") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "vision-3.9") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "12.1 and vision-12.9") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "the caretaker") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "Not supplied: the answer") })), "risk-ref").length, 0);
});

test("risk-ref: an answer defined in an outer layer warns; V ids count as Layer 1", () => {
  const outer = warns(lintText(mk({ r1: R("vision-9.1", "High", "structure-11.1") })), "risk-ref");
  assert.equal(outer.length, 1);
  assert.match(outer[0], /outward|outer/);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "detail.shed-12.1") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r2: R("structure-8.1", "High", "detail.shed-12.1") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r2: R("structure-8.1", "High", "vision-12.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r2: R("structure-8.1", "High", "structure-11.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r3: R("detail.shed-9.1", "High", "vision-3.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r3: R("detail.shed-9.1", "High", "vision-12.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r1: R("vision-9.1", "High", "vision-3.1") })), "risk-ref").length, 0);
});

test("topics: a table line in Costs or Risks warns", () => {
  assert.equal(warns(lintText(mk({ c1: "| Cost | Amount |\n| --- | --- |\n| Upkeep | 40 USD |" })), "cost-shape").length >= 1, true);
  assert.equal(warns(lintText(mk({ r3: "| Risk | Severity |" })), "risk-shape").length >= 1, true);
});

test("topics: fenced content in a topic is ignored; other topics are not checked as costs", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: "None.\n\n```text\n| a | b |\n```" }))), []);
  assert.deepEqual(crWarns(lintText(mk({ c1: C("vision-8.1") }).replace("- 12.1. Choice.", "- 8.9. Not a cost here. Choice."))), []);
});

test("topics: each example is clean, and a mutation of each cost or risk warns", () => {
  const dir = path.join(here, "..", "skills", "strata-blueprints", "references");
  let mutated = 0;
  const COST = /^- (?:8|7)\.\d+\. .*Paid by/, RISK = /^- (?:9|8)\.\d+\. .*Severity:/;
  const isCR = (l) => COST.test(l) || RISK.test(l);
  const badLine = (line) => (COST.test(line) ? line.replace(/ Paid by .*$/, "") : line.replace(/ Severity: \w+( rated)?\./, ""));
  for (const f of fs.readdirSync(dir).filter((x) => /^strata-blueprints-example/.test(x))) {
    const full = path.join(dir, f);
    assert.equal(run(full, "--strict").code, 0, f);
    if (fs.statSync(full).isDirectory()) {
      // Edit the line in the file that holds it, in a temp copy of the folder, and lint that folder.
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-copy-"));
      try {
        fs.cpSync(full, tmp, { recursive: true });
        for (const n of fs.readdirSync(tmp).filter((x) => /^sbp-.*\.md$/.test(x)).sort()) {
          const md = fs.readFileSync(path.join(tmp, n), "utf8");
          const line = md.split("\n").find(isCR);
          if (!line) continue;
          fs.writeFileSync(path.join(tmp, n), md.replace(line, () => badLine(line)));
          assert.equal(crWarns(run(tmp)).length >= 1, true, `${f}/${n}`);
          mutated++;
          break;
        }
      } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
      continue;
    }
    const md = fs.readFileSync(full, "utf8");
    const line = md.split("\n").find(isCR);
    if (!line) continue;
    const r = lintText(md.replace(line, () => badLine(line)));
    assert.equal(crWarns(r).length >= 1, true, f);
    mutated++;
  }
  assert.equal(mutated >= 1, true);
});

// --- open concerns and the Given/When/Then cost form ----------------------
const mko = (o = {}, c = {}) => mk({ ...c, ...o });
const ocWarns = (r) => r.lines.filter((l) => /^WARN concern-shape:/.test(l));
const O = (id, raised = "Raised by the club") => `- ${num(id)}. Given the shed may move, when the club votes, then the cost is priced again. ${raised}.`;
const G = (id, amt = "40 USD per month", rest = "Paid by the club") => `- ${num(id)}. Given the shed is open, when the club runs it, then it costs ${amt}. ${rest}.`;

test("concern-shape: Given, when, then and Raised by are all needed", () => {
  assert.deepEqual(ocWarns(lintText(mko({ o1: O("vision-10.1") }))), []);
  for (const bad of [
    "- 10.1. Given the shed may move, then the cost is priced again. Raised by the club.",
    "- 10.1. Given the shed may move, when the club votes. Raised by the club.",
    "- 10.1. When the club votes, then the cost is priced again. Raised by the club.",
    "- 10.1. Given the shed may move, when the club votes, then the cost is priced again.",
    "- 10.1. Given the shed may move, when the club votes, then the cost is priced again. Raised by .",
    "- 10.1. The shed may move.",
    "The shed may move.",
    "- 9.1. Given the shed may move, when the club votes, then the cost is priced again. Raised by the club.",
  ]) assert.equal(warns(lintText(mko({ o1: bad })), "concern-shape").length, 1, bad);
});

test("concern-shape: well-formed concerns pass --strict in every layer; wrapped lines are read whole", () => {
  const r = lintText(mko({ o1: O("vision-10.1") + "\n" + O("vision-10.2"), o2: O("structure-9.1"), o3: "- 10.1. Given the shed may move, when the club votes,\n  then the cost is priced again. Raised by the club." }), "--strict");
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
});

test("concern-shape: None. is accepted; a table line warns", () => {
  assert.deepEqual(ocWarns(lintText(mko({ o1: "None.", o2: "None.", o3: "None." }))), []);
  assert.equal(lintText(mko({ o1: "None.", o2: "None.", o3: "None." }), "--strict").code, 0);
  assert.equal(warns(lintText(mko({ o1: "| Concern | Who |\n| --- | --- |\n| Shed | club |" })), "concern-shape").length >= 1, true);
});

test("cost-shape: the Given, when, then cost form passes with an amount or Not supplied:", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: G("vision-8.1") + "\n" + G("vision-8.2", "Not supplied: the hours") + "\n" + G("vision-8.3", "1,200 USD one-off", "Paid by the club; driven by use"), c3: G("detail.shed-8.1", "3 hours") }))), []);
  assert.equal(lintText(mk({ c1: G("vision-8.1") }), "--strict").code, 0);
});

test("cost-shape: a Given, when, then cost without Paid by or with a bad amount warns", () => {
  assert.equal(warns(lintText(mk({ c1: "- 8.1. Given the shed is open, when the club runs it, then it costs 40 USD per month." })), "cost-shape").length, 1);
  for (const amt of ["lots", "40", "Not supplied:", ""]) assert.equal(warns(lintText(mk({ c1: G("vision-8.1", amt) })), "cost-shape").length, 1, amt);
});

test("cost-shape: a Given, when, then cost with an empty payer warns", () => {
  assert.equal(warns(lintText(mk({ c1: "- 8.1. Given the shed is open, when the club runs it, then it costs 40 USD per month. Paid by ." })), "cost-shape").length, 1);
});

test("lint: a directory path exits 2 with a one-line message and no stack trace", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  try {
    const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
    assert.ok(!r.stderr.includes(" at "), r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("cost-shape: natural amounts pass", () => {
  for (const amt of ["40 USD per week", "40 USD per month and more", "40 US dollars", "$1,200.50 USD per member per month", "about 40 hours", "about €40 EUR one-off", "12.5 hours per sprint"]) {
    assert.equal(warns(lintText(mk({ c1: G("vision-8.1", amt) })), "cost-shape").length, 0, amt);
    assert.equal(warns(lintText(mk({ c1: C("vision-8.1", amt) })), "cost-shape").length, 0, amt);
  }
});

test("cost-shape: the old cost form still passes; a document without the new topics lints as before", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: C("vision-8.1") + "\n" + C("vision-8.2", "Not supplied: the hours") }))), []);
  assert.equal(lintText(mk(), "--strict").code, 0);
  assert.deepEqual(ocWarns(lintText(mk())), []);
});

test("concern-shape: the three examples lint clean under --strict", () => {
  const dir = path.join(here, "..", "skills", "strata-blueprints", "references");
  const files = ["strata-blueprints-example.md", "strata-blueprints-example-todo-app", "strata-blueprints-example-rfp.md"];
  assert.equal(files.length, 3);
  for (const f of files) {
    assert.equal(fs.existsSync(path.join(dir, f)), true, f);
    const r = run(path.join(dir, f), "--strict");
    assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), [], f);
    assert.equal(r.code, 0, f);
  }
});

test("cost-shape: the message names the Given, when, then form", () => {
  const w = warns(lintText(mk({ c1: "- 8.1. Given the shed is open, when the club runs it, then it costs 40 USD per month." })), "cost-shape");
  assert.equal(w.length, 1);
  assert.match(w[0], /Given/);
});

// --- every topic is written in a written layer (plan ids, S1) ------------------
const tw = (md) => warns(lintText(md), "topics");
const full1 = fxT("###", T1), full2 = fxT("###", T2), full3 = "### Shed (part)\n\n" + fxT("####", T3);

test("missing-topic: a written layer that lacks a topic warns once for each, and a full layer passes", () => {
  assert.deepEqual(tw(L1 + full1 + L2 + full2 + L3 + full3), []);
  assert.equal(lintText(L1 + full1 + L2 + full2 + L3 + full3, "--strict").code, 0);
  // Layer 1 with only Need and Decisions lacks the other ten, one warning each, in guide order, at the layer heading.
  const w = tw(L1 + "### 1. Need\n\nN.\n\n### 2. Decisions\n\nNone.\n\n" + L2 + full2);
  assert.equal(w.length, 10);
  assert.match(w[0], /^WARN topics: topic 'Target audience' is missing in Layer 1 \(line 1\)$/);
  assert.match(w.at(-1), /topic 'Assumptions' is missing in Layer 1/);
  assert.equal(lintText(L1 + "### 1. Need\n\nN.\n\n" + L2 + full2, "--strict").code, 1);
  // A topic whose name is only close does not count; Layer 2 names its own missing topic.
  assert.equal(tw(L1 + full1.replace("### 3. Value", "### 3. Values") + L2 + full2).length, 1);
  const w2 = tw(L1 + full1 + L2 + full2.replace(/### 5\. Shared things\n\nNone\.\n/, ""));
  assert.equal(w2.length, 1);
  assert.match(w2[0], /topic 'Shared things' is missing in Layer 2/);
});

test("missing-topic: an entry is checked on its own, and a bare layer, an absent layer and a view are not", () => {
  const e = tw(L1 + full1 + L2 + full2 + L3 + "### Shed (part)\n\n#### 1. Responsibility\n\nR.\n\n#### 4. Rules\n\nR.\n\n### Frame (part)\n\n" + fxT("####", T3));
  assert.equal(e.length, 10);
  assert.match(e[0], /topic 'Concepts and states' is missing in the entry 'Shed' \(line \d+\)$/);
  assert.equal(e.every((l) => /the entry 'Shed'/.test(l)), true);
  // A bare layer (no topic heading), an absent layer, a Layer 3 with no entry and a view are not checked.
  assert.deepEqual(tw(L1 + "A need, with no topic heading.\n\n" + L2), []);
  assert.deepEqual(tw(L1 + full1), []);
  assert.deepEqual(tw(L1 + full1 + L2 + full2 + L3), []);
  assert.deepEqual(tw(L1 + full1 + L2 + full2 + "## View: Flow\n\n### 1. Need\n\nN.\n"), []);
  // A heading of a topic that is not in the layer still counts as a topic heading: the layer is checked.
  assert.equal(tw(L1 + "### 1. Needs\n\nN.\n\n" + L2 + full2).length, 12);
});

test("missing-topic: Costs, Risks and Open Concerns must appear in every written layer", () => {
  const without = (md, names) => md.replace(new RegExp(`#{3,4} \\d+\\. (${names.join("|")})\\n\\nNone\\.\\n\\n?`, "g"), "");
  const doc = L1 + full1 + L2 + full2 + L3 + full3;
  assert.deepEqual(tw(doc), []);
  const w = tw(without(doc, ["Costs", "Risks", "Open Concerns"]));
  assert.equal(w.length, 9);
  for (const name of ["Costs", "Risks", "Open Concerns"]) assert.equal(w.filter((l) => l.includes(`topic '${name}'`)).length, 3, name);
  assert.equal(lintText(without(doc, ["Open Concerns"]), "--strict").code, 1);
  assert.equal(lintText(without(doc, ["Costs"]), "--strict").code, 1);
});

// --- folder mode (skill-optimization S1; plan D2, D3, D15) ------------------------
const fxVision = `# Club

Version: 0.1.0
Status: Draft

## Layer 1: Vision

Scope: the whole club.

### 1. Value

- 3.1. Given a member, when they join, then they are listed.

### 2. Decisions

- 12.1. Keep lists. Reason: simple.
`;
const fxStructure = `# Club

## Layer 2: Structure

Scope: the whole club.

### 1. Parts

- Ledger (part): holds the records.
- Rota (part): plans the shifts.

### 2. Standing

- Ledger: sbp-detail-ledger.md
- Rota: sbp-detail-rota.md

### 6. Scenario paths

- 6.1. Realizes vision-3.1. Given a member, when they join, then Ledger adds a record.

## View: Lifecycle

A member joins, then rests.
`;
const fxCost = (id) => `\n#### 8. Costs\n\n- ${num(id)}. Given a busy week, when the part runs, then it costs 5 hours. Paid by the club.\n`;
const fxLedger = `# Club

## Layer 3: Detail

Scope: one part.

### Ledger (part)

#### 1. Responsibility

Holds the records.

#### 4. Rules

- 4.1. Realizes vision-3.1. Given a member, when they join, then a record is added.
`;
const fxRota = `# Club

## Layer 3: Detail

Scope: one part.

### Rota (part)

#### 1. Responsibility

Plans the shifts.
`;
// The same stack with every topic written (each missing one reads None.), so strict runs stay clean under the topics check.
const fxFull = {
  "sbp-vision.md": "# Club\n\nVersion: 0.1.0\nStatus: Draft\n\n## Layer 1: Vision\n\nScope: the whole club.\n\n" +
    fxT("###", T1, { Value: "- 3.1. Given a member, when they join, then they are listed.", Decisions: "- 12.1. Keep lists. Reason: simple." }),
  "sbp-structure.md": "# Club\n\n## Layer 2: Structure\n\nScope: the whole club.\n\n" +
    fxT("###", T2, { Parts: "- Ledger (part): holds the records.\n- Rota (part): plans the shifts.", Standing: "- Ledger: sbp-detail-ledger.md\n- Rota: sbp-detail-rota.md", "Scenario paths": "- 6.1. Realizes vision-3.1. Given a member, when they join, then Ledger adds a record." }) +
    "\n## View: Lifecycle\n\nA member joins, then rests.\n",
  "sbp-detail-ledger.md": "# Club\n\n## Layer 3: Detail\n\nScope: one part.\n\n### Ledger (part)\n\n" +
    fxT("####", T3, { Responsibility: "Holds the records.", Rules: "- 4.1. Realizes vision-3.1. Given a member, when they join, then a record is added." }),
  "sbp-detail-rota.md": "# Club\n\n## Layer 3: Detail\n\nScope: one part.\n\n### Rota (part)\n\n" +
    fxT("####", T3, { Responsibility: "Plans the shifts." }),
};
// Build a stack folder in a temp dir; an override of null removes the file; a key ending in "/" makes a folder.
function fxStack(over = {}) {
  const files = { "sbp-vision.md": fxVision, "sbp-structure.md": fxStructure, "sbp-detail-ledger.md": fxLedger, "sbp-detail-rota.md": fxRota, ...over };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-stack-"));
  for (const [name, body] of Object.entries(files)) {
    if (body === null) continue;
    if (name.endsWith("/")) { fs.mkdirSync(path.join(dir, name), { recursive: true }); continue; }
    fs.writeFileSync(path.join(dir, name), body);
  }
  return dir;
}
function fxWith(over, fn) { const dir = fxStack(over); try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); } }
const fxWarns = (over, check, ...flags) => fxWith(over, (d) => warns(run(d, ...flags), check));

test("folder: a clean stack passes --strict with no warning and the same summary line", () => {
  const r = fxWith(fxFull, (d) => run(d, "--strict"));
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
  assert.ok(r.lines.some((l) => /^INFO not-supplied: 0$/.test(l)));
});

test("folder: a detail file that lacks a topic warns with its file name", () => {
  const w = fxWarns({ ...fxFull, "sbp-detail-rota.md": fxFull["sbp-detail-rota.md"].replace(/#### 5\. Inside\n\nNone\.\n\n/, "") }, "topics");
  assert.equal(w.length, 1);
  assert.match(w[0], /topic 'Inside' is missing in the entry 'Rota' \(sbp-detail-rota\.md line 7\)$/);
  const v = fxWarns({ ...fxFull, "sbp-vision.md": fxFull["sbp-vision.md"].replace(/### 7\. Vocabulary\n\nNone\.\n\n/, "") }, "topics");
  assert.equal(v.length, 1);
  assert.match(v[0], /topic 'Vocabulary' is missing in Layer 1 \(sbp-vision\.md line 6\)$/);
});

test("folder: a trailing slash on the folder path works", () => {
  const r = fxWith(fxFull, (d) => run(d + "/", "--strict"));
  assert.equal(r.code, 0);
});

test("folder: a warning from a file is labelled with the file name and its own line", () => {
  const r = fxWith({ "sbp-vision.md": fxVision.replace("simple.", "simple. TODO") }, (d) => run(d));
  const w = warns(r, "unfinished");
  assert.equal(w.length, 1);
  assert.match(w[0], /\(sbp-vision\.md line 16\)$/);
  const r2 = fxWith({ "sbp-detail-ledger.md": fxLedger + "\nTBD\n" }, (d) => run(d));
  assert.match(warns(r2, "unfinished")[0], /\(sbp-detail-ledger\.md line 17\)$/);
});

test("folder: a layer heading in the wrong file warns layer-heading with the file label", () => {
  const w = fxWarns({ "sbp-vision.md": fxVision + "\n## Layer 2: Structure\n\nScope: x.\n" }, "layer-heading");
  assert.ok(w.some((l) => /sbp-vision\.md line 18\)$/.test(l)), w.join("\n"));
  const w2 = fxWarns({ "sbp-detail-rota.md": fxRota.replace("## Layer 3: Detail", "## Layer 2: Structure") }, "layer-heading");
  assert.ok(w2.some((l) => /sbp-detail-rota\.md line 3\)$/.test(l)), w2.join("\n"));
});

test("folder: a detail file with two entries, or none, warns layer-heading", () => {
  const two = fxWarns({ "sbp-detail-rota.md": fxRota + "\n### Extra (part)\n\n#### 1. Responsibility\n\nMore.\n" }, "layer-heading");
  assert.equal(two.filter((l) => /sbp-detail-rota\.md/.test(l)).length, 1, two.join("\n"));
  const none = fxWarns({ "sbp-detail-rota.md": fxRota.replace("### Rota (part)\n", "") }, "layer-heading");
  assert.equal(none.filter((l) => /sbp-detail-rota\.md/.test(l)).length, 1, none.join("\n"));
});

test("folder standing: a named file that is absent warns once", () => {
  const w = fxWarns({ "sbp-detail-rota.md": null }, "standing");
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /sbp-detail-rota\.md/);
  assert.match(w[0], /\(sbp-structure\.md line 15\)$/);
});

test("folder standing: a detail file named by no line warns once", () => {
  const w = fxWarns({ "sbp-structure.md": fxStructure.replace("- Rota: sbp-detail-rota.md\n", "") }, "standing");
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /sbp-detail-rota\.md/);
});

test("folder standing: a file whose slug is no part's slug warns", () => {
  const w = fxWarns({ "sbp-detail-rota.md": null, "sbp-detail-zzz.md": fxRota, "sbp-structure.md": fxStructure.replace("sbp-detail-rota.md", "sbp-detail-zzz.md") }, "standing");
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /zzz/);
});

test("folder standing: two parts that share a slug warn", () => {
  const w = fxWarns({ "sbp-structure.md": fxStructure.replace("- Rota (part): plans the shifts.", "- Rota (part): plans the shifts.\n- ROTA (part): a twin.") }, "standing");
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /rota/);
});

test("folder standing: an entry name that differs from the Parts name warns", () => {
  const w = fxWarns({ "sbp-detail-rota.md": fxRota.replace("### Rota (part)", "### Roster (part)") }, "standing");
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /Roster/);
  assert.match(w[0], /\(sbp-detail-rota\.md line 7\)$/);
});

test("folder standing: 'own stack' is only checked that the folder exists", () => {
  const structure = fxStructure.replace("- Rota (part): plans the shifts.", "- Rota (part): plans the shifts.\n- Presence (part): keeps devices level.")
    .replace("- Rota: sbp-detail-rota.md", "- Rota: sbp-detail-rota.md\n- Presence: own stack, presence/");
  assert.equal(fxWarns({ "sbp-structure.md": structure, "presence/": "" }, "standing").length, 0);
  const w = fxWarns({ "sbp-structure.md": structure }, "standing");
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /presence\//);
});

test("folder standing: 'described here' warns in folder mode", () => {
  const w = fxWarns({ "sbp-detail-rota.md": null, "sbp-structure.md": fxStructure.replace("- Rota: sbp-detail-rota.md", "- Rota: described here.") }, "standing");
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /described here/);
});

test("folder: ring warns by layer with a file label; a view section is not a layer", () => {
  const w = fxWarns({ "sbp-vision.md": fxVision.replace("simple.", "simple, see Layer 3.") }, "ring");
  assert.equal(w.length, 1);
  assert.match(w[0], /\(sbp-vision\.md line 16\)$/);
  assert.equal(fxWarns({ "sbp-structure.md": fxStructure + "\nA view that mentions Layer 3.\n" }, "ring").length, 0);
});

test("folder: a '## View:' section at the end of the structure file draws no warning", () => {
  const r = fxWith({ ...fxFull, "sbp-structure.md": fxFull["sbp-structure.md"] + "\n### Notes\n\nMore.\n" }, (d) => run(d, "--strict"));
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
});

test("folder: scenario-trace 'no rule in Layer 3' runs only when a detail file exists", () => {
  const noRule = fxWarns({ "sbp-detail-ledger.md": fxLedger.replace(/#### 4\. Rules[\s\S]*$/, "") }, "scenario-trace");
  assert.equal(noRule.length, 1, noRule.join("\n"));
  assert.match(noRule[0], /vision-3\.1 has no rule in Layer 3/);
  const none = fxWarns({ "sbp-detail-ledger.md": null, "sbp-detail-rota.md": null }, "scenario-trace");
  assert.equal(none.length, 0, none.join("\n"));
});

test("folder: a folder with none of the three names exits 2 with one stderr line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  try {
    fs.writeFileSync(path.join(dir, "README.md"), "# nothing\n");
    const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
    assert.match(r.stderr, /^strata-blueprints-lint: no sbp-vision\.md, sbp-structure\.md or sbp-detail-\*\.md in /);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("folder: a subfolder is ignored, and so are README.md and a file named for a view", () => {
  const r = fxWith({
    ...fxFull, "README.md": "TODO\n", ["sbp-" + "view-x.md"]: "TODO\n",
  }, (d) => { fs.mkdirSync(path.join(d, "sub")); fs.writeFileSync(path.join(d, "sub", "sbp-detail-extra.md"), "TODO\n"); return run(d, "--strict"); });
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
  assert.equal(r.code, 0);
});

test("folder: an unreadable detail file exits 2 with one stderr line", { skip: process.getuid && process.getuid() === 0 }, () => {
  const dir = fxStack({});
  try {
    fs.chmodSync(path.join(dir, "sbp-detail-rota.md"), 0o000);
    const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("folder: CRLF files lint clean", () => {
  const crlf = {};
  for (const [k, v] of Object.entries(fxFull)) crlf[k] = v.replace(/\n/g, "\r\n");
  const r = fxWith(crlf, (d) => run(d, "--strict"));
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
});

// --- --impact (skill-optimization S1; plan D4) -----------------------------------
function fxImpact(args) {
  const r = spawnSync(process.execPath, [script, "--impact", ...args], { encoding: "utf8" });
  return { out: r.stdout, err: r.stderr, code: r.status, lines: r.stdout.split("\n").filter(Boolean) };
}
function fxDoc(md, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  const f = path.join(dir, "doc.md"); fs.writeFileSync(f, md);
  try { return fn(f); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const fxLine = (md, needle) => md.split("\n").findIndex((l) => l.includes(needle)) + 1;
const fxImp = (md, id) => fxDoc(md, (f) => fxImpact([id, f]));
const IMP = [
  "# T", "",
  "## Layer 1: Vision", "", "Scope: all.", "",
  "### 1. Need", "",
  "- 3.1. Given a member, when they join, then they are listed.", "",
  "### 2. Decisions", "",
  "- 12.11. Keep lists. Reason: vision-3.1.", "",
  "## Layer 2: Structure", "", "Scope: all.", "",
  "### 1. Parts", "", "- Rota (part): plans.", "",
  "### 6. Scenario paths", "",
  "- 6.1. Realizes vision-3.1. Given a member, when they join, then Rota plans it.", "",
  "### 7. Decisions", "",
  "- 11.1. Lists are kept in order. Reason: follows vision-12.11.", "",
  "## Layer 3: Detail", "", "Scope: one part.", "",
  "### Rota (part)", "",
  "#### 4. Rules", "",
  "- 4.1. Realizes vision-3.1. Given a member, when they join, then a shift is made.",
  "- 4.2. Order by date. Reason: structure-11.1 and vision-12.11 both ask for it.",
  "",
  "#### 12. Decisions", "",
  "A loose paragraph that cites detail.rota-4.2.", "",
].join("\n");

test("impact: V1 reaches paths and rules across layers at depth 1, with place and label", () => {
  const r = fxImp(IMP, "vision-3.1");
  assert.equal(r.code, 0);
  assert.equal(r.lines[0], `impact vision-3.1: defined in Layer 1, line ${fxLine(IMP, "- 3.1. Given a member, when they join, then they are listed.")}`);
  assert.equal(r.lines[1], "vision-3.1");
  const l2 = r.lines.find((l) => /then Rota pl/.test(l));
  assert.match(l2, /^ {2}d1 {2}line \d+ {2}Layer 2 > Scenario paths {2}structure-6\.1 {2}6\.1\. Realizes vision-3\.1\. Given/);
  assert.match(l2, new RegExp(`line ${fxLine(IMP, "then Rota plans it")} `));
  const l3 = r.lines.find((l) => /then a shi/.test(l));
  assert.match(l3, /^ {2}d1 {2}line \d+ {2}Layer 3 > Rota \(part\) > Rules {2}detail\.rota-4\.1 {2}4\.1\. Realizes vision-3\.1\. Given/);
  assert.match(r.lines.find((l) => /Reason: vision-3\.1\./.test(l)), /^ {2}d1 {2}line \d+ {2}Layer 1 > Decisions {2}vision-12\.11 {2}12\.11\. Keep lists/);
});

test("impact: the seed's own element is never listed; there are no lint lines", () => {
  const r = fxImp(IMP, "vision-3.1");
  assert.ok(!r.lines.some((l) => /then they are listed/.test(l)));
  assert.ok(!r.lines.some((l) => /^(WARN|strata-blueprints-lint:|INFO not-supplied)/.test(l)));
});

test("impact: D1.1 is transitive, each element once, under the parent that reaches it first", () => {
  const r = fxImp(IMP, "vision-12.11");
  const at = (needle) => r.lines.findIndex((l) => l.includes(needle));
  const d2 = r.lines[at("Lists are kept in order")];
  assert.match(d2, /^ {2}d1 {2}/);
  // detail.rota-4.2 cites structure-11.1 and vision-12.11: reached at depth 1 directly, and not repeated under structure-11.1.
  const d3 = r.lines.filter((l) => /Order by date/.test(l));
  assert.equal(d3.length, 1);
  assert.match(d3[0], /^ {2}d1 {2}/);
  // The loose paragraph cites detail.rota-4.2: depth 2, nested under it with four spaces.
  const para = r.lines.filter((l) => /A loose paragraph/.test(l));
  assert.equal(para.length, 1);
  assert.match(para[0], /^ {4}d2 {2}/);
  assert.ok(at("Order by date") < at("A loose paragraph"));
  assert.match(r.lines.at(-1), /^INFO impact: 3 element\(s\) reached, deepest 2$/);
});

test("impact: D2.1 reaches D3.1 at d1 and the paragraph at d2; the order follows assembly", () => {
  const r = fxImp(IMP, "structure-11.1");
  assert.match(r.lines.find((l) => /Order by date/.test(l)), /^ {2}d1 /);
  assert.match(r.lines.find((l) => /A loose paragraph/.test(l)), /^ {4}d2 /);
  assert.match(r.lines.at(-1), /^INFO impact: 2 element\(s\) reached, deepest 2$/);
});

test("impact: D1 does not reach the citers of D1.1", () => {
  const md = IMP.replace("- 12.11. Keep lists.", "- 12.1. Keep the lists.\n- 12.11. Keep lists.");
  const r = fxImp(md, "vision-12.1");
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-1), /^INFO impact: 0 element\(s\) reached, deepest 0$/);
});

test("impact: a citation loop is reported once and the exit stays 0", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 2. Decisions\n\n- 12.1. Use X as vision-12.2 says. Reason: see vision-12.2.\n- 12.2. Use Y. Reason: follows vision-12.1.\n";
  const r = fxImp(md, "vision-12.1");
  assert.equal(r.code, 0);
  const cyc = r.lines.filter((l) => l.startsWith("WARN impact: cycle "));
  assert.equal(cyc.length, 1, r.out);
  assert.match(cyc[0], /^WARN impact: cycle vision-12\.1 \.\.\. vision-12\.2$/);
  assert.match(r.lines.at(-1), /^INFO impact: 1 element\(s\) reached, deepest 1$/);
});

test("impact: an element without an id is listed with '-'", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- 3.1. Given a, when b, then c.\n\nThe club follows vision-3.1 in every case.\n";
  const r = fxImp(md, "vision-3.1");
  const l = r.lines.find((x) => /The club follows vision-3\.1/.test(x));
  assert.match(l, /^ {2}d1 {2}line 9 {2}Layer 1 > Need {2}- {2}The club follows vision-3\.1/);
});

test("impact: an id that is defined and not cited exits 0 with zero reached", () => {
  const r = fxImp("## Layer 1: Vision\n\nScope: all.\n\n### 2. Decisions\n\n- 12.1. Alone. Reason: none.\n", "vision-12.1");
  assert.equal(r.code, 0);
  assert.equal(r.lines[0], "impact vision-12.1: defined in Layer 1, line 7");
  assert.match(r.lines.at(-1), /^INFO impact: 0 element\(s\) reached, deepest 0$/);
});

test("impact: an id that is cited and not defined exits 1 and still lists the citers", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 2. Decisions\n\n- 12.1. Uses vision-12.9. Reason: vision-12.9.\n";
  const r = fxDoc(md, (f) => ({ ...fxImpact(["vision-12.9", f]), f }));
  assert.equal(r.code, 1);
  assert.equal(r.lines[0], `WARN impact: vision-12.9 is not defined in ${r.f}`);
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}line 7 /.test(l)));
  assert.match(r.lines.at(-1), /^INFO impact: 1 element\(s\) reached, deepest 1$/);
});

test("impact: id token boundaries", () => {
  const md = [
    "## Layer 1: Vision", "", "Scope: all.", "", "### 1. Need", "",
    "- 3.1. Given a, when b, then c.", "- 3.10. Given a, when b, then c.", "",
    "### 11. Assumptions", "",
    "- 11.1. Basis: one. If wrong: none.", "- 11.10. Basis: ten. If wrong: none.", "",
    "### 12. Decisions", "",
    "- 12.1. D1. Cites the ten. Reason: vision-11.10 only.",
    "- 12.2. D2. Cites the one at a sentence end. Reason: vision-11.1.",
    "- 12.3. D3. Cites vision-3.10 only. Reason: vision-3.10.",
    "- 12.4. D4. Hides it in a span. Reason: `vision-3.1` and `vision-11.1`.",
    "- 12.5. D5. Word glued: xvision-3.1 and vision-3.1x and 2.vision-11.1 here. Reason: none.",
    "", "```", "vision-3.1 vision-11.1 in a fence", "```", "",
  ].join("\n");
  const one = fxImp(md, "vision-11.1").lines.filter((l) => /^ {2}d1 /.test(l)).map((l) => l.match(/D\d\./)?.[0]);
  assert.deepEqual(one, ["D2."]);
  const ten = fxImp(md, "vision-11.10").lines.filter((l) => /^ {2}d1 /.test(l)).map((l) => l.match(/D\d\./)?.[0]);
  assert.deepEqual(ten, ["D1."]);
  const v1 = fxImp(md, "vision-3.1");
  assert.equal(v1.lines.filter((l) => /^ {2}d1 /.test(l)).length, 0, v1.out);
  const v10 = fxImp(md, "vision-3.10").lines.filter((l) => /^ {2}d1 /.test(l)).map((l) => l.match(/D\d\./)?.[0]);
  assert.deepEqual(v10, ["D3."]);
});

test("impact: labels for a part rule and for text outside any layer", () => {
  const md = "# T\n\nVersion: vision-3.1 is the seed.\n\n## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- 3.1. Given a, when b, then c.\n\n## View: Flow\n\nThe flow honours vision-3.1.\n\n## Layer 3: Detail\n\nScope: x.\n\n### Rota (part)\n\n#### 4. Rules\n\n- 4.1. Realizes vision-3.1. Given a, when b, then c.\n";
  const r = fxImp(md, "vision-3.1");
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}line 3 {2}Other {2}- {2}Version: vision-3\.1 is the seed\.$/.test(l)), r.out);
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}line 15 {2}Other {2}- {2}The flow honours vision-3\.1\.$/.test(l)), r.out);
  assert.ok(r.lines.some((l) => /Layer 3 > Rota \(part\) > Rules/.test(l)), r.out);
});

test("impact: a nested Reason line counts for its parent element", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- 3.1. Given a, when b, then c.\n\n### 2. Decisions\n\n- 12.1. Use lists.\n  - Reason: because of vision-3.1.\n";
  const r = fxImp(md, "vision-3.1");
  const l = r.lines.find((x) => /Use lists/.test(x));
  assert.match(l, /^ {2}d1 {2}line 11 {2}Layer 1 > Decisions {2}vision-12\.1 {2}12\.1\. Use lists\. - Reason: because of vision-3\.1\.$/);
});

test("impact: the text is cut to 80 characters with '...'", () => {
  const long = "12.1. " + "word ".repeat(40) + "cites vision-3.1.";
  const md = `## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- 3.1. Given a, when b, then c.\n\n### 2. Decisions\n\n- ${long}\n`;
  const l = fxImp(md, "vision-3.1").lines.find((x) => /^ {2}d1 /.test(x));
  const text = l.split("  ").at(-1);
  assert.equal(text.length, 83);
  assert.ok(text.endsWith("..."));
  assert.equal(text.slice(0, 80), long.slice(0, 80));
});

test("impact: usage errors exit 2 with an empty stdout and one stderr line", () => {
  const doc = IMP;
  fxDoc(doc, (f) => {
    const cases = [[], ["vision-3.1"], ["vision-12.1.", f], ["x1", f], ["vision-3.1", f + ".missing"], ["--x", "vision-3.1", f], ["vision-3.1", f, "--strict"], ["vision-3.1", f, "extra"], ["--strict", "vision-3.1", f]];
    for (const c of cases) {
      const r = fxImpact(c);
      assert.equal(r.code, 2, JSON.stringify(c));
      assert.equal(r.out, "", JSON.stringify(c));
      assert.equal(r.err.trim().split("\n").length, 1, JSON.stringify(c));
      assert.match(r.err, /^strata-blueprints-lint: /, JSON.stringify(c));
    }
  });
});

test("impact: a folder shows 'file line n' places and reaches across files", () => {
  const r = fxWith({}, (d) => fxImpact(["vision-3.1", d]));
  assert.equal(r.code, 0);
  assert.equal(r.lines[0], "impact vision-3.1: defined in Layer 1, sbp-vision.md line 12");
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}sbp-structure\.md line 19 {2}Layer 2 > Scenario paths {2}structure-6\.1 {2}6\.1\. Realizes /.test(l)), r.out);
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}sbp-detail-ledger\.md line 15 {2}Layer 3 > Ledger \(part\) > Rules {2}detail\.ledger-4\.1 {2}4\.1\. Realizes /.test(l)), r.out);
  assert.match(r.lines.at(-1), /^INFO impact: 2 element\(s\) reached, deepest 1$/);
});

test("impact: an empty folder exits 2 with one stderr line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  try {
    const r = fxImpact(["vision-3.1", dir]);
    assert.equal(r.code, 2);
    assert.equal(r.out, "");
    assert.equal(r.err.trim().split("\n").length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("single document: a file named V1 lints as before", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  try {
    const f = path.join(dir, "vision-3.1");
    fs.writeFileSync(f, L1 + L2);
    const r = run(f);
    assert.equal(r.code, 0);
    assert.match(r.lines.at(-1), /^strata-blueprints-lint: \d+ warning\(s\)$/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- ids as addresses (plan ids, S2) -------------------------------------------
const iw = (md) => warns(lintText(md), "id");
const irw = (md) => warns(lintText(md), "id-ref");
const GWT = "Given a, when b, then c.";
const item = (h, n, name) => `${h} ${n}. ${name}\n\n`;
const sec = (layerHead, h, name, body) => layerHead + item(h, 1, name) + body + "\n";
const ENTRY = (part) => `### ${part} (part)\n\n`;

test("id: the topic number must match the topic the item sits under, and Construction items are numbered and need no Reason", () => {
  const a = iw(L1 + item("###", 9, "Risks") + "- 8.1. Given a, when b, then c. Severity: High. Answered by Not supplied: x.\n\n" + L2);
  assert.equal(a.length, 1);
  assert.match(a[0], /vision-8\.1 is numbered for topic 8, but sits under Risks/);
  // The number is read from the topic's name, not from the digit in the heading.
  assert.deepEqual(iw(L1 + item("###", 4, "Risks") + "- 9.1. Given a, when b, then c. Severity: High. Answered by Not supplied: x.\n\n" + L2), []);
  assert.deepEqual(iw(L1 + L2 + item("###", 6, "Scenario paths") + `- 6.1. ${GWT}\n`), []);
  assert.equal(iw(L1 + L2 + item("###", 6, "Scenario paths") + `- 3.1. ${GWT}\n`).length, 1);
  assert.equal(iw(L1 + L2 + item("###", 8, "Risks") + "- 9.1. Given a, when b, then c. Severity: Low. Answered by Not supplied: x.\n").length, 1);
  assert.equal(iw(L1 + L2 + L3 + ENTRY("Brakes") + item("####", 7, "Construction") + "- 12.1. Fit the pads.\n").length, 1);
  // A heading that names no topic opens no topic: the number is not checked.
  assert.deepEqual(iw(L1 + item("###", 1, "Diagrams") + "- 9.4. Anything.\n" + L2), []);
  // Construction items carry ids and need no Reason.
  const cons = L1 + L2 + L3 + ENTRY("Brakes") + item("####", 7, "Construction") + "- 7.1. Fit the pads with the supplied bolts.\n- 7.2. Use steel cable.\n";
  assert.deepEqual(iw(cons), []);
  assert.deepEqual(warns(lintText(cons), "reasons"), []);
  assert.deepEqual(warns(lintText(cons), "id-ref"), []);
});

test("id: a repeat warns, and a gap or a count out of order does not", () => {
  const rep = iw(L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n- 3.1. Given d, when e, then f.\n\n` + L2);
  assert.equal(rep.length, 1);
  assert.match(rep[0], /vision-3\.1 repeats the one on line 7/);
  assert.match(rep[0], /\(line 8\)$/);
  // The same count under another topic is another id.
  assert.deepEqual(iw(L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n\n` + item("###", 12, "Decisions") + "- 12.1. Choice. Reason: r.\n\n" + L2), []);
  // Gaps and order are not checked.
  assert.deepEqual(iw(L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n- 3.4. ${GWT}\n- 3.2. ${GWT}\n- 3.10. ${GWT}\n\n` + L2), []);
  assert.deepEqual(iw(L1 + item("###", 3, "Value") + `- 3.7. ${GWT}\n\n` + L2), []);
});

test("id: parts are separate documents, so two parts may both number 4.1, and a part's name must be a part in Layer 2 Parts", () => {
  const two = L1 + L2 + L3 + ENTRY("Brakes") + item("####", 4, "Rules") + `- 4.1. ${GWT}\n\n` + ENTRY("Frame") + item("####", 4, "Rules") + `- 4.1. ${GWT}\n`;
  assert.deepEqual(iw(two), []);
  // When Parts lists a part, the slug must name one.
  const parts = L1 + L2 + item("###", 1, "Parts") + "- Brakes (part): stops.\n- Frame (part): holds.\n\n" + L3;
  const ok = parts + ENTRY("Brakes") + item("####", 4, "Rules") + `- 4.1. ${GWT}\n`;
  assert.deepEqual(iw(ok), []);
  const bad = iw(ok.replace("### Brakes (part)", "### Pads (part)"));
  assert.equal(bad.length, 1);
  assert.match(bad[0], /detail\.pads-4\.1 names 'pads', which is not a part in Layer 2 Parts/);
  // With no part listed in Parts the slug is not checked against it.
  assert.deepEqual(iw(L1 + L2 + item("###", 1, "Parts") + "None.\n\n" + L3 + ENTRY("Brakes") + item("####", 4, "Rules") + `- 4.1. ${GWT}\n`), []);
});

test("id: a part name that is not one word warns", () => {
  const md = L1 + L2 + item("###", 1, "Parts") + "- Tool shed (part): keeps tools.\n- Brakes (part): stops.\n- Pad2 (part): grips.\n- Fore-arm (part): holds.\n\n";
  const w = iw(md);
  assert.equal(w.length, 2);
  assert.match(w[0], /part name 'Tool shed' is not one word \(line 11\)$/);
  assert.match(w[1], /part name 'Fore-arm' is not one word/);
  assert.deepEqual(iw(L1 + L2 + item("###", 1, "Parts") + "- Brakes (part): stops.\n- **Shed** (part): keeps tools.\n\n"), []);
});

test("id: an item under a topic that needs ids warns when it has none", () => {
  const need = [
    [1, 3, "Value"], [1, 8, "Costs"], [1, 9, "Risks"], [1, 10, "Open Concerns"], [1, 11, "Assumptions"], [1, 12, "Decisions"],
    [2, 6, "Scenario paths"], [2, 7, "Costs"], [2, 8, "Risks"], [2, 9, "Open Concerns"], [2, 10, "Assumptions"], [2, 11, "Decisions"],
    [3, 4, "Rules"], [3, 6, "Limits"], [3, 7, "Construction"], [3, 8, "Costs"], [3, 9, "Risks"], [3, 10, "Open Concerns"], [3, 11, "Assumptions"], [3, 12, "Decisions"],
  ];
  // The fixture writes the number: the document at the start of an item is dropped (see num).
  const doc = (layer, n, name, text) => doc0(layer, n, name, text.replace(/^- (?:vision|structure|detail\.[a-z0-9]+)-(?=\d+\.\d+\.)/gm, "- "));
  const doc0 = (layer, n, name, body) => layer === 1 ? L1 + item("###", n, name) + body + "\n" + L2
    : layer === 2 ? L1 + L2 + item("###", n, name) + body
    : L1 + L2 + L3 + ENTRY("Brakes") + item("####", n, name) + body;
  const own = { 1: "vision", 2: "structure", 3: "detail.brakes" };
  for (const [layer, n, name] of need) {
    const w = iw(doc(layer, n, name, "- An item with no id.\n"));
    assert.equal(w.length, 1, `${layer} ${name}`);
    assert.match(w[0], new RegExp(`an item under ${name} has no number \\(line \\d+\\)$`));
    assert.deepEqual(iw(doc(layer, n, name, `- ${own[layer]}-${n}.1. An item.\n`)), [], `${layer} ${name}`);
  }
  // A wrapped item is one item, and a paragraph item needs an id too.
  assert.equal(iw(doc(1, 3, "Value", "Given a, when b,\nthen c.\n")).length, 1);
  assert.deepEqual(iw(doc(1, 3, "Value", `- 3.1. Given a, when b,\n  then c.\n`)), []);
  // Other topics need none, and no open topic needs none.
  assert.deepEqual(iw(doc(1, 1, "Need", "- An item with no id.\n")), []);
  assert.deepEqual(iw(doc(2, 3, "Seams between parts", "- An item with no id.\n")), []);
  assert.deepEqual(iw(doc(3, 5, "Inside", "- An item with no id.\n")), []);
  assert.deepEqual(iw(L1 + "- An item with no topic open.\n" + L2), []);
});

test("id: fences, backticks, views, None, Not supplied and Title lines carry no checked id", () => {
  const costs = (body) => L1 + item("###", 8, "Costs") + body + "\n" + L2;
  const bad = `- 3.1. Upkeep: 40 USD. Paid by the club.\n`;
  assert.equal(iw(costs(bad)).length, 1);
  // Exempt lines under a topic that needs ids.
  assert.deepEqual(iw(costs("None.\n")), []);
  assert.deepEqual(iw(costs("- Not supplied: what it costs.\n")), []);
  assert.deepEqual(iw(costs("Not supplied: what it costs.\n")), []);
  assert.deepEqual(iw(costs("Title: Costs by month.\n")), []);
  assert.deepEqual(iw(costs("| Cost | Amount |\n| --- | --- |\n| Upkeep | 40 USD |\n")), []);
  // A fenced block and an id in backticks are ignored.
  assert.deepEqual(iw(costs("Title: Sample.\n```\n" + bad + "```\n")), []);
  assert.deepEqual(iw(costs("- 8.1. Upkeep: 40 USD. Paid by the club. Shown as `structure-3.1`.\n")), []);
  assert.equal(iw(costs("- `vision-8.1` Upkeep: 40 USD. Paid by the club.\n")).length, 1);
  // A view and text outside a layer are not checked.
  assert.deepEqual(iw(L1 + L2 + "## View: Flow\n\n" + item("###", 8, "Costs") + bad + "- A view item with no id.\n"), []);
  assert.deepEqual(iw("# T\n\n- 3.1. Before any layer.\n\n" + L1 + L2), []);
});

test("id-ref: a citation must exist and point inward, never to another part", () => {
  const full = L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n\n` + item("###", 12, "Decisions") + "- 12.1. Choice. Reason: see vision-3.1.\n\n" +
    L2 + item("###", 11, "Decisions") + "- 11.1. Choice. Reason: follows vision-12.1 and vision-3.1.\n\n" +
    L3 + ENTRY("Brakes") + item("####", 12, "Decisions") + "- 12.1. Choice. Reason: follows structure-11.1 and vision-12.1.\n\n" +
    ENTRY("Frame") + item("####", 12, "Decisions") + "- 12.1. Choice. Reason: follows structure-11.1.\n";
  assert.deepEqual(irw(full), []);
  // Undefined.
  const und = irw(full.replace("see vision-3.1.", "see vision-12.9."));
  assert.equal(und.length, 1);
  assert.match(und[0], /vision-12\.9 is not defined/);
  // Outward: Layer 1 cites Layer 2 and Layer 3, Layer 2 cites Layer 3.
  const out1 = irw(full.replace("see vision-3.1.", "see structure-11.1."));
  assert.equal(out1.length, 1);
  assert.match(out1[0], /structure-11\.1 is defined in structure, which is outward of Layer 1/);
  assert.equal(irw(full.replace("see vision-3.1.", "see detail.brakes-12.1.")).length, 1);
  const out2 = irw(full.replace("follows vision-12.1 and vision-3.1.", "follows detail.brakes-12.1."));
  assert.equal(out2.length, 1);
  assert.match(out2[0], /detail\.brakes-12\.1 is defined in detail\.brakes, which is outward of Layer 2/);
  // Layer 3 cites its own part, structure and vision; never another part.
  const cross = irw(full.replace("follows structure-11.1.\n", "follows detail.brakes-12.1.\n"));
  assert.equal(cross.length, 1);
  assert.match(cross[0], /detail\.brakes-12\.1 belongs to another part, and the entry 'Frame' may not cite it/);
  // Backticks and fences are not citations.
  assert.deepEqual(irw(full.replace("see vision-3.1.", "see `vision-12.9`.")), []);
  assert.deepEqual(irw(full + "\nTitle: t.\n```\nvision-12.9\n```\n"), []);
  // A risk's Answered by: risk-ref keeps undefined and outward, id-ref reports only the cross-part case.
  const risk = (ans) => full.replace(ENTRY("Frame") + item("####", 12, "Decisions"), `${ENTRY("Frame")}${item("####", 9, "Risks")}- 9.1. Given a, when b, then c. Severity: Low. Answered by ${ans}.\n\n#### 12. Decisions\n\n`);
  assert.deepEqual(irw(risk("vision-12.9")), []);
  assert.equal(warns(lintText(risk("vision-12.9")), "risk-ref").length, 1);
  const xr = irw(risk("detail.brakes-12.1"));
  assert.equal(xr.length, 1);
  assert.match(xr[0], /belongs to another part/);
  assert.deepEqual(irw(risk("structure-11.1")), []);
});

test("scenario-trace: a Realizes sentence is the trace and the line still reads Given when then", () => {
  const l1 = L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n- 3.2. Given d, when e, then f.\n\n`;
  const l2 = (body) => L2 + item("###", 6, "Scenario paths") + body;
  const l3 = (body) => L3 + ENTRY("Brakes") + item("####", 4, "Rules") + body;
  const path1 = `- 6.1. Realizes vision-3.1. ${GWT}\n`;
  const path2 = "- 6.2. Realizes vision-3.2. Given d, when e, then f.\n";
  const rule1 = `- 4.1. Realizes vision-3.1. ${GWT}\n`;
  const rule2 = "- 4.2. Realizes vision-3.2. Given d, when e, then f.\n";
  const st = (md) => warns(lintText(md), "scenario-trace");
  assert.deepEqual(st(l1 + l2(path1 + path2) + l3(rule1 + rule2)), []);
  // The Realizes sentence is the trace: the scenario's words with no Realizes do not trace it, and a bare mention does not.
  const lack = st(l1 + l2(path1 + `- 6.2. ${"Given d, when e, then f."}\n`));
  assert.equal(lack.length, 1);
  assert.match(lack[0], /vision-3\.2 has no path in Layer 2/);
  assert.equal(st(l1 + l2(path1 + "- 6.2. See vision-3.2. Given d, when e, then f.\n")).length, 1);
  const norule = st(l1 + l2(path1 + path2) + l3(rule1 + "- 4.2. Given d, when e, then f.\n"));
  assert.equal(norule.length, 1);
  assert.match(norule[0], /vision-3\.2 has no rule in Layer 3/);
  // The path's own id is no scenario: a Layer 2 path is not traced down by itself.
  assert.deepEqual(st(l1 + l2(path1 + path2)), []);
  // A Realizes line still reads Given, when, then.
  const form = (body) => warns(lintText(l1 + l2(body + path2)), "scenario-form");
  assert.equal(form(`- 6.1. Realizes vision-3.1. Given a it stops.\n`).length, 1);
  assert.deepEqual(form(path1), []);
  assert.deepEqual(form("- A path that realizes nothing, with no Given.\n"), []);
  assert.equal(form("- 6.1. Given a it stops.\n").length, 1);
  // A line that realizes no scenario has its own id and no Realizes: it needs nothing more.
  assert.deepEqual(iw(l1 + l2(path1 + path2 + `- 6.3. ${GWT}\n`)), []);
});

test("folder: a detail file's entry must be a part in Layer 2 Parts, a repeat in one file warns, and a cross-part citation warns", () => {
  const rota = (rules) => fxFull["sbp-detail-rota.md"].replace(/#### 4\. Rules\n\nNone\./, `#### 4. Rules\n\n${rules}`);
  const ok = { ...fxFull, "sbp-detail-rota.md": rota(`- 4.1. Realizes vision-3.1. Given a member, when they join, then a shift is made.`) };
  assert.deepEqual(fxWarns(ok, "id"), []);
  assert.deepEqual(fxWarns(ok, "id-ref"), []);
  assert.deepEqual(fxWarns(ok, "scenario-trace"), []);
  assert.equal(fxWith(ok, (d) => run(d, "--strict")).code, 0);
  // A file that cites the other part's id warns.
  const cross = fxWarns({ ...ok, "sbp-detail-rota.md": rota(`- 4.1. Given a member, when they join, then a shift follows detail.ledger-4.1.`) }, "id-ref");
  assert.equal(cross.length, 1);
  assert.match(cross[0], /detail\.ledger-4\.1 belongs to another part, and the entry 'Rota' may not cite it \(sbp-detail-rota\.md line \d+\)$/);
  // The same count in two files is two ids; a repeat inside one file warns.
  const dup = fxWarns({ ...ok, "sbp-detail-rota.md": rota(`- 4.1. Given a, when b, then c.\n- 4.1. Given d, when e, then f.`) }, "id");
  assert.equal(dup.length, 1);
  assert.match(dup[0], /detail\.rota-4\.1 repeats the one on sbp-detail-rota\.md line \d+ \(sbp-detail-rota\.md line \d+\)$/);
  // A file named by a part with a slug outside Parts warns, and a '## View:' in the structure file draws nothing.
  assert.equal(fxWarns({ ...ok, "sbp-detail-rota.md": rota(`- 4.1. Given a, when b, then c.`).replace("### Rota (part)", "### Zzz (part)") }, "id").length, 1);
  assert.deepEqual(fxWarns({ ...ok, "sbp-structure.md": ok["sbp-structure.md"] + "\n### 1. Costs\n\n- No id in a view.\n" }, "id"), []);
});

test("impact: full ids keep their boundaries, vision-9.1 against vision-9.10 and vision-19.1, detail slugs and decimals in prose", () => {
  const md = [
    "## Layer 1: Vision", "", "Scope: all.", "", "### 9. Risks", "",
    `- 9.1. ${GWT} Severity: Low. Answered by Not supplied: x.`,
    `- 9.10. ${GWT} Severity: Low. Answered by Not supplied: x.`,
    `- 19.1. ${GWT} Severity: Low. Answered by Not supplied: x.`, "",
    "### 12. Decisions", "",
    "- 12.1. D1. Cites nine-one. Reason: vision-9.1 only.",
    "- 12.2. D2. Cites nine-ten. Reason: vision-9.10.",
    "- 12.3. D3. Cites nineteen. Reason: vision-19.1.",
    "- 12.4. D4. At a sentence end. Reason: vision-9.1.",
    "- 12.5. D5. In a span. Reason: `vision-9.1`.",
    "- 12.6. D6. Glued: xvision-9.1, sbp-vision-9.1, vision-9.1.2, vision-9.1x and section 9.1 and 0.5 are no citations. Reason: none.",
    "", "## Layer 3: Detail", "", "Scope: x.", "", "### Rota (part)", "", "#### 7. Construction", "",
    "- 7.1. A construction item.", "",
    "#### 12. Decisions", "",
    "- 12.1. D7. Cites the item by its slug id. Reason: detail.rota-7.1.",
    "- 12.2. D8. Glued slug. Reason: xdetail.rota-7.1, sbp-detail.rota-7.1 and a.detail.rota-7.1 are no citations.",
    "", "```", "vision-9.1 in a fence", "```", "",
  ].join("\n");
  const d1 = (id) => fxImp(md, id).lines.filter((l) => /^ {2}d1 /.test(l)).map((l) => l.match(/D\d\./)?.[0]);
  assert.deepEqual(d1("vision-9.1"), ["D1.", "D4."]);
  assert.deepEqual(d1("vision-9.10"), ["D2."]);
  assert.deepEqual(d1("vision-19.1"), ["D3."]);
  assert.deepEqual(d1("detail.rota-7.1"), ["D7."]);
  // A decimal or a bare number is no id.
  for (const bad of ["9.1", "0.5", "section 9.1", "vision-9", "vision-9.", "vision-0.1", "vision-9.0", "vision-9.1.2", "V1", "A1.1", "vision-9.1x", "xvision-9.1", "detail-4.1"]) {
    const r = fxDoc(md, (f) => fxImpact([bad, f]));
    assert.equal(r.code, 2, bad);
    assert.equal(r.out, "", bad);
    assert.match(r.err, /^strata-blueprints-lint: not an id: /, bad);
  }
  // The seed's own id, defined once, is found by its full form.
  assert.match(fxImp(md, "vision-9.1").lines[0], /^impact vision-9\.1: defined in Layer 1, line 7$/);
});

// --- items are written with their local number (plan ids-local, S1) ------------
test("id: a number is the item's id under the document where it sits", () => {
  const doc = L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n\n` + item("###", 12, "Decisions") + "- 12.1. Choice. Reason: see vision-3.1.\n\n" +
    L2 + item("###", 6, "Scenario paths") + `- 6.1. Realizes vision-3.1. ${GWT}\n\n` + item("###", 11, "Decisions") + "- 11.1. Choice. Reason: follows vision-3.1 and vision-12.1.\n\n" +
    L3 + ENTRY("Brakes") + item("####", 4, "Rules") + `- 4.1. Realizes vision-3.1. ${GWT}\n\n` + item("####", 12, "Decisions") + "- 12.1. Choice. Reason: follows structure-11.1 and detail.brakes-4.1.\n";
  assert.deepEqual(iw(doc), []);
  assert.deepEqual(irw(doc), []);
  // The document is the place: structure-3.1 and detail.brakes-6.1 are no items here, so citing them warns.
  assert.equal(irw(doc.replace("see vision-3.1.", "see structure-3.1.")).length, 1);
  assert.match(irw(doc.replace("see vision-3.1.", "see detail.brakes-6.1."))[0], /detail\.brakes-6\.1 is not defined|outward/);
  // A number in Layer 2 is not a Layer 1 id.
  assert.match(irw(doc.replace("see vision-3.1.", "see vision-6.1."))[0], /vision-6\.1 is not defined/);
  // Outside a layer, under a view, and in Layer 3 with no open entry a number is no id and draws no warning.
  assert.deepEqual(iw("# T\n\n- 3.1. Before any layer.\n\n" + L1 + L2), []);
  assert.deepEqual(iw(L1 + L2 + "## View: Flow\n\n" + item("###", 8, "Costs") + "- 8.1. Upkeep.\n- A view item.\n"), []);
  assert.deepEqual(iw(L1 + L2 + L3 + `- 4.1. ${GWT}\n`), []);
});

test("id: two parts or two files may both number 6.1, and a repeat in one document warns", () => {
  const two = L1 + L2 + L3 + ENTRY("Brakes") + item("####", 6, "Limits") + "- 6.1. A limit.\n\n" + ENTRY("Frame") + item("####", 6, "Limits") + "- 6.1. Another limit.\n";
  assert.deepEqual(iw(two), []);
  const rep = iw(L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n- 3.1. Given d, when e, then f.\n\n` + L2);
  assert.equal(rep.length, 1);
  assert.match(rep[0], /vision-3\.1 repeats the one on line 7 \(line 8\)$/);
  const rota = (rules) => fxFull["sbp-detail-rota.md"].replace(/#### 4\. Rules\n\nNone\./, `#### 4. Rules\n\n${rules}`);
  const files = { ...fxFull, "sbp-detail-rota.md": rota(`- 4.1. Given a, when b, then c.`) };
  assert.deepEqual(fxWarns(files, "id"), []);
  const dup = fxWarns({ ...files, "sbp-detail-rota.md": rota(`- 4.1. Given a, when b, then c.\n- 4.1. Given d, when e, then f.`) }, "id");
  assert.equal(dup.length, 1);
  assert.match(dup[0], /detail\.rota-4\.1 repeats the one on sbp-detail-rota\.md line \d+ \(sbp-detail-rota\.md line \d+\)$/);
});

test("id: a full id at the start of an item warns and reads as the number", () => {
  const md = L1 + item("###", 3, "Value") + `- vision-3.1. ${GWT}\n\n` + item("###", 12, "Decisions") + "- 12.1. Choice. Reason: see vision-3.1.\n\n" + L2;
  const w = iw(md);
  assert.equal(w.length, 1);
  assert.match(w[0], /write '3\.1\.' at the start of the item; the document goes only in a citation \(line 7\)$/);
  assert.deepEqual(irw(md), []);
  const r = lintText(L1 + item("###", 11, "Assumptions") + "- vision-11.1. Fact.\n\n" + L2);
  assert.equal(warns(r, "reasons").length, 1);
  const a = iw(L1 + L2 + L3 + ENTRY("Brakes") + item("####", 4, "Rules") + `- detail.brakes-4.1. ${GWT}\n`);
  assert.equal(a.length, 1);
  assert.match(a[0], /write '4\.1\.'/);
});

test("id: a number for another topic warns, and decimals that are not numbers are not read", () => {
  const a = iw(L1 + item("###", 9, "Risks") + "- 8.1. Given a, when b, then c. Severity: High. Answered by Not supplied: x.\n\n" + L2);
  assert.equal(a.length, 1);
  assert.match(a[0], /vision-8\.1 is numbered for topic 8, but sits under Risks/);
  // The topic is read from its name, not from the digit in the heading.
  assert.deepEqual(iw(L1 + item("###", 4, "Risks") + "- 9.1. Given a, when b, then c. Severity: High. Answered by Not supplied: x.\n\n" + L2), []);
  // Not numbers: they leave an item without one.
  for (const text of ["99.9% of nights are quiet.", "0.5 hours is allowed.", "1.05 is the ratio.", "See section 6.1 for more.", "x 6.1. mid-line."]) {
    const w = iw(L1 + item("###", 3, "Value") + `- ${text}\n\n` + L2);
    assert.equal(w.length, 1, text);
    assert.match(w[0], /an item under Value has no number/, text);
  }
  // A decimal that reads as a number (default 1a) warns by its topic.
  const d = iw(L1 + item("###", 5, "Success measures") + "- 2.5 seconds to load.\n\n" + L2);
  assert.equal(d.length, 1);
  assert.match(d[0], /vision-2\.5 is numbered for topic 2, but sits under Success measures/);
  // A zero count or topic is not a number.
  assert.equal(iw(L1 + item("###", 3, "Value") + "- 3.0. Given a, when b, then c.\n\n" + L2).length, 1);
});

test("id: a bare number is never a citation", () => {
  const l1 = L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n\n` + item("###", 9, "Risks") + "- 9.1. Given a, when b, then c. Severity: Low. Answered by 12.1.\n\n" + item("###", 12, "Decisions") + "- 12.1. Choice. Reason: see section 3.1 and 6.9.\n\n";
  const r = lintText(l1 + L2 + item("###", 6, "Scenario paths") + `- 6.1. Realizes 3.1. ${GWT}\n`);
  assert.deepEqual(warns(r, "id-ref"), []);
  assert.deepEqual(warns(r, "id"), []);
  assert.equal(warns(r, "risk-ref").length, 1);
  assert.match(warns(r, "risk-ref")[0], /'Answered by' names no id/);
  const tr = warns(r, "scenario-trace");
  assert.equal(tr.length, 1);
  assert.match(tr[0], /vision-3\.1 has no path in Layer 2/);
  // The full id after Realizes traces it.
  const ok = lintText(l1 + L2 + item("###", 6, "Scenario paths") + `- 6.1. Realizes vision-3.1. ${GWT}\n`);
  assert.deepEqual(warns(ok, "scenario-trace"), []);
});

test("impact: a numbered item is found by its full id, and a bare number is not an id", () => {
  const md = L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n\n` + item("###", 12, "Decisions") + "- 12.1. Choice. Reason: see vision-3.1.\n\n" +
    L2 + item("###", 6, "Scenario paths") + `- 6.1. Realizes vision-3.1. ${GWT}\n`;
  const r = fxImp(md, "vision-3.1");
  assert.equal(r.code, 0);
  assert.equal(r.lines[0], `impact vision-3.1: defined in Layer 1, line ${fxLine(md, "- 3.1. " + GWT)}`);
  const l2 = r.lines.find((l) => /Realizes/.test(l));
  assert.match(l2, /^ {2}d1 {2}line \d+ {2}Layer 2 > Scenario paths {2}structure-6\.1 {2}6\.1\. Realizes vision-3\.1\. Given/);
  assert.match(r.lines.at(-1), /^INFO impact: 2 element\(s\) reached, deepest 1$/);
  const bare = fxDoc(md, (f) => fxImpact(["3.1", f]));
  assert.equal(bare.code, 2);
  assert.match(bare.err, /^strata-blueprints-lint: not an id: 3\.1/);
  // The document is part of the address: structure-3.1 is not the item written 3.1 in Layer 1.
  const other = fxImp(md, "structure-3.1");
  assert.equal(other.code, 1);
  assert.match(other.out, /WARN impact: structure-3\.1 is not defined/);
});

test("folder: a detail file's numbers belong to its part", () => {
  const rota = (rules) => fxFull["sbp-detail-rota.md"].replace(/#### 4\. Rules\n\nNone\./, `#### 4. Rules\n\n${rules}`);
  const ok = { ...fxFull, "sbp-detail-rota.md": rota(`- 4.1. Realizes vision-3.1. Given a member, when they join, then a shift is made.`) };
  assert.deepEqual(fxWarns(ok, "id"), []);
  assert.deepEqual(fxWarns(ok, "id-ref"), []);
  assert.equal(fxWith(ok, (d) => run(d, "--strict")).code, 0);
  // Ledger and Rota both number 4.1; --impact finds each by its own part's id.
  const led = fxWith(ok, (d) => fxImpact(["detail.ledger-4.1", d]));
  assert.match(led.lines[0], /^impact detail\.ledger-4\.1: defined in Layer 3, sbp-detail-ledger\.md line \d+$/);
  const rot = fxWith(ok, (d) => fxImpact(["detail.rota-4.1", d]));
  assert.match(rot.lines[0], /^impact detail\.rota-4\.1: defined in Layer 3, sbp-detail-rota\.md line \d+$/);
  // A file may not cite the other part's id.
  const cross = fxWarns({ ...ok, "sbp-detail-rota.md": rota(`- 4.1. Given a member, when they join, then a shift follows detail.ledger-4.1.`) }, "id-ref");
  assert.equal(cross.length, 1);
  assert.match(cross[0], /detail\.ledger-4\.1 belongs to another part, and the entry 'Rota' may not cite it \(sbp-detail-rota\.md line \d+\)$/);
  // An entry that is not a part in Layer 2 Parts warns by its name.
  const bad = fxWarns({ ...ok, "sbp-detail-rota.md": ok["sbp-detail-rota.md"].replace("### Rota (part)", "### Pads (part)").replace(/#### 4\. Rules\n\n/, "#### 4. Rules\n\n") }, "id");
  assert.equal(bad.length, 1);
  assert.match(bad[0], /detail\.pads-4\.1 names 'pads', which is not a part in Layer 2 Parts/);
});

// --- condensed files: a marker on line 1 skips the topics check (plan condense-expand, D15) ------
const MK = "<!-- strata-blueprints: condensed (generated; omitted topics read None.) -->";
// A condensed copy of a text: each topic whose whole body is None. is left out; the marker goes on line 1.
const cdText = (md) => MK + "\n\n" + md.replace(/#{3,4} \d+\. [^\n]+\n\nNone\.\n(?:\n|$)/g, "");
const cd1 = "### 1. Need\n\nN.\n\n### 12. Decisions\n\nNone.\n\n";

test("condensed: marker on line 1 skips missing topics, and without it they still warn", () => {
  const doc = MK + "\n\n" + L1 + cd1 + L2 + full2;
  assert.deepEqual(tw(doc), []);
  assert.equal(lintText(doc, "--strict").code, 0);
  assert.equal(tw(L1 + cd1 + L2 + full2).length, 10);
});

test("condensed: marker on line 2 does not count", () => {
  assert.equal(tw("# Club\n" + MK + "\n\n" + L1 + cd1 + L2 + full2).length, 10);
});

test("condensed: marker with CRLF lints the same as with LF", () => {
  const lf = MK + "\n\n" + L1 + cd1 + L2 + full2;
  const a = lintText(lf, "--strict"), b = lintText(lf.replace(/\n/g, "\r\n"), "--strict");
  assert.equal(b.code, 0);
  assert.deepEqual(b.lines, a.lines);
  const bad = lf.replace("### 1. Need", "### 2. Need");
  assert.deepEqual(lintText(bad.replace(/\n/g, "\r\n")).lines, lintText(bad).lines);
});

test("condensed: order and citations are still checked", () => {
  const order = MK + "\n\n" + L1 + "### 12. Decisions\n\nNone.\n\n### 1. Need\n\nN.\n\n" + L2 + full2;
  assert.equal(warns(lintText(order), "topic-order").length, 1);
  const unknown = MK + "\n\n" + L1 + "### 1. Needs\n\nN.\n\n" + L2 + full2;
  assert.equal(warns(lintText(unknown), "topic-order").length, 1);
  const cite = MK + "\n\n" + L1 + "### 1. Need\n\nSee structure-9.9.\n\n### 12. Decisions\n\nNone.\n\n" + L2 + full2;
  assert.equal(warns(lintText(cite), "id-ref").length, 1);
});

test("condensed: order and citations: INFO not-supplied counts the same on a full file and its condensed form", () => {
  const full = L1 + fxT("###", T1, { Need: "Not supplied: who pays.", Focus: "Not supplied: scope." }) + L2 + full2;
  const a = lintText(full), b = lintText(cdText(full));
  assert.match(a.out, /^INFO not-supplied: 2$/m);
  assert.match(b.out, /^INFO not-supplied: 2$/m);
  assert.deepEqual(tw(cdText(full)), []);
});

test("condensed: folder checks only the files that carry the marker", () => {
  const some = { ...fxFull, "sbp-vision.md": cdText(fxFull["sbp-vision.md"]), "sbp-detail-ledger.md": cdText(fxFull["sbp-detail-ledger.md"]) };
  assert.ok(some["sbp-vision.md"].split("\n").length < fxFull["sbp-vision.md"].split("\n").length);
  assert.deepEqual(fxWarns(some, "topics"), []);
  assert.deepEqual(fxWarns(some, "layer-heading"), []);
  assert.equal(fxWith(some, (d) => run(d, "--strict")).code, 0);
  // The unmarked detail file is still checked for missing topics.
  const cut = { ...some, "sbp-detail-rota.md": fxFull["sbp-detail-rota.md"].replace(/#### 5\. Inside\n\nNone\.\n\n/, "") };
  const w = fxWarns(cut, "topics");
  assert.equal(w.length, 1);
  assert.match(w[0], /topic 'Inside' is missing in the entry 'Rota' \(sbp-detail-rota\.md line \d+\)$/);
  // Every file condensed, including the second detail file: no spurious layer-heading warning.
  const all = Object.fromEntries(Object.entries(fxFull).map(([k, v]) => [k, cdText(v)]));
  assert.deepEqual(fxWarns(all, "layer-heading"), []);
  assert.equal(fxWith(all, (d) => run(d, "--strict")).code, 0);
});

test("condensed: folder --impact reaches the same elements as the full folder", () => {
  const all = Object.fromEntries(Object.entries(fxFull).map(([k, v]) => [k, cdText(v)]));
  const strip = (r) => r.lines.map((l) => l.replace(/\bline \d+/g, "line N"));
  const full = fxWith(fxFull, (d) => fxImpact(["vision-3.1", d]));
  const cond = fxWith(all, (d) => fxImpact(["vision-3.1", d]));
  assert.equal(full.code, 0);
  assert.ok(full.lines.length >= 2);
  assert.deepEqual(strip(cond), strip(full));
});

// scenario-trace follows Rule 4: a Layer 3 rule is asked for only where a scenario's path runs through a part that has an entry.
const stParts = L2 + item("###", 5, "Parts") + "- Brakes (part): stops the bike.\n- Frame (part): carries the rider.\n\n";
const stL1 = L1 + item("###", 3, "Value") + `- 3.1. ${GWT}\n- 3.2. Given d, when e, then f.\n\n`;
const stPaths = (p1, p2) => item("###", 6, "Scenario paths") + `- 6.1. Realizes vision-3.1. ${p1}\n- 6.2. Realizes vision-3.2. ${p2}\n\n`;
const stBrakes = (rules) => L3 + ENTRY("Brakes") + item("####", 4, "Rules") + rules;
const stTrace = (md) => warns(lintText(md), "scenario-trace");

test("scenario-trace (entries): a path through a part with no entry needs no Layer 3 rule", () => {
  const md = stL1 + stParts + stPaths("Given a, when b, then Brakes stop.", "Given d, when e, then Frame carries.") +
    stBrakes(`- 4.1. Realizes vision-3.1. ${GWT}\n`);
  assert.deepEqual(stTrace(md), []);
});

test("scenario-trace (entries): a path through a part with an entry and no rule warns", () => {
  const md = stL1 + stParts + stPaths("Given a, when b, then Brakes stop.", "Given d, when e, then Frame carries.") +
    stBrakes(`- 4.1. ${GWT}\n`);
  const r = stTrace(md);
  assert.equal(r.length, 1);
  assert.match(r[0], /vision-3\.1 has no rule in Layer 3/);
});

test("scenario-trace (entries): one part with an entry among several named still warns", () => {
  const md = stL1 + stParts + stPaths("Given a, when b, then Brakes and Frame act.", "Given d, when e, then Frame carries.") +
    stBrakes(`- 4.1. ${GWT}\n`);
  const r = stTrace(md);
  assert.equal(r.length, 1);
  assert.match(r[0], /vision-3\.1 has no rule in Layer 3/);
});

test("scenario-trace (entries): a path that names no Layer 2 part keeps the old requirement", () => {
  const md = stL1 + stParts + stPaths("Given a, when b, then it stops.", "Given d, when e, then it moves.") +
    stBrakes(`- 4.1. ${GWT}\n`);
  assert.equal(stTrace(md).length, 2);
  const one = stL1 + stParts + stPaths("Given a, when b, then it stops.", "Given d, when e, then Frame carries.") +
    stBrakes(`- 4.1. Realizes vision-3.2. Given d, when e, then f.\n`);
  const r = stTrace(one);
  assert.equal(r.length, 1);
  assert.match(r[0], /vision-3\.1 has no rule in Layer 3/);
});

test("scenario-trace (entries): a Layer 3 heading with no entry needs no rule", () => {
  const md = stL1 + stParts + stPaths("Given a, when b, then Frame carries.", "Given d, when e, then Frame holds.") + L3;
  assert.deepEqual(stTrace(md), []);
});

test("scenario-trace (entries): a folder follows the same rule", () => {
  const over = (path) => ({
    ...fxFull,
    "sbp-detail-rota.md": null,
    "sbp-structure.md": fxFull["sbp-structure.md"].replace(/- Rota: sbp-detail-rota\.md\n?/, "").replace("then Ledger adds a record", path),
    "sbp-detail-ledger.md": fxFull["sbp-detail-ledger.md"].replace("Realizes vision-3.1. ", ""),
  });
  assert.deepEqual(fxWarns(over("then Rota adds a record"), "scenario-trace"), []);
  const r = fxWarns(over("then Ledger adds a record"), "scenario-trace");
  assert.equal(r.length, 1);
  assert.match(r[0], /vision-3\.1 has no rule in Layer 3/);
});

test("folder: the error for a folder with no sbp- files says to pass the file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  try {
    fs.writeFileSync(path.join(dir, "notes.md"), "# a single document\n");
    const r = spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
    assert.equal(r.status, 2);
    assert.equal(r.stdout, "");
    assert.equal(r.stderr.trim().split("\n").length, 1, r.stderr);
    assert.match(r.stderr.trim(), /; to lint one document, pass the file$/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- owner decisions: trace context (P3), status (P5), scenario-form scope (P7) ----------------

test("scenario-trace: the missing-Layer-3-rule warning names the part and the path id", () => {
  const md = L1 + "### 3. Value\n\n- 3.1. Given a rider, when braking, then stops.\n\n" +
    L2 + "### 1. Parts\n\n- Brakes (part): stops the bike.\n\n### 6. Scenario paths\n\n- 6.1. Realizes vision-3.1. Given a rider, when braking, then Brakes stops the bike.\n\n" +
    L3 + "### Brakes (part)\n\n#### 4. Rules\n\n- A rule with no id.\n";
  const r = warns(lintText(md), "scenario-trace");
  assert.equal(r.length, 1);
  assert.match(r[0], /^WARN scenario-trace: vision-3\.1 has no rule in Layer 3/);
  assert.match(r[0], /Brakes/);
  assert.match(r[0], /structure-6\.1/);
});

test("status: a value other than Draft, Review or Approved warns with its line", () => {
  const bad = warns(lintText("# T\n\nStatus: draft\n\n" + L1 + L2), "status");
  assert.equal(bad.length, 1);
  assert.match(bad[0], /\(line 3\)$/);
  assert.equal(warns(lintText("# T\n\nStatus: Final\n\n" + L1 + L2), "status").length, 1);
  for (const v of ["Draft", "Review", "Approved"]) assert.equal(warns(lintText(`# T\n\nStatus: ${v}\n\n` + L1 + L2), "status").length, 0);
  const bp = warns(lintText("# T\n\nStatus: Draft\nBlueprint status: done\n\n" + L1 + L2), "status");
  assert.equal(bp.length, 1);
  assert.match(bp[0], /\(line 4\)$/);
  assert.equal(warns(lintText("# T\n\nStatus: Draft\nBlueprint status: Review\n\n" + L1 + L2), "status").length, 0);
});

test("status: a single document reports one INFO status line before INFO not-supplied", () => {
  const r = lintText("# T\n\nStatus: Review\n\n" + L1 + L2);
  assert.deepEqual(r.lines.filter((l) => l.startsWith("INFO status")), ["INFO status: Review"]);
  assert.equal(r.lines.at(-3), "INFO status: Review");
  assert.match(r.lines.at(-2), /^INFO not-supplied: 0$/);
});

test("status: no INFO status line when no document has a Status line", () => {
  assert.equal(lintText(L1 + L2).lines.filter((l) => l.startsWith("INFO status")).length, 0);
});

test("status: a folder reports blueprint, vision, structure and each detail, with - for none", () => {
  const files = {
    ...fxFull,
    "sbp-vision.md": fxFull["sbp-vision.md"].replace("Status: Draft\n", "Status: Review\nBlueprint status: Draft\n"),
    "sbp-detail-ledger.md": fxFull["sbp-detail-ledger.md"].replace("# Club\n\n", "# Club\n\nStatus: Approved\n\n"),
  };
  const r = fxWith(files, (d) => run(d, "--strict"));
  assert.equal(r.code, 0);
  assert.deepEqual(r.lines.filter((l) => l.startsWith("INFO status")), ["INFO status: blueprint Draft; vision Review; structure -; detail.ledger Approved; detail.rota -"]);
  const i = r.lines.findIndex((l) => l.startsWith("INFO status"));
  assert.match(r.lines[i + 1], /^INFO not-supplied/);
  const bad = fxWarns({ ...files, "sbp-detail-rota.md": fxFull["sbp-detail-rota.md"].replace("# Club\n\n", "# Club\n\nStatus: nope\n\n") }, "status");
  assert.equal(bad.length, 1);
  assert.match(bad[0], /\(sbp-detail-rota\.md line 3\)$/);
});

test("scenario-form: silent for a Layer 3 rule without Realizes, a limit and a view scenario", () => {
  const rule = (body) => L1 + L2 + "## Layer 3: Detail\n\nScope: x.\n\n### Brakes (part)\n\n" + body;
  assert.deepEqual(warns(lintText(rule("#### 4. Rules\n\n- 4.1. Given a cat it sleeps.\n")), "scenario-form"), []);
  assert.deepEqual(warns(lintText(rule("#### 6. Limits\n\n- 6.1. Given a cat it sleeps.\n")), "scenario-form"), []);
  assert.deepEqual(warns(lintText(L1 + L2 + "## View: Life\n\n- Given a cat it sleeps.\n"), "scenario-form"), []);
});

test("scenario-form: still warns on a Realizes item without when, and on a Layer 1 Value item without then", () => {
  const rule = "## Layer 3: Detail\n\nScope: x.\n\n### Brakes (part)\n\n#### 4. Rules\n\n- 4.1. Realizes vision-3.1. Given a cat, then it sleeps.\n";
  assert.equal(warns(lintText(L1 + "### 3. Value\n\n- 3.1. Given a cat, when fed, then it sleeps.\n\n" + L2 + rule), "scenario-form").length, 1);
  assert.equal(warns(lintText(L1 + "### 3. Value\n\n- 3.1. Given a cat, when fed, it sleeps.\n\n" + L2), "scenario-form").length, 1);
});

// --- metadata lines in the top matter of every document of a stack ----------------
const fxMeta = (title, lines) => title.replace("# Club\n\n", "# Club\n\n" + lines.join("\n") + "\n\n");
const fxMetaStack = () => ({
  ...fxFull,
  "sbp-vision.md": fxFull["sbp-vision.md"].replace("Version: 0.1.0\nStatus: Draft\n", "Version: 0.1.0\nBlueprint status: Approved\nStatus: Approved\nParent: Org\n"),
  "sbp-structure.md": fxMeta(fxFull["sbp-structure.md"], ["Status: Draft", "Version: 0.2.0", "Parent: Org"]),
  "sbp-detail-ledger.md": fxMeta(fxFull["sbp-detail-ledger.md"], ["Status: Review", "Blueprint status: Review"]),
  "sbp-detail-rota.md": fxMeta(fxFull["sbp-detail-rota.md"], ["Status: Approved"]),
});

test("metadata: Status, Version, Blueprint status and Parent lines in the top matter of every file lint with no warning", () => {
  const r = fxWith(fxMetaStack(), (d) => run(d, "--strict"));
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.deepEqual(r.lines.filter((l) => l.startsWith("INFO status")), ["INFO status: blueprint Approved; vision Approved; structure Draft; detail.ledger Review; detail.rota Approved"]);
});

test("metadata: top-matter lines of a later file do not change INFO not-supplied", () => {
  const notSup = (over) => fxWith(over, (d) => run(d)).lines.find((l) => l.startsWith("INFO not-supplied"));
  const base = notSup({});
  assert.match(base, /^INFO not-supplied: \d+$/);
  assert.equal(notSup(fxMetaStack()), base);
});

test("metadata: a Status line below the first ## heading is still read as an item", () => {
  const w = fxWarns({ "sbp-structure.md": fxFull["sbp-structure.md"].replace("### 11. Decisions\n\nNone.", "### 11. Decisions\n\nStatus: Draft") }, "id");
  assert.equal(w.length, 1);
});

// --- Large output on a pipe: a slow reader still receives every byte (no truncation at the pipe buffer). ---
async function slowRead(args) {
  const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "inherit"] });
  // A child that fails to start or never ends is killed and fails the test (the bound is a test mechanism).
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
    setTimeout(() => { child.kill("SIGKILL"); reject(new Error("pipe child did not finish within 60 s")); }, 60000).unref();
  });
  exited.catch(() => {});
  let bytes = 0, tail = "";
  for await (const d of child.stdout) {
    bytes += d.length; tail = (tail + d.toString()).slice(-200);
    await new Promise((r) => setTimeout(r, 50));
  }
  return { bytes, tail, code: await exited };
}
function bigDir(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbp-big-"));
  const f = path.join(dir, "big.md");
  fs.writeFileSync(f, body);
  return f;
}

test("pipe: a lint with 3000 warnings read slowly delivers its final summary line", async () => {
  const f = bigDir("# Big\n\n## Layer 1: Vision\n\n### Scenarios\n\n" + Array.from({ length: 3000 }, (_, i) => `- 3.1. Realizes vision-9.${i}. Given ${"z ".repeat(40)}`).join("\n") + "\n");
  const r = await slowRead([f]);
  assert.ok(r.bytes > 500000, `got only ${r.bytes} bytes`);
  assert.match(r.tail, /strata-blueprints-lint: \d+ warning\(s\)\n$/);
  const s = await slowRead([f, "--strict"]);
  assert.equal(s.code, 1);
  assert.equal(s.bytes, r.bytes);
});

test("pipe: a large --impact run read slowly delivers its final INFO line and keeps its exit code", async () => {
  const f = bigDir("# Big\n\n## Layer 1: Vision\n\n### Scenarios\n\n- 3.1. Given a, when b, then c.\n" + Array.from({ length: 3000 }, (_, i) => `- 3.${i + 2}. Realizes vision-3.1. Given x, when y, then ${"z ".repeat(40)}`).join("\n") + "\n");
  const r = await slowRead(["--impact", "vision-3.1", f]);
  assert.ok(r.bytes > 300000, `got only ${r.bytes} bytes`);
  assert.match(r.tail, /INFO impact: 3000 element\(s\) reached, deepest 1\n$/);
  assert.equal(r.code, 0);
  const u = await slowRead(["--impact", "vision-9.9", f]);
  assert.equal(u.code, 1);
});

// --- Large output on a pipe: a reader that closes early ends the lint quietly, with the exit code it would have had. ---
async function earlyClose(args) {
  const child = spawn(process.execPath, [script, ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let err = "";
  child.stderr.on("data", (d) => { err += d; });
  // A child that exits or fails before it writes, or never writes, fails the test (the bound is a test mechanism).
  const exited = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
    setTimeout(() => { child.kill("SIGKILL"); reject(new Error("pipe child did not finish within 60 s")); }, 60000).unref();
  });
  exited.catch(() => {});
  await new Promise((resolve, reject) => {
    child.stdout.once("data", resolve);
    exited.then(() => reject(new Error(`pipe child ended before it wrote output: ${err.slice(0, 200)}`)), reject);
  });
  child.stdout.destroy();
  return { code: await exited, err };
}

test("pipe: a reader that closes early gets no stack trace and the usual exit code", async () => {
  const f = bigDir("# Big\n\n## Layer 1: Vision\n\n### Scenarios\n\n- 3.1. Given a, when b, then c.\n" + Array.from({ length: 3000 }, (_, i) => `- 3.${i + 2}. Realizes vision-3.1. Given x, when y, then ${"z ".repeat(40)}`).join("\n") + "\n");
  const w = bigDir("# Big\n\n## Layer 1: Vision\n\n### Scenarios\n\n" + Array.from({ length: 3000 }, (_, i) => `- 3.1. Realizes vision-9.${i}. Given ${"z ".repeat(40)}`).join("\n") + "\n");
  const cases = [
    [["--impact", "vision-3.1", f], 0],
    [["--impact", "vision-9.9", f], 1],
    [[w], 0],
    [[w, "--strict"], 1],
  ];
  for (const [args, code] of cases) {
    const r = await earlyClose(args);
    assert.equal(r.err, "", `stderr for ${args.slice(0, -1).join(" ")}: ${r.err.slice(0, 120)}`);
    assert.equal(r.code, code, `exit code for ${args.slice(0, -1).join(" ")}`);
  }
});

const unf = (body) => warns(lintText(L1 + body + L2), "unfinished");

test("unfinished: a code span hides the marker, prose still warns", () => {
  assert.equal(unf("The word `TODO` is a marker.\n").length, 0);
  assert.equal(unf("A ` mark and FIXME here.\n").length, 1);
});

test("unfinished: a double-backtick span may hold a backtick, a longer run closes at its own length", () => {
  assert.equal(unf("Write ``TODO`x`` in the text.\n").length, 0);
  assert.equal(unf("Write ```TBD``` in the text.\n").length, 0);
});

test("unfinished: prose beside a span warns once and names the prose marker", () => {
  const w = unf("`TODO` and TBD together.\n");
  assert.equal(w.length, 1);
  assert.match(w[0], /marker 'TBD'/);
});

test("unfinished: backtick and tilde fences hide the marker, including info string and closing line", () => {
  assert.equal(unf("Title: t.\n```\nTODO\n```\n").length, 0);
  assert.equal(unf("Title: t.\n~~~\nTBD\n~~~\n").length, 0);
  assert.equal(unf("Title: t.\n```FIXME\nx\n```\n").length, 0);
  assert.equal(unf("Title: t.\n~~~\n```\nTODO\n~~~\n").length, 0);
});

test("unfinished: an unclosed fence hides later lines, a marker after a closed fence warns at its line", () => {
  assert.equal(unf("Title: t.\n```\nTODO\nmore TBD\n").length, 0);
  const md = L1 + "Title: t.\n```\nTODO inside\n```\nTODO after\n" + L2;
  const w = warns(lintText(md), "unfinished");
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`\\(line ${md.split("\n").findIndex((l) => l === "TODO after") + 1}\\)`));
});

// --- fence: a fenced block that is never closed draws one advisory warning per file. ---
const FENCE_MSG = "fenced block is never closed; the checks skip every row after it";
const fenceW = (md, ...flags) => warns(lintText(md, ...flags), "fence");
const rowOf = (md, text) => md.split("\n").findIndex((l) => l === text) + 1;

test("fence: an unclosed fence warns once at the row that opens it", () => {
  const md = L1 + "```\nopen\n" + L2;
  const w = fenceW(md);
  assert.deepEqual(w, [`WARN fence: ${FENCE_MSG} (line ${rowOf(md, "```")})`]);
});

test("fence: a closed fence and a fence closed by a longer run draw no fence warning", () => {
  assert.equal(fenceW(L1 + "```\nx\n```\n" + L2).length, 0);
  assert.equal(fenceW(L1 + "```\nx\n`````\n" + L2).length, 0);
  assert.equal(fenceW(L1 + "~~~\nx\n~~~~\n" + L2).length, 0);
});

test("fence: a shorter closing row leaves a four-backtick block open and warns", () => {
  const md = L1 + "````\nx\n```\ny\n" + L2;
  const w = fenceW(md);
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`\\(line ${rowOf(md, "````")}\\)$`));
});

test("fence: an unclosed tilde fence warns", () => {
  const md = L1 + "~~~\nx\n" + L2;
  const w = fenceW(md);
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`\\(line ${rowOf(md, "~~~")}\\)$`));
});

test("fence: a backtick row with a backtick after the run opens nothing and draws no fence warning", () => {
  assert.equal(fenceW(L1 + "```x``` more\n" + L2).length, 0);
});

test("fence: the warning counts, so --strict exits 1 and a plain run exits 0", () => {
  const md = L1 + L2 + "Title: t.\n```\nopen\n";
  assert.equal(lintText(md).code, 0);
  assert.equal(lintText(md, "--strict").code, 1);
  assert.match(lintText(md).lines.at(-1), /^strata-blueprints-lint: 1 warning\(s\)$/);
});

test("fence: a folder names the file and row of the open block even when a later file has a row that would close it", () => {
  const vision = fxVision + "```\nopen\n";
  const row = vision.split("\n").findIndex((l) => l === "```") + 1;
  const w = fxWarns({ "sbp-vision.md": vision, "sbp-structure.md": fxStructure + "```\nx\n```\n" }, "fence");
  assert.deepEqual(w, [`WARN fence: ${FENCE_MSG} (sbp-vision.md line ${row})`]);
});

test("fence: a block opened on the last row warns, and CRLF rows that close a block draw no warning", () => {
  const md = L1 + L2 + "```";
  const w = fenceW(md);
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`\\(line ${rowOf(md, "```")}\\)$`));
  assert.equal(fenceW((L1 + "```\r\nx\r\n```\r\n" + L2).replace(/\n/g, "\r\n").replace(/\r\r/g, "\r")).length, 0);
});

test("fence: two openers in one file give one warning", () => {
  const md = L1 + "```\na\n~~~\nb\n" + L2;
  const w = fenceW(md);
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`\\(line ${rowOf(md, "```")}\\)$`));
});

test("unfinished: stray backticks on two lines make no span across lines", () => {
  const w = unf("A ` stray\nTODO on its own line\nanother ` stray\n");
  assert.equal(w.length, 1);
  assert.match(w[0], /marker 'TODO'/);
});

test("id-ref: a double-backtick span hides an id", () => {
  const need = "### 1. Need\n\n";
  assert.equal(warns(lintText(L1 + need + "- 1.1. See ``vision-9.9``.\n\n" + L2), "id-ref").length, 0);
  assert.equal(warns(lintText(L1 + need + "- 1.1. See `vision-9.9`.\n\n" + L2), "id-ref").length, 0);
  assert.equal(warns(lintText(L1 + need + "- 1.1. See vision-9.9.\n\n" + L2), "id-ref").length, 1);
});

// --- One span rule: the Not supplied: count reads a code span the way clean does. ---
const notSupCount = (body) => +lintText(L1 + body + L2).out.match(/^INFO not-supplied: (\d+)$/m)[1];

test("not-supplied: a double-backtick span is not counted", () => {
  assert.equal(notSupCount("Not supplied: a.\n"), 1);
  assert.equal(notSupCount("Write ``Not supplied: x`` in the text.\n"), 0);
  assert.equal(notSupCount("Write ``Not`x supplied: x`` and Not supplied: y.\n"), 1);
});

test("not-supplied: a single-backtick span is still not counted and a stray backtick does not hide the count", () => {
  assert.equal(notSupCount("Write `Not supplied: x` here.\n"), 0);
  assert.equal(notSupCount("A ` stray and Not supplied: x.\n"), 1);
});

// --- One fence rule: a fence closes at a row of the same mark at least as long; a backtick row with a backtick after the run is text. ---
const unfAt = (body, word) => {
  const md = L1 + body + L2;
  return { w: warns(lintText(md), "unfinished"), n: md.split("\n").findIndex((l) => l === word) + 1 };
};

test("fence: a four-backtick fence closes at a row of four backticks and an inner three-backtick row stays content", () => {
  const { w, n } = unfAt("Title: t.\n````\n```\nTODO\n````\nTBD after\n", "TBD after");
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`marker 'TBD'.*\\(line ${n}\\)`));
});

test("fence: a closing row shorter than the opening run does not close it", () => {
  assert.equal(unf("Title: t.\n````\nTODO\n```\nTBD still inside\n").length, 0);
  assert.equal(unf("Title: t.\n~~~~\nTODO\n~~~\nTBD still inside\n").length, 0);
});

test("fence: a closing row longer than the opening run closes it", () => {
  const { w, n } = unfAt("Title: t.\n```\nTODO\n`````\nFIXME after\n", "FIXME after");
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`marker 'FIXME'.*\\(line ${n}\\)`));
  assert.equal(unf("Title: t.\n~~~\nTODO\n~~~~~\nFIXME after\n").length, 1);
});

test("fence: a closing row with text after the run does not close", () => {
  assert.equal(unf("Title: t.\n```\nTODO\n``` more\nTBD inside\n```\n").length, 0);
  assert.equal(unf("Title: t.\n```\nTODO\n```x\nTBD inside\n```\n").length, 0);
});

test("fence: a backtick row with a backtick after the opening run is text", () => {
  const md = L1 + "Title: t.\n```TODO``` more\nTBD next\n" + L2;
  const r = lintText(md);
  const w = warns(r, "unfinished");
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`marker 'TBD'.*\\(line ${md.split("\n").findIndex((l) => l === "TBD next") + 1}\\)`));
  assert.equal(warns(lintText(L1 + "```a`b\nTODO\n" + L2), "diagram-title").length, 0);
});

test("fence: a tilde fence text after the run may hold a backtick", () => {
  assert.equal(unf("Title: t.\n~~~ a`b\nTODO\n~~~\n").length, 0);
  assert.equal(unf("Title: t.\n~~~ a`b\nTODO\n~~~\nTBD after\n").length, 1);
});

test("fence: CRLF rows open and close a fence", () => {
  const md = (L1 + "Title: t.\n````\n```\nTODO\n````\nTBD after\n" + L2).replace(/\n/g, "\r\n");
  const w = warns(lintText(md), "unfinished");
  assert.equal(w.length, 1);
  assert.match(w[0], /marker 'TBD'/);
});

test("fence: an indented fence opens and closes like any other and hides its rows", () => {
  const md = L1 + L2 + "    ```\nTODO inside\n\t```\nTODO outside\n";
  const w = warns(lintText(md), "unfinished");
  assert.equal(w.length, 1);
  assert.match(w[0], new RegExp(`marker 'TODO'.*\\(line ${rowOf(md, "TODO outside")}\\)`));
});

test("diagram-title: a fenced block that holds a command draws it like a diagram", () => {
  assert.equal(warns(lintText(L1 + L2 + "text\n```bash\nnode gate.mjs\n```\n"), "diagram-title").length, 1);
  assert.equal(warns(lintText(L1 + L2 + "Title: t.\n```bash\nnode gate.mjs\n```\n"), "diagram-title").length, 0);
});

test("ring: a Layer number inside a code span draws nothing, the same words in prose still warn", () => {
  const ring = (body) => warns(lintText(L1 + body + L2), "ring").length;
  assert.equal(ring("See `Layer 3` for more.\n"), 0);
  assert.equal(ring("See ``Layer 3`` for more.\n"), 0);
  assert.equal(ring("See Layer 3 for more.\n"), 1);
  assert.equal(ring("See `Layer 3` and Layer 1 and Layer 3 here.\n"), 1);
  assert.equal(ring("```\nLayer 3\n```\n"), 0);
});

test("impact: several ids print one block each, in the order given, with one empty line between blocks", () => {
  const one = (id) => fxImp(IMP, id).out;
  const ab = fxImp(IMP, "vision-3.1,vision-12.11");
  assert.equal(ab.code, 0);
  assert.equal(ab.out, one("vision-3.1") + "\n" + one("vision-12.11"));
  assert.equal(ab.out.split("\n\n").length, 2);
  const ba = fxImp(IMP, "vision-12.11,vision-3.1");
  assert.equal(ba.code, 0);
  assert.equal(ba.out, one("vision-12.11") + "\n" + one("vision-3.1"));
  const abc = fxImp(IMP, "vision-3.1,vision-12.11,structure-6.1");
  assert.equal(abc.out, one("vision-3.1") + "\n" + one("vision-12.11") + "\n" + one("structure-6.1"));
});

test("impact: an undefined id among several exits 1 and every id still prints", () => {
  const r = fxImp(IMP, "vision-3.1,vision-99.9,vision-12.11");
  assert.equal(r.code, 1);
  const blocks = r.out.split("\n\n");
  assert.equal(blocks.length, 3);
  assert.match(blocks[0], /^impact vision-3\.1: defined in Layer 1/);
  assert.match(blocks[1], /^WARN impact: vision-99\.9 is not defined in /);
  assert.match(blocks[2], /^impact vision-12\.11: defined in Layer 1/);
});

test("impact: a malformed element in the list exits 2 with an empty stdout and one stderr line", () => {
  fxDoc(IMP, (f) => {
    for (const list of ["vision-3.1,", "vision-3.1,x1", ",vision-3.1", "vision-3.1,,vision-12.11"]) {
      const r = fxImpact([list, f]);
      assert.equal(r.code, 2, list);
      assert.equal(r.out, "", list);
      assert.equal(r.err.trim().split("\n").length, 1, list);
      assert.match(r.err, /^strata-blueprints-lint: not an id: /, list);
    }
    assert.match(fxImpact(["vision-3.1,x1", f]).err, /not an id: x1\n$/);
  });
});

test("impact: a repeated id prints once, and a single id prints as before", () => {
  const single = fxImp(IMP, "vision-3.1");
  const twice = fxImp(IMP, "vision-3.1,vision-3.1");
  assert.equal(twice.out, single.out);
  assert.equal(twice.code, single.code);
  const mixed = fxImp(IMP, "vision-3.1,vision-12.11,vision-3.1");
  assert.equal(mixed.out.split("\n\n").length, 2);
  assert.equal(mixed.out.split("\n\n")[0] + "\n", single.out);
});

// --- limit-quality: a Limit cites a quality Layer 1 names -----------------------------------------
const lqQual = (names) => item("###", 6, "Qualities and constraints") + names.map((n) => `- **${n}:** it holds.\n`).join("") + "\n";
const lqDoc = (cite, quals = ["Prompt", "Durable"]) => L1 + lqQual(quals) + L2 + L3 + ENTRY("Brakes") + item("####", 6, "Limits") + `- 6.1. A stop takes under two seconds (Layer 1, ${cite}).\n`;
const lq = (md) => warns(lintText(md), "limit-quality");

test("limit-quality: a Limit that cites a quality Layer 1 does not name warns once; a named quality, a different case, a topic name and Not supplied draw none", () => {
  const w = lq(lqDoc("Speedy"));
  assert.equal(w.length, 1);
  assert.match(w[0], /^WARN limit-quality: 'Speedy' is not named in Layer 1 Qualities and constraints \(line \d+\)$/);
  assert.match(w[0], new RegExp(`\\(line ${fxLine(lqDoc("Speedy"), "A stop takes")}\\)$`));
  assert.deepEqual(lq(lqDoc("Prompt")), []);
  assert.deepEqual(lq(lqDoc("  Durable ")), []);
  assert.deepEqual(lq(lqDoc("pROMPT")), []);
  assert.deepEqual(lq(lqDoc("Prompt", ["Prompt  Fast", "Durable"]).replace("(Layer 1, Prompt)", "(Layer 1, prompt fast)")), []);
  assert.deepEqual(lq(lqDoc("Costs")), []);
  assert.deepEqual(lq(lqDoc("Target audience")), []);
  assert.deepEqual(lq(lqDoc("Not supplied: which quality")), []);
  // the last citation counts; an element with no citation is silent; a table row and a Rules item are not read
  assert.equal(lq(lqDoc("Speedy").replace("(Layer 1, Speedy)", "(Layer 1, Prompt) and (Layer 1, Speedy)")).length, 1);
  assert.deepEqual(lq(lqDoc("Speedy").replace(" (Layer 1, Speedy)", "")), []);
  assert.deepEqual(lq(lqDoc("Speedy").replace("#### 6. Limits", "#### 4. Rules")), []);
});

test("limit-quality: silent when Layer 1 names no quality in bold, or the document has no Layer 1", () => {
  // control: the same Limit warns when Layer 1 names its qualities in bold
  assert.equal(lq(lqDoc("Speedy")).length, 1);
  assert.equal(lq(lqDoc("Speedy") + "- 6.2. A start takes under a second (Layer 1, Fast).\n").length, 2);
  assert.deepEqual(lq(lqDoc("Speedy").replace(/- \*\*(Prompt|Durable):\*\*/g, "- $1:")), []);
  assert.deepEqual(lq(lqDoc("Speedy").replace(/### 6\. Qualities and constraints\n\n[\s\S]*?\n\n(?=## Layer 2)/, "")), []);
  assert.deepEqual(lq(lqDoc("Speedy", []).replace(L1, L1)), []);
  assert.deepEqual(lq(L2 + L3 + ENTRY("Brakes") + item("####", 6, "Limits") + "- 6.1. A stop takes under two seconds (Layer 1, Speedy).\n"), []);
});

test("limit-quality: a Limit that cites a Layer 1 id draws no limit-quality warning; an id that does not exist still draws id-ref", () => {
  assert.deepEqual(lq(lqDoc("vision-3.6")), []);
  assert.deepEqual(lq(lqDoc("vision-9.9")), []);
  assert.equal(warns(lintText(lqDoc("vision-9.9")), "id-ref").length, 1);
  assert.equal(lq(lqDoc("Speedy")).length, 1);
});

test("limit-quality: a Limit that cites an id of another document warns like an unnamed quality", () => {
  const s = lq(lqDoc("structure-3.1"));
  assert.equal(s.length, 1);
  assert.match(s[0], /^WARN limit-quality: 'structure-3\.1' is not named in Layer 1 Qualities and constraints \(line \d+\)$/);
  const d = lq(lqDoc("detail.brakes-6.1"));
  assert.equal(d.length, 1);
  assert.match(d[0], /detail\.brakes-6\.1/);
  assert.deepEqual(lq(lqDoc("vision-3.6")), []);
});

test("limit-quality: a Layer 1 id is read in lower case with plain numbers; other forms warn once each", () => {
  for (const c of ["Vision-3.6", "VISION-3.6", "vision-03.6", "vision-3.0", "vision-3.6.1"]) assert.equal(lq(lqDoc(c)).length, 1, c);
  assert.deepEqual(lq(lqDoc("vision-3.6")), []);
});

// limit-quality reads a quality name in every form the Layer 1 guide allows
const lqRaw = (items, cite) => L1 + item("###", 6, "Qualities and constraints") + items.map((i) => `- ${i}\n`).join("") + "\n" + L2 + L3 + ENTRY("Brakes") + item("####", 6, "Limits") + `- 6.1. A stop takes under two seconds (Layer 1, ${cite}).\n`;

test("limit-quality: a bold name anywhere in the item counts, and an absent name still warns", () => {
  const q = ["**Durable:** lasts.", "The **Prompt** quality: quick."];
  assert.deepEqual(lq(lqRaw(q, "Prompt")), []);
  assert.deepEqual(lq(lqRaw(q, "Durable")), []);
  assert.equal(lq(lqRaw(q, "Speedy")).length, 1);
});

test("limit-quality: a plain leading Name: counts when other qualities are bold, and an absent name still warns", () => {
  const q = ["**Prompt:** quick.", "Durable: lasts."];
  assert.deepEqual(lq(lqRaw(q, "Durable")), []);
  assert.deepEqual(lq(lqRaw(q, "Prompt")), []);
  assert.equal(lq(lqRaw(q, "Speedy")).length, 1);
});

test("limit-quality: either form counts after a leading item number, and an absent name still warns", () => {
  const q = ["6.1. **Prompt:** quick.", "6.2. Durable: lasts."];
  assert.deepEqual(lq(lqRaw(q, "Prompt")), []);
  assert.deepEqual(lq(lqRaw(q, "Durable")), []);
  assert.equal(lq(lqRaw(q, "Speedy")).length, 1);
});

// --- realizes-text: a Realizes item keeps the Given and when text of its scenario ---------------------
const RT_SCEN = "Given a rider on a hill, when braking hard, then the bike stops.";
const rtDoc = (path, scen = RT_SCEN) => L1 + `- 3.1. ${scen}\n\n` + L2 + `- 6.1. Realizes vision-3.1. ${path}\n`;
const rt = (md) => warns(lintText(md), "realizes-text");

test("realizes-text: a path that rewords the Given or the when of its scenario warns once and names the scenario", () => {
  const given = rt(rtDoc("Given a cyclist on a hill, when braking hard, then the bike stops."));
  assert.equal(given.length, 1);
  assert.match(given[0], /^WARN realizes-text: does not keep the Given and when text of vision-3\.1 word for word \(line \d+\)$/);
  assert.match(given[0], new RegExp(`\\(line ${fxLine(rtDoc("Given a cyclist"), "Realizes vision-3.1")}\\)$`));
  assert.equal(rt(rtDoc("Given a rider on a hill, when braking, then the bike stops.")).length, 1);
  assert.equal(rt(rtDoc("Given a rider on a hill, when braking hard, then the bike stops.").replace("Given", "Given that")).length, 1);
  // a Layer 3 rule is read the same way
  const l3 = rtDoc(RT_SCEN) + "\n" + L3 + ENTRY("Brakes") + item("####", 4, "Rules") + "- 4.1. Realizes vision-3.1. Given a cyclist, when braking, then it stops.\n";
  assert.equal(rt(l3).length, 1);
});

test("realizes-text: the same words, a wrapped line, an undefined id and an item with no Given draw none", () => {
  // control: the same fixtures warn once when the path is reworded
  assert.equal(rt(rtDoc("Given a cyclist, when braking, then stops.")).length, 1);
  assert.deepEqual(rt(rtDoc("Given a rider on a hill, when braking hard, then the bike stops quickly.")), []);
  assert.deepEqual(rt(rtDoc("Given a rider on a hill,\n  when braking hard, then the bike stops.")), []);
  assert.deepEqual(rt(rtDoc("Given a cyclist, when braking, then stops.").replace("Realizes vision-3.1", "Realizes vision-3.9")), []);
  assert.deepEqual(rt(rtDoc("The bike stops.")), []);
  assert.deepEqual(rt(rtDoc("Given a rider on a hill, when braking hard.")), []);
  assert.deepEqual(rt(rtDoc("Given a cyclist, when braking, then stops.", "The bike stops.")), []);
  assert.deepEqual(rt(rtDoc("Given a cyclist, when braking, then stops.", "Given a cat it sleeps.")), []);
  // a Realizes item that cites a Layer 2 id, not a Value item, is not compared
  assert.deepEqual(rt(rtDoc(RT_SCEN) + "- 6.2. Realizes structure-6.1. Given a cyclist, when braking, then it stops.\n"), []);
});

// --- scenario-form: Given is asked for where tracing needs it ----------------------------------------
const sf = (md) => warns(lintText(md), "scenario-form");
const sfL2 = (body) => L1 + "### 3. Value\n\n- 3.1. Given a cat, when fed, then it sleeps.\n\n" + L2 + body;

test("scenario-form: a Value item, a path and a Realizes item that do not start with Given each warn once", () => {
  const value = sf(L1 + "### 3. Value\n\n- 3.1. The cat sleeps.\n\n" + L2);
  assert.equal(value.length, 1);
  assert.match(value[0], /^WARN scenario-form: must read 'Given \.\.\., when \.\.\., then \.\.\.' \(line \d+\)$/);
  assert.equal(sf(sfL2("### 6. Scenario paths\n\n- 6.1. Realizes vision-3.1. The cat sleeps.\n")).length, 1);
  assert.equal(sf(sfL2("### 6. Scenario paths\n\n- 6.1. The cat sleeps.\n")).length, 1);
  assert.equal(sf(sfL2("### 6. Scenario paths\n\n- 6.1. Realizes vision-3.1. Given a cat, when fed, then it sleeps.\n\n") + L3 + ENTRY("Brakes") + item("####", 4, "Rules") + "- 4.1. Realizes vision-3.1. The cat sleeps.\n").length, 1);
  assert.equal(sf(L1 + "### 3. Value\n\n- vision-3.1. The cat sleeps.\n\n" + L2).length, 1);
});

test("scenario-form: None., Not supplied:, a table row and a plain Layer 3 rule draw none", () => {
  // control: the same Value item warns when it is a plain sentence
  assert.equal(sf(L1 + "### 3. Value\n\n- 3.1. The cat sleeps.\n\n" + L2).length, 1);
  assert.deepEqual(sf(L1 + "### 3. Value\n\n- 3.1. None.\n\n" + L2), []);
  assert.deepEqual(sf(L1 + "### 3. Value\n\nNone.\n\n" + L2), []);
  assert.deepEqual(sf(L1 + "### 3. Value\n\n- 3.1. Not supplied: the scenarios.\n\n" + L2), []);
  assert.deepEqual(sf(L1 + "### 3. Value\n\n- 3.1. Title: a cat\n\n" + L2), []);
  assert.deepEqual(sf(L1 + "### 3. Value\n\n| Who | What |\n|---|---|\n| cat | sleeps |\n\n" + L2), []);
  assert.deepEqual(sf(L1 + "### 3. Value\n\n- The cat sleeps.\n\n" + L2), []);
  assert.deepEqual(sf(sfL2("### 6. Scenario paths\n\n- 6.1. Realizes vision-3.1. Given a cat, when fed, then it sleeps.\n\n") + L3 + ENTRY("Brakes") + item("####", 4, "Rules") + "- 4.1. A stop takes time.\n"), []);
});

test("shared things: a numbered item is cited from a Detail, and --impact reaches the citer", () => {
  const md = [
    "# T", "",
    "## Layer 1: Vision", "", "Scope: all.", "",
    "## Layer 2: Structure", "", "Scope: all.", "",
    "### 1. Parts", "", "- Rota (part): plans.", "- Pay (part): pays.", "",
    "### 5. Shared things", "", "- 5.1. The date format is ISO, kept by Rota and Pay.", "",
    "## Layer 3: Detail", "", "Scope: one part.", "",
    "### Rota (part)", "",
    "#### 4. Rules", "",
    "- 4.1. Dates are written in ISO. Reason: structure-5.1.", "",
    "### Pay (part)", "",
    "#### 4. Rules", "",
    "- 4.1. Amounts are whole cents.", "",
  ].join("\n");
  const r = lintText(md);
  assert.deepEqual(r.lines.filter((l) => /^WARN (id|id-ref):/.test(l)), []);
  const imp = fxImp(md, "structure-5.1");
  assert.equal(imp.code, 0);
  assert.match(imp.lines.find((l) => /Dates are written in ISO/.test(l)), /^ {2}d1 {2}line \d+ {2}Layer 3 > Rota \(part\) > Rules {2}detail\.rota-4\.1 {2}4\.1\. Dates are written/);
  const other = lintText(md.replace("Reason: structure-5.1.", "Reason: detail.pay-4.1."));
  assert.equal(warns(other, "id-ref").length, 1);
});

test("realizes-text: a Realizes sentence inside a code span is not read", () => {
  const doc = (path) => L1 + "### 3. Value\n\n- 3.1. Given a keeper is idle, when they write, then it is saved.\n\n" + L2 + "### 6. Scenario paths\n\n" + path + "\n";
  assert.deepEqual(rt(doc("- 6.1. Given the keeper is away, when they return, then it is saved, as in `Realizes vision-3.1` above.")), []);
  const prose = rt(doc("- 6.1. Realizes vision-3.1. Given the keeper is away, when they return, then it is saved."));
  assert.equal(prose.length, 1);
  assert.match(prose[0], /vision-3\.1/);
});

test("existing project: a Reason that names a settled concern by number draws no warning", () => {
  const doc = (ref) => L1 + "### 10. Open Concerns\n\n- 10.1. Given the club grows, when the shed fills, then a second shed is priced. Raised by the club.\n\n### 12. Decisions\n\n- 12.1. Chosen X. Reason: settles open concern " + ref + ".\n\n" + L2;
  const ok = lintText(doc("10.1"));
  assert.deepEqual(warns(ok, "id-ref"), []);
  assert.deepEqual(warns(ok, "reasons"), []);
  const bad = lintText(doc("vision-10.1").replace(/### 10\. Open Concerns\n\n- 10\.1\.[^\n]*\n\n/, "### 10. Open Concerns\n\nNone.\n\n"));
  const refs = warns(bad, "id-ref");
  assert.equal(refs.length, 1);
  assert.match(refs[0], /vision-10\.1/);
});

test("shared things: a numbered item among unnumbered bullets keeps its own count", () => {
  const doc = (cite) => [
    "# T", "",
    "## Layer 1: Vision", "", "Scope: all.", "",
    "## Layer 2: Structure", "", "Scope: all.", "",
    "### 1. Parts", "", "- Rota (part): plans.", "", 
    "### 5. Shared things", "", "- A plain first bullet.", "- A plain second bullet.", "- 5.1. A numbered fact the Detail cites.", "",
    "## Layer 3: Detail", "", "Scope: one part.", "",
    "### Rota (part)", "",
    "#### 4. Rules", "",
    `- 4.1. Dates are written in ISO. Reason: ${cite}.`, "",
  ].join("\n");
  assert.deepEqual(warns(lintText(doc("structure-5.1")), "id-ref"), []);
  const bad = warns(lintText(doc("structure-5.2")), "id-ref");
  assert.equal(bad.length, 1);
  assert.match(bad[0], /structure-5\.2/);
});

// ordered: every list item is numbered under its topic (plan ordered-lists-only).
const ordParts = "- 1.1. **Ledger** (part): holds the records.\n- 1.2. Rota (part): plans the shifts.";
const ordStanding = "- 2.1. Ledger: sbp-detail-ledger.md\n- 2.2. Rota: sbp-detail-rota.md";
const ordStructure = (parts, standing) => fxFull["sbp-structure.md"].replace(/- Ledger \(part\)[^\n]*\n- Rota \(part\)[^\n]*/, parts).replace(/- Ledger: sbp-detail-ledger\.md\n- Rota: sbp-detail-rota\.md/, standing);

test("ordered: numbered Parts and Standing read as unnumbered ones do, in a folder and in one document", () => {
  const num = { ...fxFull, "sbp-structure.md": ordStructure(ordParts, ordStanding) };
  const r = fxWith(num, (d) => run(d, "--strict"));
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  // A numbered Standing line names its part without the number.
  const absent = fxWarns({ ...num, "sbp-detail-rota.md": null }, "standing");
  assert.equal(absent.length, 1, absent.join("\n"));
  assert.match(absent[0], /^WARN standing: Rota names sbp-detail-rota\.md, which is not in the folder/);
  // Own stack and described here, numbered.
  const own = fxWarns({ ...num, "sbp-structure.md": ordStructure(ordParts, "- 2.1. Ledger: sbp-detail-ledger.md\n- 2.2. Rota: own stack, presence/"), "sbp-detail-rota.md": null, "presence/": "" }, "standing");
  assert.deepEqual(own, []);
  const here = fxWarns({ ...num, "sbp-structure.md": ordStructure(ordParts, "- 2.1. Ledger: sbp-detail-ledger.md\n- 2.2. Rota: described here."), "sbp-detail-rota.md": null }, "standing");
  assert.equal(here.length, 1, here.join("\n"));
  assert.match(here[0], /^WARN standing: Rota says 'described here'/);
  // One document: a numbered part name, bold or plain, is one word and matches its entry.
  const md = L1 + L2 + item("###", 1, "Parts") + "- 1.1. **Brakes** (part): stops.\n- 1.2. Pads (part): grip.\n\n" + L3 + ENTRY("Brakes") + item("####", 4, "Rules") + `- 4.1. ${GWT}\n`;
  assert.deepEqual(iw(md), []);
  assert.equal(warns(lintText(md.replace("1.2. Pads", "1.2. Pad shoes")), "id").length, 1);
});
