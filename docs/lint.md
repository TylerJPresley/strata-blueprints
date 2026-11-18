# Verify a Strata Blueprints document

The lint script checks the structure of Strata Blueprints documents mechanically. It flags structural problems and counts cells marked `Not supplied:`.

## Run the lint

To check a single document:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs path/to/document.md
```

With no arguments the script prints its usage line and exits 0:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs
```

To check a stack written as separate files in a folder:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs path/to/stack-folder
```

For a folder, the lint reads `sbp-vision.md`, `sbp-structure.md` and every `sbp-detail-*.md` in it as one virtual document, ignores every other file, and reports each warning with its file and line. The files are read in this order: Vision, Structure, then the detail files in the order that parts are listed in Layer 2 Parts, with any unnamed detail files last by file name.

The lint takes the path you give it and does not read `AGENTS.md`; an agent resolves the path first (see the core guide, Where the blueprints live). A folder run reads only `sbp-` files, so pass a single document as a file.

To write a condensed copy of a stack, or to publish it as one document, see [tool.md](tool.md).

## Output

The script produces three kinds of output:

### Warnings

`WARN <check>: <message> (<place>)` flags a structural problem. The place is `line N` for a single file or `<filename> line N` for a folder. Warnings are printed pass by pass, not in one line order. In a folder the folder checks come first (`layer-heading` per file, then `standing`). Then one scan reports, line by line and in this order within a line: `unfinished`, `diagram-title`, `diagram-key`, `layer-heading`, `scope-line`, `topic-order`, `ring`. After the scan come the two `layer-heading` missing-layer warnings (line 1), then `status`, `topics`, `scenario-form`, `id`, `id-ref`, `reasons`, `scenario-trace`, and last the `cost-shape`, `risk-shape`, `concern-shape` and `risk-ref` warnings (one pass, line order). Each pass is in line order. The check sections below are in the guide's order, not the print order:

#### Check: `layer-heading`

Fires when:
- A `## Layer N: Name` heading has wrong layer number, wrong name, or is out of order after a valid heading
- Layer 1 or Layer 2 is missing entirely (warns at line 1)
- In a folder, a file holds a `##` heading for a layer other than the one its name declares: Vision files must have Layer 1, Structure Layer 2, detail files Layer 3
- In a folder, a detail file has zero or more than one `### <Part> (part)` entry

Silent when:
- A `## ` heading starting with `Layer` is malformed or has a wrong name; it is treated as not a layer heading, and no layer is open (but the malformed heading itself draws a warning), so lines after it are given no layer and draw no topic-order, ring or id checks
- Layer 3 is missing (not treated as an error)
- A heading does not start with `Layer` (such as `## View: Name`)

#### Check: `scope-line`

Fires when the first non-blank line after a valid `## Layer N:` heading does not start with `Scope:`, unless that line is inside a fenced block.

Silent when:
- The layer heading is invalid (no layer is open, so no Scope check runs)

#### Check: `topic-order`

Fires when:
- A `### N. Topic Name` heading names a topic not in the layer's list (in Layer 3, `### N. Topic Name` is checked against Layer 3's list too)
- A topic heading appears before the previous topic heading in the layer's guide order
- A `#### N. Topic Name` heading inside a `### <Part> (part)` entry names a topic that is not in Layer 3's list
- An unknown topic name (`### 99. Bogus`) warns `'<Topic>' is not a Layer <N> topic`; the heading is not counted as present for the `topics` check, and the lines under it are given no topic, so they draw no `id`, `reasons` or shape finding

Silent when:
- A `###` heading has no number (such as `### Value`); it is not a topic heading, and the lines under it are given no topic
- A topic heading sits in no valid layer
- A `#### ` heading sits outside a `### <Part> (part)` entry

#### Check: `topics`

Fires when a layer, or a Layer 3 `### <Part> (part)` entry, has topic headings but is missing one of the topics in the Guide's list for that layer.

Silent when:
- The layer or entry has no topic heading at all
- The file is condensed (first line is the condensed marker)
- Layer 3 has no entry at all (an unnumbered Layer 3 asks no topics)
- A layer heading is invalid

