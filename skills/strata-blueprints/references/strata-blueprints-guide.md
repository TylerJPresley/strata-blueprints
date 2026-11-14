# Strata Blueprints

Version: 0.1.0
Status: Draft

A Strata Blueprints stack describes any subject, at any scale, in three layers. Every layer zooms into one element of the layer before it. The layers are the same everywhere; only the content changes. This is a guide, not a strict template: use what fits the subject and leave out what does not.

Strata Blueprints is a lightweight framework for spec-driven development, for anyone or anything. Models load it as context, so it stays small and high level, carrying context and intent. Use it for RFPs (requests for proposals), software documentation, project steering, standards, policies, ideas and more. As loose suggestions, Layer 1 reads like a product brief, Layer 2 like a high-level design and Layer 3 like a technical design for one part of the subject.

**Short stacks.** Write every layer the subject needs, and in each only the topics the subject needs, in their order. The required topics are, in Layer 1: Need, Target audience, Value, Focus, Assumptions and Decisions; in Layer 2: Parts, Seams between parts, Assumptions and Decisions; and in each Layer 3 part: Responsibility, Rules, Limits, Assumptions and Decisions. Every other topic is optional and left out when the owner gave nothing; add one when a maker would otherwise have to ask. Assumptions and Decisions are written as `None.` when empty. Mark each unknown fact `Not supplied:`. Costs, Risks and Open Concerns are written only when the owner gave something; an idea often has none.

## Definitions

- **Subject:** a bounded thing that has a purpose and parts.
- **Part:** a named piece of a subject with one responsibility, stated in one line in Layer 2. A unit of responsibility, not of where or how it is run.
- **Seam:** a place where a part meets another part, or the subject meets what lies beyond it, with what crosses and in which direction. A seam is named `<From> to <To>`, the same in Layer 2 and Layer 3. A seam is about responsibility, not about where parts run.
- **Layer:** one kind of content about a subject, written for one audience at one zoom level.
- **Standing:** whether a part has its own stack or is described inside its subject's stack. A part gets its own stack when someone can use it on its own. Standing names the file of a part's Detail when it has its own file, and the folder or file of a part's own stack.
- **Stack:** the set of layers that describe one subject, written as one document or as one file per layer.

## Element types

Every element has exactly one of these types, and a reader can tell which: stated beside its name, once for a list of one type (a topic such as Parts or Inside does so by its name), or plainly in its sentence. Subject and Part are types too, defined above.

- **Actor:** a person, role or group that uses the subject or is served by it.
- **Outsider:** something beyond the subject's boundary that it depends on or exchanges with.
- **Piece:** a grouping inside one part, that cannot stand on its own. Pieces appear only inside that part's entry in Layer 3; they are never listed in Layer 2.
- **Means:** the specific tool, material or method a piece is made with, described in Detail under Construction.

## Rules for the layers

1. The layers are rings, with Layer 1 innermost: a layer may refer to the layers inside it, never to the layers outside it. A change to an inner layer reaches every layer outside it.
2. A parent names its parts, each with a one-line responsibility; that is the parent's own content. A part's Detail is an entry in the parent's stack (in its document or its `sbp-detail-<part>.md` file) or a stack of its own named in Layer 2 Standing; either way the parent never depends on how the part works inside.
3. Each layer holds one kind of content, stated in its Intent. Content of another kind belongs in the layer that holds it. Specific means (tools, materials, methods) are named in Layer 3, under Construction. Earlier layers name them only when they are a constraint stated in Layer 1.
4. Layer 3 is written where a maker needs it, as an entry in this stack or as the part's own stack. A subject made of independent members needs only its upper layers; the lower layers are those members' own stacks. Nesting is unlimited: any part may have its own stack, and any subject may have any number of peers.
5. Every layer ends with its costs, then its risks, then its open concerns, then its assumptions, then its decisions. Each cost says what it takes and who pays; each risk says what could go wrong, how badly and what answers it; each open concern says what is unsettled and who raised it; each assumption says why we think so; each decision says why. Costs, risks and open concerns are valid in every layer. They weigh most in Layer 3, where a maker meets the amount, the harm and the unsettled question, and least in Layer 1.

## How the layers depend on each other

Every layer rests on the layers above it, Layer 1 highest (the innermost ring in Rule 1). These four rules keep the layers saying one thing.

