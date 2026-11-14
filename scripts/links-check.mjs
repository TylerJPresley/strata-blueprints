// SPDX-License-Identifier: MIT
// links-check.mjs: every Markdown file in the repo has working relative links and in-page anchors.
// linkProblems(root) returns problem strings; empty means every link resolves.
// Excluded: _internal/, .kiro/, .git/, node_modules/. Links that start with http(s): or mailto: are not fetched.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SKIP = new Set(['_internal', '.kiro', '.git', 'node_modules']);

function markdownFiles(dir, out = []) {
  for (const n of readdirSync(dir).sort()) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) markdownFiles(p, out);
    else if (n.endsWith('.md')) out.push(p);
  }
  return out;
}

// Text outside fenced code blocks, with inline code spans removed.
function prose(text) {
  const keep = [];
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue; }
    if (!fence) keep.push(line.replace(/`[^`]*`/g, ''));
  }
  return keep;
}

// GitHub heading slugs: lowercase, drop punctuation, spaces to hyphens, -1/-2 suffix for repeats.
function anchors(text) {
  const seen = new Map();
  const set = new Set();
  for (const line of prose(text)) {
    const h = line.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (!h) continue;
    const label = h[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_]/g, '');
    const base = label.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    set.add(n ? `${base}-${n}` : base);
  }
  return set;
}

export function linkProblems(root) {
  const problems = [];
  const cache = new Map();
  const anchorsOf = (abs) => {
    if (!cache.has(abs)) cache.set(abs, anchors(readFileSync(abs, 'utf8')));
    return cache.get(abs);
  };
  for (const abs of markdownFiles(root)) {
    const f = relative(root, abs).split('\\').join('/');
    const linkRe = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
    for (const line of prose(readFileSync(abs, 'utf8'))) {
      let m;
      while ((m = linkRe.exec(line))) {
        const raw = m[1];
        if (/^(https?:|mailto:)/i.test(raw)) continue;
        const [file, frag] = [raw.split('#')[0], raw.includes('#') ? raw.slice(raw.indexOf('#') + 1) : null];
        const target = file ? resolve(dirname(abs), file) : abs;
        if (!existsSync(target)) { problems.push(`${f}: broken link ${raw}`); continue; }
        if (frag && target.endsWith('.md') && statSync(target).isFile() && !anchorsOf(target).has(frag.toLowerCase())) {
          problems.push(`${f}: broken anchor ${raw}`);
        }
      }
    }
  }
  return problems;
}
