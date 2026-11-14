// SPDX-License-Identifier: MIT
// Tests for strata-blueprints-lint.mjs. Run: node --test tests/strata-blueprints-lint.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  assert.equal(warns(lintText(L1 + "- Given a cat it sleeps.\n" + L2), "scenario-form").length, 1);
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
  assert.equal(warns(lintText(L1 + "A1.1. Fact. If wrong: x.\n" + L2), "reasons").length, 1);
  assert.equal(warns(lintText(L1 + "A1.1. Fact. Basis: y. If wrong: x.\n" + L2), "reasons").length, 0);
  assert.equal(warns(lintText(L1 + "D1.1. Choice.\n" + L2), "reasons").length, 1);
  assert.equal(warns(lintText(L1 + "D1.1. Choice. Reason: z.\n" + L2), "reasons").length, 0);
});

test("unfinished", () => {
  for (const w of ["TODO", "TBD", "FIXME"]) assert.equal(warns(lintText(L1 + `${w} here\n` + L2), "unfinished").length, 1);
  assert.equal(warns(lintText(L1 + L2), "unfinished").length, 0);
});

// --- three-layer rules (D18) ---------------------------------------------
const todoApp = path.join(here, "..", "skills", "strata-blueprints", "references", "strata-blueprints-example-todo-app");
const L3 = "## Layer 3: Detail\n\nScope: one part.\n\n";

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
  const md = L1 + "- V1. Given a rider, when braking, then stops.\n" + L2 + "- No citation here.\n";
  const r = warns(lintText(md), "scenario-trace");
  assert.equal(r.length, 1);
  assert.match(r[0], /V1 has no path in Layer 2/);
});

test("scenario-trace: an id without a rule in Layer 3 warns", () => {
  const md = L1 + "- V1. Given a rider, when braking, then stops.\n" +
    L2 + "- V1. Given a rider, when braking, then stops.\n" +
    L3 + "### Brakes (part)\n\n#### 4. Rules\n- A rule with no id.\n";
  const r = warns(lintText(md), "scenario-trace");
  assert.equal(r.length, 1);
  assert.match(r[0], /V1 has no rule in Layer 3/);
});

test("scenario-trace: ids cited pass, and Layers 1 and 2 only with ids on both pass strict", () => {
  const full = L1 + "- V1. Given a rider, when braking, then stops.\n" +
    L2 + "- V1. Given a rider, when braking, then stops.\n" +
    L3 + "### Brakes (part)\n\n#### 4. Rules\n- V1. Given a rider, when braking, then stops.\n";
  assert.equal(warns(lintText(full), "scenario-trace").length, 0);
  const idea = L1 + "- V1. Given a rider, when braking, then stops.\n" + L2 + "- V1. Given a rider, when braking, then stops.\n";
  assert.equal(lintText(idea, "--strict").code, 0);
  assert.equal(warns(lintText(idea), "scenario-trace").length, 0);
});

test("scenario-trace: an id'd line must still read Given, when, then", () => {
  const md = L1 + "- V1. Given a cat it sleeps.\n" + L2 + "- V1. Given a cat, when fed, then sleeps.\n";
  assert.equal(warns(lintText(md), "scenario-form").length, 1);
});

// --- own-stack and view sections lint clean (D8) --------------------------

test("own-stack: a Parent line before Layer 1 and an own-stack Standing line lint clean", () => {
  const md = "# Example: brakes (part)\n\nParent: bicycle, part Brakes\n\n" +
    L1 + "- V1. Given a rider, when braking, then stops.\n" +
    "## Layer 2: Structure\n\nScope: all.\n\n### 2. Standing\nStanding: own stack, brakes/brakes.md\n" +
    "- V1. Given a rider, when braking, then stops.\n";
  const r = lintText(md, "--strict");
  assert.equal(r.code, 0);
  assert.equal(r.lines.filter((l) => l.startsWith("WARN")).length, 0);
});

test("view: a View section after the last layer lints clean", () => {
  const md = L1 + L2 + L3 + "### Brakes (part)\n\n#### 1. Responsibility\n\n" +
    "## View: Lifecycle\n\n- Given a bicycle, when built, then shipped.\n";
  const r = lintText(md, "--strict");
  assert.equal(r.code, 0);
  assert.equal(r.lines.filter((l) => l.startsWith("WARN")).length, 0);
});

// --- reasons: every id shape (scope-and-ids D14) ---------------------------
const ADH = "### 8. Assumptions\n\n";
const rs = (md) => warns(lintText(md), "reasons");
const A_IDS = ["A1.", "A1.1.", "A1.1", "A1:", "A1.1:", "A3.1.1.", "A12.3.4", "**A1.1.**", "**A1.1**", "A1)", "Assumption 1:", "Assumption 2.1.", "Assumption A1.1."];
const D_IDS = ["D1.", "D1.1.", "D2.3", "D1:", "D3.1.1.", "**D1.1.**", "Decision 2.", "Decision D3.1:"];

test("reasons-ids: assumption id shapes without both labels warn", () => {
  for (const id of A_IDS) {
    const r = rs(L1 + ADH + "- " + id + " Fact.\n" + L2);
    assert.equal(r.length, 1, id);
    assert.match(r[0], /assumption needs 'Basis:' and 'If wrong:'/, id);
    assert.match(r[0], /\(line 7\)$/, id);
  }
  for (const prefix of ["* ", "1. ", ""]) {
    assert.equal(rs(L1 + ADH + prefix + "A1.1 Fact.\n" + L2).length, 1, JSON.stringify(prefix));
  }
  assert.equal(rs(L1 + ADH + "- A1.1 Fact. Basis: y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- A1.1 Fact. If wrong: x.\n" + L2).length, 1);
});

