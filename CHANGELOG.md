# Changelog

This changelog records releases of Strata Blueprints. The `Version:` line of `skills/strata-blueprints/references/strata-blueprints-guide.md` is the single source of the version, and the owner chooses release tags.

## 0.4.0

Every list item in a blueprint is numbered, so every item can be cited by its full id.

- Core guide and layer guides: every list item is written `- <topic>.<count>. text`, in every topic of every layer; Target audience, Success measures, Qualities and constraints, Vocabulary, Parts, Standing, Seams between parts, Seams with the outside, Shared things, Concepts and states, Seams and Inside are now numbered like the other topics; a paragraph stays a paragraph; a line nested under an item belongs to it; `None.` and `Not supplied:` lines carry no number.
- Lint: the `id` check warns on an unnumbered list item under any topic of a written layer (exit 1 under `--strict`). A paragraph is checked only under the topics where it was checked before. Parts and Standing lines may start with their number; the lint and the tool read the part name after it.
- Breaking for blueprints: a blueprint with an unnumbered list item now draws an `id` warning. Write each missing number once; an item's number never changes and no script renumbers.
- Templates, the three examples and the published example number every list item; every number that existed is unchanged.
- Existing test lines changed: see the plan's list; no assertion was weakened.

## 0.3.0

Fixes from a test run in which the standard was used to write a blueprint of this project.

