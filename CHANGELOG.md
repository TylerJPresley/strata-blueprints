# Changelog

This changelog records releases of Strata Blueprints. The `Version:` line of `skills/strata-blueprints/references/strata-blueprints-guide.md` is the single source of the version, and the owner chooses release tags.

## Unreleased

- Condensed copies: `scripts/strata-blueprints.mjs` has `condense`, which writes a copy that leaves out each topic whose whole body is `None.`. The lint reads a condensed file (marker on line 1) and still checks topic order and citations.
- Published documents: `publish` condenses a stack, merges all of its files into one document with a table of contents, leaves out each topic that holds only `Not supplied:` lines, and is shown in [docs/example-published.md](docs/example-published.md) (the to-do app published as a worked example). Numbers and ids stay as in the source, the command prints what it left out and what stays open, and the lint reads the file as a condensed copy.

## 0.1.0

First release (not yet tagged): a lightweight standard for describing any subject (an RFP, software documentation, project steering, a standard, a policy, an idea and more) in three layers, delivered as one skill with its lint, templates, examples and gate.

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
