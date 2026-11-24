// SPDX-License-Identifier: MIT
// Tests for strata-blueprints.mjs (publish). Run: node --test tests/strata-blueprints-publish.test.mjs
// STRATA_TOOL may name another copy of the tool (used to show these tests fail against an older tool).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.join(here, "..", "skills", "strata-blueprints", "scripts");
const tool = process.env.STRATA_TOOL ? path.resolve(process.env.STRATA_TOOL) : path.join(scripts, "strata-blueprints.mjs");
const lint = path.join(scripts, "strata-blueprints-lint.mjs");
const refs = path.join(here, "..", "skills", "strata-blueprints", "references");
const T = await import(pathToFileURL(tool).href);
const { MARKER, PUBLISHED_MARKER, TOPICS, condenseText } = T;
const publishFiles = (...a) => T.publishFiles(...a);

const cli = (...args) => { const r = spawnSync(process.execPath, [tool, ...args], { encoding: "utf8" }); return { out: r.stdout, err: r.stderr, code: r.status, lines: r.stdout.split("\n").filter(Boolean) }; };
const runLint = (...args) => { const r = spawnSync(process.execPath, [lint, ...args], { encoding: "utf8" }); return { out: r.stdout, err: r.stderr, code: r.status, lines: r.stdout.split("\n").filter(Boolean) }; };
function tmp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-publish-"));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const put = (dir, name, text) => { const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
const get = (f) => fs.readFileSync(f, "utf8");
const ents = (o) => Object.entries(o).map(([name, text]) => ({ name, text }));
const pub = (o, opts) => publishFiles(ents(o), opts);
const lines = (s) => s.split("\n");

const T1 = TOPICS[1], T2 = TOPICS[2], T3 = TOPICS[3];
const fxT = (h, names, have = {}) => names.map((n, i) => `${h} ${i + 1}. ${n}\n\n${have[n] ?? "None."}\n`).join("\n");
const L1 = "## Layer 1: Vision\n\nScope: all.\n\n";
const L2 = "## Layer 2: Structure\n\nScope: all.\n\n";
const L3 = "## Layer 3: Detail\n\nScope: one part.\n\n";
const vision = (have = { Need: "- 1.1. Members need a shed.", Decisions: "- 12.1. Keep it. Reason: simple." }) =>
  "# Club\n\nVersion: 1.0\nStatus: Draft\n\n" + L1 + fxT("###", T1, have);
const structure = (parts, have = {}, views = "") =>
  "# Club\n\n" + L2 + fxT("###", T2, { Parts: parts.map((p, i) => `- 1.${i + 1}. ${p} (part): holds ${p}.`).join("\n"), ...have }) + views;
const detail = (part, have = {}) =>
  "# Club\n\n" + L3 + `### ${part} (part)\n\n` + fxT("####", T3, { Responsibility: `${part} holds things.`, ...have });
const stack = (parts, views = "") => ({
  "sbp-vision.md": vision(),
  "sbp-structure.md": structure(parts, {}, views),
  ...Object.fromEntries(parts.map((p) => [`sbp-detail-${p.toLowerCase()}.md`, detail(p)])),
});
const writeStack = (dir, o) => { for (const [n, t] of Object.entries(o)) put(dir, n, t); return dir; };
// A one-document source in standard form.
const doc = (o1 = { Need: "N." }, o2 = { Parts: "- 1.1. Shed (part): holds tools." }, o3 = { Responsibility: "Holds tools." }, tail = "") =>
  "# Club\n\n" + L1 + fxT("###", T1, o1) + "\n" + L2 + fxT("###", T2, o2) + "\n" + L3 + "### Shed (part)\n\n" + fxT("####", T3, o3) + tail;