#### Check: `unfinished`

Fires once per line when the line contains the markers `TODO`, `TBD` or `FIXME` as whole words, anywhere on the line, inside fences and code spans included.

#### Check: `diagram-title`

Fires when a fenced block (triple backtick or tilde) has no line before it beginning `Title:`.

Silent when:
- The `Title:` line exists (no warning)

#### Check: `diagram-key`

Fires when a fenced block with language `mermaid` has no `Key:` in the `Title:` line before it.

Silent when:
- The diagram is not mermaid, or has no fenced block
- The `Title:` line exists but contains no `Key:` marker

#### Check: `ring`

Fires when a line in a valid layer contains `Layer N` as whole words, where N is a layer number higher than the line's own layer, on any line except layer headings (layer headings are skipped).

Reports once per `Layer N` occurrence, so one line can produce several warnings.

Silent when:
- The line is inside a fenced block

#### Check: `status`

Fires when a `Status:` or `Blueprint status:` line in the top matter (before the first `##` heading) has a value other than `Draft`, `Review` or `Approved` (exact case). `Version:` and `Parent:` values are not checked.

Silent when:
- No `Status:` or `Blueprint status:` line exists
- The line is not in the top matter (after a `##` heading, it is treated as prose content)

#### Check: `scenario-form`

Fires when an element text (after any id number and any `Realizes <id>.` sentence) begins with `Given` but does not read `Given <situation>, when <event>, then <result>`, on these items only:
- A Layer 1 Value item
- A Layer 2 Scenario path item
- Any item anywhere that contains a `Realizes <id>` sentence

Silent when:
- The element does not begin with `Given`
- The element is inside a table row
- The item is a Layer 3 rule, limit, refusal, or other Layer 3 item without `Realizes`
- The item is a Layer 1 or Layer 2 item without an id or `Realizes` sentence


#### Check: `reasons`

Fires when an Assumption item lacks `Basis:` or `If wrong:`, or a Decision item lacks `Reason:`, unless the item body contains `Not supplied:` anywhere.

Reports once per item.

Silent when:
- The item is marked `Not supplied:`
- The item is `None.` or a table row

#### Check: `scenario-trace`

Fires when a Layer 1 Value scenario (a numbered item under Value) is not realized in Layer 2 or Layer 3:
- Missing from Layer 2: no `Realizes <vision-N.M>.` sentence in any Layer 2 element
- Missing from Layer 3: when the scenario's path runs through a part that has a Layer 3 entry, no `Realizes <vision-N.M>.` sentence appears in any Layer 3 element. A path is built from the Layer 2 text that realizes the scenario, a part is on the path when its Parts name appears as a whole word in that text, and an empty path (no valid Layer 2 heading) names no part. If the path names no part but any Layer 3 entry exists, Layer 3 must have the sentence anyway. The warning message names the path and the part if it was found: `vision-3.1 has no rule in Layer 3; path structure-6.1 names part Brakes` or `its path structure-6.1 names no part` (when no path or path found no part).

Silent when:
- Layer 3 has no `(part)` entry at all (no trace needed)
- The Layer 2 check does not run when the document has no valid `## Layer 2: Structure` heading (`<id> has no path in Layer 2` is silent); the Layer 3 check does not run when it has no valid Layer 3 heading
- The Value item is not numbered

#### Check: `cost-shape`, `risk-shape`, `concern-shape`

Each fires when an item under Costs, Risks or Open Concerns is malformed or does not match its shape:
- Costs: `<number>. Given <condition>, when <subject state>, then it costs <amount>. Paid by <who>.` or the older form `<number>. <What>: <amount>. Paid by <who>.` with a valid amount (number, optional decimals, currency symbol optional)
- Risks: `<number>. Given <situation>, when <event>, then <result>. Severity: High|Medium|Low|Not rated. Answered by <answer>.`
- Open Concerns: `<number>. Given <situation>, when <event>, then <result>. Raised by <who>.`
- A line reading `None.` or `Not supplied: <text>` is accepted without the shape

