// SPDX-License-Identifier: MIT
// Tests for strata-blueprints.mjs (condense). Run: node --test tests/strata-blueprints-tool.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARKER, TOPICS, NAMES, condenseText } from "../skills/strata-blueprints/scripts/strata-blueprints.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.join(here, "..", "skills", "strata-blueprints", "scripts");
const tool = path.join(scripts, "strata-blueprints.mjs");
const lint = path.join(scripts, "strata-blueprints-lint.mjs");
const refs = path.join(here, "..", "skills", "strata-blueprints", "references");

const cli = (...args) => { const r = spawnSync(process.execPath, [tool, ...args], { encoding: "utf8" }); return { out: r.stdout, err: r.stderr, code: r.status, lines: r.stdout.split("\n").filter(Boolean) }; };
const runLint = (...args) => { const r = spawnSync(process.execPath, [lint, ...args], { encoding: "utf8" }); return { out: r.stdout, code: r.status, lines: r.stdout.split("\n").filter(Boolean) }; };
function tmp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "strata-blueprints-tool-"));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const put = (dir, name, text) => { const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text); return f; };
const get = (f) => fs.readFileSync(f, "utf8");

const T1 = TOPICS[1], T2 = TOPICS[2], T3 = TOPICS[3];
const fxT = (h, names, have = {}) => names.map((n, i) => `${h} ${i + 1}. ${n}\n\n${have[n] ?? "None."}\n`).join("\n");
const L1 = "## Layer 1: Vision\n\nScope: all.\n\n";
const L2 = "## Layer 2: Structure\n\nScope: all.\n\n";
const L3 = "## Layer 3: Detail\n\nScope: one part.\n\n";
// A canonical document: every topic block is heading, blank, body, blank; the last block has no trailing blank.
const doc = (o1 = { Need: "N.", Decisions: "- 12.1. Keep it. Reason: simple." }, o2 = { Parts: "- Shed (part): holds tools." }, o3 = { Responsibility: "Holds tools." }) =>
  "# Club\n\n" + L1 + fxT("###", T1, o1) + "\n" + L2 + fxT("###", T2, o2) + "\n" + L3 + "### Shed (part)\n\n" + fxT("####", T3, o3);
