# Changelog

This changelog records releases of Strata Blueprints. The `Version:` line of `skills/strata-blueprints/references/strata-blueprints-guide.md` is the single source of the version, and the owner chooses release tags.

## 0.3.0

Fixes from a test run in which the standard was used to write a blueprint of this project.

- Lint: `scenario-trace` asks for a Layer 3 rule only for a Layer 1 scenario whose Layer 2 path runs through a part that has a Layer 3 entry. A part with no entry no longer draws a warning for every scenario. A path that names no part listed in Parts keeps the old requirement.
- Lint: the error for a folder that holds no `sbp-` files says to pass the file to lint one document. The exit code stays 2.
- Core guide: Rule 4 says a part with no entry in the stack is built from its Layer 2 entry alone or from its own stack. "A stack in separate files" counts the split limit in words. The single-document file name does not start with `sbp-` or `strata-blueprints-`. The `Version:` line under the title is the blueprint's own version.
- The Layer 3 template cut and "How to fill it out" say one entry for each part that has Detail. README names the file-name rule.
- The condense and publish tool, the full template, the examples and every existing test are unchanged.

## 0.2.0

A project says where its blueprints live, and the skill finds them there.

- Two lines in a project's `AGENTS.md`, `Strata Blueprints Directory: docs/blueprints/` and `Strata Blueprints Form: single` or `separate`, name the blueprint directory and the form. Directory defaults to `docs/blueprints/`. When Form is not stated, the blueprint is one document until it reaches the limit in "A stack in separate files", then it is split into separate files.
- Core guide: the new section "Where the blueprints live" covers the two lines, how they are read, a missing directory, and moving a blueprint between forms, only when Form is not stated, with every id and sentence kept.
- `SKILL.md`: AUTHOR and BUILD resolve the location first and give it to the scripts as an explicit argument.
- README, `docs/lint.md` and `docs/tool.md` say where the path comes from.
- The lint, the condense and publish tool, the templates, the examples and every test are unchanged. The scripts take the path they are given and never read `AGENTS.md`.

## 0.1.0

First release: a lightweight standard for describing any subject (an RFP, software documentation, project steering, a standard, a policy, an idea and more) in three layers, delivered as one skill with its lint, templates, examples and gate.

- One skill, `skills/strata-blueprints/`, the single home of the standard and the only source. `SKILL.md` is a router with three tasks: write, review and build. Layout: `SKILL.md`, `LICENSE`, `references/`, `assets/` and `scripts/`.
- The guides: a core guide and one guide per layer (Vision, Structure, Detail) of 12, 11 and 12 topics. Each topic has How to write it, Ask the owner and Check. A layer that is written holds all of its topics, and a topic with nothing to say reads `None.`. Every item in the cited topics is numbered under its own topic, such as `9.1`, and its id, the document in front joined by a hyphen (`vision-9.1`), is what a citation and `--impact` write.
- Templates: a full blank template with every topic of every layer, and one cut for each layer.
- Three worked examples: a community garden that is still an idea, a to-do app written as a stack of separate files, and a library room booking RFP, a spec for others to answer.
- The lint, `skills/strata-blueprints/scripts/strata-blueprints-lint.mjs`: an advisory check of layers, topics (each one present), entries, ids and their citations, costs, risks, open concerns, and the reasons behind assumptions and decisions. It lints a single file or a folder, and `--impact <id>` lists every element a change reaches.
- Split-file blueprints: a stack written as separate files with `sbp-` names (`sbp-vision.md`, `sbp-structure.md`, `sbp-detail-<part>.md`).
- `docs/lint.md`: what each lint check does, exit codes, `--strict` and `--impact`.
- The gate, `gate.mjs`: links across every Markdown file, skill layout, template cuts, versions, the tests, and `--strict` lints of the three examples.
- A Claude Code marketplace manifest, `.claude-plugin/marketplace.json`.
- Community files: contributing guide, code of conduct, security policy, issue and pull request templates.
- Licensing: MIT, see `LICENSE`.
- Condensed copies: `scripts/strata-blueprints.mjs` has `condense`, which writes a copy that leaves out each topic whose whole body is `None.`. The lint reads a condensed file (marker on line 1) and still checks topic order and citations.
- Published documents: `publish` condenses a stack, merges all of its files into one document with a table of contents, leaves out each topic that holds only `Not supplied:` lines, and is shown in [docs/example-published.md](docs/example-published.md) (the to-do app published as a worked example). Numbers and ids stay as in the source, the command prints what it left out and what stays open, and the lint reads the file as a condensed copy.
