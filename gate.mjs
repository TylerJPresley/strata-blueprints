#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// gate.mjs: this project's gate. Exit 0 only when every check passes; exit 1 otherwise.
// Run from any directory: node gate.mjs (the root is derived from this file's location).
// A CHECKS entry is [name, command, args, env?] (run with process.execPath, stdio inherited)
// or [name, fn] where fn() returns an array of problem strings (non-empty fails).
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionProblems } from './scripts/version-check.mjs';
import { linkProblems } from './scripts/links-check.mjs';

const root = dirname(fileURLToPath(import.meta.url));

// --- links check (fn) ---
function linksCheck() {
  const problems = [];
  for (const f of ['README.md', 'CONTRIBUTING.md']) {
    if (!existsSync(join(root, f))) problems.push(`${f} is missing`);
  }
  // Relative links and in-page anchors in every Markdown file (scripts/links-check.mjs).
  problems.push(...linkProblems(root));
  // Fenced-code node commands in README and CONTRIBUTING must name an existing file.
  const cmdRe = /^\s*(?:\w+=\S+\s+)*node\s+(?:--test\s+)?(\S+\.mjs)/;
  for (const f of ['README.md', 'CONTRIBUTING.md']) {
    const abs = join(root, f);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, 'utf8');
    let inFence = false;
    for (const line of text.split('\n')) {
      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      if (!inFence) continue;
      const cm = line.match(cmdRe);
      if (cm && !existsSync(join(root, cm[1]))) problems.push(`${f}: command names missing file ${cm[1]}`);
    }
  }
  return problems;
}

// --- version check (fn): guide Version equals the top released CHANGELOG heading, package.json, marketplace.json and the skill's metadata ---
const versionCheck = () => versionProblems(root);

// --- layout check (fn): the skill folder holds exactly SKILL.md, LICENSE, references/, assets/, scripts/; name equals folder ---
function layoutCheck() {
  const dir = join(root, 'skills', 'strata-blueprints');
  if (!existsSync(dir)) return ['skills/strata-blueprints is missing'];
  const want = ['LICENSE', 'SKILL.md', 'assets', 'references', 'scripts'];
  const have = readdirSync(dir).sort();
  const problems = [];
  if (JSON.stringify(have) !== JSON.stringify([...want].sort())) {
    problems.push(`skills/strata-blueprints holds [${have.join(', ')}], expected [${want.join(', ')}]`);
  }
  const md = join(dir, 'SKILL.md');
  if (existsSync(md)) {
    const fm = readFileSync(md, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    const nm = fm && fm[1].match(/^name:\s*"?([^"\s]+)"?\s*$/m);
    if (!nm || nm[1] !== 'strata-blueprints') problems.push(`SKILL.md front matter name ${nm ? nm[1] : 'missing'} does not equal folder name strata-blueprints`);
  }
  return problems;
}

// --- templates check (fn): each layer cut equals the matching section of the full template, headings one level up ---
function templateProblems() {
  const dir = join(root, 'skills', 'strata-blueprints', 'assets');
  const names = ['strata-blueprints-template.md', 'strata-blueprints-template-layer-1.md', 'strata-blueprints-template-layer-2.md', 'strata-blueprints-template-layer-3.md'];
  const problems = [];
  const text = {};
  for (const n of names) {
    const f = join(dir, n);
    if (!existsSync(f)) { problems.push(`${n} is missing`); continue; }
    const t = readFileSync(f, 'utf8');
    text[n] = t;
    if (!t.endsWith('\n') || t.endsWith('\n\n')) problems.push(`${n} must end in exactly one newline`);
    const first = t.split('\n')[0];
    if (!/^<!--.*-->$/.test(first)) problems.push(`${n}: line 1 is not a comment`);
    else if (n !== names[0] && !first.includes('cut of strata-blueprints-template.md')) problems.push(`${n}: line 1 lacks "cut of strata-blueprints-template.md"`);
  }
  const full = text[names[0]];
  if (!full) return problems;
  const lines = full.replace(/\n$/, '').split('\n');
  for (let n = 1; n <= 3; n++) {
    const name = `strata-blueprints-template-layer-${n}.md`;
    if (!text[name]) continue;
    const want = [];
    let inLayer = false, fence = false;
    for (const l of lines) {
      if (/^\s*(```|~~~)/.test(l)) fence = !fence;
      if (!fence && /^## /.test(l)) inLayer = l.startsWith(`## Layer ${n}:`);
      if (inLayer) want.push(!fence && /^#/.test(l) ? l.slice(1) : l);
    }
    while (want.length && want[want.length - 1] === '') want.pop();
    const have = text[name].replace(/\n$/, '').split('\n').slice(2);
    const len = Math.max(want.length, have.length);
    for (let k = 0; k < len; k++) {
      if (want[k] !== have[k]) {
        problems.push(`template-layer-${n}: line ${k + 3} expected "${want[k] ?? '(end of file)'}", found "${have[k] ?? '(end of file)'}"`);
        break;
      }
    }
  }
  return problems;
}

const LINT = 'skills/strata-blueprints/scripts/strata-blueprints-lint.mjs';
const REFS = 'skills/strata-blueprints/references';
const CHECKS = [
  ['templates', templateProblems],
  ['links', linksCheck],
  ['layout', layoutCheck],
  ['lint tests', process.execPath, ['--test', 'tests/strata-blueprints-lint.test.mjs']],
  ['tool tests', process.execPath, ['--test', 'tests/strata-blueprints-tool.test.mjs']],
  ['publish tests', process.execPath, ['--test', 'tests/strata-blueprints-publish.test.mjs']],
  ['examples tests', process.execPath, ['--test', 'tests/strata-blueprints-examples.test.mjs']],
  ['version check tests', process.execPath, ['--test', 'tests/version-check.test.mjs']],
  ['links check tests', process.execPath, ['--test', 'tests/links-check.test.mjs']],
  ['example lint: garden', process.execPath, [LINT, `${REFS}/strata-blueprints-example.md`, '--strict']],
  ['example lint: todo app', process.execPath, [LINT, `${REFS}/strata-blueprints-example-todo-app`, '--strict']],
  ['example lint: RFP', process.execPath, [LINT, `${REFS}/strata-blueprints-example-rfp.md`, '--strict']],
  ['version', versionCheck],
];

for (const check of CHECKS) {
  const [name] = check;
  console.log(`gate: ${name}`);
  if (typeof check[1] === 'function') {
    const problems = check[1]();
    if (problems.length) {
      for (const p of problems) console.error(`  ${p}`);
      console.error(`gate: ${name} failed`);
      process.exit(1);
    }
    continue;
  }
  const [, command, args, env] = check;
  const r = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: env ? { ...process.env, ...env } : process.env,
  });
  if (r.status !== 0) {
    console.error(`gate: ${name} failed`);
    process.exit(1);
  }
}
console.log('gate: all checks passed');
