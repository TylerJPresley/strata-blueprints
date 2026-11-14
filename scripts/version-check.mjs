// SPDX-License-Identifier: MIT
// version-check.mjs: the guide's Version line is the single source of the version.
// versionProblems(root) returns problem strings; empty means every copy agrees:
// the top released CHANGELOG heading, package.json, .claude-plugin/marketplace.json and the skill's metadata version.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function versionProblems(root) {
  const guide = join(root, 'skills', 'strata-blueprints', 'references', 'strata-blueprints-guide.md');
  const changelog = join(root, 'CHANGELOG.md');
  if (!existsSync(guide)) return [`skills/strata-blueprints/references/strata-blueprints-guide.md is missing`];
  if (!existsSync(changelog)) return [`CHANGELOG.md is missing`];
  const vm = readFileSync(guide, 'utf8').match(/^Version:\s*(\S+)\s*$/m);
  if (!vm) return [`no 'Version:' line in skills/strata-blueprints/references/strata-blueprints-guide.md`];
  const version = vm[1];
  const problems = [];

  let topReleased = null;
  for (const line of readFileSync(changelog, 'utf8').split('\n')) {
    const hm = line.match(/^##\s+(.+?)\s*$/);
    if (hm && hm[1] !== 'Unreleased') { topReleased = hm[1]; break; }
  }
  if (topReleased === null) problems.push(`CHANGELOG.md has no released heading`);
  else if (topReleased !== version) problems.push(`guide Version ${version} does not equal top released CHANGELOG heading ${topReleased}`);

  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) problems.push(`package.json is missing`);
  else {
    let pkgVersion;
    try { pkgVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version; } catch { pkgVersion = undefined; }
    if (pkgVersion !== version) problems.push(`package.json version ${pkgVersion} does not equal guide Version ${version}`);
  }

  for (const f of ['skills/strata-blueprints/SKILL.md']) {
    const p = join(root, f);
    if (!existsSync(p)) { problems.push(`${f} is missing`); continue; }
    const m = readFileSync(p, 'utf8').match(/^\s+version:\s*"?([^"\s]+)"?\s*$/m);
    if (!m || m[1] !== version) problems.push(`${f} version ${m ? m[1] : 'missing'} does not equal guide Version ${version}`);
  }

  const mp = join(root, '.claude-plugin', 'marketplace.json');
  if (!existsSync(mp)) problems.push(`.claude-plugin/marketplace.json is missing`);
  else {
    let mv;
    try { mv = JSON.parse(readFileSync(mp, 'utf8'))?.metadata?.version; } catch { mv = undefined; }
    if (mv !== version) problems.push(`.claude-plugin/marketplace.json metadata.version ${mv} does not equal guide Version ${version}`);
  }
  return problems;
}
