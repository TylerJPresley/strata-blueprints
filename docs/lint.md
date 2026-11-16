# Verify a Strata Blueprints document

The lint script checks the structure of Strata Blueprints documents mechanically. It flags structural problems and counts cells marked `Not supplied:`.

## Run the lint

To check a single document:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs path/to/document.md
```

To check a stack written as separate files in a folder:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs path/to/stack-folder
```

For a folder, the lint reads `sbp-vision.md`, `sbp-structure.md` and every `sbp-detail-*.md` in it as one stack, ignores every other file, and reports each warning with its file and line.

The lint takes the path you give it and does not read `AGENTS.md`; an agent resolves the path first (see the core guide, Where the blueprints live). A folder run reads only `sbp-` files, so pass a single document as a file.

To write a condensed copy of a stack, or to publish it as one document, see [tool.md](tool.md).

## Output

The script produces three kinds of output:

### Warnings

`WARN <check>: <message> (line N)` flags a structural problem the script can decide. The checks are:

- `unfinished` — marker `TODO`, `TBD` or `FIXME` found
- `diagram-title` — fenced block has no `Title:` line before it
- `diagram-key` — mermaid diagram `Title:` line has no `Key:`
- `layer-heading` — layer heading wrong, out of order, or Layer 1 or Layer 2 missing; for a folder, also flags a file holding a layer other than the one its name declares
- `scope-line` — first line after a layer heading does not start with `Scope:`
- `topic-order` — topic not in the layer, out of order, or inside a `### Part (part)` entry where it does not belong
- `topics` — a layer, or a part's `### Part (part)` entry, that has topic headings lacks one of its topics; a layer with no topic heading and a layer that is absent are not checked; a file whose first line is the condensed marker (a published document carries one) is not checked for missing topics
- `ring` — a layer refers outward to a later layer
- `scenario-form` — `Given` line not shaped `Given ..., when ..., then ...`
- `reasons` — assumption missing `Basis:` and `If wrong:`, or decision missing `Reason:`
- `scenario-trace` — a Layer 1 scenario is realized by no path in Layer 2 or no rule in Layer 3
- `cost-shape` — a cost is malformed or does not follow `<number>. Given <condition>, when <subject state>, then it costs <amount>. Paid by <who>.`
- `risk-shape` — a risk is malformed or does not follow `<number>. Given ..., when ..., then .... Severity: High|Medium|Low|Not rated. Answered by <answer>.`
- `concern-shape` — an open concern is malformed or does not follow `<number>. Given ..., when ..., then .... Raised by <who>.`
- `id` — an item's number is not what its place says: a topic number that does not fit its topic, a repeat in the same document, an item under a topic that needs numbers with no number, a full id written at the start of an item (write the number), a part name that is not a part in Layer 2 Parts, or a part name that is not one word
- `id-ref` — an element cites an id that is defined nowhere, an id of a deeper layer or an id of another part
- `risk-ref` — a risk's `Answered by` field cites an id that does not exist, or cites an id defined in a later layer
- `standing` (folder only) — for folder mode, a Standing line names a missing detail file, or a detail file is not named by any Standing line

In the shape lines, `<number>` is the item's number under its topic, such as `8.1`. The lint derives the item's full id from the document it sits in and its number: `6.1` under Limits in the part Ledger is `detail.ledger-6.1`.

### Info line

`INFO not-supplied: N` means N cells are marked `Not supplied:` and are ready to be asked for.

### Exit codes

- `0`: no warnings
- `1`: at least one warning, with `--strict`
- `2`: file does not exist, or a folder holds none of `sbp-vision.md`, `sbp-structure.md` or `sbp-detail-*.md` files

Warnings are advisory; exit code 0 indicates the script ran successfully.

## Use --strict

Exit with code 1 if any warnings are found:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs path/to/document.md --strict
```

Use this in a gate to fail a build when warnings are present.

## Use --impact

To list every element that a change reaches, give the full id of the element that changed, such as `vision-9.1` or `detail.ledger-7.2`. A bare number such as `7.2` is not an id. For example:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs --impact vision-9.1 path/to/document.md
```

The output is a tree of every element that cites the id, directly or through other elements, with its depth, place, layer, topic and first words. Exit codes:

- `0`: the id is defined and the tree is shown
- `1`: the id is not defined
- `2`: usage error