test("reasons-ids: decision id shapes without Reason warn", () => {
  for (const id of D_IDS) {
    const r = rs(L1 + ADH + "- " + id + " Choice.\n" + L2);
    assert.equal(r.length, 1, id);
    assert.match(r[0], /decision needs 'Reason:'/, id);
    assert.match(r[0], /\(line 7\)$/, id);
  }
  assert.equal(rs(L1 + ADH + "- D1.1 Choice. Why: y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- D1.1 Choice. Reason it is.\n" + L2).length, 1);
});

test("reasons-ids: the same shapes pass with their labels", () => {
  for (const id of A_IDS) assert.equal(rs(L1 + ADH + "- " + id + " Fact. Basis: y. If wrong: x.\n" + L2).length, 0, id);
  for (const id of D_IDS) assert.equal(rs(L1 + ADH + "- " + id + " Choice. Reason: z.\n" + L2).length, 0, id);
  assert.equal(rs(L1 + "- A1.1 Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
});

test("reasons-ids: labels inside a ~~~ fenced block are not credited to the item above", () => {
  const r = rs(L1 + ADH + "- A1.1. Fact.\n~~~\nBasis: y. If wrong: x.\n~~~\n" + L2);
  assert.equal(r.length, 1);
  assert.match(r[0], /assumption needs 'Basis:' and 'If wrong:'/);
});

test("reasons-ids: only the guide's labels count", () => {
  assert.equal(rs(L1 + ADH + "- A1.1 Fact. We think so because y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- D1.1 Choice. Why: y.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- D1 Choice, so that z.\n" + L2).length, 1);
});

test("reasons-ids: an unclosed id is checked only inside the topic", () => {
  assert.equal(rs(L1 + "- A4 paper is used.\n- D2 cable is long.\n- A1.1 Fact.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- A1. Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "- D2: Choice.\n" + L2).length, 1);
});

test("reasons-ids: the topic ends at the next heading, and Detail entries are covered", () => {
  assert.equal(rs(L1 + ADH + "- A1 Fact. Basis: y. If wrong: x.\n\n### Diagrams\n\n- A2 Fact.\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + "- A1 Fact.\n" + L2 + "- A2 Fact.\n").length, 1);
  assert.equal(rs(L1 + "### Assumptions\n\n- A1 Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 8. Assumption notes\n\n- A1 Fact.\n" + L2).length, 0);
  assert.equal(rs(L1 + L2 + L3 + "### Brakes (part)\n\n#### 8. Assumptions\n\n- A3.1.1 Fact.\n\n#### 9. Decisions\n\n- D3.1.1 Choice.\n\n### Frame (part)\n\n- A3.2 Fact.\n").length, 2);
});

test("reasons-ids: items with no id are not checked", () => {
  const md = L1 + ADH + "- Not supplied: who decides.\n- None.\n- Some prose without an id.\n" + L2;
  assert.equal(rs(md).length, 0);
  assert.equal(lintText(md, "--strict").code, 0);
});

test("reasons-ids: wrapped and nested lines count, the next item's do not", () => {
  const doc = (text) => rs(L1 + ADH + text + L2);
  assert.equal(doc("- A1.1. Fact.\n  Basis: y. If wrong: x.\n").length, 0);
  assert.equal(doc("- A1.1. Fact.\n  - Basis: y\n  - If wrong: x\n").length, 0);
  assert.equal(doc("- A1.1. Fact.\n  Basis: y.\n").length, 1);
  const two = doc("- D1.1. Choice.\n- A1.1. Fact. Basis: y. If wrong: x. Reason: z.\n");
  assert.equal(two.length, 1);
  assert.match(two[0], /decision needs 'Reason:'/);
  assert.match(two[0], /\(line 7\)$/);
  const plain = doc("D1.1. Choice.\nA1.1. Fact. Basis: y. If wrong: x. Reason: z.\n");
  assert.equal(plain.length, 1);
  assert.match(plain[0], /decision needs 'Reason:'/);
  assert.match(plain[0], /\(line 7\)$/);
  assert.equal(doc("- D1.1. Choice.\n\nReason: later.\n").length, 1);
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
    mutate(/^- A\d+(\.\d+)*\. .*Basis:.*If wrong:/, (l) => l.replace(" If wrong:", ""));
    mutate(/^- D\d+(\.\d+)*\. .*Reason:/, (l) => l.replace(" Reason:", " Because:"));
  }
});

test("fence: a ~~~ block hides its content like a backtick block, and each closes only with its own marker", () => {
  const body = "- A1.1. Inside tilde fence with no reasons.\n";
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
  assert.equal(rs(L1 + "### 8. Assumptions\n\n- A1 Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- D1 Choice.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- A2 Fact.\n" + L2).length, 1);
  assert.equal(rs(L1 + "### 8. Assumptions\n\n- A1 Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- D1 Choice. Reason: z.\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- A2 Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
  assert.equal(rs(L1 + L2 + L3 + "### Brakes (part)\n\n#### 8. Assumptions\n\n- A3.1.1 Fact.\n\n#### 9. Decisions\n\n- D3.1.1 Choice.\n").length, 2);
  assert.equal(rs(L1 + "### 8. Assumptions\n\n- A1 Fact. Basis: y. If wrong: x.\n\n### 9. Decisions\n\n- D1 Choice. Reason: z.\n\n### Diagrams\n\n- A2 Fact.\n" + L2).length, 0);
});

test("split-topics: None. under either topic passes strict", () => {
  const r = lintText(L1 + "### 8. Assumptions\n\nNone.\n\n### 9. Decisions\n\nNone.\n\n" + L2 + "### 7. Assumptions\n\nNone.\n\n### 8. Decisions\n\n- D2.1. Choice. Reason: z.\n\n", "--strict");
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
  assert.equal(rs(L1 + "### 8. Assumptions and decisions\n\n- A1 Fact.\n" + L2).length, 0);
});

// --- reasons: a "Not supplied:" gap is exempt --------------------------------
test("reasons-ids: Not supplied gap in a bullet is exempt", () => {
  assert.equal(rs(L1 + "- A1.3. Not supplied: the deployment target.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- A1.2. Expiry policy: Not supplied: whether and when a link expires.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- D1.2. Not supplied: the storage choice.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- D1.2. Expiry policy: Not supplied: whether a link expires.\n" + L2).length, 0);
});
test("reasons-ids: Not supplied gap wrapped over two lines is exempt", () => {
  assert.equal(rs(L1 + "- A1.3. Deployment target.\n  Not supplied: the deployment target.\n" + L2).length, 0);
  assert.equal(rs(L1 + "- D1.3. Storage choice.\n  Not supplied: which store.\n" + L2).length, 0);
});
test("reasons-ids: Not supplied gap in Assumptions and Decisions topics is exempt", () => {
  assert.equal(rs(L1 + ADH + "- A1.3. Not supplied: the deployment target.\n\n" + L2).length, 0);
  assert.equal(rs(L1 + ADH + "- A1 Target.\n  Not supplied: the deployment target.\n\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- D1 Not supplied: the store.\n\n" + L2).length, 0);
  assert.equal(rs(L1 + "### 9. Decisions\n\n- D1 Store.\n  Not supplied: which store.\n\n" + L2).length, 0);
});
test("reasons-ids: items without labels or gap still warn; complete item passes", () => {
  assert.equal(rs(L1 + "- A1.3. Deployment target is cloud.\n" + L2).length, 1);
  assert.equal(rs(L1 + ADH + "- A1 Deployment target is cloud.\n\n" + L2).length, 1);
  assert.equal(rs(L1 + "- A1.3. Fact. Basis: y. If wrong: x.\n" + L2).length, 0);
});

// --- costs and risks topics (plan costs-risks-topics, step 2) -------------
const mk = (o = {}) => {
  const d = { c1: "None.", r1: "None.", c2: "None.", r2: "None.", c3: "None.", r3: "None.", ...o };
  return "## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\nA need.\n\n### 2. Value\n\n- V1. Given a, when b, then c.\n\n" +
    `### 3. Costs\n\n${d.c1}\n\n### 4. Risks\n\n${d.r1}\n\n### 5. Assumptions\n\n- A1.1. Fact. Basis: b. If wrong: w.\n\n### 6. Decisions\n\n- D1.1. Choice. Reason: r.\n\n` +
    "## Layer 2: Structure\n\nScope: all.\n\n### 1. Parts\n\nP.\n\n### 2. Scenario paths\n\n- V1. Given a, when b, then c.\n\n" +
    `### 3. Costs\n\n${d.c2}\n\n### 4. Risks\n\n${d.r2}\n\n### 5. Assumptions\n\nNone.\n\n### 6. Decisions\n\n- D2.1. Choice. Reason: r.\n\n` +
    "## Layer 3: Detail\n\nScope: one part.\n\n### Shed (part)\n\n#### 1. Rules\n\n- V1. Given a, when b, then c.\n\n#### 2. Limits\n\nL.\n\n" +
    `#### 3. Costs\n\n${d.c3}\n\n#### 4. Risks\n\n${d.r3}\n\n#### 5. Assumptions\n\nNone.\n\n#### 6. Decisions\n\n- D3.1. Choice. Reason: r.\n`;
};
const crWarns = (r) => r.lines.filter((l) => /^WARN (cost-shape|risk-shape|cr-id|risk-ref):/.test(l));
const C = (id, amt = "40 USD per month", rest = "Paid by the club") => `- ${id}. Upkeep: ${amt}. ${rest}.`;
const R = (id, sev = "High", ans = "D1.1") => `- ${id}. Given a flood, when the shed fills, then tools rust. Severity: ${sev}. Answered by ${ans}.`;

test("topics: well-formed costs and risks pass --strict in every layer; Not supplied counts", () => {
  const r = lintText(mk({
    c1: C("C1.1", "Not supplied: the hours") + "\n" + C("C1.2", "1,200.50 USD one-off", "Paid by the club; driven by the tool count"),
    r1: R("R1.1") + "\n" + R("R1.2", "Not rated", "Not supplied: who covers"),
    c2: C("C2.1", "16 hours per year"), r2: R("R2.1", "Low", "V1"),
    c3: C("C3.1", "3 days") + "\n" + C("C3.2"), r3: R("R3.1", "Medium", "D2.1"),
  }), "--strict");
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.match(r.out, /^INFO not-supplied: 2$/m);
});

test("topics: None. and a bare Not supplied: bullet pass; absent topics lint as before", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: "- Not supplied: what it costs.", r1: "- Not supplied: the risks." }))), []);
  assert.equal(lintText(mk(), "--strict").code, 0);
  const old = "## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\nN.\n\n### 2. Assumptions\n\nNone.\n\n### 3. Decisions\n\nNone.\n\n" + L2 + "### 1. Parts\n\nP.\n";
  assert.equal(lintText(old, "--strict").code, 0);
});

test("cost-shape: a cost needs a valid amount and Paid by", () => {
  assert.equal(warns(lintText(mk({ c1: C("C1.1", "40 USD per month", "Paid by the club; driven by use") })), "cost-shape").length, 0);
  assert.equal(warns(lintText(mk({ c1: "- C1.1. Upkeep: 40 USD per month." })), "cost-shape").length, 1);
  for (const amt of ["lots", "40", ""]) {
    assert.equal(warns(lintText(mk({ c1: C("C1.1", amt) })), "cost-shape").length, 1, amt);
  }
  assert.equal(warns(lintText(mk({ c1: "- C1.1. Upkeep: 40 USD. Paid by ." })), "cost-shape").length, 1);
  assert.equal(warns(lintText(mk({ c1: "- C1.1. Upkeep: Not supplied: . Paid by the club." })), "cost-shape").length, 1);
  assert.equal(warns(lintText(mk({ c1: "Upkeep is dear." })), "cost-shape").length, 1);
  assert.equal(warns(lintText(mk({ c1: "- R1.1. Upkeep: 40 USD. Paid by the club." })), "cost-shape").length, 1);
});

test("cost-shape: a wrapped cost bullet is read whole", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: "- C1.1. Upkeep: 40 USD per month.\n  Paid by the club." }))), []);
});

