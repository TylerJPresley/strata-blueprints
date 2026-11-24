# Strata Blueprints

**AI agents:** start with [AGENTS.md](AGENTS.md) for commands, project map and rules.

A lightweight standard for describing any subject in three zoom layers: Vision, Structure and Detail.

Website: <https://stratablueprints.com>

## Table of Contents

- [Background](#background)
  - [What Strata Blueprints is and the problem it solves](#what-strata-blueprints-is-and-the-problem-it-solves)
  - [The three layers](#the-three-layers)
  - [How the layers work together](#how-the-layers-work-together)
  - [One document or separate files](#one-document-or-separate-files)
  - [The standard's files](#the-standards-files)
  - [Worked examples](#worked-examples)
- [Install](#install)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Background

### What Strata Blueprints is and the problem it solves

Strata Blueprints solves the problem that documents for a project usually grow without a shape. Vision, the parts, the rules and the fine points end up mixed together, new ideas pile onto whatever page is nearest, and the next person or model cannot tell what is settled or where to look.

Strata Blueprints describes any subject in three layers: Vision (why it exists), Structure (its parts and where they meet), and Detail (how one part does its job). Use it for spec-driven development, RFPs, software documentation, project steering, standards, policies and ideas. Anyone, or any model, can build the subject from the documents without asking, and a lint script checks them mechanically.

Each of the three layers has a fixed place for each kind of content, so a model knows where to look instead of searching or guessing. Layered inward-only references let a model load only the layers it needs; a change to Detail does not reach the layers above it. One set of layers works for any subject, at any scale, and content belongs in one layer, so it is easy to spot what is out of place.

### The three layers

| Layer | Answers | Holds | Example |
|-------|---------|-------|---------|
| Vision | Why does it exist? | Need, value, audience, success measures, limits | Households on one street have no yard and nowhere to grow food together. A household that joins holds a piece of ground. |
| Structure | What are its parts? | Parts, seams between them and with the outside, scenario paths | Membership, Plots, Water, Shed, Rota. |
| Detail | How does one part work? | Rules, pieces, seams, construction, limits | See the to-do app example for Detail; the garden example stops at Layer 2. |

### How the layers work together

Each layer rests on the layers above it. A change to Vision reaches every layer below it; a change to Detail reaches nothing above it.

- One kind of content per layer. Vision holds why it exists and what matters. Structure holds how it is divided into parts and where they meet. Detail holds how one part does its job. Any content in the wrong layer is easy to spot.

- Fill top down. Settle Vision before Structure, then Detail. Any unknown fact is marked `Not supplied:` and never invented (core guide, section "How the layers depend on each other").

- Changes cascade top down. When Vision changes, every path in Structure and every rule in Detail that cites it reopens and must be settled. Find each with `node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs --impact <id> <blueprint>` (core guide, section "How the layers depend on each other"). Adding or deleting a list item shifts the ids after it; `strata-blueprints.mjs insert` and `delete` print the impact first, then rewrite every citation of a moved id (core guide, bullet on ids).

- Every layer holds costs, risks and open concerns. Every list is a Markdown ordered list, and an item is cited by its id, its topic's number and its place (`8.1`) with the document in front (`vision-8.1`, `structure-8.2`), so a change to one reopens answers that cite it. An unsettled question is an Open Concern with who raised it (core guide, section "Element types").

- Events flow through the layers. Every key scenario is written in Vision as Given/When/Then, one item each under Value, cited by their ids (`vision-3.1`, `vision-3.2`, ...). Each scenario's path through Structure says `Realizes` and that id, keeping the Given and when text the same. Each rule in Detail that realizes it says the same. Following one id shows the whole thread from intent to construction (core guide, section "How to fill it out").

- Decisions are written with their reason. Every choice about means, rules or trade-offs is stated as a decision with why it was chosen, so a later change to the reason reopens it (core guide, section "Rules for the layers").

### One document or separate files

A stack can be written as one document with all three layers, or as separate files in one folder, the blueprint directory (see Usage, With an agent).

One document: write `<subject>.md` in the blueprint directory, with a name that does not start with `sbp-` or `strata-blueprints-`, holding all three layers and all details under `## Layer 1: Vision`, `## Layer 2: Structure` and `## Layer 3: Detail` headings (see the template in `skills/strata-blueprints/assets/strata-blueprints-template.md`).

Separate files: write `sbp-vision.md`, `sbp-structure.md` and one `sbp-detail-<part>.md` per part (for example, `sbp-detail-ledger.md`) in the blueprint directory.

Every document carries a `Status:` line under its title: `Draft`, `Review` or `Approved`. In separate files each file has its own, and `sbp-vision.md` also carries `Blueprint status:`, the status of the whole blueprint. The lint reports them in its `INFO status:` line.

### The standard's files

The skill folder is the single home of the standard. SKILL.md tells an agent which file to load at each step.

| File | Path | What it is | When to read |
|------|------|-----------|--------------|
| SKILL.md | [skills/strata-blueprints/SKILL.md](skills/strata-blueprints/SKILL.md) | How an agent chooses each file to load at each step. Load when building or reviewing a blueprint, or writing one from the owner's request. | Before loading any other file. |
| Core guide | [skills/strata-blueprints/references/strata-blueprints-guide.md](skills/strata-blueprints/references/strata-blueprints-guide.md) | Definitions, rules, how layers depend on each other, how to fill them out, formatting, procedure, interview method, where a project's blueprints live. | Always first, before reading any other file. |
| Layer 1 guide | [skills/strata-blueprints/references/strata-blueprints-guide-layer-1.md](skills/strata-blueprints/references/strata-blueprints-guide-layer-1.md) | Topics in Layer 1: Need, Target audience, Value, Focus, Success measures, Qualities and constraints, Vocabulary, Costs, Risks, Open Concerns, Assumptions, Decisions. Each topic has how to write it, what to ask the owner and what to check. | Before writing or checking Layer 1. |
| Layer 2 guide | [skills/strata-blueprints/references/strata-blueprints-guide-layer-2.md](skills/strata-blueprints/references/strata-blueprints-guide-layer-2.md) | Topics in Layer 2: Parts, Standing, Seams between parts, Seams with the outside, Shared things, Scenario paths, Costs, Risks, Open Concerns, Assumptions, Decisions. | Before writing or checking Layer 2. |
| Layer 3 guide | [skills/strata-blueprints/references/strata-blueprints-guide-layer-3.md](skills/strata-blueprints/references/strata-blueprints-guide-layer-3.md) | Topics in Layer 3: Responsibility, Concepts and states, Seams, Rules, Inside, Limits, Construction, Costs, Risks, Open Concerns, Assumptions, Decisions. | Before writing or checking Layer 3 for a part. |
| Full template | [skills/strata-blueprints/assets/strata-blueprints-template.md](skills/strata-blueprints/assets/strata-blueprints-template.md) | Blank template with every topic of all three layers; optional topics are marked. | Starting a whole stack in one document. |
| Layer 1 template | [skills/strata-blueprints/assets/strata-blueprints-template-layer-1.md](skills/strata-blueprints/assets/strata-blueprints-template-layer-1.md) | Blank Layer 1 only. | Starting Layer 1 alone or Layer 1 of a separate-file stack. |
| Layer 2 template | [skills/strata-blueprints/assets/strata-blueprints-template-layer-2.md](skills/strata-blueprints/assets/strata-blueprints-template-layer-2.md) | Blank Layer 2 only. | Starting Layer 2 alone or Layer 2 of a separate-file stack. |
| Layer 3 template | [skills/strata-blueprints/assets/strata-blueprints-template-layer-3.md](skills/strata-blueprints/assets/strata-blueprints-template-layer-3.md) | Blank entries for one part's Detail. | Starting Layer 3 for one or more parts. |
| Lint script | [skills/strata-blueprints/scripts/strata-blueprints-lint.mjs](skills/strata-blueprints/scripts/strata-blueprints-lint.mjs) | Checks layer structure, topic order, ids, costs, risks, concerns and assumptions. Run it on a document or folder. | Checking a blueprint for warnings. |
| Condense and publish tool | [skills/strata-blueprints/scripts/strata-blueprints.mjs](skills/strata-blueprints/scripts/strata-blueprints.mjs) | Writes a condensed copy of a stack (topics that read None. left out), or publishes it as one document with a table of contents; `insert` and `delete` add or remove one list item and cascade the new ids and every citation through the stack. | Reading or sending a short form of a stack, or sending one document. |
| Published to-do example | [docs/example-published.md](docs/example-published.md) | The to-do app example published as one document with a table of contents. | Seeing what a published blueprint looks like. |
| Lint reference | [docs/lint.md](docs/lint.md) | What each lint check does, how to run it with `--strict` and `--impact`, and exit codes. | Understanding lint output or running it in a gate. |

### Worked examples

| Example | Path | What it shows |
|---------|------|---------------|
| Community garden (idea) | [skills/strata-blueprints/references/strata-blueprints-example.md](skills/strata-blueprints/references/strata-blueprints-example.md) | An idea with Vision and Structure only, no Detail or construction. Shows how to write when it is still a shared vision before anyone builds. |
| To-do app (software) | [skills/strata-blueprints/references/strata-blueprints-example-todo-app/](skills/strata-blueprints/references/strata-blueprints-example-todo-app/) | All three layers, written as separate files. Shows how value ids flow from Layer 1 through paths in Layer 2 to rules in Layer 3. Shows how to write Construction for each part with means and limits. A `README.md` in the folder explains what to notice. |
| Library booking (RFP) | [skills/strata-blueprints/references/strata-blueprints-example-rfp.md](skills/strata-blueprints/references/strata-blueprints-example-rfp.md) | A spec for others to answer: the issuer fixes the need, parts and limits, and the bidder fills the means. Shows how to leave Detail open and mark it `Not supplied:` for the bidder to fill. |

See [docs/example-published.md](docs/example-published.md) for the to-do app published as one document, showing what the publish tool produces.

## Install

Strata Blueprints ships as one agent skill in `skills/strata-blueprints`.

To install with Claude Code:

```
/plugin marketplace add TylerJPresley/strata-blueprints
/plugin install strata-blueprints@strata-blueprints
```

Alternatively, copy `skills/strata-blueprints/` by hand into your agent's skills folder (for example, `~/.claude/skills/` or `.agents/skills/`).

The lint script requires Node.js 22 or later.

## Usage

### With an agent

Quickstart: install the skill (see Install), then ask your agent using one of these prompts.

> Use the Strata Blueprints skill. I am building a [subject]. Fill the blueprint layer by layer, starting with Vision. Ask me for each assertion and confirm before moving to the next layer.

> Use the Strata Blueprints skill to review [blueprint file or folder]. Go layer by layer and report each finding with its fix.

> Use the Strata Blueprints skill to build the [part] part from [blueprint file or folder]. Ask me wherever the blueprint says `Not supplied:`.

A project says where its blueprints live with a line in its `AGENTS.md`, in any section, and fixes the form with a second line. The line below is the default directory, so a project that wants it writes nothing.

```
Strata Blueprints Directory: docs/blueprints/
```

Directory is a directory relative to the project root, never a file. Form is `single` (one document) or `separate` (one file per layer), written as `Strata Blueprints Form: single` or `Strata Blueprints Form: separate`. When Form is not stated, the blueprint is one document until it needs to be split into separate files (core guide, "A stack in separate files"). The agent resolves both, gives the path to the lint and the tool, and moves a blueprint between the forms only when Form is not stated, keeping every id (core guide, "Where the blueprints live").

### By hand

1. Start from a template: choose one from `skills/strata-blueprints/assets/` based on whether you are writing all three layers in one document or splitting them into files.
2. Follow the core guide ([skills/strata-blueprints/references/strata-blueprints-guide.md](skills/strata-blueprints/references/strata-blueprints-guide.md)) and the guide for each layer you write.
3. Run the lint to check structure and count unsettled items:

```sh
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs <path-to-blueprint.md or folder>
```

Lint a folder as a whole: a lone Detail file draws layer warnings because it has no Layer 1 or 2. Paths in this README start at the repository root; in the skill's own files `scripts/...` means the skill folder's scripts (`skills/strata-blueprints/scripts/` here).

See [docs/lint.md](docs/lint.md) for what each check does, how to use `--strict` to fail on warnings, and how to use `--impact <id>` to find what a change reaches.

To read or send a short form of a stack, write a condensed copy that leaves out each topic that reads `None.`. To send one document, publish the stack: it condenses, merges the files and adds a table of contents. See [docs/tool.md](docs/tool.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the human workflow and the rules that bind contributors. See [AGENTS.md](AGENTS.md) for agent execution rules.

## License

MIT (see [LICENSE](LICENSE))