Silent when:
- The item is a table row
- The item is `None.` or every line of the item body is `Not supplied:`
- The item sits in Layer 3 with no `(part)` entry

#### Check: `id`

Fires when an item's number is wrong or taken:
- A numbered topic item with no number, in topics that require one (in any layer or entry)
- A number under the wrong topic by name
- The same id appears twice in the same document
- A Layer 3 item in an entry whose slug does not match a part in Layer 2 Parts
- A part name in Layer 2 Parts that is not one word (letters, digits, underscores)
- The item starts with a full id form like `vision-3.1.` (the old style); only the number should be written

Reports once per item. A prose paragraph (lines up to a blank) counts as one item, numbered or not. An item under a numbered topic needs a number; prose and items under unnumbered topics do not. Table rows, `None.`, `Not supplied:` and `Title:` lines are exempt.

Silent when:
- The layer is invalid (no topics to judge)
- The item is in a Layer 3 with no entry

#### Check: `id-ref`

Fires when an element cites an id and:
- The id is defined nowhere in the stack
- The id is defined in a layer outward (deeper) than the citing element's layer
- A Layer 3 entry cites a Detail id from another part (not allowed)

Does not fire for ids cited in the `Answered by` field of a Risk item after the field label itself (those are checked by `risk-ref` instead).

Silent when:
- The id is defined in the layer or inward of it
- The id is inside a code span or fence

#### Check: `risk-ref`

Fires when a Risk's `Answered by` field is not `Not supplied:` and:
- The field cites no id at all
- An id it cites is not defined in the stack
- An id is defined in a layer outward (deeper) than the Risk's layer

Silent when:
- The Risk field starts with `Not supplied:`
- The Risk has already failed the `risk-shape` check

#### Check: `standing` (folder mode only)

Fires when reading a folder, for these faults in the `sbp-structure.md` Standing topic:
- Two part names share the same file slug (after lowercasing and replacing non-alphanumeric with hyphens)
- A Standing line names a detail file `sbp-detail-<slug>.md` that is not in the folder
- A Standing line names its own-stack folder as `own stack, <folder>/` but the folder does not exist
- A Standing line reads `described here` (not allowed in a stack of separate files)
- A detail file in the folder is not named by any Standing line
- A detail file's slug does not match any part name in the Parts topic

A line reads `<Part>: sbp-detail-<slug>.md` or `<Part>: own stack, <folder>/`. Parts and Standing are found by topic name alone, ignoring the layer heading above them, and both are read from `sbp-structure.md` only.

Silent when:
- No `sbp-structure.md` file exists
- Parts and Standing lines cannot be read from `sbp-structure.md` (the file is inside an unclosed fence, or it has no Parts or Standing topic heading): then the faults that come from those lines are silent (shared slug, file not in the folder, own stack missing, `described here`, entry differs from the Parts name). Each detail file still draws `<file> is named by no Standing line` and `<file>: '<slug>' is not the slug of a part in Parts`

### Structure faults and their cascades

When a structural fault occurs, Lint repairs nothing and only warns on the fault itself. The following rules describe what each fault leaves unread:

**Deleted or misspelled layer heading:** When a `## Layer` heading is invalid or missing, no layer is open, so its lines are given no layer and draw no `topic-order`, `topics`, `ring`, `id`, `reasons` or shape checks. A malformed heading warns at its own line, and a missing Layer 1 or Layer 2 warns once more at line 1 (so a malformed `## Layer 2 Structure` gives two warnings); a missing Layer 3 does not warn.