test("risk-shape: Given/when/then, severity and Answered by", () => {
  assert.equal(warns(lintText(mk({ r1: R("R1.1") })), "risk-shape").length, 0);
  for (const sev of ["High", "Medium", "Low", "Not rated"]) assert.equal(warns(lintText(mk({ r1: R("R1.1", sev) })), "risk-shape").length, 0, sev);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "Severe") })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- R1.1. Given a flood, when the shed fills, then tools rust. Answered by D1.1." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- R1.1. Given a flood, then tools rust. Severity: High. Answered by D1.1." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- R1.1. Given a flood, when the shed fills, then tools rust. Severity: High." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- R1.1. Floods rust tools." })), "risk-shape").length, 1);
  assert.equal(warns(lintText(mk({ r1: "- C1.1. Given a flood, when the shed fills, then tools rust. Severity: High. Answered by D1.1." })), "risk-shape").length, 1);
});

test("cr-id: layer number matches and ids count up in document order per layer", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: C("C1.1") + "\n" + C("C1.2"), c3: C("C3.1") + "\n" + C("C3.2") }))), []);
  assert.equal(warns(lintText(mk({ c1: C("C2.1") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mk({ r2: R("R1.1") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mk({ c1: C("C1.1") + "\n" + C("C1.1") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mk({ c1: C("C1.2") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mk({ c1: C("C1.1") + "\n" + C("C1.3") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("R1.2") + "\n" + R("R1.1") })), "cr-id").length >= 1, true);
  assert.equal(warns(lintText(mk({ c1: C("C1.1"), r1: R("R1.1") })), "cr-id").length, 0);
});

test("cr-id: Layer 3 ids count across entries and repeat across entries warns", () => {
  const second = "\n### Yard (part)\n\n#### 1. Rules\n\n- V1. Given a, when b, then c.\n\n#### 3. Costs\n\n" + C("C3.1") + "\n\n#### 4. Risks\n\nNone.\n";
  assert.equal(warns(lintText(mk({ c3: C("C3.1") }) + second), "cr-id").length, 1);
  assert.equal(warns(lintText(mk({ c3: C("C3.1") }) + second.replace("C3.1", "C3.2")), "cr-id").length, 0);
});

test("risk-ref: Answered by names an id that exists, or Not supplied:", () => {
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "A1.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "V1; D1.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "D1.9") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "V9") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "D1.1 and D1.9") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "the caretaker") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "Not supplied: the answer") })), "risk-ref").length, 0);
});

