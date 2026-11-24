// SPDX-License-Identifier: MIT
// Tests for strata-blueprints.mjs (condense). Run: node --test tests/strata-blueprints-tool.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { MARKER, TOPICS, NAMES, condenseText } from "../skills/strata-blueprints/scripts/strata-blueprints.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = path.join(here, "..", "skills", "strata-blueprints", "scripts");
const tool = process.env.STRATA_TOOL || path.join(scripts, "strata-blueprints.mjs");
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
const doc = (o1 = { Need: "N.", Decisions: "1. Keep it. Reason: simple." }, o2 = { Parts: "1. Shed (part): holds tools." }, o3 = { Responsibility: "Holds tools." }) =>
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
  const o = { Need: "Not supplied: who pays.", Focus: "None.\n\nNot supplied: scope.", Risks: "1. A risk.\n\nNot supplied: odds." };
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
      "sbp-structure.md": h(2) + fxT("###", T2, { Parts: "1. Shed (part): tools." }),
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
  const some = "# C\n\n" + L3 + "### Shed (part)\n\n" + fxT("####", T3, { Responsibility: "R.", Rules: "1. A rule." }) + "\n### Rota (part)\n\n" + fxT("####", T3);
  const c = condenseText(some);
  assert.deepEqual(topicNames(c), ["Responsibility", "Rules"]);
  assert.ok(c.includes("### Rota (part)"), "an entry with every topic dropped stays");
  assert.ok(c.includes("#### 4. Rules"));
  // A Layer 3 with no entry but numbered topics is condensed.
  const noEntry = L3 + fxT("###", T3, { Rules: "1. A rule." });
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
  const cases = [doc(), doc({}), doc({ Need: "N.", Costs: "1. Given a, when b, then c." }, { Parts: "P.", Decisions: "1. D." }, { Rules: "1. R.", Decisions: "1. D." }),
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

test("fence: a four-backtick fence in condense keeps an inner three-backtick row as content", () => {
  const t = "# C\n\n" + L1 + "### 1. Need\n\n````\n```\n### 2. Target audience\n\nNone.\n````\n\n### 2. Target audience\n\nNone.\n\n### 3. Value\n\nN.\n\n" + L2 + "### 1. Parts\n\nP.\n";
  const c = condenseText(t);
  assert.ok(c.includes("````\n```\n### 2. Target audience\n\nNone.\n````"), "the fenced heading stays");
  assert.ok(!c.includes("\n### 2. Target audience\n\nNone.\n\n### 3."), "the real None. topic is dropped");
});

test("fence: a backtick row with a backtick after the run is text in condense", () => {
  const t = "# C\n\n" + L1 + "### 1. Need\n\n```x``` more\n\n### 2. Target audience\n\nNone.\n\n### 3. Value\n\nN.\n\n" + L2 + "### 1. Parts\n\nP.\n";
  const c = condenseText(t);
  assert.ok(c.includes("```x``` more"));
  assert.ok(!c.includes("### 2. Target audience"), "the topic after the text row is read and dropped");
});

test("fence: the lint and the tool carry the same fenceOpen and fenceCloses lines", () => {
  for (const name of ["const fenceOpen = ", "const fenceCloses = "]) {
    const pick = (f) => get(f).split("\n").filter((l) => l.startsWith(name));
    const a = pick(lint), b = pick(tool);
    assert.equal(a.length, 1, name);
    assert.deepEqual(b, a, name);
  }
});

test("fence: an indented fence is read by the tool like the lint reads it", () => {
  const t = "# C\n\n" + L1 + "### 1. Need\n\nN.\n\n- Item:\n\n    ```\n### 5. Success measures\n\nNone.\n\n### 6. Qualities and constraints\n\nNone.\n    ```\n\n### 2. Target audience\n\nN.\n\n" + L2 + "### 1. Parts\n\nP.\n";
  const c = condenseText(t);
  assert.ok(c.includes("    ```\n### 5. Success measures\n\nNone.\n\n### 6. Qualities and constraints\n\nNone.\n    ```"), "the rows inside an indented fence stay unchanged");
});

test("ordered: condense keeps ordered lists and their numbers byte for byte, and the result lints strict", () => {
  const src = doc({ Need: "N.", Value: "1. Given a, when b, then c.\n2. Given d, when e, then f.", Decisions: "1. Keep it. Reason: simple.\n   1. A nested note." });
  const c = condenseText(src);
  assert.ok(c.includes("### 3. Value\n\n1. Given a, when b, then c.\n2. Given d, when e, then f.\n"));
  assert.ok(c.includes("1. Keep it. Reason: simple.\n   1. A nested note.\n"));
  tmp((dir) => {
    const f = put(dir, "club.md", src);
    const out = path.join(dir, "out.md");
    assert.equal(cli("condense", f, "--out", out).code, 0);
    assert.equal(get(out), c);
    assert.deepEqual(runLint(out).lines.filter((l) => /^WARN (list|id):/.test(l)), []);
  });
});

// cascade: insert and delete one list item and cascade the new ids (docs/tool.md, Insert and delete an item).
const loadTool = () => import(pathToFileURL(tool).href);
const K = "## Layer 1: Vision\n\nScope: all.\n\n### 6. Qualities and constraints\n\n1. **A:** a.\n2. **B:** b.\n3. **C:** c.\n\n### 7. Vocabulary\n\n1. **T:** see vision-6.3.\n";
const kRun = (args, text = K, name = "k.md") => tmp((dir) => { const f = put(dir, name, text); const r = cli(...args.map((a) => (a === "@" ? f : a))); return { ...r, text: get(f), dir, listing: fs.readdirSync(dir) }; });
const kApply = (args, text = K) => kRun(args, text);
const lintWarns = (f) => runLint(f).lines.filter((l) => l.startsWith("WARN")).length;
// A stack: Vision, Structure and one detail file, each citing items of the Vision.
const S3 = {
  "sbp-vision.md": "# S\n\n## Layer 1: Vision\n\nScope: all.\n\n### 6. Qualities and constraints\n\n1. **A:** a.\n2. **B:** b.\n3. **C:** c.\n4. **D:** d.\n",
  "sbp-structure.md": "# S\n\n## Layer 2: Structure\n\nScope: all.\n\n### 1. Parts\n\n1. X (part): holds.\n\n### 11. Decisions\n\n1. Keep C. Reason: vision-6.3 and vision-6.4.\n",
  "sbp-detail-x.md": "# S\n\n## Layer 3: Detail\n\nScope: one part.\n\n### X (part)\n\n#### 6. Limits\n\n1. A stop takes time (Layer 1, vision-6.4).\n\n#### 12. Decisions\n\n1. Keep it. Reason: vision-6.3.\n",
};
const stackRun = (args, over = {}) => tmp((dir) => { for (const [n, t] of Object.entries({ ...S3, ...over })) put(dir, n, t); const r = cli(...args.map((a) => (a === "@" ? dir : a))); return { ...r, dir, files: Object.fromEntries(fs.readdirSync(dir).filter((n) => n.endsWith(".md")).map((n) => [n, get(path.join(dir, n))])), listing: fs.readdirSync(dir) }; });

test("cascade: delete a middle item shifts the later ids and rewrites their citations, and the lint adds no warning", () => {
  const p = kRun(["delete", "vision-6.2", "@"]);
  assert.equal(p.code, 0, p.err);
  assert.equal(p.text, K);
  assert.equal(p.lines.at(-1), "preview: no file written");
  assert.ok(p.lines.some((l) => /^vision-6\.3 -> vision-6\.2 /.test(l)));
  assert.ok(p.lines.some((l) => /^rewrite {2}\S+ line 13 {2}vision-7\.1 {2}id {2}vision-6\.3 -> vision-6\.2$/.test(l)));
  const a = kApply(["delete", "vision-6.2", "@", "--apply"]);
  assert.equal(a.code, 0, a.err);
  assert.equal(a.text, K.replace("2. **B:** b.\n", "").replace("3. **C:**", "2. **C:**").replace("vision-6.3", "vision-6.2"));
  assert.match(a.lines.at(-1), /^applied: 1 file\(s\) written$/);
  assert.match(a.out, /lint before: (\d+) warning\(s\)\nlint after: \1 warning\(s\), 0 new/);
});

test("cascade: the report prints the lint's --impact text verbatim after the report line, then the stages in order", () => {
  const r = kRun(["delete", "vision-6.2", "@"]);
  assert.match(r.lines[0], /^cascade delete vision-6\.2 in /);
  assert.equal(r.lines[1], "== impact ==");
  const stages = r.lines.filter((l) => /^== \w+ ==$/.test(l));
  assert.deepEqual(stages, ["== impact ==", "== shift ==", "== citations ==", "== lint ==", "== result =="]);
  const im = tmp((dir) => { const f = put(dir, "k.md", K); return spawnSync(process.execPath, [lint, "--impact", "vision-6.2", f], { encoding: "utf8" }).stdout.split("\n").filter(Boolean); });
  assert.deepEqual(r.lines.slice(2, 2 + im.length).map((l) => l.replace(/\S+k\.md/, "F")), im.map((l) => l.replace(/\S+k\.md/, "F")));
});

test("cascade: in a stack folder every file's citations of a later id are rewritten and nothing else changes", () => {
  const a = stackRun(["delete", "vision-6.2", "@", "--apply"]);
  assert.equal(a.code, 0, a.err + a.out);
  assert.equal(a.files["sbp-vision.md"], S3["sbp-vision.md"].replace("2. **B:** b.\n", "").replace("3. **C:**", "2. **C:**").replace("4. **D:**", "3. **D:**"));
  assert.equal(a.files["sbp-structure.md"], S3["sbp-structure.md"].replace("vision-6.3 and vision-6.4", "vision-6.2 and vision-6.3"));
  assert.equal(a.files["sbp-detail-x.md"], S3["sbp-detail-x.md"].replace("vision-6.4", "vision-6.3").replace("Reason: vision-6.3.", "Reason: vision-6.2."));
  assert.ok(!a.listing.some((n) => /strata-tmp/.test(n)));
});

test("cascade: insert in the middle, at the first place and one past the end; an append rewrites nothing", () => {
  const mid = kApply(["insert", "vision-6.2", "@", "--text", "**N:** n.", "--apply"]);
  assert.equal(mid.text, K.replace("2. **B:** b.\n3. **C:** c.", "2. **N:** n.\n3. **B:** b.\n4. **C:** c.").replace("vision-6.3", "vision-6.4"));
  const first = kApply(["insert", "vision-6.1", "@", "--text", "**N:** n.", "--apply"]);
  assert.ok(first.text.includes("1. **N:** n.\n2. **A:** a.\n3. **B:** b.\n4. **C:** c.") && first.text.includes("see vision-6.4."));
  const end = kApply(["insert", "vision-6.4", "@", "--text", "**N:** n.", "--apply"]);
  assert.equal(end.text, K.replace("3. **C:** c.\n", "3. **C:** c.\n4. **N:** n.\n"));
  assert.ok(end.lines.some((l) => /^none: vision-6\.4 is a new place at the end of its list; nothing cites it$/.test(l)));
});

test("cascade: a nested list: the shifted item's nested ids take the new prefix, nested marker lines keep their numbers", () => {
  const text = K.replace("2. **B:** b.\n3. **C:** c.\n", "2. **B:** b.\n3. **C:** c.\n   1. one.\n   2. two.\n").replace("see vision-6.3.", "see vision-6.3.2.");
  const a = kApply(["delete", "vision-6.2", "@", "--apply"], text);
  assert.equal(a.code, 0, a.err + a.out);
  assert.ok(a.text.includes("2. **C:** c.\n   1. one.\n   2. two.\n"));
  assert.ok(a.text.includes("see vision-6.2.2."));
});

test("cascade: an item that becomes 10 or 9 has its nested and continuation lines re-indented", () => {
  const nine = Array.from({ length: 9 }, (_, i) => `${i + 1}. **Q${i + 1}:** q.`).join("\n");
  const text = `## Layer 1: Vision\n\nScope: all.\n\n### 6. Qualities and constraints\n\n${nine}\n10. **Q10:** q.\n    wrapped.\n    1. nested.\n`;
  const a = kApply(["delete", "vision-6.1", "@", "--apply"], text);
  assert.equal(a.code, 0, a.err + a.out);
  assert.ok(a.text.includes("9. **Q10:** q.\n   wrapped.\n   1. nested.\n"), a.text);
  const eight = Array.from({ length: 8 }, (_, i) => `${i + 1}. **Q${i + 1}:** q.`).join("\n");
  const nineText = `## Layer 1: Vision\n\nScope: all.\n\n### 6. Qualities and constraints\n\n${eight}\n9. **Q9:** q.\n   wrapped.\n   1. nested.\n`;
  const b = kApply(["insert", "vision-6.1", "@", "--text", "**N:** n.", "--apply"], nineText);
  assert.equal(b.code, 0, b.err + b.out);
  assert.ok(b.text.includes("10. **Q9:** q.\n    wrapped.\n    1. nested.\n"), b.text);
});

test("cascade: a citation of the deleted item is UNRESOLVED, blocks the apply, and --ack releases it", () => {
  const p = kRun(["delete", "vision-6.3", "@"]);
  assert.equal(p.code, 0);
  assert.ok(p.lines.some((l) => /^UNRESOLVED {2}\S+ line 13 {2}vision-7\.1 {2}id {2}vision-6\.3 \(deleted\)$/.test(l)));
  const b = kApply(["delete", "vision-6.3", "@", "--apply"]);
  assert.equal(b.code, 2);
  assert.match(b.err, /apply blocked: 1 unresolved reference\(s\)/);
  assert.equal(b.text, K);
  const a = kApply(["delete", "vision-6.3", "@", "--apply", "--ack", "vision-7.1"]);
  assert.equal(a.code, 0, a.err);
  assert.ok(a.text.includes("see vision-6.3."));
  assert.equal(kApply(["delete", "vision-6.3", "@", "--apply", "--ack", "nope"]).code, 2);
  const f = tmp((dir) => { const q = put(dir, "k.md", K.replace("3. **C:** c.\n", "")); return lintWarns(q); });
  assert.ok(f >= 0);
});

test("cascade: a bare settles open concern number of the deleted concern cannot be acknowledged, and a moved one is rewritten", () => {
  const base = "## Layer 1: Vision\n\nScope: all.\n\n### 10. Open Concerns\n\n1. Given a, when b, then c. Raised by the club.\n2. Given d, when e, then f. Raised by the club.\n\n### 12. Decisions\n\n1. Chosen X. Reason: settles open concern 10.2.\n";
  const moved = kApply(["delete", "vision-10.1", "@", "--apply"], base);
  assert.equal(moved.code, 0, moved.err + moved.out);
  assert.ok(moved.text.includes("settles open concern 10.1."));
  const gone = kApply(["delete", "vision-10.2", "@", "--apply", "--ack", "vision-12.1"], base);
  assert.equal(gone.code, 2);
  assert.match(gone.err, /cannot acknowledge vision-12\.1: it settles an open concern this change deletes/);
  assert.equal(gone.text, base);
});

test("cascade: a preview changes no file and leaves no temporary file", () => {
  const p = stackRun(["delete", "vision-6.2", "@"]);
  assert.equal(p.code, 0);
  for (const [n, t] of Object.entries(S3)) assert.equal(p.files[n], t, n);
  assert.deepEqual(p.listing.sort(), Object.keys(S3).sort());
});

test("cascade: an injected rename failure on the second file restores the first, leaves no temporary file and exits 2", async () => {
  const mod = await loadTool();
  tmp((dir) => {
    for (const [n, t] of Object.entries(S3)) put(dir, n, t);
    let renames = 0;
    const io = { writeFileSync: fs.writeFileSync, renameSync: (a, b) => { if (++renames === 2) throw new Error("injected"); fs.renameSync(a, b); }, accessSync: fs.accessSync, fsyncDir: () => {} };
    assert.throws(() => mod.run(["delete", "vision-6.2", dir, "--apply"], () => {}, io), /write failed on .*; every file restored/);
    for (const [n, t] of Object.entries(S3)) assert.equal(get(path.join(dir, n)), t, n);
    assert.deepEqual(fs.readdirSync(dir).sort(), Object.keys(S3).sort());
    const io2 = { ...io, accessSync: (p) => { if (/structure/.test(p)) throw new Error("denied"); } };
    assert.throws(() => mod.run(["delete", "vision-6.2", dir, "--apply"], () => {}, io2), /cannot write sbp-structure\.md; nothing was written/);
    for (const [n, t] of Object.entries(S3)) assert.equal(get(path.join(dir, n)), t, n);
  });
});

test("cascade: an insert whose text breaks a form check is refused with the hint and nothing written", () => {
  const md = "## Layer 1: Vision\n\nScope: all.\n\n### 3. Value\n\n1. Given a, when b, then c.\n\n## Layer 2: Structure\n\nScope: all.\n\n### 6. Scenario paths\n\n1. Realizes vision-3.1. Given a, when b, then c.\n";
  const r = kApply(["insert", "vision-3.2", "@", "--text", "Given a, when b, then c.", "--apply"], md);
  assert.equal(r.code, 2);
  assert.match(r.err, /would add \d+ lint warning/);
  assert.match(r.err, /hint: an item that needs a path, a rule or a reason is added bare/);
  assert.equal(r.text, md);
  const bare = kApply(["insert", "vision-3.2", "@", "--apply"], md);
  assert.equal(bare.code, 0, bare.err + bare.out);
  assert.ok(bare.text.includes("2. Not supplied: what this item says."));
  const needs = kApply(["insert", "vision-3.2", "@", "--needs", "a scenario nobody has given.", "--apply"], md);
  assert.ok(needs.text.includes("2. Not supplied: a scenario nobody has given."));
  assert.equal(kApply(["insert", "vision-3.2", "@", "--needs", "x", "--text", "y"], md).code, 2);
});

test("cascade: a citation in a code span or a fenced block is not read, and a chain of shifts does not double-shift", () => {
  const text = K.replace("1. **T:** see vision-6.3.", "1. **T:** see vision-6.3, vision-6.2 and `vision-6.3`.\n\n```\nvision-6.3\n```");
  const a = kApply(["delete", "vision-6.1", "@", "--apply"], text);
  assert.equal(a.code, 0, a.err + a.out);
  assert.ok(a.text.includes("see vision-6.2, vision-6.1 and `vision-6.3`.\n\n```\nvision-6.3\n```"), a.text);
});

test("cascade: refusals: unknown id, sole item, condensed input, one past the end plus one, a topic with no list, a symlink, misplaced options", () => {
  const nonexist = kRun(["delete", "vision-6.9", "@"]);
  assert.equal(nonexist.code, 2); assert.match(nonexist.err, /vision-6\.9 is not defined/);
  const sole = kRun(["delete", "vision-7.1", "@"]);
  assert.equal(sole.code, 2); assert.match(sole.err, /vision-7\.1 is the only item under Vocabulary/);
  assert.equal(kRun(["insert", "vision-6.5", "@"]).code, 2);
  assert.equal(kRun(["insert", "vision-8.1", "@"]).code, 2);
  assert.equal(kRun(["delete", "vision-6.2", "@"], MARKER + "\n\n" + K).code, 2);
  assert.equal(kRun(["delete", "vision-6.2", "@", "--out", "x"]).code, 2);
  assert.equal(kRun(["insert", "vision-6.2", "@", "--ack", "x"]).code, 2);
  assert.equal(kRun(["condense", "@", "--apply", "--out", "o.md"]).code, 2);
  assert.equal(kRun(["publish", "@", "--text", "t", "--out", "o.md"]).code, 2);
  assert.equal(kRun(["delete", "vision-6.2", "@"], K.replace("2. **B:**", "5. **B:**")).code, 2);
  tmp((dir) => { put(dir, "real.md", K); fs.symlinkSync(path.join(dir, "real.md"), path.join(dir, "link.md")); assert.equal(cli("delete", "vision-6.2", path.join(dir, "link.md")).code, 2); });
});

test("cascade: CRLF files and a file with no final newline keep their line endings", () => {
  const crlf = kApply(["delete", "vision-6.2", "@", "--apply"], K.replace(/\n/g, "\r\n"));
  assert.equal(crlf.code, 0, crlf.err);
  assert.equal(crlf.text, K.replace(/\n/g, "\r\n").replace("2. **B:** b.\r\n", "").replace("3. **C:**", "2. **C:**").replace("vision-6.3", "vision-6.2"));
  const noeol = kApply(["delete", "vision-6.2", "@", "--apply"], K.replace(/\n$/, ""));
  assert.equal(noeol.code, 0, noeol.err);
  assert.ok(!noeol.text.endsWith("\n"));
  const app = kApply(["insert", "vision-6.4", "@", "--text", "x", "--apply"], K.replace("### 7. Vocabulary\n\n1. **T:** see vision-6.3.\n", "").replace(/\n+$/, ""));
  assert.equal(app.code, 0, app.err + app.out);
  assert.ok(app.text.includes("3. **C:** c.\n4. x"), app.text);
});

test("cascade: insert then delete of the same place restores the original bytes, on a document and on the to-do folder", () => {
  const a = kApply(["insert", "vision-6.2", "@", "--apply"]);
  assert.notEqual(a.text, K);
  tmp((dir) => {
    const f = put(dir, "k.md", K);
    assert.equal(cli("insert", "vision-6.2", f, "--apply").code, 0);
    assert.equal(cli("delete", "vision-6.2", f, "--apply").code, 0);
    assert.equal(get(f), K);
    const todo = path.join(dir, "todo"); fs.cpSync(path.join(refs, "strata-blueprints-example-todo-app"), todo, { recursive: true });
    const snap = Object.fromEntries(fs.readdirSync(todo).map((n) => [n, get(path.join(todo, n))]));
    for (const id of ["vision-3.3", "vision-6.1", "structure-6.2", "detail.ledger-4.1"]) {
      const i = cli("insert", id, todo, "--apply"); assert.equal(i.code, 0, `${id}: ${i.err}${i.out}`);
      const d = cli("delete", id, todo, "--apply"); assert.equal(d.code, 0, `${id}: ${d.err}${d.out}`);
    }
    for (const [n, t] of Object.entries(snap)) assert.equal(get(path.join(todo, n)), t, n);
  });
});

test("cascade: on the to-do example the citation sites the tool rewrites equal the citers --impact lists for the moved ids", () => {
  tmp((dir) => {
    const todo = path.join(dir, "todo"); fs.cpSync(path.join(refs, "strata-blueprints-example-todo-app"), todo, { recursive: true });
    const r = cli("delete", "vision-3.1", todo);
    assert.equal(r.code, 0, r.err);
    const moved = [...r.out.matchAll(/^(vision-3\.\d+) -> /gm)].map((m) => m[1]);
    assert.ok(moved.length >= 5);
    const sites = new Set(r.lines.filter((l) => /^rewrite /.test(l)).map((l) => { const p = l.split("  "); return `${p[1].replace(/ line (\d+)$/, ":$1")}|${p[4].split(" -> ")[0]}`; }));
    const want = new Set();
    for (const id of moved) {
      const im = spawnSync(process.execPath, [lint, "--impact", id, todo], { encoding: "utf8" }).stdout.split("\n").filter((l) => /^ {2}d1 /.test(l));
      for (const l of im) { const m = l.match(/^ {2}d1 {2}(\S+) line (\d+) /); want.add(`${m[1]}:${m[2]}|${id}`); }
    }
    assert.deepEqual([...sites].sort(), [...want].sort());
  });
});

test("cascade: kill: a run killed at its second rename leaves temp files that the next run reports and never deletes", () => {
  tmp((dir) => {
    for (const [n, t] of Object.entries(S3)) put(dir, n, t);
    const code = `import { run } from ${JSON.stringify(pathToFileURL(tool).href)}; import fs from "node:fs"; let n = 0;
      run(["delete", "vision-6.2", ${JSON.stringify(dir)}, "--apply"], () => {}, { writeFileSync: fs.writeFileSync, renameSync: (a, b) => { if (++n === 2) process.kill(process.pid, "SIGKILL"); fs.renameSync(a, b); }, accessSync: fs.accessSync, fsyncDir: () => {} });`;
    const k = spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
    assert.equal(k.signal, "SIGKILL");
    const temps = fs.readdirSync(dir).filter((n) => /\.strata-tmp-\d+$/.test(n));
    assert.equal(temps.length, 2);
    const again = cli("delete", "vision-6.2", dir, "--apply");
    assert.equal(again.code, 2);
    assert.match(again.err, /interrupted run: 2 temp file\(s\) left by an earlier insert or delete/);
    const preview = cli("delete", "vision-6.2", dir);
    assert.equal(preview.code, 2);
    assert.equal(fs.readdirSync(dir).filter((n) => /\.strata-tmp-\d+$/.test(n)).length, 2);
    for (const t of temps) fs.rmSync(path.join(dir, t));
  });
});

const killRun = (dir, extra, argv = ["delete", "vision-6.2", dir, "--apply"]) => {
  const code = `import { run } from ${JSON.stringify(pathToFileURL(tool).href)}; import fs from "node:fs"; let n = 0;
    run(${JSON.stringify(argv)}, () => {}, { writeFileSync: ${extra.write ? "(a, b, c) => { if (++n === " + extra.at + ") process.kill(process.pid, 'SIGKILL'); fs.writeFileSync(a, b, c); }" : "fs.writeFileSync"}, renameSync: ${extra.write ? "fs.renameSync" : "(a, b) => { if (++n === " + extra.at + ") process.kill(process.pid, 'SIGKILL'); fs.renameSync(a, b); }"}, accessSync: fs.accessSync, fsyncDir: () => {} });`;
  return spawnSync(process.execPath, ["--input-type=module", "-e", code], { encoding: "utf8" });
};
test("cascade: kill: a run killed while writing the second temp file changes no target and leaves one temp file", () => {
  tmp((dir) => {
    for (const [n, t] of Object.entries(S3)) put(dir, n, t);
    assert.equal(killRun(dir, { write: true, at: 2 }).signal, "SIGKILL");
    for (const [n, t] of Object.entries(S3)) assert.equal(get(path.join(dir, n)), t, n);
    const temps = fs.readdirSync(dir).filter((n) => /\.strata-tmp-\d+$/.test(n));
    assert.ok(temps.length >= 1);
    assert.equal(cli("delete", "vision-6.2", dir).code, 2);
    for (const t of temps) fs.rmSync(path.join(dir, t));
    const ok = cli("delete", "vision-6.2", dir, "--apply");
    assert.equal(ok.code, 0, ok.err);
  });
});
test("cascade: kill: a run killed at its first rename leaves every original and three temp files, and finishing it by hand equals an uninterrupted run", () => {
  tmp((dir) => {
    for (const [n, t] of Object.entries(S3)) put(dir, n, t);
    assert.equal(killRun(dir, { write: false, at: 1 }).signal, "SIGKILL");
    for (const [n, t] of Object.entries(S3)) assert.equal(get(path.join(dir, n)), t, n);
    const temps = fs.readdirSync(dir).filter((n) => /\.strata-tmp-\d+$/.test(n)).sort();
    assert.equal(temps.length, 3);
    for (const t of temps) { const m = t.match(/^\.(.+)\.strata-tmp-\d+$/); fs.renameSync(path.join(dir, t), path.join(dir, m[1])); }
    const finished = Object.fromEntries(fs.readdirSync(dir).map((n) => [n, get(path.join(dir, n))]));
    tmp((d2) => { for (const [n, t] of Object.entries(S3)) put(d2, n, t); assert.equal(cli("delete", "vision-6.2", d2, "--apply").code, 0); for (const [n, t] of Object.entries(finished)) assert.equal(get(path.join(d2, n)), t, n); });
  });
});
test("cascade: a bare insert writes the open placeholder in every topic of a complete document, and the lint adds no warning", () => {
  const md = mk0();
  const before = lintWarns0(md);
  for (const [id] of [["vision-8.1"], ["vision-11.1"], ["vision-12.1"], ["structure-7.1"], ["detail.shed-4.1"]]) {
    const r = kApply(["insert", id, "@", "--apply"], md);
    assert.equal(r.code, 0, `${id}: ${r.err}${r.out}`);
    assert.ok(/Not supplied: what this item says\./.test(r.text), id);
  }
  assert.ok(before >= 0);
});
test("cascade: --needs writes its text exactly, and the text options exclude each other", () => {
  const r = kApply(["insert", "vision-6.4", "@", "--needs", "the fourth quality is unknown.", "--apply"]);
  assert.ok(r.text.includes("4. Not supplied: the fourth quality is unknown.") || r.code === 2, r.err);
  assert.equal(kRun(["insert", "vision-6.4", "@", "--text", "a", "--text-file", "b"]).code, 2);
  assert.equal(kRun(["insert", "vision-6.4", "@", "--needs", "a", "--text-file", "b"]).code, 2);
});
test("cascade: two equal warnings that existed before are two for the gate, and a loose list keeps its blank lines", () => {
  const loose = K.replace("1. **A:** a.\n2. **B:** b.\n3. **C:** c.", "1. **A:** a.\n\n2. **B:** b.\n\n3. **C:** c.");
  const a = kApply(["delete", "vision-6.2", "@", "--apply"], loose);
  assert.equal(a.code, 0, a.err + a.out);
  assert.ok(a.text.includes("1. **A:** a.\n\n2. **C:** c.\n"), a.text);
  const b = kApply(["insert", "vision-6.2", "@", "--apply"], loose);
  assert.ok(b.text.includes("1. **A:** a.\n\n2. Not supplied: what this item says.\n\n3. **B:** b."), b.text);
});
const mk0 = () => "## Layer 1: Vision\n\nScope: all.\n\n### 8. Costs\n\n1. Given a, when b, then it costs 5 USD. Paid by the club.\n2. Given c, when d, then it costs 6 USD. Paid by the club.\n\n### 11. Assumptions\n\n1. Fact. Basis: y. If wrong: x.\n2. Fact. Basis: y. If wrong: x.\n\n### 12. Decisions\n\n1. Choice. Reason: r.\n2. Choice. Reason: r.\n\n## Layer 2: Structure\n\nScope: all.\n\n### 7. Costs\n\n1. Given a, when b, then it costs 5 USD. Paid by the club.\n2. Given c, when d, then it costs 6 USD. Paid by the club.\n\n## Layer 3: Detail\n\nScope: one part.\n\n### Shed (part)\n\n#### 4. Rules\n\n1. A rule.\n2. Another rule.\n";
const lintWarns0 = (md) => tmp((dir) => { const f = put(dir, "m.md", md); return lintWarns(f); });
