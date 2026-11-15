# Condense a blueprint

`skills/strata-blueprints/scripts/strata-blueprints.mjs` writes a condensed copy of a stack for reading or sending on. It needs Node.js 22 or later and no packages. The full working files stay the source; a condensed copy is generated and never edited by hand.

## Run it

```
node skills/strata-blueprints/scripts/strata-blueprints.mjs condense <file.md or folder> --out <path> [--force]
```

Give a file and `--out` names a file. Give a folder and `--out` names a folder, created when absent. A folder run reads `sbp-vision.md`, `sbp-structure.md` and every `sbp-detail-*.md`, writes the same names into `--out`, and copies nothing else. Each file is written on its own and files are never merged. With no arguments the tool prints its usage and exits 0.

Each file written prints one line: `condensed <path>: dropped N topic(s)`.

Exit codes: 0 for success; 2 for a refusal or a usage error, with `strata-blueprints: <message>` on stderr and nothing written.

## What condense drops

Condense leaves out a topic only when its whole body is the single line `None.`. A topic with `None.` and another line, `- None.`, `**None.**`, `None` without the period, a fenced block, or `Not supplied:` anywhere stays. Kept topics keep their numbers, so every id and citation is the same in the copy and the source. A layer keeps its heading and its `Scope:` line even when all its topics are dropped. Headings inside fenced blocks, views (`## View:`) and topic names the guide does not list are never touched.

## The marker

Line 1 of a condensed file is `<!-- strata-blueprints: condensed (generated; omitted topics read None.) -->`, followed by a blank line. The lint reads a file with this marker on line 1 without warning about omitted topics, and still checks topic order and every citation.

## Running it again

Running condense twice gives the same result. The way back is the source: change the full working files and generate the copy again.

## Output safety

- `--out` is required. The tool never writes to its input and refuses when `--out` is the input, inside the input folder, or a parent of the input.
- It refuses a folder input with a file `--out`, a file input with a folder `--out`, and any target that is a symbolic link.
- An existing target file is overwritten only when it carries the marker, or when `--force` is given.
- All inputs are read and all targets checked before the first write, so a failure writes nothing. The tool deletes nothing, so a stale file in `--out` stays.
- Line endings: a file with `\r\n` is written with `\r\n` throughout; otherwise `\n`.