test("risk-ref: an answer defined in an outer layer warns; V ids count as Layer 1", () => {
  const outer = warns(lintText(mk({ r1: R("R1.1", "High", "D2.1") })), "risk-ref");
  assert.equal(outer.length, 1);
  assert.match(outer[0], /outward|outer/);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "D3.1") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r2: R("R2.1", "High", "D3.1") })), "risk-ref").length, 1);
  assert.equal(warns(lintText(mk({ r2: R("R2.1", "High", "D1.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r2: R("R2.1", "High", "D2.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r3: R("R3.1", "High", "V1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r3: R("R3.1", "High", "D1.1") })), "risk-ref").length, 0);
  assert.equal(warns(lintText(mk({ r1: R("R1.1", "High", "V1") })), "risk-ref").length, 0);
});

test("topics: a table line in Costs or Risks warns", () => {
  assert.equal(warns(lintText(mk({ c1: "| Cost | Amount |\n| --- | --- |\n| Upkeep | 40 USD |" })), "cost-shape").length >= 1, true);
  assert.equal(warns(lintText(mk({ r3: "| Risk | Severity |" })), "risk-shape").length >= 1, true);
});

test("topics: fenced content in a topic is ignored; other topics are not checked as costs", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: "None.\n\n```text\n| a | b |\n```" }))), []);
  assert.deepEqual(crWarns(lintText(mk({ c1: C("C1.1") }).replace("- D1.1. Choice.", "- C9.9. Not a cost here. Choice."))), []);
});

test("topics: each example is clean, and a mutation of each cost or risk warns", () => {
  const dir = path.join(here, "..", "skills", "strata-blueprints", "references");
  let mutated = 0;
  const badLine = (line) => (line.startsWith("- C") ? line.replace(/ Paid by .*$/, "") : line.replace(/ Severity: \w+( rated)?\./, ""));
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
          const line = md.split("\n").find((l) => /^- [CR]\d+\.\d+\. /.test(l));
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
    const line = md.split("\n").find((l) => /^- [CR]\d+\.\d+\. /.test(l));
    if (!line) continue;
    const r = lintText(md.replace(line, () => badLine(line)));
    assert.equal(crWarns(r).length >= 1, true, f);
    mutated++;
  }
  assert.equal(mutated >= 1, true);
});

