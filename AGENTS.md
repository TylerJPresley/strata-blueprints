# Agents in Strata Blueprints

Strata Blueprints is a lightweight standard for describing any subject in three layers (Vision, Structure, Detail). Edit `skills/strata-blueprints` directly; run `node gate.mjs` before finishing.

Overview for people: [README.md](README.md).

## Commands

- Gate: `node gate.mjs` (runs all checks)
- Test (all): `npm test`
- Test (single file): `node --test tests/strata-blueprints-lint.test.mjs` (or the examples, version-check or links-check test)
- Lint (file): `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs <file.md> --strict`
- Lint (folder): `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs <folder> --strict`
- Impact: `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs --impact <id> <file or folder>`
- Condense: `node skills/strata-blueprints/scripts/strata-blueprints.mjs condense <file or folder> --out <path>`
- Publish: `node skills/strata-blueprints/scripts/strata-blueprints.mjs publish <file or folder> --out <file>`
- Ids: `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs --ids <file or folder>`
- Insert an item: `node skills/strata-blueprints/scripts/strata-blueprints.mjs insert <id> <file or folder> [--text <text> | --text-file <path> | --needs <text>] [--apply]`
- Delete an item: `node skills/strata-blueprints/scripts/strata-blueprints.mjs delete <id> <file or folder> [--apply] [--ack <handle>]`
- Lint reference: [docs/lint.md](docs/lint.md) (what each check does, exit codes, `--strict` and `--impact` usage)

Pre-flight: run `npm test` and `node gate.mjs` before every commit.

## Stack

Node.js LTS 22 and 24 (`engines.node` is `>=22` in `package.json`), ES modules, no dependencies. CI runs `node gate.mjs` on Node 22 and 24 (`.github/workflows/gate.yml`).

## Map

- `skills/strata-blueprints/` is the single home of the standard and the only source:
  - `SKILL.md`: skill instructions (how to write, review and build)
  - `LICENSE`: MIT
  - `references/`: core guide, one guide file per layer, examples (community garden idea, to-do app as separate files, library room booking RFP)
  - `assets/`: full template and one cut per layer
  - `scripts/strata-blueprints-lint.mjs`: the lint script
  - `scripts/strata-blueprints.mjs`: the condense and publish tool
- `tests/`: tests for the lint, examples, version check and links check
- `scripts/version-check.mjs`: verifies versions across files match (runs in the gate)
- `scripts/links-check.mjs`: verifies relative links and anchors in every Markdown file (runs in the gate)
- `docs/lint.md`: the lint reference
- `docs/index.html`, `docs/CNAME`, `docs/.nojekyll`: the GitHub Pages redirect from stratablueprints.com to the repository
- `gate.mjs`: root-level gate, runs all checks
- `.claude-plugin/marketplace.json`: Claude Code plugin manifest
- Blueprints (written by users): not in this repo; point tools at this skill or copy `skills/strata-blueprints` into a project.

## Conventions

The skill folder holds exactly `SKILL.md`, `LICENSE`, `references/`, `assets/` and `scripts/`. No files are generated or copied from elsewhere. The `name` in SKILL.md front matter must equal the folder name `strata-blueprints`.

Blueprint files follow the naming pattern `sbp-<layer>.md` for the three layers and `sbp-detail-<part>.md` for each part's Detail in a stack of separate files. A stack written in one file omits the `sbp-` prefix and uses layer headings instead.

Example: a subject can be written as one file `mybp.md`, or as a folder `mybp/` holding `sbp-vision.md`, `sbp-structure.md`, and one `sbp-detail-<part>.md` per part.

Stack folder structure:

```
mybp/
  sbp-vision.md
  sbp-structure.md
  sbp-detail-part1.md
  sbp-detail-part2.md
```

## Boundaries

### Always

- Run `node gate.mjs` before finishing.
- Edit `skills/strata-blueprints` directly.
- Fix the code when a test fails; a failing test signals a real problem.

### Ask first

- Changing the standard's rules or topics (propose it as a standard change issue first; build agreement before coding).
- Changing the licence.
- Changing `.claude-plugin/marketplace.json`.
- Adding a file to the skill folder.

### Never

- Add a dependency.
- Commit secrets.
- Change or delete a test assertion to get green.

## PR review guidelines

Flag:

- `node gate.mjs` failing or not run.
- A changed or deleted test assertion.
- A change to the standard's rules or topics with no "Standard change" issue.
- A file added to `skills/strata-blueprints/` beyond `SKILL.md`, `LICENSE`, `references/`, `assets/` and `scripts/`.
- A guide change with no matching update to the worked examples and README.
- A new dependency, or a secret.
- A lint-script change with no test.
- AI assistance not disclosed in the pull request.

Ignore:

- Wording preferences that change no rule.
- Line wrapping.

Git, changelog, dependencies and review rules: [CONTRIBUTING.md](CONTRIBUTING.md).

Licenses allowed: MIT
