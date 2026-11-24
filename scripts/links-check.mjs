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

// A code span: a run of N backticks to the next run of N, on one line (the lint's rule).
const CODE_SPAN = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g;

// A fenced block opens at three or more backticks or tildes (a backtick row with another backtick after the run is text) and closes at a row of the same mark at least as long with nothing after it.
const fenceOpen = (t) => { const m = t.match(/^(`{3,}|~{3,})(.*)$/); return m && !(m[1][0] === "`" && m[2].includes("`")) ? { mark: m[1], lang: m[2].trim().split(/\s+/)[0] } : null; };
const fenceCloses = (t, fence) => t[0] === fence.mark[0] && t.length >= fence.mark.length && t === t[0].repeat(t.length);

// Text outside fenced code blocks, with inline code spans removed.
function prose(text) {
  const keep = [];
  let fence = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (fence) { if (fenceCloses(t, fence)) fence = null; continue; }
    const f = fenceOpen(t);
    if (f) { fence = f; continue; }
    keep.push(line.replace(CODE_SPAN, ''));
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
