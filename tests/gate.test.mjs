// SPDX-License-Identifier: MIT
// The gate's templates check, run on a scratch copy of gate.mjs, scripts/ and the assets.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join("skills", "strata-blueprints", "assets");

function gateOn(mutate) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbp-gate-"));
  try {
    fs.copyFileSync(path.join(root, "gate.mjs"), path.join(dir, "gate.mjs"));
    fs.cpSync(path.join(root, "scripts"), path.join(dir, "scripts"), { recursive: true });
    fs.cpSync(path.join(root, ASSETS), path.join(dir, ASSETS), { recursive: true });
    mutate((name, fn) => {
      const f = path.join(dir, ASSETS, name);
      fs.writeFileSync(f, fn(fs.readFileSync(f, "utf8")));
    });
    const r = spawnSync(process.execPath, ["gate.mjs"], { cwd: dir, encoding: "utf8", timeout: 60000 });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const VISION = "strata-blueprints-template-layer-1.md";
const FULL = "strata-blueprints-template.md";

test("gate: unmutated templates pass the templates check", () => {
  const r = gateOn(() => {});
  assert.ok(!r.out.includes("gate: templates failed"), r.out);
  assert.ok(r.out.includes("gate: links"), r.out);
});

test("gate: a Vision cut without Version fails at templates", () => {
  const r = gateOn((edit) => edit(VISION, (t) => t.replace("Version: 0.1.0\n", "")));
  assert.equal(r.status, 1);
  assert.ok(r.out.includes("gate: templates failed"), r.out);
  assert.match(r.out, /template-layer-1: line 3 expected "Version: 0\.1\.0"/);
});

test("gate: Status: Draft before Version: in the full template fails at templates", () => {
  const r = gateOn((edit) => edit(FULL, (t) => t.replace("Version: 0.1.0\nStatus: Draft\n", "Status: Draft\nVersion: 0.1.0\n")));
  assert.equal(r.status, 1);
  assert.ok(r.out.includes("gate: templates failed"), r.out);
});

// A lint with a syntax error must make the lint test file fail promptly, not hang on a pipe that never delivers.
test("lint tests: a lint script with a syntax error fails the lint test file within the bound", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbp-brokenlint-"));
  try {
    const broken = path.join(dir, "strata-blueprints-lint.mjs");
    const src = fs.readFileSync(path.join(root, "skills", "strata-blueprints", "scripts", "strata-blueprints-lint.mjs"), "utf8");
    fs.writeFileSync(broken, src + "\n}}}\n");
    // The bound is a test mechanism: a healthy failing run ends in seconds; a hang is killed here.
    const r = spawnSync(process.execPath, ["--test", path.join(root, "tests", "strata-blueprints-lint.test.mjs")],
      { cwd: root, encoding: "utf8", timeout: 60000, killSignal: "SIGKILL", env: { ...process.env, NODE_TEST_CONTEXT: undefined, STRATA_LINT: broken } });
    const out = `${r.stdout}${r.stderr}`;
    assert.ok(!r.error, `the lint test file did not finish within the bound: ${r.error && r.error.message}`);
    assert.notEqual(r.status, 0, out.slice(-500));
    assert.match(out, /not ok|✖|fail/i);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// The links check reads the fenced node commands of README.md by the fence rule of the lint.
function linksOn(readmeTail) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sbp-gate-fence-"));
  try {
    fs.copyFileSync(path.join(root, "gate.mjs"), path.join(dir, "gate.mjs"));
    fs.cpSync(path.join(root, "scripts"), path.join(dir, "scripts"), { recursive: true });
    fs.cpSync(path.join(root, ASSETS), path.join(dir, ASSETS), { recursive: true });
    fs.writeFileSync(path.join(dir, "README.md"), "# R\n\n" + readmeTail);
    fs.writeFileSync(path.join(dir, "CONTRIBUTING.md"), "# C\n");
    const r = spawnSync(process.execPath, ["gate.mjs"], { cwd: dir, encoding: "utf8", timeout: 60000 });
    return `${r.stdout}${r.stderr}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("gate: a four-backtick fence in README closes only at four or more backticks", () => {
  const out = linksOn("````\n```\nnode inner-missing.mjs\n````\n\n```\nnode outer-missing.mjs\n```\n");
  assert.match(out, /README\.md: command names missing file inner-missing\.mjs/);
  assert.match(out, /README\.md: command names missing file outer-missing\.mjs/);
});

test("gate: a backtick row with a backtick after the run is not a fence in README", () => {
  const out = linksOn("```x``` more\nnode text-missing.mjs\n");
  assert.doesNotMatch(out, /text-missing\.mjs/);
});

// The template cut reader reads fences by the lint's rule: a row closes a fence at the same mark, at least as long, with nothing after it.
// Each case adds the same rows to the full template and to one cut; `cut` is the rows as the cut must hold them.
const CUT = (n) => `strata-blueprints-template-layer-${n}.md`;
function templatesWith(n, full, cut) {
  const heading = (t, h) => t.replace(h, (m) => `${m}\n${full.join("\n")}`);
  return gateOn((edit) => {
    if (n === 3) {
      edit(FULL, (t) => `${t.replace(/\n$/, "")}\n\n${full.join("\n")}\n`);
      edit(CUT(3), (t) => `${t.replace(/\n$/, "")}\n\n${cut.join("\n")}\n`);
    } else {
      edit(FULL, (t) => heading(t, `## Layer ${n}: ${n === 1 ? "Vision" : "Structure"}`));
      edit(CUT(n), (t) => t.replace(`# Layer ${n}: ${n === 1 ? "Vision" : "Structure"}`, (m) => `${m}\n${cut.join("\n")}`));
    }
  });
}
const passes = (r) => !r.out.includes("gate: templates failed");

test("gate templates: a fence closed by a longer row ends there; the next # row is stripped in the cut", () => {
  const full = ["```", "#a", "````", "#b"];
  { const r = templatesWith(1, full, ["```", "#a", "````", "b"]); assert.ok(passes(r), r.out); }
  const bad = templatesWith(1, full, ["```", "#a", "````", "#b"]);
  assert.ok(!passes(bad), bad.out);
});

test("gate templates: a shorter row inside a longer fence does not close it", () => {
  const full = ["````", "#a", "```", "#b", "````", "#c"];
  assert.ok(passes(templatesWith(2, full, ["````", "#a", "```", "#b", "````", "c"])));
  const bad = templatesWith(2, full, ["````", "#a", "```", "b", "````", "c"]);
  assert.ok(!passes(bad), bad.out);
});

test("gate templates: a backtick row with a backtick after the opening run is text, not a fence", () => {
  const full = ["```x``` more", "#t"];
  assert.ok(passes(templatesWith(1, full, ["```x``` more", "t"])));
  const bad = templatesWith(1, full, ["```x``` more", "#t"]);
  assert.ok(!passes(bad), bad.out);
});

test("gate templates: an unclosed fence hides every later row to the end of the template", () => {
  const full = ["```", "#u", "## v"];
  assert.ok(passes(templatesWith(3, full, ["```", "#u", "## v"])));
  const bad = templatesWith(3, full, ["```", "u", "## v"]);
  assert.ok(!passes(bad), bad.out);
});

// The gate, the links check, the lint and the tool each carry their own fenceOpen and fenceCloses (the programs are separate files).
// Each copy is read from its file and run on the same rows, so a change to one copy fails here.
const FENCE_FILES = ["gate.mjs", "scripts/links-check.mjs", "skills/strata-blueprints/scripts/strata-blueprints-lint.mjs", "skills/strata-blueprints/scripts/strata-blueprints.mjs"];
function fenceCopy(file) {
  const src = fs.readFileSync(path.join(root, file), "utf8").split("\n");
  const pick = (name) => {
    const lines = src.filter((l) => l.startsWith(`const ${name} = `));
    assert.equal(lines.length, 1, `${file} holds one ${name}`);
    return lines[0];
  };
  return new Function(`${pick("fenceOpen")}\n${pick("fenceCloses")}\nreturn { fenceOpen, fenceCloses };`)();
}

test("fence helpers: the gate, the links check, the lint and the tool read every row alike", () => {
  const rows = [
    "```", "````", "`````", "~~~", "~~~~", "``", "~~", "", "text",
    "```js", "```js title", "~~~ yaml", "```x``` more", "``` `a`", "~~~ `a`", "~~~x~~~",
    "``` ", "```.", "~~~.", "````js", "~~~~x y",
    "  ```", "    ```", "\t```", "> ```", "`~`", "```~~~", "~~~```",
  ];
  const copies = FENCE_FILES.map((f) => ({ f, ...fenceCopy(f) }));
  const view = (c) => {
    const out = [];
    for (const row of rows) {
      const open = c.fenceOpen(row);
      out.push([row, open]);
      for (const closer of rows) out.push([row, closer, c.fenceCloses(closer, open || { mark: "```" })]);
    }
    for (const mark of ["```", "````", "~~~", "~~~~"]) for (const closer of rows) out.push([mark, closer, c.fenceCloses(closer, { mark })]);
    return JSON.stringify(out);
  };
  const [first, ...rest] = copies;
  for (const c of rest) assert.equal(view(c), view(first), `${c.f} differs from ${first.f}`);
  assert.ok(first.fenceOpen("````"), "the table opens a four-backtick row");
  assert.equal(first.fenceOpen("```x``` more"), null, "the table holds a text row");
});

test("fence: an indented fence is read by the gate like the lint reads it", () => {
  const out = linksOn("    ```\nnode scripts/no-such-file.mjs\n    ```\n");
  const hits = out.split("\n").filter((l) => l.includes("command names missing file"));
  assert.equal(hits.length, 1, out);
  assert.match(hits[0], /scripts\/no-such-file\.mjs/);
});