- **Fill top down.** Settle the layer above before the layer below, and within a layer ask in the order of its Contents. Where an upper answer is missing, write `Not supplied: <what is needed>` there. Every element below that rests on it carries the gap, with its own `Not supplied:` or by citing the gap's id.
- **Changes cascade down.** A change to an element reopens every element below it that cites it: paths and rules by V id, and costs, risks, open concerns, assumptions and decisions that name its id. Find them with `node scripts/strata-blueprints-lint.mjs --impact <id> <blueprint or folder>` and settle each. A Limit cites its Layer 1 quality by name, so when a quality changes, re-read every Limit that cites it.
- **A lower answer can change an upper layer.** When an answer for Layer 2 or Layer 3 contradicts or adds to what a layer above says, the answer is a change to that layer: write it there, have the owner confirm it, then cascade it down.
- **A decision reopens when its basis changes.** A decision's `Reason:` and the ids it cites are its basis. When either changes, ask the decision again.

## How to fill it out

- Start from the template that fits the job, in `assets/` of the skill folder. Optional topics are marked `(optional)`.
  - A whole stack in one document: `strata-blueprints-template.md`, the full template. It is authoritative; the three cuts follow it.
  - Layer 1 alone or Layer 2 alone: `strata-blueprints-template-layer-1.md` or `strata-blueprints-template-layer-2.md`.
  - One part's Detail: `strata-blueprints-template-layer-3.md`, one entry for each part.
  - A file of a stack in separate files: the matching cut with each heading lowered one level, under the `# <Subject>` title (see "A stack in separate files").
- Write anything that happens as Given, When, Then. One scenario keeps its form down the layers.
- A Layer 1 value scenario may carry an id (V1, V2, ...). When it does, the Layer 2 path and the Layer 3 rule that realize it cite the same id and keep its Given and when text, so one line reads `- V1. Given ..., when ..., then ...`. Ids are optional.

## Every layer has

Intent, Audience, a Success test written as Given, When, Then, and its Contents in dependency order. Each topic carries three parts: how to write it, what to ask the owner and what to check. Each layer also ends with a check of the whole layer. They are held in one guide file per layer, `strata-blueprints-guide-layer-1.md`, `strata-blueprints-guide-layer-2.md` and `strata-blueprints-guide-layer-3.md`, loaded when that layer's turn comes.

## A stack in separate files

A stack stands complete as one document. It may instead be written as one file per layer in one folder. Keep one document for an idea, for a stack that stops at Layer 2, and for a few small parts. Split when a part's Detail is built separately, changes on its own schedule or has its own owner, or when Layer 3 outweighs Layers 1 and 2 together.

The files sit flat in one folder. The lint finds them by name and ignores every other file.

- `sbp-vision.md` holds Layer 1. There is one per stack.
- `sbp-structure.md` holds Layer 2, and any views at its end. There is one per stack.
- `sbp-detail-<part>.md` holds Layer 3 for one part: the heading `## Layer 3: Detail`, its `Scope:` line and that part's one `### <Part> (part)` entry. `<part>` is the part's name in Parts, in lower case, each run of characters other than letters and digits written as one hyphen, with no hyphen at either end.
- `sbp-` marks a blueprint file. `strata-blueprints-` marks the standard's own files.

Each file opens with the stack's `# <Subject>` title and holds its layer exactly as the one document would. Only `sbp-vision.md` carries `Version:` and `Status:`. A view is a `## View: <name>` section at the end of `sbp-structure.md`; there is no view file.

Ids name one thing in the whole stack. A file cites an id by the id alone, never by a file name, and only ids of its own layer or the layers inside it. Layer 3 ids count up across the detail files together, in the order of the parts in Parts.

Standing names each detail file, such as `Ledger: sbp-detail-ledger.md`. The files Standing names and the detail files in the folder are the same set. A part with no Detail has no file and no Standing line. The line `described here` belongs to a stack written as one document.

A part's own stack is a subfolder named by the part's lower-case name, holding that stack's `sbp-` files; Standing reads `Presence: own stack, presence/`. A nested stack has its own ids and is checked by its own run. This guide describes the form; the lint does not descend into it.

Check a folder with `node scripts/strata-blueprints-lint.mjs <folder>`.

## Views across the layers