- Lint: `ring` skips code spans.
- Lint: `--impact` takes several ids joined by commas, each printing its block in the order given, with one empty line between blocks. Exit codes: 0 when every id is defined; 1 when any id is not defined; 2 for usage error.
- Lint: new advisory check `limit-quality` warns when a Limit cites a quality by name that Layer 1 Qualities and constraints does not name; silent when the cited item is a Layer 1 id (`vision-N.M`; an id of another document warns), when `Not supplied:` is read, or when Layer 1 names no qualities in bold. A quality's name is the first bold pair in an item, or a plain leading `Name:` when another item of the topic holds a bold name.
- Lint: new advisory check `realizes-text` warns when a Layer 2 or Layer 3 element rewords the Given and when text of the Layer 1 scenario it realizes; a `Realizes` sentence inside a code span is not read.
- Lint: `scenario-form` also warns when a Value item, a path or a `Realizes` item does not start with `Given`.
- Templates: each layer cut opens as the file it becomes, with the title row, the metadata lines, and every heading at the full template's level.
- Guide: a quality a Limit cites is written in bold, and a Limit may cite a Layer 1 id in place of the name; a test is named by its title and a source's parts by their names, never by a count or a place; a rule split off a long rule takes the next free number; a settled Open Concern is named in the Decision or Assumption that settles it; a Decision may take its reason from a commit or a document; a blueprint of an existing project names the version of its sources in the Scope line; a numbered Shared things item counts from 1.
- Guide: a group of tests is named by its shared title prefix, and a count the program prints stays; the item that settles an Open Concern names it without a fixed field; a reason comes from a commit message or a document, and a title that only states the change gives none; the version in a Scope line is the sources' own, and a re-read source moves its version in that line; the Layer 1 guide no longer calls bold optional for a quality a Limit cites.
- Core guide and guides: a Detail cites a numbered Shared things item; a project's tests are a source and a subject's tests are run against the build; every fenced block carries a `Title:` line; Layer 1 may name what the subject does.
- Lint: new advisory check `fence` warns once at the row that opens a fenced block if it is never closed; a block that ends a file hides all later lines until it closes.
- Core guide: Formatting section, new bullet on Markup says how to write marker words in code spans or fenced blocks; a span opens with N backticks and closes at the next run of N on the same line, so a span opened with two backticks may hold one; a fenced block opens at a row that starts with three or more backticks or tildes (a backtick row with another backtick after the run is text) and closes at a row of the same mark that is at least as long; close every fence.
- Layer 3 guide: Rules now shows how to write an exact contract: when a rule gives an exact string or operation, it states for each element whether it is filled in or printed as is; what ordered by which key; for splits, trims and comparisons whether they are case-sensitive, trim, first or last; and whether a state like an open fence carries across the files of a stack. A rule for a function that a test calls says what it returns with the keys of an object and what it throws with the message. Where a test reads the program's own text or an environment variable the rule names the text or the variable and the test. A rule that skips a case names the checks it skips and the checks that apply.
- Core guide: Starting from an existing project now says: a source that feeds a whole layer or file names a shared source once in its `Scope:` line; what the sources show is written as Rules, Limits or Construction, and an item with another source ends with `Source: <file or document>`; what sources only suggest (intent, reasons) is written as an Assumption with its `Basis:`; a choice the sources show with no reason is a Decision with `Reason: Not supplied:` when the reason is needed; where two sources disagree write an Open Concern naming both; for a program's exact text the program outranks its documentation (difference is an Open Concern); ask the owner only for intent the sources cannot show, otherwise write `Not supplied:` and keep `Status: Draft`; when sources change re-read each named source, list the items it feeds, run `--impact` on each id changed, and settle what it reaches; a `Not supplied:` that a source now answers stays until the owner confirms; an Open Concern names the source that answers it; a settled Open Concern becomes a Decision or Assumption with a new id.
- Lint, publish and links check: code spans are read by one rule: N backticks to the next run of N backticks on the same line. The `Not supplied:` count, citations in publish, and the links check use this rule, so a span opened with double backticks can hold a single backtick and is properly skipped.
- Lint, publish and links check: fenced blocks are read by one rule, on the trimmed row, so a fence may be indented to any depth: a fence opens at a row that starts with three or more backticks or tildes (a backtick row with another backtick after the run is text, so it does not open a fence) and closes at a row of the same mark that is at least as long and has nothing after it. A closing row must be at least as long as the opening run.
- Lint: `unfinished` skips fenced blocks and code spans; a span opened with N backticks closes at the next run of N backticks on the same line, so it can hold a single backtick.
- Lint: `scenario-form` check applies only where tracing needs it: Layer 1 Value scenarios, Layer 2 Scenario path items, and any item that says `Realizes <id>`. A rule may be written plainly elsewhere (Costs, Risks, Open Concerns keep their shapes).
- Lint: the error for a folder that holds no `sbp-` files says to pass the file to lint one document. The exit code stays 2.
- Lint: `scenario-trace` asks for a Layer 3 rule only for a Layer 1 scenario whose Layer 2 path runs through a part that has a Layer 3 entry. A part with no entry no longer draws a warning for every scenario. The warning carries the matched path id and part names.
- Lint: new `status` check validates Status and Blueprint status line values (Draft, Review or Approved). The `INFO status:` line reports the status of each file in the stack and the blueprint status when present.
- Lint: metadata lines (Version:, Status:, Blueprint status:, Parent:) in the top matter are accepted in every file and in folders excluded from the `INFO not-supplied` count; in a single document they are counted if they contain `Not supplied:`.
- Publish: when the first file (Vision) carries a `Blueprint status:` line, it is published as `Status:` and the Vision's own `Status:` line (if present) is dropped. Metadata lines from later files are dropped from the published document.
- Core guide: Rule 4 says a part with no entry in the stack is built from its Layer 2 entry alone or from its own stack. The single-document file name does not start with `sbp-` or `strata-blueprints-`. The `Version:` line under the title is the blueprint's own version.
- Layer 3 guide: the Check for Rules is reworded to the P7 scope: rules that realize a Layer 1 Value scenario or a Layer 2 path are scenarios; other rules may be written plainly.
- The Layer 3 template cut and "How to fill it out" say one entry for each part that has Detail. README names the file-name rule.
- Five existing test lines changed: the scenario-form 1-warning case moved under `### 3. Value`; four Status field assertions became `Status: Draft` (capitalized) from lowercase `status: draft`; the examples test helper `assemble` skips the metadata lines after a title as the lint does (and the folder-against-document lint comparison asserts the folder's `INFO status:` line and the document's `INFO status:` line exactly, then compares the remaining lines); no assertion was weakened.
- Layer 3 guide: when a program builds a part and tests check it, its Rules and Limits carry "the contract the tests assert" (the exact strings it prints, its inputs and outputs as signatures, and Given, when, then cases), so that someone with only the blueprint can build a part that passes.
- Layer 2 guide: the Standing topic says that in a stack written as one document a part with no Layer 3 entry reads `Docs: no Detail here`, and that in separate files such a part has no file and no Standing line. Standing holds only `Name: value` lines, one for each part; the lint reads only those lines and ignores any other line under Standing.
- Layer 1 and Layer 2 guides: each has a `Holds:` field stating that the layer holds intent only.
- Layer guides: the field that says when a layer is written is renamed `Written:` (it was `Status:`, which reads like the document's `Status:` line).
- Layer 2 guide: the sentence that let one sentence cover every part's standing is removed; Standing holds only `Name: value` lines.
- Lint and tool: `Parent:` is read as a metadata line in the top matter, with `Version:`, `Status:` and `Blueprint status:`.
- Publish: when the Vision has a `Blueprint status:` line, the published document carries it as `Status:` and the Vision's own `Status:` line is dropped; otherwise the Vision's own `Status:` stays. The `Status:` lines of the Structure and Detail files are dropped with the other metadata lines.
- The full template, the three layer cuts, the three examples and the published example carry `Status:` lines (`Blueprint status:` in the Vision cut and the to-do Vision). The README describes the lines. The Vision cut and the three examples also carry `Version:`. The gate checks the Status lines of the cuts and the full template, `Version:` in the Vision cut, and that `Version:` comes before `Status:` in the full template. The tool and every test pass under the new rules.

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