// --- open concerns and the Given/When/Then cost form ----------------------
const mko = (o = {}, c = {}) => {
  const q = [o.o1, o.o2, o.o3]; let k = 0;
  return mk(c).replace(/^(#{3,4}) 5\. Assumptions$/gm, (m, h) => { const b = q[k++]; return b === undefined ? m : `${h} 5. Open Concerns\n\n${b}\n\n${h} 6. Assumptions`; });
};
const ocWarns = (r) => r.lines.filter((l) => /^WARN (concern-shape|cr-id):/.test(l));
const O = (id, raised = "Raised by the club") => `- ${id}. Given the shed may move, when the club votes, then C1.1 is priced again. ${raised}.`;
const G = (id, amt = "40 USD per month", rest = "Paid by the club") => `- ${id}. Given the shed is open, when the club runs it, then it costs ${amt}. ${rest}.`;

test("concern-shape: Given, when, then and Raised by are all needed", () => {
  assert.deepEqual(ocWarns(lintText(mko({ o1: O("O1.1") }))), []);
  for (const bad of [
    "- O1.1. Given the shed may move, then C1.1 is priced again. Raised by the club.",
    "- O1.1. Given the shed may move, when the club votes. Raised by the club.",
    "- O1.1. When the club votes, then C1.1 is priced again. Raised by the club.",
    "- O1.1. Given the shed may move, when the club votes, then C1.1 is priced again.",
    "- O1.1. Given the shed may move, when the club votes, then C1.1 is priced again. Raised by .",
    "- O1.1. The shed may move.",
    "The shed may move.",
    "- R1.1. Given the shed may move, when the club votes, then C1.1 is priced again. Raised by the club.",
  ]) assert.equal(warns(lintText(mko({ o1: bad })), "concern-shape").length, 1, bad);
});

test("concern-shape: well-formed concerns pass --strict in every layer; wrapped lines are read whole", () => {
  const r = lintText(mko({ o1: O("O1.1") + "\n" + O("O1.2"), o2: O("O2.1"), o3: "- O3.1. Given the shed may move, when the club votes,\n  then C1.1 is priced again. Raised by the club." }), "--strict");
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
});

test("concern-shape: None. is accepted; a table line warns", () => {
  assert.deepEqual(ocWarns(lintText(mko({ o1: "None.", o2: "None.", o3: "None." }))), []);
  assert.equal(lintText(mko({ o1: "None.", o2: "None.", o3: "None." }), "--strict").code, 0);
  assert.equal(warns(lintText(mko({ o1: "| Concern | Who |\n| --- | --- |\n| Shed | club |" })), "concern-shape").length >= 1, true);
});

test("cr-id: O ids are layer-scoped, unique and count up in document order", () => {
  assert.equal(warns(lintText(mko({ o1: O("O2.1") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mko({ o1: O("O1.1") + "\n" + O("O1.1") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mko({ o1: O("O1.2") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mko({ o1: O("O1.1") + "\n" + O("O1.3") })), "cr-id").length, 1);
  assert.equal(warns(lintText(mko({ o1: O("O1.1"), o2: O("O2.1"), o3: O("O3.1") })), "cr-id").length, 0);
  assert.equal(warns(lintText(mko({ o1: O("O1.1") }, { c1: C("C1.1"), r1: R("R1.1") })), "cr-id").length, 0);
});

test("cost-shape: the Given, when, then cost form passes with an amount or Not supplied:", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: G("C1.1") + "\n" + G("C1.2", "Not supplied: the hours") + "\n" + G("C1.3", "1,200 USD one-off", "Paid by the club; driven by use"), c3: G("C3.1", "3 hours") }))), []);
  assert.equal(lintText(mk({ c1: G("C1.1") }), "--strict").code, 0);
});

test("cost-shape: a Given, when, then cost without Paid by or with a bad amount warns", () => {
  assert.equal(warns(lintText(mk({ c1: "- C1.1. Given the shed is open, when the club runs it, then it costs 40 USD per month." })), "cost-shape").length, 1);
  for (const amt of ["lots", "40", "Not supplied:", ""]) assert.equal(warns(lintText(mk({ c1: G("C1.1", amt) })), "cost-shape").length, 1, amt);
});

test("cost-shape: a Given, when, then cost with an empty payer warns", () => {
  assert.equal(warns(lintText(mk({ c1: "- C1.1. Given the shed is open, when the club runs it, then it costs 40 USD per month. Paid by ." })), "cost-shape").length, 1);
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
    assert.equal(warns(lintText(mk({ c1: G("C1.1", amt) })), "cost-shape").length, 0, amt);
    assert.equal(warns(lintText(mk({ c1: C("C1.1", amt) })), "cost-shape").length, 0, amt);
  }
});

test("cost-shape: the old cost form still passes; a document without the new topics lints as before", () => {
  assert.deepEqual(crWarns(lintText(mk({ c1: C("C1.1") + "\n" + C("C1.2", "Not supplied: the hours") }))), []);
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
  const w = warns(lintText(mk({ c1: "- C1.1. Given the shed is open, when the club runs it, then it costs 40 USD per month." })), "cost-shape");
  assert.equal(w.length, 1);
  assert.match(w[0], /Given/);
});

// --- costs, risks and open concerns may be omitted ---------------------------
test("omission: a document without Costs, Risks and Open Concerns in every layer lints clean under --strict", () => {
  const md = L1 + "### 1. Need\n\nA need.\n\n### 7. Assumptions\n\nNone.\n\n### 8. Decisions\n\nNone.\n\n"
    + L2 + "### 1. Parts\n\nA part.\n\n### 6. Assumptions\n\nNone.\n\n### 7. Decisions\n\nNone.\n\n"
    + L3 + "### Brakes (part)\n\n#### 1. Responsibility\n\nStops.\n\n#### 7. Assumptions\n\nNone.\n\n#### 8. Decisions\n\nNone.\n";
  const r = lintText(md, "--strict");
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
});

test("omission: only some of Costs, Risks and Open Concerns may be omitted", () => {
  const md = L1 + "### 1. Need\n\nA need.\n\n### 7. Costs\n\nNone.\n\n### 8. Assumptions\n\nNone.\n\n### 9. Decisions\n\nNone.\n\n"
    + L2 + "### 1. Parts\n\nA part.\n\n### 6. Risks\n\nNone.\n\n### 7. Assumptions\n\nNone.\n\n### 8. Decisions\n\nNone.\n";
  const r = lintText(md, "--strict");
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
});

// --- folder mode (skill-optimization S1; plan D2, D3, D15) ------------------------
const fxVision = `# Club

Version: 0.1.0
Status: draft

## Layer 1: Vision

Scope: the whole club.

### 1. Need

- V1. Given a member, when they join, then they are listed.

### 2. Decisions

- D1. Keep lists. Reason: simple.
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

- V1. Given a member, when they join, then Ledger adds a record.

## View: Lifecycle

A member joins, then rests.
`;
const fxCost = (id) => `\n#### 8. Costs\n\n- ${id}. Given a busy week, when the part runs, then it costs 5 hours. Paid by the club.\n`;
const fxLedger = `# Club

## Layer 3: Detail

Scope: one part.

### Ledger (part)

#### 1. Responsibility

Holds the records.

#### 4. Rules

- V1. Given a member, when they join, then a record is added.
`;
const fxRota = `# Club

## Layer 3: Detail

Scope: one part.

### Rota (part)

#### 1. Responsibility

Plans the shifts.
`;
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
  const r = fxWith({}, (d) => run(d, "--strict"));
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
  assert.ok(r.lines.some((l) => /^INFO not-supplied: 0$/.test(l)));
});

