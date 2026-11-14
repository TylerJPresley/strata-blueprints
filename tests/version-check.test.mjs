// SPDX-License-Identifier: MIT
// Tests for version-check.mjs. Run: node --test tests/version-check.test.mjs
// Each test builds a fixture under a scratch directory; the real repository is never touched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { versionProblems } from "../scripts/version-check.mjs";

function fixture(t, over = {}) {
  const v = { guide: "0.1.0", changelog: "0.1.0", pkg: "0.1.0", skill: "0.1.0", market: "0.1.0", ...over };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "version-check-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  put("skills/strata-blueprints/references/strata-blueprints-guide.md", `# Guide\n\nVersion: ${v.guide}\n`);
  put("CHANGELOG.md", `# Changelog\n\n## Unreleased\n\n## ${v.changelog}\n`);
  put("package.json", JSON.stringify({ name: "strata-blueprints", version: v.pkg }));
  put("skills/strata-blueprints/SKILL.md", `---\nname: strata-blueprints\nmetadata:\n  version: "${v.skill}"\n---\n`);
  put(".claude-plugin/marketplace.json", JSON.stringify({ metadata: { version: v.market } }));
  return root;
}

test("all versions equal: no problems", (t) => {
  assert.deepEqual(versionProblems(fixture(t)), []);
});

test("package.json version differing from the guide fails", (t) => {
  const p = versionProblems(fixture(t, { pkg: "0.2.0" }));
  assert.equal(p.length, 1);
  assert.match(p[0], /package\.json version 0\.2\.0 does not equal guide Version 0\.1\.0/);
});

test("skill metadata version differing from the guide fails", (t) => {
  assert.match(versionProblems(fixture(t, { skill: "0.3.0" })).join("\n"), /skills\/strata-blueprints\/SKILL\.md version 0\.3\.0/);
});

test("changelog heading differing from the guide fails", (t) => {
  assert.match(versionProblems(fixture(t, { changelog: "0.0.9" })).join("\n"), /top released CHANGELOG heading 0\.0\.9/);
});

test("missing package.json fails", (t) => {
  const root = fixture(t);
  fs.rmSync(path.join(root, "package.json"));
  assert.match(versionProblems(root).join("\n"), /package\.json is missing/);
});

test("marketplace.json version differing from the guide fails", (t) => {
  const p = versionProblems(fixture(t, { market: "0.9.0" }));
  assert.equal(p.length, 1);
  assert.match(p[0], /marketplace\.json metadata\.version 0\.9\.0 does not equal guide Version 0\.1\.0/);
});

test("missing marketplace.json fails", (t) => {
  const root = fixture(t);
  fs.rmSync(path.join(root, ".claude-plugin"), { recursive: true });
  assert.match(versionProblems(root).join("\n"), /marketplace\.json is missing/);
});

test("every marketplace plugin skill path holds a SKILL.md named for its folder", (t) => {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const market = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "marketplace.json"), "utf8"));
  let count = 0;
  for (const plugin of market.plugins) {
    for (const rel of plugin.skills) {
      const dir = path.join(root, plugin.source, rel);
      const md = path.join(dir, "SKILL.md");
      assert.ok(fs.existsSync(md), `${rel} has no SKILL.md`);
      const m = fs.readFileSync(md, "utf8").match(/^name:\s*"?([^"\s]+)"?\s*$/m);
      assert.equal(m && m[1], path.basename(dir), `${rel} SKILL.md name differs from its folder`);
      count++;
    }
  }
  assert.equal(count, 1);
});
