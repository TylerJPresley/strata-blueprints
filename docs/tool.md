# Condense and publish a blueprint

`skills/strata-blueprints/scripts/strata-blueprints.mjs` writes a condensed copy of a stack for reading or sending on, or publishes the stack as one document. It needs Node.js 22 or later and no packages. The full working files stay the source; a condensed copy and a published document are generated and never edited by hand. The way is one way: the source, then a condensed copy, then a published document.

The tool reads spans and fences the way the lint does. A code span opens with a run of backticks and closes at the next run of the same length on the same line. A fenced block opens at a row that starts with three or more backticks or tildes (a backtick row with another backtick after the run is text) and closes at a row of the same mark that is at least as long and has nothing after it. Each row is trimmed before it is tested, so a fence may be indented to any depth, and a closing row may be indented too.

## Run it

```
node skills/strata-blueprints/scripts/strata-blueprints.mjs condense <file.md or folder> --out <path> [--force]
```

Give a file and `--out` names a file. Give a folder and `--out` names a folder, created when absent. A folder run reads `sbp-vision.md`, `sbp-structure.md` and every `sbp-detail-*.md`, writes the same names into `--out`, and copies nothing else. Each file is written on its own and files are never merged during condense. With no arguments the tool prints its usage and exits 0.

Each file written prints one line during condense: `condensed <path>: dropped N topic(s)`.

Condense refuses a published document as input.

Exit code 1 and the other behaviors that this page marks as uncaught or accidental are observed, not promised, and may change. Script paths here start at the repository root (`skills/strata-blueprints/scripts/...`); in the skill's own files `scripts/...` means the skill folder's scripts.

Exit codes: 0 for success; 2 for a refusal or a usage error, with `strata-blueprints: <message>` on stderr and nothing written.

## What condense drops

Condense leaves out a topic only when its whole body is the single line `None.`. All other cases keep the topic:
- `None.` followed by another line
- `1. None.`, `**None.**`, or `None` without the period
- A fenced code block inside the topic
- Any line with `Not supplied:` anywhere

Kept topics keep their numbers, so every id and citation is the same in the copy and the source.

A layer keeps its heading and its `Scope:` line even when all its topics are dropped. Headings inside fenced blocks, headings not in the layer's topic list (such as `## View:` or `### Diagrams`), and view blocks never have their topics dropped.

The marker, line endings and file names stay as they are. A condensed file never contains anything generated beyond the marker itself.

A condensed file can be condensed again; the result is the same.

## The condensed marker

Line 1 of a condensed file is:
```
<!-- strata-blueprints: condensed (generated; omitted topics read None.) -->
```
followed by a blank line.

The lint reads this marker on line 1 of a file without checking for missing topics (because they were dropped on purpose), but still checks topic order and every citation.

Running condense twice on the same input gives the same result, byte for byte. The way back is the source: change the full working files and generate the copy again.

## Publish

```
node skills/strata-blueprints/scripts/strata-blueprints.mjs publish <file.md or folder> --out <file> [--force]
```

Publish reads the source files or a condensed copy. It writes one file. The input may be a single document file or a folder of `sbp-` files.

See [example-published.md](example-published.md), created with `node skills/strata-blueprints/scripts/strata-blueprints.mjs publish skills/strata-blueprints/references/strata-blueprints-example-todo-app --out docs/example-published.md`, for a worked example of the output.

### The merge

When the input is a folder, the files are merged in this order: `sbp-vision.md`, `sbp-structure.md`, then each `sbp-detail-*.md` in the order that parts are listed in the Parts topic (any detail file not named in Parts comes last, by file name). A Parts line is an ordered list item (`1. Ledger (part): ...`).

The table of contents is an ordered list: `1. [Layer 1: Vision](#layer-1-vision)`, with the topics of a layer nested under it and counting from 1 again, indented to the parent's text (three spaces under `1.` to `9.`, four under `10.` to `99.`). Its numbers count entries; they are not topic numbers.