test("folder: a trailing slash on the folder path works", () => {
  const r = fxWith({}, (d) => run(d + "/", "--strict"));
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

test("folder: cr-id counts across files in Parts order, and repeats warn", () => {
  const rota = (id) => fxRota + fxCost(id);
  const ledger = (id) => fxLedger + fxCost(id);
  // Parts order Ledger, Rota: Ledger holds C3.1 and Rota holds C3.2.
  assert.equal(fxWarns({ "sbp-detail-ledger.md": ledger("C3.1"), "sbp-detail-rota.md": rota("C3.2") }, "cr-id").length, 0);
  // Swapped ids in the same Parts order warn.
  assert.ok(fxWarns({ "sbp-detail-ledger.md": ledger("C3.2"), "sbp-detail-rota.md": rota("C3.1") }, "cr-id").length >= 1);
  // Parts order Rota, Ledger puts Rota first, although the file names sort the other way.
  const swapped = fxStructure.replace("- Ledger (part): holds the records.\n- Rota (part): plans the shifts.", "- Rota (part): plans the shifts.\n- Ledger (part): holds the records.");
  assert.equal(fxWarns({ "sbp-structure.md": swapped, "sbp-detail-ledger.md": ledger("C3.2"), "sbp-detail-rota.md": rota("C3.1") }, "cr-id").length, 0);
  assert.ok(fxWarns({ "sbp-structure.md": swapped, "sbp-detail-ledger.md": ledger("C3.1"), "sbp-detail-rota.md": rota("C3.2") }, "cr-id").length >= 1);
  // The same id in two files warns as a repeat.
  const rep = fxWarns({ "sbp-detail-ledger.md": ledger("C3.1"), "sbp-detail-rota.md": rota("C3.1") }, "cr-id");
  assert.ok(rep.some((l) => /repeats/.test(l) && /sbp-detail-rota\.md line/.test(l)), rep.join("\n"));
});

test("folder: ring warns by layer with a file label; a view section is not a layer", () => {
  const w = fxWarns({ "sbp-vision.md": fxVision.replace("simple.", "simple, see Layer 3.") }, "ring");
  assert.equal(w.length, 1);
  assert.match(w[0], /\(sbp-vision\.md line 16\)$/);
  assert.equal(fxWarns({ "sbp-structure.md": fxStructure + "\nA view that mentions Layer 3.\n" }, "ring").length, 0);
});

test("folder: a '## View:' section at the end of the structure file draws no warning", () => {
  const r = fxWith({ "sbp-structure.md": fxStructure + "\n### Notes\n\nMore.\n" }, (d) => run(d, "--strict"));
  assert.deepEqual(r.lines.filter((l) => l.startsWith("WARN")), []);
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
});

test("folder: scenario-trace 'no rule in Layer 3' runs only when a detail file exists", () => {
  const noRule = fxWarns({ "sbp-detail-ledger.md": fxLedger.replace(/#### 4\. Rules[\s\S]*$/, "") }, "scenario-trace");
  assert.equal(noRule.length, 1, noRule.join("\n"));
  assert.match(noRule[0], /V1 has no rule in Layer 3/);
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
    "README.md": "TODO\n", ["sbp-" + "view-x.md"]: "TODO\n",
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
  for (const [k, v] of Object.entries({ "sbp-vision.md": fxVision, "sbp-structure.md": fxStructure, "sbp-detail-ledger.md": fxLedger, "sbp-detail-rota.md": fxRota })) crlf[k] = v.replace(/\n/g, "\r\n");
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
  "- V1. Given a member, when they join, then they are listed.", "",
  "### 2. Decisions", "",
  "- D1.1. Keep lists. Reason: V1.", "",
  "## Layer 2: Structure", "", "Scope: all.", "",
  "### 1. Parts", "", "- Rota (part): plans.", "",
  "### 6. Scenario paths", "",
  "- V1. Given a member, when they join, then Rota plans it.", "",
  "### 7. Decisions", "",
  "- D2.1. Lists are kept in order. Reason: follows D1.1.", "",
  "## Layer 3: Detail", "", "Scope: one part.", "",
  "### Rota (part)", "",
  "#### 4. Rules", "",
  "- V1. Given a member, when they join, then a shift is made.",
  "- D3.1. Order by date. Reason: D2.1 and D1.1 both ask for it.",
  "",
  "#### 12. Decisions", "",
  "A loose paragraph that cites D3.1.", "",
].join("\n");

test("impact: V1 reaches paths and rules across layers at depth 1, with place and label", () => {
  const r = fxImp(IMP, "V1");
  assert.equal(r.code, 0);
  assert.equal(r.lines[0], `impact V1: defined in Layer 1, line ${fxLine(IMP, "- V1. Given a member, when they join, then they are listed.")}`);
  assert.equal(r.lines[1], "V1");
  const l2 = r.lines.find((l) => /then Rota plans it/.test(l));
  assert.match(l2, /^ {2}d1 {2}line \d+ {2}Layer 2 > Scenario paths {2}- {2}V1\. Given/);
  assert.match(l2, new RegExp(`line ${fxLine(IMP, "then Rota plans it")} `));
  const l3 = r.lines.find((l) => /a shift is made/.test(l));
  assert.match(l3, /^ {2}d1 {2}line \d+ {2}Layer 3 > Rota \(part\) > Rules {2}- /);
  assert.match(r.lines.find((l) => /Reason: V1\./.test(l)), /^ {2}d1 {2}line \d+ {2}Layer 1 > Decisions {2}D1\.1 {2}D1\.1\. Keep lists/);
});

test("impact: the seed's own element is never listed; there are no lint lines", () => {
  const r = fxImp(IMP, "V1");
  assert.ok(!r.lines.some((l) => /then they are listed/.test(l)));
  assert.ok(!r.lines.some((l) => /^(WARN|strata-blueprints-lint:|INFO not-supplied)/.test(l)));
});

test("impact: D1.1 is transitive, each element once, under the parent that reaches it first", () => {
  const r = fxImp(IMP, "D1.1");
  const at = (needle) => r.lines.findIndex((l) => l.includes(needle));
  const d2 = r.lines[at("Lists are kept in order")];
  assert.match(d2, /^ {2}d1 {2}/);
  // D3.1 cites D2.1 and D1.1: reached at depth 1 directly, and not repeated under D2.1.
  const d3 = r.lines.filter((l) => /Order by date/.test(l));
  assert.equal(d3.length, 1);
  assert.match(d3[0], /^ {2}d1 {2}/);
  // The loose paragraph cites D3.1: depth 2, nested under D3.1 with four spaces.
  const para = r.lines.filter((l) => /A loose paragraph/.test(l));
  assert.equal(para.length, 1);
  assert.match(para[0], /^ {4}d2 {2}/);
  assert.ok(at("Order by date") < at("A loose paragraph"));
  assert.match(r.lines.at(-1), /^INFO impact: 3 element\(s\) reached, deepest 2$/);
});

test("impact: D2.1 reaches D3.1 at d1 and the paragraph at d2; the order follows assembly", () => {
  const r = fxImp(IMP, "D2.1");
  assert.match(r.lines.find((l) => /Order by date/.test(l)), /^ {2}d1 /);
  assert.match(r.lines.find((l) => /A loose paragraph/.test(l)), /^ {4}d2 /);
  assert.match(r.lines.at(-1), /^INFO impact: 2 element\(s\) reached, deepest 2$/);
});

test("impact: D1 does not reach the citers of D1.1", () => {
  const md = IMP.replace("- D1.1. Keep lists.", "- D1. Keep the lists.\n- D1.1. Keep lists.");
  const r = fxImp(md, "D1");
  assert.equal(r.code, 0);
  assert.match(r.lines.at(-1), /^INFO impact: 0 element\(s\) reached, deepest 0$/);
});

test("impact: a citation loop is reported once and the exit stays 0", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 2. Decisions\n\n- D1. Use X as D2 says. Reason: see D2.\n- D2. Use Y. Reason: follows D1.\n";
  const r = fxImp(md, "D1");
  assert.equal(r.code, 0);
  const cyc = r.lines.filter((l) => l.startsWith("WARN impact: cycle "));
  assert.equal(cyc.length, 1, r.out);
  assert.match(cyc[0], /^WARN impact: cycle D1 \.\.\. D2$/);
  assert.match(r.lines.at(-1), /^INFO impact: 1 element\(s\) reached, deepest 1$/);
});

test("impact: an element without an id is listed with '-'", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- V1. Given a, when b, then c.\n\nThe club follows V1 in every case.\n";
  const r = fxImp(md, "V1");
  const l = r.lines.find((x) => /The club follows V1/.test(x));
  assert.match(l, /^ {2}d1 {2}line 9 {2}Layer 1 > Need {2}- {2}The club follows V1/);
});

test("impact: an id that is defined and not cited exits 0 with zero reached", () => {
  const r = fxImp("## Layer 1: Vision\n\nScope: all.\n\n### 2. Decisions\n\n- D1. Alone. Reason: none.\n", "D1");
  assert.equal(r.code, 0);
  assert.equal(r.lines[0], "impact D1: defined in Layer 1, line 7");
  assert.match(r.lines.at(-1), /^INFO impact: 0 element\(s\) reached, deepest 0$/);
});

test("impact: an id that is cited and not defined exits 1 and still lists the citers", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 2. Decisions\n\n- D1. Uses D9. Reason: D9.\n";
  const r = fxDoc(md, (f) => ({ ...fxImpact(["D9", f]), f }));
  assert.equal(r.code, 1);
  assert.equal(r.lines[0], `WARN impact: D9 is not defined in ${r.f}`);
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}line 7 /.test(l)));
  assert.match(r.lines.at(-1), /^INFO impact: 1 element\(s\) reached, deepest 1$/);
});