**Unclosed fence:** A fenced block that is not closed swallows every later line, including the lines of every later file in a folder run, because the files are read as one document: Layer headings are missing, later layers are not opened, and every line after the fence is skipped for all checks except `unfinished`. The `Not supplied:` count does not count lines inside the fence (only `unfinished` still reads them). Two `layer-heading` warnings are issued at line 1 (or the first file's line 1 in a folder) when both layers are missing (one for each). In a folder, an unclosed fence in one file also swallows the files after it (an unclosed fence at the end of `sbp-vision.md` hides the Layer 2 heading in `sbp-structure.md` and draws `missing '## Layer 2: Structure'`); `unfinished` still reads every line.

**Unknown topic heading:** A topic name not in the Guide's list for its layer warns `topic-order` and is not treated as a topic heading. Its lines are given no topic and draw no `id`, `reasons` or shape checks. Lines after a known topic in order that comes before an unknown one still carry the known topic.

**Faults that repeat:** Each fault warns once per element it touches. A line with multiple faults warns for each. A paragraph (run of lines to a blank) is one item, so multiple lines under an unknown topic heading warn once per item, not per line. The `ring` check warns once per `Layer N` occurrence on a line.

**Layer 3 without entries:** When Layer 3 has no `### <Part> (part)` entry at all, its lines are given no topic and draw no `topics`, `id`, `reasons` or shape checks. The line scan still runs on them: `### N. Topic Name` headings are checked against Layer 3's topic list (`topic-order`), and `scope-line`, `ring`, `diagram-title`, `diagram-key`, `unfinished`, `id-ref` and the `Not supplied:` count apply.

**Per-file vs. whole-folder reading:** In a folder, most checks read the assembled virtual document as if it were one file (layers merged, files reordered, some lines dropped). The exceptions are:
- `standing` reads each part in `sbp-structure.md` alone
- The entry count of `layer-heading` reads each detail file alone
- `scope-line` skips fenced lines when finding the first non-blank line

**Detail files in a folder:** Each `sbp-detail-*.md` file after the first loses its leading `# ` title heading (if present), its `## Layer 3: Detail` heading and its Scope line. These are dropped from the virtual document so there is one Layer 3 with one `### <Part> (part)` entry per part. The first detail file keeps all three. Lines before the first entry heading of the first detail file, and every line of a detail file with no entry heading in the first detail file, sit in no entry and are given no topic. In a later detail file, lines before its entry heading continue the last topic of the previous file's entry (prose there draws `an item under Decisions has no number`). The leading `# ` title, Layer 3 heading and Scope line are dropped only when they open the file; text before them keeps the heading, which then draws `Layer 3 is out of order`.

**Heading-only topics:** A `## View: <name>` heading or a `### Diagrams` heading under it are not layer headings or topic headings. Lines under them belong to no layer and draw no layer, topic, `ring`, `id`, `reasons` or shape checks, but they are still counted for `unfinished` and `Not supplied:`.

### Info line

`INFO status:` appears when the document(s) have a `Status:` or `Blueprint status:` line in the top matter (before the first `##` heading). `Version:` and `Parent:` lines never cause it. For a single document, the line reads `INFO status: <value>` (printing the `Status:` value when both `Status:` and `Blueprint status:` lines are present; a `Blueprint status:` line in a single document is validated for its value and, when no `Status:` line is present, is reported in the INFO line; when both lines are present the `Status:` value prints). For a folder, the line reads `INFO status: blueprint <v>; vision <v>; structure <v>; detail.<part> <v>` with `-` replacing `<v>` when a document has no Status line. In a folder's Vision file, the first document's `Blueprint status:` line (if present) takes precedence over its `Status:` line and is reported as the blueprint status.

`INFO not-supplied: N` means N cells are marked `Not supplied:` and are ready to be asked for. The count excludes metadata lines (`Version:`, `Status:`, `Blueprint status:`, `Parent:`) in the top matter and is one per occurrence of the text `Not supplied:` outside code spans and fenced blocks, counted on every non-blank line outside fenced blocks that does not start with `## ` (the `# ` title line, Scope: lines, `###` topic headings and content lines all count; every `## ` line is skipped, including `## View: ...` and `## Contents`). A line with multiple occurrences counts each one. The `INFO status:` line appears before this one when status lines exist.

### Accidental behaviors

- `Blueprint status:` in a Structure or Detail file is value-checked (`status` warning when invalid) but never reported in the INFO line.
- With duplicate `Status:` or `Blueprint status:` lines, the first is the one reported in the INFO line; every line is still value-checked.
- A `Status:` line inside a code fence in the top matter is read as a status.
- `publish` copies an invalid Blueprint status unchecked.
- `Status: Not supplied: x` draws a `status` warning and also counts toward `INFO not-supplied`.
- Lowercase key `status:` is silently ignored.

### Summary line

`strata-blueprints-lint: N warning(s)` reports the total count of warnings. Exit code is 0 unless `--strict` is used and warnings exist.

### Exit codes

- `0`: no warnings, or warnings with no `--strict` flag. Plain mode exits 0 even when an unknown option is given (ignored).
- `1`: at least one warning found and `--strict` flag is given
- `2`: file does not exist, a folder holds no `sbp-` files, or `--impact` has no id, path, unknown option, or extra argument

Warnings are advisory; exit code 0 indicates the script ran successfully.

## Warnings reference

Every warning follows the format `WARN <check>: <message> (<place>)`. The full list of messages by check:

| Check | Message |
|--|--|
| `layer-heading` | `'<heading>' should read '## Layer N: Name' where N is 1 to 3 and the names are 1 Vision, 2 Structure, 3 Detail` (a `## Layer` heading with the wrong form, number or name) |
| `layer-heading` | `missing '## Layer 1: Vision'` or `missing '## Layer 2: Structure'` |
| `layer-heading` | `Layer <N> is out of order` |
| `layer-heading` | `'<heading>' does not belong in <file>, which holds Layer <N>` (folder mode, when any file holds a layer heading other than its own) |
| `layer-heading` | `<filename> must hold exactly one '### <Part> (part)' entry; it holds N` (folder mode) |
| `scope-line` | `first line after the layer heading must start with 'Scope:'` |
| `topic-order` | `'<Topic>' is not a Layer <N> topic` |
| `topic-order` | `'<Topic>' is out of order in Layer <N>` |
| `topic-order` | `'<Topic>' is not a Layer 3 topic in the entry '<Part>'` |
| `topic-order` | `'<Topic>' is out of order in the entry '<Part>'` |
| `topics` | `topic '<Topic>' is missing in Layer <N>` |
| `topics` | `topic '<Topic>' is missing in the entry '<Part>'` |
| `unfinished` | `marker '<MARKER>'` (where MARKER is TODO, TBD or FIXME, once per line) |
| `diagram-title` | `fenced block has no 'Title:' line before it` |
| `diagram-key` | `mermaid Title line has no 'Key:'` |
| `ring` | `Layer <N> refers outward to Layer <M>` (where M > N) |
| `status` | `'<value>' is not one of Draft, Review, Approved` |
| `scenario-form` | `must read 'Given ..., when ..., then ...'` |
| `reasons` | `assumption needs 'Basis:' and 'If wrong:'` |
| `reasons` | `decision needs 'Reason:'` |
| `scenario-trace` | `<id> has no path in Layer 2` |
| `scenario-trace` | `<id> has no rule in Layer 3; path <path-id> names part <Part>` or `<id> has no rule in Layer 3; path <path-id> names no part` or `<id> has no rule in Layer 3; its path <path-id> names no part` |
| `cost-shape` | `a line under Costs must be 'None.' or start '<T>.<n>.'` where T is the Costs topic number of the layer (8 in Layers 1 and 3, 7 in Layer 2), or `a cost must read '<T>.<n>. Given <condition or volume>, when <the subject is built, run or changed>, then it costs <amount>. Paid by <who>.' with a valid amount (the older form '<T>.<n>. <What>: <amount>. Paid by <who>.' is also accepted)` |
| `risk-shape` | `a line under Risks must be 'None.' or start '<T>.<n>.'` where T is the Risks topic number of the layer (9 in Layers 1 and 3, 8 in Layer 2), or `a risk must read '<T>.<n>. Given ..., when ..., then .... Severity: High, Medium, Low or Not rated. Answered by <answer>.'` |
| `concern-shape` | `a line under Open Concerns must be 'None.' or start '<T>.<n>.'` where T is the Open Concerns topic number of the layer (10 in Layers 1 and 3, 9 in Layer 2), or `an open concern must read '<T>.<n>. Given ..., when ..., then .... Raised by <who>.'` |
| `id` | `an item under <Topic> has no number` |
| `id` | `<id> is numbered for topic <T>, but sits under <Topic>` |
| `id` | `<id> repeats the one on <place>` |
| `id` | `<id> names '<slug>', which is not a part in Layer 2 Parts` |
| `id` | `part name '<name>' is not one word` |
| `id` | `write '<Topic>.<N>.' at the start of the item; the document goes only in a citation` (old form) |
| `id-ref` | `<id> is not defined` |
| `id-ref` | `<id> is defined in <doc>, which is outward of Layer <N>` |
| `id-ref` | `<id> belongs to another part, and the entry '<Part>' may not cite it` |
| `risk-ref` | `'Answered by' names no id and does not begin 'Not supplied:'` |
| `risk-ref` | `<id> is not defined in a layer` |
| `risk-ref` | `<id> is defined in Layer <M>, outward of Layer <N>` |
| `standing` | `parts '<P1>' and '<P2>' share the file slug '<slug>'` (folder mode) |
| `standing` | `<Part> names <file>, which is not in the folder` (folder mode) |
| `standing` | `<Part> names its own stack <folder>/, which is not a folder here` (folder mode) |
| `standing` | `<Part> says 'described here'; in a stack of separate files name the part's file or its own stack` (folder mode) |
| `standing` | `<file> is named by no Standing line` (folder mode) |
| `standing` | `<file>: '<slug>' is not the slug of a part in Parts` (folder mode) |
| `standing` | `the entry '<Part1>' differs from the Parts name '<Part2>'` (folder mode) |
| `cost-shape`, `risk-shape`, `concern-shape` | `a table line; write the topic as a list` |

## Use --strict

Exit with code 1 if any warnings are found:

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs path/to/document.md --strict
```

Use this in a gate to fail a build when warnings are present.

## Use --impact

To list every element that a change reaches, give the full id of the element that changed, such as `vision-9.1` or `detail.ledger-7.2`. A bare number such as `7.2` is not an id.

```
node skills/strata-blueprints/scripts/strata-blueprints-lint.mjs --impact vision-9.1 path/to/document.md
```

The output format is exactly:

```
impact <id>: defined in Layer N, <place>
<id>
  d1  <place>  <layer path>  <citing id or ->  <element text, first 80 chars or fewer>
  d2  ...
  ...
  d<depth>  ...
<any WARN lines from cycles or duplicates>
INFO impact: <count> element(s) reached, deepest <depth>
```

- Line 1: `impact <id>: defined in Layer N, <place>` where `<place>` is the file and line number
- Line 2: the id bare, on its own line
- Tree lines: each element that cites the id, indented two spaces per depth level. Fields are separated by two spaces: depth marker `d<N>`, place (`line N` or `file line N`), layer path (`Layer <N> > <Topic Name>`, such as `Layer 1 > Value` or `Layer 2 > Scenario paths`; `Layer <N> > -` for an element of Layer 1 or 2 with no topic, such as the Scope line; `Layer 3 > <Part> (part) > <Topic Name>`, or `Layer 3 > <Part> (part)` with no topic; `Layer 3 > -` in Layer 3 outside any entry; `Other` for an element outside any layer), the citing id if numbered or `-` if prose, and the element's text. Text is cut at 80 characters with `...` appended if longer. Text of an item with an id includes its number at the start, like `6.1. Given ...`
- Elements appear in document order, each once, under the first element that cites it at the shallowest depth
- Warnings: `WARN impact: cycle <id1> ... <id2>` when a citation would loop back; such elements are not followed. `WARN impact: <id> is defined on lines <line1> and <line2>` when the id is defined twice (in a folder run the two numbers are lines of the assembled document, not of the files; this is accidental)
- Last line: `INFO impact: <count> element(s) reached, deepest <depth>` always, even when count is 0

When the id is not defined:

```
WARN impact: <id> is not defined in <path as given>
<id>
INFO impact: 0 element(s) reached, deepest 0
```

Exit codes:

- `0`: the id is defined and the tree is shown
- `1`: the id is not defined
- `2`: usage error (no id, no path, extra arguments, unknown options)

The impact run prints no `INFO not-supplied` count and no summary line.