**First file:** The first file keeps its leading `# ` title heading, any `Version:`, `Status:`, `Blueprint status:` and `Parent:` metadata lines, and all text before its first layer heading. If the first file holds a `Blueprint status:` line in its top matter, that line is renamed to `Status:` in the published document and the file's own `Status:` line (if present) is dropped; otherwise the first file's `Status:` line is kept. The `Status:` lines of the later files are dropped either way. `Condense` preserves all lines as-is; `publish` applies this rule when merging. Note: `publish` copies an invalid `Blueprint status:` value unchecked; the lint must be run on source files to catch status errors before publishing.

**Later files:** Every file after the first loses its leading `# ` title heading. Any text that sits before its first layer heading in a later file is refused (exit 2, message printed to stderr, nothing written), except for the metadata lines `Version:`, `Status:`, `Blueprint status:` and `Parent:`, which are accepted in the top matter of every file but dropped from the published document. These lines are accepted by `condense` as well and kept in the condensed output.

**Layer 3 headings in detail files:** Each detail file after the first loses its `## Layer 3: Detail` heading and its `Scope:` line. These are dropped from the output so there is one `## Layer 3: Detail` heading with one `Scope:` line, containing one `### <Part> (part)` entry per part. The first detail file keeps both.

**Non-layer headings:** Every heading that is not a layer heading, such as `## View: <name>`, moves to the end of the merged document, in the order they appear across all files.

### What publish leaves out

A topic is dropped when its whole body is `None.`, or when every non-blank line of its body is `Not supplied:` preceded by an optional list marker (`1.`, `-`, `*` or `+`). Examples:
- `1. None.` — kept (a list item is not dropped)
- `1. Not supplied: Pending owner decision.` — dropped if that is the only line
- `1. Not supplied: pending` and `2. Not supplied: owner decision` — dropped if those are the only lines
- `1. Not supplied: part 1` followed by a line that is not a `Not supplied:` line (another item, or a wrapped line) — kept

A topic with any line that is not a `Not supplied:` line (an item, a wrapped line, a fenced block or a table) is kept with its `Not supplied:` lines included. Nothing is renumbered and no id or citation is rewritten; only `insert` and `delete` (below) change positions, and they rewrite the citations of every id they move.

A Standing line still names the original source file of its part, even in the published document (e.g., `1. Ledger: sbp-detail-ledger.md`).

When a topic body is entirely `None.` (alone) or entirely `Not supplied:` lines with no other text (after blank lines are removed), the topic is dropped and the reason reported. `None.` and `Not supplied:` are dropped only in that case, never when they appear with other content.

### The published marker

Line 1 of the published file is:
```
<!-- strata-blueprints: condensed, published (generated; each omitted topic read None. or held only open questions) -->
```
followed by a blank line.

The lint reads this marker as it reads the condensed marker: no topic check, but all order and citation checks run.

### The table of contents

`## Contents` sits between any pre-layer text and the first layer heading. It lists every second-level heading (`##`) and third-level heading (`###` indented two spaces) that is not inside a fenced block, including layer headings, topic headings and part entries. Each entry in the TOC is a markdown link, with anchors generated by the GitHub rule:

- Convert to lower case
- Remove all characters except letters, numbers, spaces, hyphens and underscores
- Replace spaces with hyphens
- If the anchor is not unique, append `-1`, `-2`, etc. to make it unique

For example, `## Layer 1: Vision` becomes anchor `#layer-1-vision`, and a second heading with the same text becomes `#layer-1-vision-1`.

### Output messages

Publish prints:
- One line for each topic left out: `dropped <doc> <T>. <Name>: <text>` where `<text>` is `None.` or (for Not supplied only) the text of the kept lines up to 80 characters with `...` if longer
- One line for each line in the output that still holds `Not supplied:`: `open <out> line <N>: <text>` (line numbers from the generated file), text cut at 80 characters
- One final summary: `published <out>: <F> file(s), dropped <D> topic(s) (<A> None., <B> Not supplied:), <M> open question(s) remain`

where `<M>` equals the `INFO not-supplied` count that the lint would report for the output file.

Exit codes: 0 for success; 2 for a refusal or error, with `strata-blueprints: <message>` on stderr. Exit code 1 occurs when `--out` is a path whose parent directory is an existing file (an uncaught error in both condense and publish).

### Refusals (all exit 2)

