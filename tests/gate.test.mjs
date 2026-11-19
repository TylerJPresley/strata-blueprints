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