Views are not layers. A view is optional and refers inward. A view that stands on its own is a `## View: <name>` section after Layer 3, or at the end of `sbp-structure.md` in a stack of separate files.

- **Lifecycle:** how the subject is produced, put into service, kept working, changed and retired. See Lifecycle view below.

### Lifecycle view

- **Lifecycle:** how the subject is produced, put into service, kept working, changed and retired, written as a `## View: Lifecycle` section after Layer 3. It is written once for the subject, and again for any part whose lifecycle differs.
  - For: says how the subject lives over time, which no layer holds.
  - Write: a `## View: Lifecycle` section after Layer 3 with a `Scope:` line and one scenario (Given, when, then) for each stage that matters: production, service, upkeep, change, retirement.
  - Example:
    - Given a change to the app is ready, when the maintainer releases it, then every device runs a compatible version, and a keeper on an older version is still served until they update.
    - Given a keeper closes their account, when they ask for it, then their commitments are removed from every device and store.
  - Mistake: putting where things run into the parts or seams. Construction records it.
- **Ask the owner:** Lifecycle: ask how it is released, updated and retired, and what happens to data when someone leaves.
- **Check:**
  - [ ] Does the section sit after Layer 3 (or at the end of `sbp-structure.md` in a stack), with a `Scope:` line?
  - [ ] Is each stage that matters named: production, service, upkeep, change, retirement?
  - [ ] Is each stage a Given, when, then scenario?
  - [ ] Does the view add no rule that the layers do not hold?

### Diagrams

A diagram supplements the text; the text is the source of truth. Use a diagram only where it clarifies; Layer 2 is where it helps most. Choose the simplest form that works:
- An indented tree, to show what contains what.
- A seam list, one line per seam: `A → B: what crosses`.
- A Mermaid flowchart, only where the reader's tool draws it.

Every diagram has a title, one scope, and a key if it uses symbols, colours or shapes. Labels state intent, arrows point from the one that initiates, and no meaning rests on colour alone. The community garden example (`strata-blueprints-example.md`, beside this file) shows each form.

## Notation

Every layer opens with a title and a one-line scope. A layer that uses symbols, colours or shapes carries a key. Every element has a name, a type, a one-line description and, where it applies, what it is made of. Every relationship has one label that states its intent and points from the one that initiates. Define terms and acronyms where first used. Never carry meaning by colour alone. One scope per view; never mix layers in one view.

## Formatting

**Markup**
- Under the title, write `Version: 0.1.0`.
- One heading per layer, such as "## Layer 2: Structure", followed by its one-line scope as a line that starts with `Scope:`, for example `Scope: the whole app, divided into parts, with the seams between them and with the outside.`
- Number the topics in sequence as written, 1, 2, 3 and so on, in dependency order.
- Write each Detail entry under `### <Part> (part)`, with its topics as `#### N. <Topic>` in the layer's order.
- Write each scenario as one line: Given …, when …, then …. A value scenario may open with an id, such as `- V1. Given …, when …, then …`, cited by its path and its rule.
- Write a stand-alone view as a `## View: <name>` section after Layer 3, or at the end of `sbp-structure.md` in a stack of separate files.
- Write costs, risks and open concerns as list bullets, never as a table.
- A part's own stack may open with `Parent: <subject>, part <part>` before its `## Layer 1: Vision` heading, in its `sbp-vision.md` when split.
- Write a missing fact as `Not supplied: <what is needed>`.

**Diagrams (optional)**

A diagram supplements the text, which is the source of truth; give it a title and, if it uses symbols, colours or shapes, a key. See Views across the layers, Diagrams, before drawing one.

## Procedure

1. Gather the facts about the subject as assertions, and have the owner confirm or correct them. Ask by layer:
   - Layer 1: who has the problem, what happens without a solution, how we would know it worked, and what it would cost, what could go wrong and what is still unsettled overall.
   - Layer 2: what the subject is divided into, what each part touches inside and outside, and what the division costs, what could go wrong with it and what is still unsettled.
   - Layer 3: for each part, what it must do, what it needs and what it offers, what it is made of, with what values, and what it costs, what could go wrong with it and what is still unsettled.
   Ask the owner for intent: the need, why each part exists and what it must achieve. Choose the Layer 3 values and specific means that serve that intent, and record each as a decision with its reason, which the owner can change. When the intent itself, or a fact about the world, is missing, write `Not supplied: <what is needed>` and ask for it. Never invent it.