| INPUT CASE | RESULT |
|--|--|
| Unknown subcommand | `strata-blueprints: unknown subcommand: <cmd>` |
| `condense` or `publish` without a positional argument | `strata-blueprints: <cmd> needs a file or a folder` |
| More than one positional argument | `strata-blueprints: give one file or folder` |
| No `--out` option | `strata-blueprints: <cmd> needs --out <path>` |
| `--out` given but no path | `strata-blueprints: --out needs a path` |
| Unknown option like `--foo` | `strata-blueprints: unknown option: --foo` |
| Input file or folder does not exist | `strata-blueprints: no such file: <path>` |
| Input path exists but is neither file nor directory | `strata-blueprints: not a file: <path>` |
| Folder input contains no `sbp-*` files | `strata-blueprints: no sbp-vision.md, sbp-structure.md or sbp-detail-*.md in <path>` |
| `--out` path overlaps the input path (same, parent, or child) | `strata-blueprints: --out <path> overlaps the input <input>` |
| `--out` path is a symlink | `strata-blueprints: --out <path> is a symlink` |
| Folder input with file `--out` path (condense only) | `strata-blueprints: --out <path> is a file; give a folder for a folder input` |
| File input with folder `--out` path (condense) | `strata-blueprints: --out <path> is a folder; give a file path for a file input` |
| Any input with folder `--out` path (publish) | `strata-blueprints: --out <path> is a folder; give a file path` |
| Condense input is a published document | `strata-blueprints: <path> is a published document; condense the source files` |
| Publish input is a published document | `strata-blueprints: <path> is a published document; publish from the source files` |
| Later file (publish) has text before first layer heading | `strata-blueprints: <path>: text before the first layer heading (line N) cannot be merged; only the first file may hold it` |
| Folder run: a detail file is a symlink (condense or publish) | `strata-blueprints: <path> is a symlink` |
| Folder run: a detail file is not a file (condense or publish) | `strata-blueprints: not a file: <path>` |
| Existing output file exists but is not a condensed or published copy, and no `--force` | `strata-blueprints: <out> exists and is not a condensed copy; use --force to overwrite it` (for condense) or `strata-blueprints: <out> exists and is not a condensed copy or a published document; use --force to overwrite it` (for publish) |
| Output file cannot be read to check its marker | `strata-blueprints: cannot read <path>: <error>` |
| Input file cannot be read | `strata-blueprints: cannot read <path>: <error>` |
| Folder input has a file that cannot be read | `strata-blueprints: cannot read <path>: <error>` |
| Input file has no layer heading at all | `strata-blueprints: <filename>: no layer heading found` |
| Publishing: a layer heading is wrong (for publish, folder mode) | `strata-blueprints: <filename>: '## Layer X: ...' does not belong in <filename>, which holds Layer Y` |
| Publishing: a kept line cites an id inside a topic that was dropped | `strata-blueprints: <file> line <N>: cites <id>, which is in topic <T>. <Name> of <doc>, left out of the published document (<kind>)` where `<kind>` is `None.` or `Not supplied:` |

## Insert and delete an item

```
node skills/strata-blueprints/scripts/strata-blueprints.mjs delete <id> <file or folder> [--apply] [--ack <handle>[,<handle>...]]
node skills/strata-blueprints/scripts/strata-blueprints.mjs insert <id> <file or folder> [--text <text> | --text-file <path> | --needs <text>] [--apply]
```

Both commands cascade the change through the stack: every later item in the list and every item nested in them takes the id of its new place, and every citation of a moved id, in every layer and file, is rewritten to the new id. Without `--apply` they print the report and write nothing. With `--apply` they write every changed file or none. `--apply`, `--ack`, `--text`, `--text-file` and `--needs` are unknown options for `condense` and `publish`, and `--out` and `--force` are unknown options for `insert` and `delete`.