const headingsOf = (text, re) => lines(text).filter((l) => re.test(l));
const partNames = (text) => headingsOf(text, /^### .+ \(part\)$/).map((l) => l.slice(4, -7));
const topicNames = (text) => [...text.matchAll(/^#{3,4} \d+\. (.+)$/gm)].map((m) => m[1]);
// Slugs by an independent route: collect and count headings, outside fences, with a loop.
function linkProblems(text) {
  const slugs = new Map(); const have = new Set(); let fence = false;
  for (const l of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; continue; }
    const m = !fence && l.match(/^#{1,6} (.*)$/);
    if (!m) continue;
    let s = ""; for (const ch of m[1].toLowerCase()) { if (/[\p{L}\p{N}_-]/u.test(ch)) s += ch; else if (ch === " ") s += "-"; }
    const k = slugs.get(s) ?? 0; slugs.set(s, k + 1);
    have.add(k ? `${s}-${k}` : s);
  }
  const bad = [];
  for (const m of text.matchAll(/^\s*- \[.*\]\(#([^)]*)\)\r?$/gm)) if (!have.has(m[1])) bad.push(m[1]);
  return bad;
}

test("publish: folder merges into one document", () => {
  const parts = ["Access", "Ledger", "Timing"];
  const s = stack(parts);
  const order = ["sbp-detail-timing.md", "sbp-structure.md", "sbp-detail-access.md", "sbp-vision.md", "sbp-detail-ledger.md"];
  const r = pub(Object.fromEntries(order.map((n) => [n, s[n]])));
  assert.equal(r.files, 5);
  assert.equal(lines(r.text)[0], PUBLISHED_MARKER);
  assert.equal(lines(r.text)[1], "");
  assert.equal(lines(r.text)[2], "# Club");
  assert.equal(headingsOf(r.text, /^# /).length, 1);
  assert.equal(headingsOf(r.text, /^## Layer 3: Detail$/).length, 1);
  assert.equal(headingsOf(r.text, /^Scope: one part\.$/).length, 1);
  assert.equal(headingsOf(r.text, /^Version: /).length, 1);
  assert.deepEqual(partNames(r.text), parts);
  assert.ok(r.text.indexOf("## Layer 1") < r.text.indexOf("## Layer 2") && r.text.indexOf("## Layer 2") < r.text.indexOf("## Layer 3"));
  assert.ok(r.text.indexOf("## Contents") < r.text.indexOf("## Layer 1"));
  // the same through the command line
  tmp((dir) => {
    writeStack(path.join(dir, "src"), s);
    const out = path.join(dir, "o", "club.md");
    const c = cli("publish", path.join(dir, "src"), "--out", out);
    assert.equal(c.code, 0, c.err);
    assert.equal(get(out), r.text);
  });
});

test("publish: one detail part", () => {
  const one = pub({ "sbp-detail-ledger.md": detail("Ledger") });
  assert.deepEqual(partNames(one.text), ["Ledger"]);
  assert.equal(headingsOf(one.text, /^## Layer 3: Detail$/).length, 1);
  const none = pub({ "sbp-vision.md": vision(), "sbp-structure.md": structure(["Ledger"]) });
  assert.equal(headingsOf(none.text, /^## Layer 3/).length, 0);
  assert.equal(headingsOf(none.text, /^## Layer [12]:/).length, 2);
  tmp((dir) => {
    put(path.join(dir, "src"), "sbp-vision.md", vision());
    const out = path.join(dir, "out.md");
    const c = cli("publish", path.join(dir, "src"), "--out", out);
    assert.equal(c.code, 0, c.err);
    const t = get(out);
    assert.equal(headingsOf(t, /^## Layer 1: Vision$/).length, 1);
    assert.equal(headingsOf(t, /^## Layer [23]/).length, 0);
    assert.deepEqual(linkProblems(t), []);
  });
});

test("publish: parts order", () => {
  // Parts names Zulu before Mike, so Zulu comes first although mike sorts before zulu; alpha is not named and goes last.
  const files = {
    "sbp-detail-alpha.md": detail("Alpha"),
    "sbp-detail-mike.md": detail("Mike"),
    "sbp-detail-zulu.md": detail("Zulu"),
    "sbp-structure.md": structure(["Zulu", "Mike"]),
    "sbp-vision.md": vision(),
  };
  assert.deepEqual(partNames(pub(files).text), ["Zulu", "Mike", "Alpha"]);
  // two unnamed files: file name ascending
  const f2 = { ...files, "sbp-detail-beta.md": detail("Beta") };
  assert.deepEqual(partNames(pub(f2).text), ["Zulu", "Mike", "Alpha", "Beta"]);
});

test("publish: single file as input", () => {
  const src = doc({ Need: "N.", Value: "Not supplied: the value." }, undefined, undefined, "\n## View: Tour\n\nA tour.\n");
  const r = pub({ "club.md": src });
  const t = r.text;
  assert.equal(lines(t)[0], PUBLISHED_MARKER);
  assert.deepEqual(topicNames(t).filter((n) => T1.includes(n)), ["Need"]);
  assert.ok(!/Not supplied/.test(t.replace(PUBLISHED_MARKER, "")));
  assert.equal(headingsOf(t, /^## Contents$/).length, 1);
  assert.equal(headingsOf(t, /^## Layer 3: Detail$/).length, 1);
  assert.ok(t.trimEnd().endsWith("## View: Tour\n\nA tour."));
  assert.ok(t.endsWith("A tour.\n") && !t.endsWith("\n\n"));
  // every topic that condense keeps and is not open-only stays; the numbers are those of the source
  assert.ok(t.includes("### 1. Need\n\nN.\n"));
});

test("publish: views move after Layer 3", () => {
  const views = "\n## View: One\n\nFirst view.\n\n## View: Two\n\nSecond view.\n";
  const r = pub(stack(["Access", "Ledger"], views));
  const t = r.text;
  const at = (s) => t.indexOf(s);
  assert.ok(at("## View: One") > at("### Ledger (part)"));
  assert.ok(at("## View: One") < at("## View: Two"));
  assert.ok(at("## Layer 3: Detail") < at("### Access (part)"));
  assert.ok(t.trimEnd().endsWith("## View: Two\n\nSecond view."));
  assert.equal(headingsOf(t, /^## View: /).length, 2);
});

test("publish: table of contents", () => {
  const src = [
    "# Club", "",
    "## Layer 1: Vision", "", "Scope: all.", "",
    "### 1. Need", "", "- 1.1. Members need a shed.", "", "```", "### Hidden", "```", "",
    "## Layer 2: Structure", "", "Scope: all.", "",
    "### 1. Parts", "", "- 1.1. Access (part): gate.", "",
    "## Layer 3: Detail", "", "Scope: one part.", "",
    "### Access (part)", "",
    "#### 1. Responsibility", "", "Opens the gate.", "",
    "#### 12. Decisions", "", "- 12.1. Keep. Reason: simple.", "",
    "## View: X", "", "Text.", "",
    "## View: X", "", "Text 2.", "",
    "## View: [beta]", "", "Text 3.", "",
    "## 12. Decisions", "", "Text 4.", "",
    "## Hidden", "", "Text 5.", "",
  ].join("\n");
  const t = pub({ "club.md": src }).text;
  const toc = [
    "## Contents", "",
    "- [Layer 1: Vision](#layer-1-vision)",
    "  - [1. Need](#1-need)",
    "- [Layer 2: Structure](#layer-2-structure)",
    "  - [1. Parts](#1-parts)",
    "- [Layer 3: Detail](#layer-3-detail)",
    "  - [Access (part)](#access-part)",
    "- [View: X](#view-x)",
    "- [View: X](#view-x-1)",
    "- [View: \\[beta\\]](#view-beta)",
    "- [12. Decisions](#12-decisions-1)",
    "- [Hidden](#hidden)",
    "", "## Layer 1: Vision",
  ].join("\n");
  assert.ok(t.includes("# Club\n\n" + toc + "\n"), t);
  assert.ok(!t.includes("[Contents]"));
  assert.ok(!t.includes("[Responsibility") && !t.includes("[1. Responsibility"));
  assert.deepEqual(linkProblems(t), []);
  assert.equal(t.indexOf("## Contents"), t.indexOf("# Club\n\n") + "# Club\n\n".length);
});

test("publish: CRLF", () => {
  const s = stack(["Access"]);
  const mixed = { ...s, "sbp-structure.md": s["sbp-structure.md"].replace(/\n/g, "\r\n") };
  const a = pub(mixed).text;
  assert.ok(a.includes("\r\n"));
  assert.equal(a.replace(/\r\n/g, "").includes("\n"), false, "no bare line feed");
  assert.ok(a.endsWith("\r\n") && !a.endsWith("\r\n\r\n"));
  const b = pub(s).text;
  assert.ok(!b.includes("\r"));
  assert.equal(a.replace(/\r\n/g, "\n"), b);
  tmp((dir) => {
    const o1 = path.join(dir, "a.md"), o2 = path.join(dir, "b.md");
    put(dir, "a/sbp-vision.md", s["sbp-vision.md"]); put(dir, "a/sbp-structure.md", mixed["sbp-structure.md"]); put(dir, "a/sbp-detail-access.md", s["sbp-detail-access.md"]);
    writeStack(path.join(dir, "b"), s);
    assert.equal(cli("publish", path.join(dir, "a"), "--out", o1).code, 0);
    assert.equal(cli("publish", path.join(dir, "b"), "--out", o2).code, 0);
    const la = runLint(o1, "--strict"), lb = runLint(o2, "--strict");
    assert.equal(la.code, lb.code);
    const sig = (r) => r.lines.filter((l) => /^(INFO|strata-blueprints-lint:)/.test(l));
    assert.deepEqual(sig(la), sig(lb));
  });
});

test("publish: empty file and no layer heading", () => {
  const s = stack(["Access"]);
  for (const bad of ["", "   \n\n", "# Club\n", "# Club\n\nText only.\n"]) {
    assert.throws(() => pub({ ...s, "sbp-detail-access.md": bad }), /sbp-detail-access\.md: no layer heading found/);
  }
  tmp((dir) => {
    writeStack(path.join(dir, "src"), { ...s, "sbp-detail-access.md": "" });
    const out = path.join(dir, "out.md");
    const c = cli("publish", path.join(dir, "src"), "--out", out);
    assert.equal(c.code, 2);
    assert.match(c.err, /^strata-blueprints: .*sbp-detail-access\.md: no layer heading found/);
    assert.ok(!fs.existsSync(out));
  });
});

test("publish: None. and Not supplied: mixed", () => {
  const o1 = {
    Need: "None.\n\nMore text.",
    "Target audience": "- None.",
    Value: "Not supplied: x.\n\n- 3.1. Item.",
    Focus: "Not supplied: a.\n\nNone.",
    "Success measures": "- Not supplied: a\n  wrapped continuation.",
    "Qualities and constraints": "- Not supplied: a.\n- Not supplied: b.\n\nNot supplied: c.",
    Vocabulary: "```\nNot supplied: z.\n```",
    Costs: "None.",
    Risks: "* Not supplied: r.",
    "Open Concerns": "+ Not supplied: o.",
    Assumptions: "Not supplied: a.",
    Decisions: "  - Not supplied: indented.",
  };
  const t = pub({ "club.md": doc(o1, {}, {}) }).text;
  const l1 = t.slice(t.indexOf("## Layer 1: Vision"), t.indexOf("## Layer 2: Structure"));
  const kept = [...l1.matchAll(/^### \d+\. (.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(kept, ["Need", "Target audience", "Value", "Focus", "Success measures", "Vocabulary"]);
  assert.ok(t.includes("## Layer 2: Structure\n\nScope: all.\n"), "a layer with every topic dropped keeps its heading and Scope");
});

test("publish: dropped and open lines", () => {
  const long = "x".repeat(100);
  const longOpen = "- Not supplied: how many members there are, counted by the end of the quarter, with the source.";
  const src = [
    "# Club", "",
    "## Layer 1: Vision", "", "Scope: all.", "",
    "### 1. Need", "", "- 1.1. Members need a shed.", longOpen, "",
    "### 3. Value", "", "Not supplied: the value.", "",
    "### 4. Focus", "", `Not supplied: ${long}`, "",
    "### 8. Costs", "", "None.", "",
    "### 9. Risks", "", "- Not supplied: a risk.", "- Not supplied: another.", "",
    "### 12. Decisions", "", "- 12.1. Write `Not supplied:` for gaps. Reason: r.", "",
    "## Layer 2: Structure", "", "Scope: all.", "",
    "### 1. Parts", "", "- 1.1. Shed (part): holds tools.", "",
  ].join("\n");
  tmp((dir) => {
    const f = put(dir, "club.md", src);
    const out = path.join(dir, "out.md");
    const c = cli("publish", f, "--out", out);
    assert.equal(c.code, 0, c.err);
    const outLines = get(out).split("\n");
    const n = outLines.indexOf(longOpen) + 1;
    assert.ok(n > 0);
    const cut = (s) => (s.length > 80 ? s.slice(0, 80) + "..." : s);
    assert.deepEqual(c.out.split("\n").filter(Boolean), [
      "dropped vision 3. Value: Not supplied: the value.",
      `dropped vision 4. Focus: ${cut("Not supplied: " + long)}`,
      "dropped vision 8. Costs: None.",
      "dropped vision 9. Risks: Not supplied: a risk. Not supplied: another.",
      `open ${out} line ${n}: ${cut(longOpen)}`,
      `published ${out}: 1 file(s), dropped 4 topic(s) (1 None., 3 Not supplied:), 1 open question(s) remain`,
    ]);
    assert.ok(cut(longOpen).endsWith("..."));
    assert.equal(runLint(out).out.match(/^INFO not-supplied: (\d+)$/m)[1], "1");
  });
});

test("publish: dangling citation", () => {
  const src = (need, extra = {}) => doc({ Need: need, "Success measures": "None.", ...extra }, undefined, undefined);
  const cite = "- 1.1. See vision-5.1 for the measure.";
  const lns = lines(src(cite));
  const n = lns.indexOf(cite) + 1;
  assert.throws(() => pub({ "club.md": src(cite) }), (e) => e.message === `club.md line ${n}: cites vision-5.1, which is in topic 5. Success measures of vision, left out of the published document (None.)`);
  assert.throws(() => pub({ "club.md": src(cite, { "Success measures": "Not supplied: the measure." }) }), /\(Not supplied:\)$/);
  // not an error: in a code span, in a fence, in a dropped topic, a kept topic
  assert.doesNotThrow(() => pub({ "club.md": src("- 1.1. See `vision-5.1`.") }));
  assert.doesNotThrow(() => pub({ "club.md": src("- 1.1. Fine.\n\n```\nvision-5.1\n```") }));
  assert.doesNotThrow(() => pub({ "club.md": src("- 1.1. Fine.", { Costs: "Not supplied: see vision-5.1." }) }));
  assert.doesNotThrow(() => pub({ "club.md": src("- 1.1. See vision-1.1.") }));
  // a detail.<part> citation is checked, across files
  const s = stack(["Shed"]);
  s["sbp-detail-shed.md"] = detail("Shed", { Responsibility: "Holds things. See detail.shed-4.1." });
  assert.throws(() => pub(s), /sbp-detail-shed\.md line \d+: cites detail\.shed-4\.1, which is in topic 4\. Rules of detail\.shed, left out/);
  const s2 = stack(["Shed"]);
  s2["sbp-structure.md"] = structure(["Shed"], { Standing: "- Shed: see detail.shed-4.1." });
  assert.throws(() => pub(s2), /sbp-structure\.md line \d+: cites detail\.shed-4\.1/);
  // the command writes nothing and prints one line per citation
  tmp((dir) => {
    const f = put(dir, "club.md", src(cite + "\n- 1.2. Also vision-5.2."));
    const out = path.join(dir, "out.md");
    const c = cli("publish", f, "--out", out);
    assert.equal(c.code, 2);
    assert.equal(c.err.trim().split("\n").length, 2);
    assert.match(c.err, /^strata-blueprints: .*club\.md line \d+: cites vision-5\.1, which is in topic 5/);
    assert.ok(!fs.existsSync(out));
  });
});

test("publish: input already condensed", () => {
  const s = stack(["Access", "Ledger"], "\n## View: One\n\nFirst.\n");
  const condensed = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, condenseText(v)]));
  assert.ok(Object.values(condensed).every((v) => v.startsWith(MARKER)));
  assert.equal(pub(condensed).text, pub(s).text);
  const d = doc({ Need: "N.", Value: "Not supplied: v." });
  assert.equal(pub({ "club.md": condenseText(d) }).text, pub({ "club.md": d }).text);
});

test("publish: input already published", () => {
  const s = stack(["Access"]);
  const p = pub(s).text;
  assert.throws(() => pub({ "club.md": p }), /club\.md is a published document; publish from the source files/);
  assert.throws(() => pub({ ...s, "sbp-detail-access.md": p }), /sbp-detail-access\.md is a published document; publish from the source files/);
  tmp((dir) => {
    const f = put(dir, "p.md", p);
    const out = path.join(dir, "out.md");
    const c = cli("publish", f, "--out", out);
    assert.equal(c.code, 2);
    assert.match(c.err, /is a published document/);
    assert.ok(!fs.existsSync(out));
    writeStack(path.join(dir, "src"), { ...s, "sbp-detail-access.md": p });
    assert.equal(cli("publish", path.join(dir, "src"), "--out", out).code, 2);
    assert.ok(!fs.existsSync(out));
  });
});

test("publish: marker lines of merged files", () => {
  const s = stack(["Access", "Ledger"]);
  const condensed = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, condenseText(v)]));
  const t = pub(condensed).text;
  assert.equal(lines(t).filter((l) => l.startsWith("<!-- strata-blueprints:")).length, 1);
  assert.equal(lines(t)[0], PUBLISHED_MARKER);
  assert.equal(lines(t)[1], "");
  assert.ok(!PUBLISHED_MARKER.includes("Not supplied:"));
  assert.ok(PUBLISHED_MARKER.startsWith("<!-- strata-blueprints: condensed"));
  // marker text on line 2 of an input is ordinary text and stays
  const odd = { ...s, "sbp-vision.md": s["sbp-vision.md"].replace("# Club\n", "# Club\n<!-- strata-blueprints: condensed (a note) -->\n") };
  const u = pub(odd).text;
  assert.equal(lines(u).filter((l) => l.startsWith("<!-- strata-blueprints:")).length, 2);
  assert.ok(u.includes("<!-- strata-blueprints: condensed (a note) -->"));
  // no marker line of an input is left in a later position
  assert.equal(lines(t).slice(1).some((l) => l === MARKER), false);
});

test("publish: numbers and ids kept", () => {
  const s = {
    "sbp-vision.md": vision({ Need: "- 1.1. Members need a shed.", Value: "- 3.1. A shed is held. Realizes vision-1.1.", Decisions: "- 12.1. Keep it. Reason: vision-1.1." }),
    "sbp-structure.md": structure(["Shed"], { Parts: "Shed (part): holds Shed.", "Seams between parts": "- 3.1. Seam. See vision-3.1 and detail.shed-1.1.", "Scenario paths": "- 6.1. Path. Realizes vision-3.1." }),
    "sbp-detail-shed.md": detail("Shed", { Responsibility: "- 1.1. Holds tools. Realizes vision-3.1.", Rules: "- 4.1. Lock it. See structure-3.1.", Decisions: "- 12.1. Keep. Reason: simple." }),
  };
  const r = pub(s);
  const keep = (text) => lines(text).filter((l) => /^\s*[-*]?\s*\**\d+\.\d+\./.test(l) || /\b(?:vision|structure|detail\.[a-z0-9]+)-\d+\.\d+/.test(l));
  const want = ["sbp-vision.md", "sbp-structure.md", "sbp-detail-shed.md"].flatMap((n) => keep(s[n]));
  assert.equal(want.length, 8);
  assert.deepEqual(keep(r.text), want);
  assert.ok(r.text.includes("### 9. Risks") === false);
});

test("publish: later file preamble and wrong layer", () => {
  const s = stack(["Access"]);
  const extra = { ...s, "sbp-structure.md": s["sbp-structure.md"].replace("# Club\n\n", "# Club\n\nExtra text.\n\n") };
  assert.throws(() => pub(extra), (e) => e.message === "sbp-structure.md: text before the first layer heading (line 3) cannot be merged; only the first file may hold it");
  const noTitle = { ...s, "sbp-structure.md": s["sbp-structure.md"].replace("# Club\n\n", "Extra text.\n\n") };
  assert.throws(() => pub(noTitle), /sbp-structure\.md: text before the first layer heading \(line 1\)/);
  // the first file may hold text, and a later title is dropped
  assert.doesNotThrow(() => pub({ ...s, "sbp-vision.md": s["sbp-vision.md"].replace("Status: Draft\n", "Status: Draft\n\nIntro text.\n") }));
  const wrong = { ...s, "sbp-vision.md": s["sbp-vision.md"] + "\n" + L2 + "### 1. Parts\n\n- A (part): a.\n" };
  assert.throws(() => pub(wrong), (e) => e.message === "sbp-vision.md: '## Layer 2: Structure' does not belong in sbp-vision.md, which holds Layer 1");
  assert.throws(() => pub({ ...s, "sbp-detail-access.md": detail("Access").replace("## Layer 3: Detail", "## Layer 1: Vision") }), /does not belong in sbp-detail-access\.md, which holds Layer 3/);
  // a single file input is exempt
  const all = doc();
  assert.doesNotThrow(() => pub({ "sbp-vision.md": all }, { single: true }));
  tmp((dir) => {
    const f = put(dir, "sbp-vision.md", all);
    const out = path.join(dir, "o.md");
    assert.equal(cli("publish", f, "--out", out).code, 0);
    assert.equal(get(out), pub({ [f]: all }, { single: true }).text);
    writeStack(path.join(dir, "src"), { "sbp-vision.md": all });
    const c = cli("publish", path.join(dir, "src"), "--out", path.join(dir, "o2.md"));
    assert.equal(c.code, 2);
    assert.match(c.err, /does not belong in .*sbp-vision\.md, which holds Layer 1/);
  });
});

test("publish: output safety", () => {
  const s = stack(["Access"]);
  tmp((dir) => {
    const src = path.join(dir, "src");
    writeStack(src, s);
    const before = Object.fromEntries(Object.keys(s).map((n) => [n, get(path.join(src, n))]));
    const same = () => { for (const n of Object.keys(s)) assert.equal(get(path.join(src, n)), before[n]); };
    const refuses = (args, re) => { const c = cli("publish", ...args); assert.equal(c.code, 2, c.out); assert.match(c.err, re); return c; };
    // out is the input file
    const single = path.join(src, "sbp-vision.md");
    refuses([single, "--out", single, "--force"], /overlaps the input/);
    // out inside the input folder, and out as a parent of the input
    refuses([src, "--out", path.join(src, "out.md")], /overlaps the input/);
    assert.ok(!fs.existsSync(path.join(src, "out.md")));
    refuses([src, "--out", dir], /overlaps the input/);
    // an existing directory
    const d = path.join(dir, "adir"); fs.mkdirSync(d);
    refuses([src, "--out", d], /is a folder; give a file path/);
    // a symlink
    const target = put(dir, "target.md", "keep me\n");
    const link = path.join(dir, "link.md"); fs.symlinkSync(target, link);
    refuses([src, "--out", link, "--force"], /is a symlink/);
    assert.equal(get(target), "keep me\n");
    // an existing file without a marker
    const plain = put(dir, "plain.md", "mine\n");
    refuses([src, "--out", plain], /not a condensed copy|use --force/);
    assert.equal(get(plain), "mine\n");
    // with a marker it is overwritten; with --force too
    const marked = put(dir, "marked.md", MARKER + "\n\nold\n");
    assert.equal(cli("publish", src, "--out", marked).code, 0);
    assert.equal(lines(get(marked))[0], PUBLISHED_MARKER);
    assert.equal(cli("publish", src, "--out", marked).code, 0, "a published file is replaced too");
    assert.equal(cli("publish", src, "--out", plain, "--force").code, 0);
    assert.equal(lines(get(plain))[0], PUBLISHED_MARKER);
    // the parent is created
    const deep = path.join(dir, "a", "b", "out.md");
    assert.equal(cli("publish", src, "--out", deep).code, 0);
    assert.ok(fs.existsSync(deep));
    same();
    // a failure writes nothing
    put(src, "sbp-detail-bad.md", "");
    const out2 = path.join(dir, "never.md");
    refuses([src, "--out", out2], /no layer heading found/);
    assert.ok(!fs.existsSync(out2));
    assert.deepEqual(fs.readdirSync(dir).sort(), ["a", "adir", "link.md", "marked.md", "plain.md", "src", "target.md"]);
  });
});

test("publish: deterministic", () => {
  const s = stack(["Access", "Ledger"], "\n## View: One\n\nFirst.\n");
  const a = pub(s), b = pub(s);
  assert.equal(a.text, b.text);
  assert.deepEqual(a, b);
  const rev = Object.fromEntries(Object.entries(s).reverse());
  assert.equal(pub(rev).text, a.text);
  tmp((dir) => {
    writeStack(path.join(dir, "src"), s);
    const o1 = path.join(dir, "1.md"), o2 = path.join(dir, "2.md");
    const c1 = cli("publish", path.join(dir, "src"), "--out", o1), c2 = cli("publish", path.join(dir, "src"), "--out", o2);
    assert.equal(get(o1), get(o2));
    assert.equal(c1.out.replaceAll(o1, "X"), c2.out.replaceAll(o2, "X"));
  });
});

test("publish: usage and exit codes", () => {
  const none = cli();
  assert.equal(none.code, 0);
  assert.match(none.lines[0], /^usage: /);
  assert.ok(none.lines.some((l) => /publish <file\.md or folder> --out <file>/.test(l)));
  tmp((dir) => {
    const f = put(dir, "club.md", doc());
    const out = path.join(dir, "out.md");
    const g = put(dir, "two.md", doc());
    for (const [args, re] of [
      [["publish", f], /needs --out/],
      [["publish", f, "--bogus", "--out", out], /unknown option/],
      [["publish", f, g, "--out", out], /give one file or folder/],
      [["publish", path.join(dir, "missing.md"), "--out", out], /no such file/],
      [["publish", "--out", out], /needs a file or a folder/],
      [["publish", f, "--out"], /--out needs a path/],
      [["frob", f, "--out", out], /unknown subcommand/],
    ]) {
      const c = cli(...args);
      assert.equal(c.code, 2, args.join(" "));
      assert.match(c.err, /^strata-blueprints: /);
      assert.match(c.err, re);
      assert.ok(!fs.existsSync(out));
    }
    assert.equal(cli("publish", f, "--out", out).code, 0);
  });
});

test("publish: marker prefix and id pattern match the lint", () => {
  const src = get(lint);
  const prefix = src.match(/const MARKER_PREFIX = "([^"]+)"/)[1];
  const idcore = src.match(/const IDCORE = String\.raw`([^`]+)`/)[1];
  assert.ok(MARKER.startsWith(prefix));
  assert.ok(PUBLISHED_MARKER.startsWith(prefix));
  assert.equal(T.IDCORE, idcore);
});

test("publish: shipped examples lint strict and impact", () => {
  const todo = path.join(refs, "strata-blueprints-example-todo-app");
  const inputs = [path.join(refs, "strata-blueprints-example.md"), path.join(refs, "strata-blueprints-example-rfp.md"), todo];
  tmp((dir) => {
    for (const [i, input] of inputs.entries()) {
      const out = path.join(dir, `p${i}.md`);
      const c = cli("publish", input, "--out", out);
      assert.equal(c.code, 0, c.err);
      const l = runLint(out, "--strict");
      assert.equal(l.code, 0, l.out);
      assert.match(l.out, /0 warning\(s\)/);
      const notSupplied = +l.out.match(/^INFO not-supplied: (\d+)$/m)[1];
      assert.equal(+c.lines.at(-1).match(/(\d+) open question\(s\) remain$/)[1], notSupplied);
      assert.deepEqual(linkProblems(get(out)), []);
      assert.ok(!/^None\.$/m.test(get(out)));
      assert.equal(headingsOf(get(out), /^## Contents$/).length, 1);
    }
    const imp = (x) => runLint("--impact", "vision-3.3", x);
    const a = imp(todo), b = imp(path.join(dir, "p2.md"));
    assert.equal(a.code, 0); assert.equal(b.code, 0, b.out + b.err);
    assert.match(b.lines.at(-1), /^INFO impact:/);
    assert.equal(b.lines.at(-1), a.lines.at(-1));
  });
});

test("publish: a topic with an empty body is neither None. nor Not supplied:, so it stays", () => {
  const d = doc({ Need: "N.", Value: "" });
  const empty = d.replace(/(### 3\. Value\n)\n+(?=### 4\.)/, "$1\n");
  assert.ok(/### 3\. Value\n\n### 4\./.test(empty), "fixture has an empty Value body");
  const p = pub({ "club.md": empty });
  assert.ok(p.text.includes("### 3. Value"), "empty topic is kept");
  assert.ok(!p.dropped.some((x) => /Value/.test(JSON.stringify(x))), "empty topic is not listed as dropped");
  assert.ok(condenseText(empty).includes("### 3. Value"), "condense keeps it too");
});

test("condense: a published document as input is refused, exit 2, nothing written", () => {
  tmp((dir) => {
    const f = put(dir, "p.md", pub(stack(["Access"])).text);
    const out = path.join(dir, "out.md");
    const c = cli("condense", f, "--out", out);
    assert.equal(c.code, 2);
    assert.match(c.err, /p\.md is a published document; condense the source files/);
    assert.ok(!fs.existsSync(out));
    const s = path.join(dir, "src"); writeStack(s, { ...stack(["Access"]), "sbp-detail-access.md": get(f) });
    const o2 = path.join(dir, "outdir");
    assert.equal(cli("condense", s, "--out", o2).code, 2);
    assert.ok(!fs.existsSync(path.join(o2, "sbp-vision.md")), "nothing written for a folder");
  });
});

test("docs/example-published.md equals the tool's published output for the to-do example", () => {
  const regen = "node skills/strata-blueprints/scripts/strata-blueprints.mjs publish skills/strata-blueprints/references/strata-blueprints-example-todo-app --out docs/example-published.md";
  const committed = process.env.STRATA_PUBLISHED_DOC ? path.resolve(process.env.STRATA_PUBLISHED_DOC) : path.join(here, "..", "docs", "example-published.md");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-published-doc-"));
  try {
    const out = path.join(dir, "example-published.md");
    const c = cli("publish", path.join(refs, "strata-blueprints-example-todo-app"), "--out", out);
    assert.equal(c.code, 0, c.err);
    assert.ok(get(committed) === get(out), `docs/example-published.md differs from the tool's output; regenerate it with: ${regen}`);
    assert.ok(get(committed).startsWith(PUBLISHED_MARKER), "file starts with the published marker");
    const l = runLint(committed, "--strict");
    assert.equal(l.code, 0, l.out + l.err);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("publish: Status comes from the Vision's Blueprint status when it has one", () => {
  const s = stack(["Access"]);
  const withBp = { ...s, "sbp-vision.md": s["sbp-vision.md"].replace("Status: Draft\n", "Status: Review\nBlueprint status: Approved\n") };
  const r = pub(withBp);
  assert.equal(headingsOf(r.text, /^Status: /).length, 1);
  assert.equal(headingsOf(r.text, /^Status: /)[0], "Status: Approved");
  assert.equal(headingsOf(r.text, /^Blueprint status:/).length, 0);
  assert.equal(headingsOf(r.text, /^Version: /).length, 1);
  const plain = pub({ ...s, "sbp-vision.md": s["sbp-vision.md"].replace("Status: Draft\n", "Status: Review\n") });
  assert.deepEqual(headingsOf(plain.text, /^Status: /), ["Status: Review"]);
});

test("publish and condense: Status, Version and Parent in the top matter of every file are accepted; one Status is published", () => {
  const s = stack(["Access"]);
  const withMeta = {
    ...s,
    "sbp-vision.md": s["sbp-vision.md"].replace("Version: 1.0\nStatus: Draft\n", "Version: 1.0\nBlueprint status: Approved\nStatus: Review\n"),
    "sbp-structure.md": s["sbp-structure.md"].replace("# Club\n\n", "# Club\n\nStatus: Draft\nVersion: 0.2\nParent: Org\n\n"),
    "sbp-detail-access.md": s["sbp-detail-access.md"].replace("# Club\n\n", "# Club\n\nStatus: Review\n\n"),
  };
  const r = pub(withMeta);
  assert.deepEqual(headingsOf(r.text, /^Status: /), ["Status: Approved"]);
  assert.equal(headingsOf(r.text, /^Version: /).length, 1);
  assert.equal(headingsOf(r.text, /^Parent: /).length, 0);
  for (const [n, t] of Object.entries(withMeta)) {
    const c = condenseText(t);
    assert.deepEqual(c.split("\n").filter((l) => /^(Status|Version|Parent):/.test(l)), t.split("\n").filter((l) => /^(Status|Version|Parent):/.test(l)), n);
  }
  tmp((dir) => {
    const out = path.join(dir, "pub.md");
    const c = cli("publish", writeStack(path.join(dir, "src"), withMeta), "--out", out);
    assert.equal(c.code, 0, c.err);
    const l = runLint(out, "--strict");
    assert.equal(l.code, 0, l.out);
    assert.match(l.lines.at(-1), /^strata-blueprints-lint: 0 warning\(s\)$/);
  });
});

test("publish: a double-backtick span around an id is not a citation", () => {
  const src = (need) => doc({ Need: need, "Success measures": "None." });
  assert.doesNotThrow(() => pub({ "club.md": src("- 1.1. See ``vision-5.1`` for the measure.") }));
  assert.doesNotThrow(() => pub({ "club.md": src("- 1.1. See `vision-5.1` for the measure.") }));
  assert.throws(() => pub({ "club.md": src("- 1.1. See vision-5.1 for the measure.") }), /cites vision-5\.1, which is in topic 5/);
});

test("publish: Not supplied inside a double-backtick span is not an open question", () => {
  const q = (need) => pub({ "club.md": doc({ Need: need }) }).questions;
  assert.equal(q("- 1.1. Write ``Not supplied: x`` in the text."), 0);
  assert.equal(q("- 1.1. Write `Not supplied: x` in the text."), 0);
  assert.equal(q("- 1.1. Not supplied: x."), 1);
});

test("publish: an id after an inner three-backtick row in a four-backtick fence stays hidden", () => {
  const src = (need) => doc({ Need: need, "Success measures": "None." });
  assert.doesNotThrow(() => pub({ "club.md": src("- 1.1. Ok.\n\n````\n```\nvision-5.1\n````") }));
  assert.throws(() => pub({ "club.md": src("- 1.1. Ok.\n\n````\n```\nx\n````\n\nSee vision-5.1.") }), /cites vision-5\.1, which is in topic 5/);
});

test("ordered: detail files follow numbered Parts", () => {
  // Parts names Zulu before Mike before Bravo (bold, numbered); an identity number strip cannot match the part names, so the order falls back to file names.
  const numbered = (names) => names.map((p, i) => `- 1.${i + 1}. ${i === 2 ? `**${p}**` : p} (part): holds ${p}.`).join("\n");
  const files = {
    "sbp-detail-alpha.md": detail("Alpha"),
    "sbp-detail-bravo.md": detail("Bravo"),
    "sbp-detail-mike.md": detail("Mike"),
    "sbp-detail-zulu.md": detail("Zulu"),
    "sbp-structure.md": "# Club\n\n" + L2 + fxT("###", T2, { Parts: numbered(["Zulu", "Mike", "Bravo"]) }),
    "sbp-vision.md": vision(),
  };
  assert.deepEqual(partNames(pub(files).text), ["Zulu", "Mike", "Bravo", "Alpha"]);
});