test("impact: id token boundaries", () => {
  const md = [
    "## Layer 1: Vision", "", "Scope: all.", "", "### 1. Need", "",
    "- V1. Given a, when b, then c.", "- V10. Given a, when b, then c.", "",
    "### 11. Assumptions", "",
    "- A1.1. Basis: one. If wrong: none.", "- A1.10. Basis: ten. If wrong: none.", "",
    "### 12. Decisions", "",
    "- D1. Cites the ten. Reason: A1.10 only.",
    "- D2. Cites the one at a sentence end. Reason: A1.1.",
    "- D3. Cites V10 only. Reason: V10.",
    "- D4. Hides it in a span. Reason: `V1` and `A1.1`.",
    "- D5. Word glued: xV1 and V1x and 2.A1.1 here. Reason: none.",
    "", "```", "V1 A1.1 in a fence", "```", "",
  ].join("\n");
  const one = fxImp(md, "A1.1").lines.filter((l) => /^ {2}d1 /.test(l)).map((l) => l.match(/D\d\./)?.[0]);
  assert.deepEqual(one, ["D2."]);
  const ten = fxImp(md, "A1.10").lines.filter((l) => /^ {2}d1 /.test(l)).map((l) => l.match(/D\d\./)?.[0]);
  assert.deepEqual(ten, ["D1."]);
  const v1 = fxImp(md, "V1");
  assert.equal(v1.lines.filter((l) => /^ {2}d1 /.test(l)).length, 0, v1.out);
  const v10 = fxImp(md, "V10").lines.filter((l) => /^ {2}d1 /.test(l)).map((l) => l.match(/D\d\./)?.[0]);
  assert.deepEqual(v10, ["D3."]);
});

