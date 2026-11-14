// SPDX-License-Identifier: MIT
// Tests for links-check.mjs. Run: node --test tests/links-check.test.mjs
// Each test builds a fixture under a scratch directory; the real repository is never touched.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { linkProblems } from "../scripts/links-check.mjs";

function linkRoot(files, t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "links-check-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

test("links: valid relative links, anchors and http links pass", (t) => {
  const root = linkRoot({
    "README.md": "# Title\n\n[a](AGENTS.md#commands) [b](docs/x.md) [c](#title) [d](https://example.invalid/nope)\n",
    "AGENTS.md": "# Agents\n\n## Commands\n",
    "docs/x.md": "# X\n\n[up](../README.md)\n",
  }, t);
  assert.deepEqual(linkProblems(root), []);
});

for (const file of ["AGENTS.md", "CONTRIBUTING.md", "docs/x.md"]) {
  test(`links: a broken relative link in ${file} fails`, (t) => {
    const root = linkRoot({ "README.md": "# R\n", [file]: "# T\n\n[gone](missing-file.md)\n" }, t);
    const p = linkProblems(root);
    assert.equal(p.length, 1);
    assert.match(p[0], new RegExp(file.replace(".", "\\.") + ": broken link missing-file\\.md"));
  });
}

test("links: a broken in-page anchor and a broken cross-file anchor fail", (t) => {
  const root = linkRoot({
    "AGENTS.md": "# A\n\n[x](#nope)\n[y](CONTRIBUTING.md#no-such)\n",
    "CONTRIBUTING.md": "# C\n\n## Git\n",
  }, t);
  const p = linkProblems(root);
  assert.equal(p.length, 2);
  assert.match(p.join("\n"), /AGENTS\.md: broken anchor #nope/);
  assert.match(p.join("\n"), /AGENTS\.md: broken anchor CONTRIBUTING\.md#no-such/);
});

test("links: _internal, .kiro and node_modules are excluded; code is not scanned", (t) => {
  const root = linkRoot({
    "_internal/n.md": "[x](gone.md)\n",
    ".kiro/n.md": "[x](gone.md)\n",
    "node_modules/p/n.md": "[x](gone.md)\n",
    "README.md": "# R\n\n`[x](gone.md)`\n\n```\n[y](gone.md)\n```\n",
  }, t);
  assert.deepEqual(linkProblems(root), []);
});