2. Write Layer 1, then Layer 2, reading each topic's `How to write it` entry in its layer file before writing the topic. Stop there for an idea with no numbers, rules or means given, or for a subject made of independent members.
3. Write Layer 3 for each part that needs it, as an entry in this stack or as the part's own stack named in Layer 2 Standing, including Construction where a maker needs it.
4. Add the views that are wanted.
5. Run each layer's `Check` lines, its `Check (whole layer)` and its Success test. Aim for yes on every answer; where one is no, fix it or note why.

### How to interview

Each `Ask the owner` entry in a layer file holds the grouped question, then the value and edge follow-up, then the usual `Not supplied:` case. Read the topic's entry before asking about it.

Interview the owner. The owner's intent comes as assertions to confirm or correct, and you derive the specifics from it. Skip the interview when the owner has already specified the subject in full. To fill `Not supplied:` items in an existing blueprint, make them the agenda.

- Read the owner's seed. List the agenda as rows in a question log (`questions.md` beside the blueprint; its format is under The question log) with status `open`, and mark what the seed already answers.
- Go Layer 1, then Layer 2, then Layer 3, part by part. Read the topic's `Ask the owner` entry in its layer file first.
- Ask one block per layer: one numbered question per topic or part, covering its related items together, Costs, Risks and Open Concerns included. A cost or risk named early gets a row under the layer where it binds. A concern the owner raises is recorded as an Open Concern with who raised it.
- Ask each success measure open-ended first: what number or result shows it worked. Offer examples after.
- When an answer names a rule, ask its value and edge (smallest, longest, none, missed) and what happens when it is broken or a window is missed.
- Read an inferred item back as an assertion. It becomes an Assumption with `Basis:` and `If wrong:` only after the owner confirms.
- A "not decided" answer becomes `Not supplied: <what>` with status `not decided`, and the interview moves on. Never ask why for a choice the owner never reasoned about; at most once, ask "did you consider an alternative?".
- Ask in rounds, highest yield first: Construction, Rules and Limits of each part come before other topics. Rows still `open` when the owner stops become `Not supplied:`.
- Whatever the owner did not give, or left "not decided", is `Not supplied:` too.
- Anything you infer goes in Assumptions or Decisions, never in Rules or Need.

### The question log

Write a Markdown table beside the blueprint as `questions.md`, with this header row:

`| id | topic | question | status | answer | changed |`

- Add the agenda rows at the start; update each row after its answer.
- `status` is `open`, `answered` or `not decided`.
- `changed` is `yes`, `no` or `pending`.
- One row per question; keep the owner's answer in the owner's words.

### Audit

Audit: for each rule, definition, state, trigger, reason, measure, seam, cost and risk you wrote, point to the seed line or answer that gives it. Delete what has no source, or write `Not supplied:` instead; an inference you keep is an Assumption with `Basis:` and `If wrong:`. End your reply with the counts: audited, deleted, marked, made Assumptions.

## Edge cases

- **An idea:** a stack for an idea may stop after Layer 2. It states the need, the parts and the seams, marks unknown intent as `Not supplied:`, and gains Layer 3 for a part when a maker needs it.
- **A subject with no outsiders:** say so in Vision.
- **A cost, a risk or an open concern:** write it in the Costs, Risks or Open Concerns topic of the layer where it binds; where a layer has none, leave the topic out, or write `None.`. A figure, a severity or an answer the owner did not give is never invented: write `Not supplied:`, and `Not rated` for a severity. A decision, an assumption or a value scenario's rule answers a risk; cite its id.

## Worked example

Three companion examples, beside this guide, fill the layers, each one way to fill them, not a template:
- `strata-blueprints-example-todo-app/`: a software product, all three layers, written as a stack of separate files. Its `README.md` names the files.
- `strata-blueprints-example.md`: a community garden, an idea with Vision and Structure only, written as one document.
- `strata-blueprints-example-rfp.md`: a library room booking service, a spec for others to answer: the issuer fixes the need, parts and limits, and the means are left to the bidder.

## When it is done

A stack is done when anyone, person or model, can make the subject from it without asking. Light means no more than a maker needs, and no less. Every part has a place in Layer 2, with its Detail where a maker needs it, and every key scenario has a path through the parts.
