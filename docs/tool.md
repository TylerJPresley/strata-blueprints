# Condense and publish a blueprint

`skills/strata-blueprints/scripts/strata-blueprints.mjs` writes a condensed copy of a stack for reading or sending on, or publishes the stack as one document. It needs Node.js 22 or later and no packages. The full working files stay the source; a condensed copy and a published document are generated and never edited by hand. The way is one way: the source, then a condensed copy, then a published document.

## Run it

```
node skills/strata-blueprints/scripts/strata-blueprints.mjs condense <file.md or folder> --out <path> [--force]
```

Give a file and `--out` names a file. Give a folder and `--out` names a folder, created when absent. A folder run reads `sbp-vision.md`, `sbp-structure.md` and every `sbp-detail-*.md`, writes the same names into `--out`, and copies nothing else. Each file is written on its own and files are never merged. With no arguments the tool prints its usage and exits 0.

Each file written prints one line: `condensed <path>: dropped N topic(s)`.

Condense refuses a published document as input, because it holds no source files to condense.

Exit codes: 0 for success; 2 for a refusal or a usage error, with `strata-blueprints: <message>` on stderr and nothing written.

## What condense drops

Condense leaves out a topic only when its whole body is the single line `None.`. A topic with `None.` and another line, `- None.`, `**None.**`, `None` without the period, a fenced block, or `Not supplied:` anywhere stays. Kept topics keep their numbers, so every id and citation is the same in the copy and the source. A layer keeps its heading and its `Scope:` line even when all its topics are dropped. Headings inside fenced blocks, views (`## View:`) and topic names the guide does not list are never touched.

## The marker

Line 1 of a condensed file is `<!-- strata-blueprints: condensed (generated; omitted topics read None.) -->`, followed by a blank line. The lint reads a file with this marker on line 1 without warning about omitted topics, and still checks topic order and every citation.

## Running it again

Running condense twice gives the same result. The way back is the source: change the full working files and generate the copy again.

## Publish

```
node skills/strata-blueprints/scripts/strata-blueprints.mjs publish <file.md or folder> --out <file> [--force]
```

Publish writes one file, whether the input is a file or a folder. A folder is read as condense reads it. The input may be the source or a condensed copy of it; both give the same document. A published document is refused as input, because it holds no source files to merge.

**The merge.** The files go in this order: `sbp-vision.md`, `sbp-structure.md`, then each `sbp-detail-*.md` in the order of the Parts topic (a file not named there goes last, by file name). The first file keeps its title, `Version:`, `Status:` and any text before its first layer heading. In each later file the `# ` title is dropped, and any other text before its first layer heading is refused. In each later detail file the `## Layer 3` heading and its `Scope:` line are dropped, so the document has one Layer 3 with one `### <Part> (part)` entry per part. Every `## ` block that is not a layer, such as a view, moves after the last layer, in file order. A file named for one layer that holds another is refused.

**What it leaves out.** A topic goes when its whole body is `None.`, or when every line of its body is `Not supplied:` (after one list marker). A topic with an item, a wrapped continuation line, a fenced block or a table stays, with its `Not supplied:` lines. Nothing is renumbered and no id or citation is rewritten, so topic numbers have gaps. A Standing line still names the source file of its part.

**The table of contents.** `## Contents` sits before Layer 1 and lists every `##` and `###` heading: the layers, the Layer 1 and 2 topics, the Layer 3 parts and the views. Layer 3 topics are not listed. Anchors follow the GitHub rule: lower case, characters other than letters, numbers, spaces, hyphens and underscores removed, spaces turned into hyphens, and `-1`, `-2` added to a repeated name. Renderers that follow the GitHub rule resolve the links; others may not.

**The marker.** Line 1 is `<!-- strata-blueprints: condensed, published (generated; each omitted topic read None. or held only open questions) -->`, then a blank line. It starts like the condensed marker, so the lint reads the file as a condensed copy and checks it as one document, with `--strict` and `--impact`.

**What it prints.** One line for each topic left out (`dropped <doc> <T>. <Name>: None.` or the text of its lines, cut at 80 characters), one line for each line that still holds `Not supplied:` (`open <out> line <n>: <text>`), and a last line `published <out>: <F> file(s), dropped <D> topic(s) (<A> None., <B> Not supplied:), <M> open question(s) remain`. `M` equals the `INFO not-supplied` count of the lint for the output.

**The dangling-citation stop.** When a kept line cites an id inside a topic that was left out, publish exits 2, writes nothing and prints one line for each citation: `<file> line <n>: cites <id>, which is in topic <T>. <Name> of <doc>, left out of the published document (None.)`. A source that passes the lint cannot reach this; the stop guards a source nobody linted. There is no flag to bypass it.

Publishing twice gives the same bytes. A file with `\r\n` in any input makes the whole output `\r\n`; otherwise `\n`.

## Output safety

For condense:
- `--out` is required. The tool never writes to its input and refuses when `--out` is the input, inside the input folder, or a parent of the input.
- It refuses a folder input with a file `--out`, a file input with a folder `--out`, and any target that is a symbolic link.
- An existing target file is overwritten only when it carries the marker, or when `--force` is given.
- All inputs are read and all targets checked before the first write, so a failure writes nothing. The tool deletes nothing, so a stale file in `--out` stays.
- Line endings: a file with `\r\n` is written with `\r\n` throughout; otherwise `\n`.

For publish:
- `--out` is always a file, and an existing folder is refused.
- An existing target file is overwritten only when it carries a marker (either one), or with `--force`.