test("impact: labels for a part rule and for text outside any layer", () => {
  const md = "# T\n\nVersion: V1 is the seed.\n\n## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- V1. Given a, when b, then c.\n\n## View: Flow\n\nThe flow honours V1.\n\n## Layer 3: Detail\n\nScope: x.\n\n### Rota (part)\n\n#### 4. Rules\n\n- V1. Given a, when b, then c.\n";
  const r = fxImp(md, "V1");
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}line 3 {2}Other {2}- {2}Version: V1 is the seed\.$/.test(l)), r.out);
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}line 15 {2}Other {2}- {2}The flow honours V1\.$/.test(l)), r.out);
  assert.ok(r.lines.some((l) => /Layer 3 > Rota \(part\) > Rules/.test(l)), r.out);
});

test("impact: a nested Reason line counts for its parent element", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- V1. Given a, when b, then c.\n\n### 2. Decisions\n\n- D1. Use lists.\n  - Reason: because of V1.\n";
  const r = fxImp(md, "V1");
  const l = r.lines.find((x) => /Use lists/.test(x));
  assert.match(l, /^ {2}d1 {2}line 11 {2}Layer 1 > Decisions {2}D1 {2}D1\. Use lists\. - Reason: because of V1\.$/);
});

test("impact: the text is cut to 80 characters with '...'", () => {
  const long = "D1. " + "word ".repeat(40) + "cites V1.";
  const md = `## Layer 1: Vision\n\nScope: all.\n\n### 1. Need\n\n- V1. Given a, when b, then c.\n\n### 2. Decisions\n\n- ${long}\n`;
  const l = fxImp(md, "V1").lines.find((x) => /^ {2}d1 /.test(x));
  const text = l.split("  ").at(-1);
  assert.equal(text.length, 83);
  assert.ok(text.endsWith("..."));
  assert.equal(text.slice(0, 80), long.slice(0, 80));
});

test("impact: usage errors exit 2 with an empty stdout and one stderr line", () => {
  const doc = IMP;
  fxDoc(doc, (f) => {
    const cases = [[], ["V1"], ["D1.", f], ["x1", f], ["V1", f + ".missing"], ["--x", "V1", f], ["V1", f, "--strict"], ["V1", f, "extra"], ["--strict", "V1", f]];
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
  const r = fxWith({}, (d) => fxImpact(["V1", d]));
  assert.equal(r.code, 0);
  assert.equal(r.lines[0], "impact V1: defined in Layer 1, sbp-vision.md line 12");
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}sbp-structure\.md line 19 {2}Layer 2 > Scenario paths {2}- /.test(l)), r.out);
  assert.ok(r.lines.some((l) => /^ {2}d1 {2}sbp-detail-ledger\.md line 15 {2}Layer 3 > Ledger \(part\) > Rules {2}- /.test(l)), r.out);
  assert.match(r.lines.at(-1), /^INFO impact: 2 element\(s\) reached, deepest 1$/);
});

test("impact: an empty folder exits 2 with one stderr line", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  try {
    const r = fxImpact(["V1", dir]);
    assert.equal(r.code, 2);
    assert.equal(r.out, "");
    assert.equal(r.err.trim().split("\n").length, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("single document: a file named V1 lints as before", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-"));
  try {
    const f = path.join(dir, "V1");
    fs.writeFileSync(f, L1 + L2);
    const r = run(f);
    assert.equal(r.code, 0);
    assert.match(r.lines.at(-1), /^strata-blueprints-lint: \d+ warning\(s\)$/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