`delete` removes the item with its nested items. `insert` puts the new item at `<id>`; the item now there and every later one move down. To add an item at the end of a list, give the id one past the last item (nothing moves), or write the next number by hand. To add the first nested item, give `<parent id>.1`. A move is `delete`, then `insert`. With `--text` or `--text-file` the item is the text you give (a file holds the first line and its continuation lines). With neither, the item is an open placeholder, `Not supplied: what this item says.` (or `Not supplied: <text>` with `--needs <text>`), which the lint treats as an open question and not as a malformed item; write its text, and a Value scenario's path, by hand afterwards. A new item whose text needs a path, a rule or a reason draws a new lint warning and the tool refuses it, so add such an item as a placeholder first.

The report has these parts, in this order: the line `cascade <command> <id> in <path>`; `== impact ==` and the output of `--impact` for the id and the ids nested in it; `== shift ==`, which lists each old id and its new id, first item to last; `== citations ==`, with a `rewrite` line for each citation of a moved id and an `UNRESOLVED` line for each citation of a deleted id (each line carries the citing item's handle, its id, or `<file>:<line>`, and how it cites: `id`, `Realizes`, `Answered by`, `(Layer N, id)` or `settles open concern`); `== lint ==`, the warnings before and after and every new warning; `== result ==`.

A citation of the deleted item cannot be rewritten; the citing item reopens for you. `--apply` is refused until each `UNRESOLVED` line is gone (edit the citing item and run again) or acknowledged with `--ack <handle>`, the handle the line prints. An acknowledged citation stays as written. When the deleted item was the last in its list, the id no longer exists and the lint reports it as not defined. When a later item moved up, the id now names that item, and the lint reports `realizes-text` (or another mismatch) because the citing item does not match the item it now cites. A `settles open concern <number>` citation of a deleted concern cannot be acknowledged, and the delete is refused until the Decision is reworded to name the concern by its words.

The tool lints a scratch copy of the result. It refuses the change, and writes nothing, when the result has a warning the original did not have (two equal warnings count as two), except that a warning naming a deleted id whose citation still holds it is expected (the citing item reopens when acknowledged, or the apply is blocked). It first writes every changed file to a temporary file beside it (`.<name>.strata-tmp-<pid>`), and only then renames each into place; if one rename fails it restores the files it already renamed. If a run is killed part-way (an interrupted run), the temporary files stay. The next `insert` or `delete` run, preview or apply, finds them first, lists each with the file it was meant for, writes nothing and exits 2. The tool never deletes them: delete each temporary file to undo the run, or rename each over its file, in the order listed, to finish it, then run the lint. A rename replaces a file whole, so each file is old or new, never half written; git is the backstop against a power loss. The tool refuses a document that draws a `list` warning (close the gap first), a condensed copy or a published document (edit the source files), a symlink and a duplicated id.

It rewrites ids and `settles open concern` numbers only. A sentence that names an item by its count or place (`the third risk`) draws a `count-ref` warning from the lint; rewrite it as an id citation before you run the command, and the cascade then keeps it true. A sentence that names an item by its words stays as written, because words do not move when a list does, and an id inside a code span or a fenced block is an example and is neither read nor rewritten. It reads the lint's `--ids` listing, so the lint script must sit next to the tool. Exit codes: 0 for a preview or an applied change; 2 for a refusal, with `strata-blueprints: <message>` on stderr.

## Output safety

**Condense:**
- `--out` is required and must be a path that does not overlap the input
- The tool never writes to its input and refuses when `--out` resolves to the input file, inside the input folder, or a parent of the input
- The tool checks only the last path component for symlinks; only if `--out` itself is a symlink is it refused. A symlinked parent directory of `--out` is written through
- A folder input requires `--out` to be a folder; a file input requires `--out` to be a file
- An existing output file is overwritten only when it has the condensed or published marker on line 1, or when `--force` is given
- All inputs are read and all targets checked before any write; a failure writes nothing
- The tool deletes nothing, so a stale file in `--out` stays
- Line endings: a file with `\r\n` anywhere in the input is written with `\r\n` throughout; otherwise `\n`

**Publish:**
- `--out` is always a file (an existing directory is refused)
- An existing output file is overwritten only when it has the condensed or published marker on line 1, or when `--force` is given
- All inputs are read before any write; a failure writes nothing and a dangling-citation stop prevents partial output
- Line endings: a file with `\r\n` anywhere in any input makes the whole output `\r\n`; otherwise `\n`