const topicNames = (text) => [...text.matchAll(/^#{3,4} \d+\. (.+)$/gm)].map((m) => m[1]);

test("edge: CRLF", () => {
  const lf = doc();
  const crlf = lf.replace(/\n/g, "\r\n");
  const c = condenseText(crlf);
  assert.ok(c.startsWith(MARKER + "\r\n\r\n"));
  assert.equal(c.replace(/\r\n/g, ""), c.replace(/\r\n/g, "").replace(/[\r\n]/g, ""), "no bare line feed");
  assert.equal(/(?<!\r)\n/.test(c), false);
  assert.equal(c, condenseText(lf).replace(/\n/g, "\r\n"));
  // A mixed file is written all CRLF.
  const mixed = lf.replace("# Club\n", "# Club\r\n");
  assert.equal(/(?<!\r)\n/.test(condenseText(mixed)), false);
});

test("edge: empty file", () => {
  for (const text of ["", "   \n\n", "# Title\n\nSome text.\n", "## Layer 4: Vision\n\nScope: x.\n"]) {
    assert.throws(() => condenseText(text), /no layer heading found/);
  }
  tmp((d) => {
    const f = put(d, "empty.md", "");
    const out = path.join(d, "out.md");
    const r = cli("condense", f, "--out", out);
    assert.equal(r.code, 2);
    assert.equal(r.err.trim(), `strata-blueprints: ${f}: no layer heading found`);
    assert.equal(fs.existsSync(out), false);
    const empty = path.join(d, "stack"); fs.mkdirSync(empty); put(empty, "notes.md", "x");
    const r2 = cli("condense", empty, "--out", path.join(d, "o2"));
    assert.equal(r2.code, 2);
    assert.match(r2.err, /no sbp-vision\.md, sbp-structure\.md or sbp-detail-\*\.md in /);
    assert.equal(fs.existsSync(path.join(d, "o2")), false);
  });
});

test("edge: None. plus other text", () => {
  const keep = { Need: "None.\n\nBut also this.", "Target audience": "- None.", Value: "**None.**", Focus: "None", "Success measures": "```\nNone.\n```", Vocabulary: "none." };
  const c = condenseText(doc(keep));
  for (const n of ["Need", "Target audience", "Value", "Focus", "Success measures", "Vocabulary"]) assert.ok(topicNames(c).includes(n), n);
  assert.ok(!topicNames(c).includes("Qualities and constraints"));
  assert.ok(c.includes("None.\n\nBut also this."));
});

test("edge: Not supplied anywhere", () => {
  const o = { Need: "Not supplied: who pays.", Focus: "None.\n\nNot supplied: scope.", Risks: "- 9.1. A risk.\n\nNot supplied: odds." };
  const c = condenseText(doc(o));
  assert.deepEqual(topicNames(c).slice(0, 3), ["Need", "Focus", "Risks"]);
  assert.equal((c.match(/Not supplied:/g) || []).length, 3);
});

test("edge: stack of several files", () => {
  tmp((d) => {
    const src = path.join(d, "src"), out = path.join(d, "out");
    const h = (n) => `# Club\n\n## Layer ${n}: ${NAMES[n - 1]}\n\nScope: all.\n\n`;
    const files = {
      "sbp-vision.md": h(1) + fxT("###", T1, { Need: "N." }),
      "sbp-structure.md": h(2) + fxT("###", T2, { Parts: "- Shed (part): tools." }),
      "sbp-detail-shed.md": h(3) + "### Shed (part)\n\n" + fxT("####", T3, { Responsibility: "R." }),
      "sbp-detail-full.md": h(3) + "### Full (part)\n\n" + fxT("####", T3, Object.fromEntries(T3.map((n) => [n, "Text."]))),
    };
    for (const [n, t] of Object.entries(files)) put(src, n, t);
    put(src, "README.md", "readme"); put(src, "notes/other.md", "other");
    put(out, "stale.md", "stale");
    const r = cli("condense", src, "--out", out);
    assert.equal(r.code, 0);
    assert.deepEqual(fs.readdirSync(out).sort(), [...Object.keys(files), "stale.md"].sort());
    assert.equal(get(path.join(out, "stale.md")), "stale");
    assert.deepEqual(r.lines, [
      `condensed ${path.join(out, "sbp-vision.md")}: dropped 11 topic(s)`,
      `condensed ${path.join(out, "sbp-structure.md")}: dropped 10 topic(s)`,
      `condensed ${path.join(out, "sbp-detail-full.md")}: dropped 0 topic(s)`,
      `condensed ${path.join(out, "sbp-detail-shed.md")}: dropped 11 topic(s)`,
    ]);
    for (const n of Object.keys(files)) { assert.ok(get(path.join(out, n)).startsWith(MARKER + "\n\n"), n); assert.equal(get(path.join(src, n)), files[n]); }
  });
});

test("edge: single file", () => {
  tmp((d) => {
    const f = put(d, "bp.md", doc());
    const out = path.join(d, "copy", "bp-short.md");
    const r = cli("condense", f, "--out", out);
    assert.equal(r.code, 0);
    assert.equal(r.out, `condensed ${out}: dropped 31 topic(s)\n`);
    assert.ok(fs.statSync(out).isFile());
    assert.equal(get(f), doc());
    assert.equal(get(out), condenseText(doc()));
  });
});

test("edge: part sections", () => {
  const some = "# C\n\n" + L3 + "### Shed (part)\n\n" + fxT("####", T3, { Responsibility: "R.", Rules: "- 4.1. A rule." }) + "\n### Rota (part)\n\n" + fxT("####", T3);
  const c = condenseText(some);
  assert.deepEqual(topicNames(c), ["Responsibility", "Rules"]);
  assert.ok(c.includes("### Rota (part)"), "an entry with every topic dropped stays");
  assert.ok(c.includes("#### 4. Rules"));
  // A Layer 3 with no entry but numbered topics is condensed.
  const noEntry = L3 + fxT("###", T3, { Rules: "- 4.1. A rule." });
  const nc = condenseText(noEntry);
  assert.deepEqual(topicNames(nc), ["Rules"]);
});

test("edge: condense twice", () => {
  const c = condenseText(doc());
  assert.equal(condenseText(c), c);
  assert.equal(c.split("\n").filter((l) => l.startsWith("<!--")).length, 1);
  assert.equal(condenseText(doc()), c, "condense is deterministic");
});

test("edge: edit after condense", () => {
  const c = condenseText(doc());
  const edited = c.replace("N.", "A new need.").replace("### 12. Decisions", "### 7. Vocabulary\n\nNone.\n\n### 12. Decisions");
  assert.ok(edited.includes("A new need."));
  assert.equal(condenseText(edited).includes("### 7. Vocabulary"), false, "a hand-added None. topic is dropped again");
  tmp((d) => {
    const f = put(d, "src.md", doc()); const out = path.join(d, "copy.md");
    assert.equal(cli("condense", f, "--out", out).code, 0);
    put(d, "src.md", doc({ Need: "Changed." }));
    assert.equal(cli("condense", f, "--out", out).code, 0, "a marked copy is regenerated without --force");
    assert.ok(get(out).includes("Changed."));
  });
});

test("edge: fences and views", () => {
  const fenced = "# C\n\n" + L1 + "### 1. Need\n\n```\n### 2. Target audience\n\nNone.\n```\n\n### 2. Target audience\n\nNone.\n\n### 3. Value\n\nTitle: x\n\n~~~\n## Layer 2: Structure\n~~~\n\n" + L2 + "### 1. Parts\n\nP.\n\n## View: Flow\n\n### 1. Need\n\nNone.\n";
  const c = condenseText(fenced);
  assert.ok(c.includes("```\n### 2. Target audience\n\nNone.\n```"));
  assert.ok(c.includes("## View: Flow\n\n### 1. Need\n\nNone.\n"), "a view is untouched");
  assert.ok(!c.includes("\n### 2. Target audience\n\nNone.\n\n### 3."));
  assert.ok(c.includes("### 3. Value"));
});

test("edge: unknown topics", () => {
  const t = "# C\n\n" + L1 + "### 1. Need\n\nN.\n\n### 3. Whatever\n\nNone.\n\n### 5. Costs\n\nNone.\n\n";
  const c = condenseText(t + L2 + "### 1. Parts\n\nP.\n");
  assert.ok(c.includes("### 3. Whatever\n\nNone."), "unknown name is never touched");
  assert.ok(!c.includes("### 5. Costs"), "a known name with a wrong number is a topic and is dropped");
});

test("edge: output safety", () => {
  tmp((d) => {
    const body = doc();
    const f = put(d, "src.md", body);
    const refuse = (args, msg) => { const r = cli(...args); assert.equal(r.code, 2, args.join(" ")); assert.match(r.err, /^strata-blueprints: /); if (msg) assert.match(r.err, msg); return r; };
    refuse(["condense", f, "--out", f], /overlaps/);
    assert.equal(get(f), body);
    refuse(["condense", f, "--out", path.join(d, "sub", "..", "src.md")]);
    // A folder: out is the input, inside it, or a parent of it.
    const stack = path.join(d, "stack"); put(stack, "sbp-vision.md", L1 + fxT("###", T1));
    refuse(["condense", stack, "--out", stack], /overlaps/);
    refuse(["condense", stack, "--out", path.join(stack, "inner")], /overlaps/);
    refuse(["condense", stack, "--out", d], /overlaps/);
    assert.deepEqual(fs.readdirSync(stack), ["sbp-vision.md"]);
    // A symlink to the input.
    const link = path.join(d, "link.md"); fs.symlinkSync(f, link);
    refuse(["condense", f, "--out", link]);
    assert.equal(get(f), body);
    const dirLink = path.join(d, "dirlink"); fs.symlinkSync(stack, dirLink);
    refuse(["condense", stack, "--out", dirLink]);
    refuse(["condense", stack, "--out", path.join(dirLink, "x")], /overlaps/);
    // Folder against file mismatches.
    const plain = put(d, "plain.md", "x");
    refuse(["condense", stack, "--out", plain], /file/);
    refuse(["condense", f, "--out", stack], /folder/);
    // An existing unmarked file is refused until --force; a marked one is overwritten.
    const target = put(d, "target.md", "mine\n");
    refuse(["condense", f, "--out", target], /--force/);
    assert.equal(get(target), "mine\n");
    assert.equal(cli("condense", f, "--out", target, "--force").code, 0);
    assert.ok(get(target).startsWith(MARKER));
    assert.equal(cli("condense", f, "--out", target).code, 0);
    // One bad file in a folder writes nothing.
    const bad = path.join(d, "bad"); put(bad, "sbp-vision.md", L1 + fxT("###", T1)); put(bad, "sbp-detail-x.md", "no layers here\n");
    const bout = path.join(d, "bout");
    refuse(["condense", bad, "--out", bout], /no layer heading found/);
    assert.equal(fs.existsSync(bout), false);
    // A symlinked target file inside the out folder.
    const o2 = path.join(d, "o2"); fs.mkdirSync(o2); fs.symlinkSync(f, path.join(o2, "sbp-vision.md"));
    refuse(["condense", stack, "--out", o2], /symlink/);
    assert.equal(get(f), body);
  });
});

test("edge: condense is deterministic", () => {
  const cases = [doc(), doc({}), doc({ Need: "N.", Costs: "- 8.1. Given a, when b, then c." }, { Parts: "P.", Decisions: "- 11.1. D." }, { Rules: "- 4.1. R.", Decisions: "- 12.1. D." }),
    doc(Object.fromEntries(T1.map((n) => [n, "Text."])), Object.fromEntries(T2.map((n) => [n, "Text."])), Object.fromEntries(T3.map((n) => [n, "Text."])))];
  for (const x of cases) {
    const c = condenseText(x);
    assert.equal(condenseText(x), c);
    assert.equal(condenseText(c), c);
  }
});

test("edge: topic lists match the lint", () => {
  const src = fs.readFileSync(lint, "utf8");
  const literal = (name) => new Function(`return (${src.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`))[1]});`)();
  assert.deepEqual(TOPICS, literal("TOPICS"));
  assert.deepEqual(NAMES, literal("NAMES"));
});

test("tool: usage and exit codes", () => {
  const none = cli();
  assert.equal(none.code, 0);
  assert.match(none.lines[0], /^usage: /);
  tmp((d) => {
    const f = put(d, "a.md", doc()), out = path.join(d, "o.md");
    const bad = (args, msg) => { const r = cli(...args); assert.equal(r.code, 2, args.join(" ")); assert.equal(r.out, ""); assert.match(r.err, new RegExp(`^strata-blueprints: ${msg}`)); };
    bad(["frobnicate", f], "unknown subcommand");
    bad(["condense", f], "condense needs --out");
    bad(["condense", "--out", out], "condense needs a file");
    bad(["condense", f, "--out"], "--out needs a path");
    bad(["condense", f, "--out", out, "--wat"], "unknown option");
    bad(["condense", path.join(d, "missing.md"), "--out", out], "no such file");
    bad(["condense", f, f, "--out", out], "give one file");
    assert.equal(fs.existsSync(out), false);
    assert.equal(cli("condense", f, "--out", out).code, 0);
  });
});

const examples = [
  ["garden", path.join(refs, "strata-blueprints-example.md")],
  ["rfp", path.join(refs, "strata-blueprints-example-rfp.md")],
  ["todo app", path.join(refs, "strata-blueprints-example-todo-app")],
];
const filesOf = (p) => (fs.statSync(p).isDirectory() ? fs.readdirSync(p).filter((n) => /^sbp-.+\.md$/.test(n)).map((n) => path.join(p, n)) : [p]);

test("tool: condensing each shipped example writes the marker, is deterministic and leaves the source alone", () => {
  for (const [name, src] of examples) tmp((d) => {
    const copy = path.join(d, "copy"), again = path.join(d, "again");
    const before = filesOf(src).map(get);
    assert.equal(cli("condense", src, "--out", copy).code, 0, name);
    assert.equal(cli("condense", src, "--out", again).code, 0, name);
    assert.deepEqual(filesOf(src).map(get), before, `${name}: source unchanged`);
    for (const f of filesOf(src)) {
      const rel = fs.statSync(src).isDirectory() ? path.basename(f) : "";
      assert.ok(get(path.join(copy, rel)).startsWith(MARKER + "\n\n"), name);
      assert.equal(get(path.join(copy, rel)), get(path.join(again, rel)), name);
    }
  });
});

test("tool: condensed examples lint --strict clean and keep the same INFO not-supplied count", () => {
  const info = (r) => r.lines.find((l) => l.startsWith("INFO not-supplied"));
  for (const [name, src] of examples) tmp((d) => {
    const copy = path.join(d, "copy");
    assert.equal(cli("condense", src, "--out", copy).code, 0, name);
    const c = runLint(copy, "--strict");
    assert.equal(c.code, 0, `${name}: ${c.out}`);
    assert.equal(info(c), info(runLint(src)), name);
  });
});

test("span rule: the lint and the tool carry the same clean line", () => {
  const line = (f) => get(f).split("\n").filter((l) => l.startsWith("const clean = "));
  const a = line(lint), b = line(tool);
  assert.equal(a.length, 1);
  assert.deepEqual(b, a);
});
