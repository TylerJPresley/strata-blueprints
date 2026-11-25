# Agents in Strata Blueprints

Strata Blueprints is a lightweight standard for describing any subject in three layers (Vision, Structure, Detail). Edit `skills/strata-blueprints` directly; run `node gate.mjs` before finishing.

Overview for people: [README.md](README.md).

## Commands

- Gate (templates, links, layout, all unit tests, strict example lints, version sync): `node gate.mjs`
- Test (all): `npm test`
- Test (single file): `node --test tests/<name>.test.mjs` (`strata-blueprints-lint`, `strata-blueprints-tool`, `strata-blueprints-publish`, `strata-blueprints-examples`, `version-check`, `links-check`, `gate`)
- Lint worked examples (`--strict`):
  - `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs skills/strata-blueprints/references/strata-blueprints-example.md --strict`
  - `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs skills/strata-blueprints/references/strata-blueprints-example-todo-app --strict`
  - `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs skills/strata-blueprints/references/strata-blueprints-example-rfp.md --strict`
- Regenerate published To-Do App example (`docs/example-published.md`): `node skills/strata-blueprints/scripts/strata-blueprints.mjs publish skills/strata-blueprints/references/strata-blueprints-example-todo-app --out docs/example-published.md`
- Tool CLI (`condense`, `publish`, `insert`, `delete`): `node skills/strata-blueprints/scripts/strata-blueprints.mjs <subcommand> ...` (reference: [docs/tool.md](docs/tool.md))
- Lint CLI (`--strict`, `--impact <id>`, `--ids`): `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs ...` (reference: [docs/lint.md](docs/lint.md))

Pre-flight: run `npm test` and `node gate.mjs` before every commit.

## Stack

Node.js LTS 22 and 24 (`engines.node` is `>=22` in `package.json`), ES modules (`.mjs`), zero external dependencies, built-in `node:test` runner. CI runs `node gate.mjs` on Node 22 and 24 (`.github/workflows/gate.yml`).

## Map

- `skills/strata-blueprints/` — Single home of the distribute-ready skill and the only source:
  - `SKILL.md` — Skill entry point and step-by-step file loader instructions
  - `LICENSE` — MIT
  - `references/` — Core guide (`strata-blueprints-guide.md`), per-layer guides (`strata-blueprints-guide-layer-{1,2,3}.md`), and worked examples (`strata-blueprints-example.md`, `strata-blueprints-example-todo-app/`, `strata-blueprints-example-rfp.md`)
  - `assets/` — Full template (`strata-blueprints-template.md`) and per-layer cuts (`strata-blueprints-template-layer-{1,2,3}.md`)
  - `scripts/strata-blueprints-lint.mjs` — Blueprint linter (`--strict`, `--impact`, `--ids`)
  - `scripts/strata-blueprints.mjs` — Blueprint tool (`condense`, `publish`, `insert`, `delete`)
- `tests/` — Unit and integration test suites (`*.test.mjs`) for the linter, tool, publish output, worked examples manifest, version check, link check, and gate
- `scripts/version-check.mjs` — Verifies version consistency across the repository (run by `gate.mjs`)
- `scripts/links-check.mjs` — Verifies relative links and heading anchors across all Markdown files (run by `gate.mjs`)
- `docs/lint.md` — Reference documentation for `strata-blueprints-lint.mjs`
- `docs/tool.md` — Reference documentation for `strata-blueprints.mjs` (`condense`, `publish`, `insert`, `delete`)
- `docs/example-published.md` — Published single-document output of the To-Do App example
- `docs/index.html`, `docs/CNAME`, `docs/.nojekyll` — GitHub Pages redirect from `stratablueprints.com` to the repository
- `gate.mjs` — Root repository quality gate
- `.claude-plugin/marketplace.json` — Claude Code plugin marketplace manifest

## Conventions

- **Skill folder layout (`layoutCheck` in `gate.mjs`):** `skills/strata-blueprints/` holds exclusively `SKILL.md`, `LICENSE`, `references/`, `assets/`, and `scripts/`. No extra files or subdirectories are permitted, and `name` in `SKILL.md` frontmatter must equal `strata-blueprints`.
- **Template cuts (`templateProblems` in `gate.mjs`):** `skills/strata-blueprints/assets/strata-blueprints-template.md` is the master template. Each `strata-blueprints-template-layer-{1,2,3}.md` file is a row-for-row cut of its matching `## Layer N:` section in the full template. Always edit `strata-blueprints-template.md` first, then update the matching layer cut so `node gate.mjs` passes.
- **Single source of version (`scripts/version-check.mjs`):** The `Version:` line in `skills/strata-blueprints/references/strata-blueprints-guide.md` is the single source of truth and must match the top released heading in `CHANGELOG.md`, `package.json` (`version`), `skills/strata-blueprints/SKILL.md` (`metadata.version`), and `.claude-plugin/marketplace.json` (`metadata.version`).
- **Worked examples & docs parity:** Every worked example in `skills/strata-blueprints/references/` is registered in `tests/strata-blueprints-examples.test.mjs` (`MANIFEST`) and must lint with `0` warnings under `--strict`. When changing a guide rule, template, or the To-Do App example, update the matching examples, `README.md`, `docs/lint.md`, `docs/tool.md`, and `docs/example-published.md` in the same change.
- **Markdown link & command integrity (`linksCheck` in `gate.mjs`):** Every relative link and `#anchor` in every `.md` file must resolve, and every fenced `node <path>.mjs` command in `README.md` and `CONTRIBUTING.md` must point to an existing file relative to the repo root.

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
