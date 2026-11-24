<!-- A blank Strata Blueprints stack, all three layers in one document. Delete this line, delete the `(optional)` marker from each heading you fill in, write `None.` under an optional topic with nothing to say, then fill in the brackets. Every list is a Markdown ordered list: `1.`, `2.`, `3.` with no gap, and no `-`, `*` or `+`. An item's id is its topic's number and its place in the list, with the document in front in a citation, joined with a hyphen (`vision`, `structure`, `detail.<part>` or `view.<name>`): `vision-9.1` is place 1 under topic 9 (Risks) of the Vision, and `detail.session-7.1` is place 1 under topic 7 (Construction) of the part Session. A list nested in an item extends its id (`vision-9.1.2`). An item's id follows its place in the list; adding or deleting an item shifts the ids after it, and that change is cascaded: impact first, then each following item and each citation is adjusted (core guide, bullet on ids). Cite an item by its id, never by its count or its place in words. For one layer, start from strata-blueprints-template-layer-1.md, -2.md or -3.md. -->

# [Subject name]

Version: 0.1.0
Status: Draft

## Layer 1: Vision

Scope: the whole [subject], its [audiences], and what lies beyond it.

### 1. Need

[Who] has [the problem]. Today [what they do about it, if anything]. [What it costs them.]

### 2. Target audience

1. **[Audience] (actor):** [who they are, how many, what they want].
2. **[Other party] (outsider):** [who they are and why they matter].

### 3. Value

1. Given [an audience in a situation], when [they act], then [what they get].
2. Given [...], when [...], then [...].

### 4. Focus

The [subject] covers [what is in]. It does not cover [what is out].

### 5. Success measures (optional)

1. [A number or an observable result] (vision-3.1).
2. [A number or an observable result] (vision-3.2).

### 6. Qualities and constraints (optional)

1. **[Quality]:** [what must hold, in the audience's terms].
2. **[Constraint]:** [the limit], set by [its source].

### 7. Vocabulary (optional)

1. **[Term]:** [the owner's definition].

### 8. Costs (optional)

1. Given [the condition or volume], when [the subject is built, run or changed], then it costs [the amount, or Not supplied: the figure]. Paid by [who].

### 9. Risks (optional)

1. Given [a situation], when [it goes wrong], then [the harm]. Severity: [High, Medium, Low or Not rated]. Answered by [the id of a decision, assumption or rule, or Not supplied: the answer].

### 10. Open Concerns (optional)

1. Given [the unsettled situation], when [what would settle it happens], then [what follows, and what it feeds]. Raised by [who].

### 11. Assumptions

1. [What is taken as true]. Basis: [why we think so]. If wrong: [what changes].

### 12. Decisions

1. [What was chosen]. Reason: [why].

## Layer 2: Structure

Scope: the whole [subject], divided into parts, with the seams between them and with the outside.

### 1. Parts

1. [Part A] (part): [its one responsibility].
2. [Part B] (part): [its one responsibility].
3. [Part C] (part): [its one responsibility].

### 2. Standing (optional)

1. [Part A]: described here.
2. [Part B]: described here.
3. [Part C]: own stack, [folder/file.md].

### 3. Seams between parts

1. [Part A] to [Part B]: [what crosses and why]. [Part A] initiates when [what starts it].
2. [Part B] to [Part C]: [what crosses and why]. [Part B] initiates when [what starts it].

### 4. Seams with the outside (optional)

1. [Part A] to [actor or outsider]: [what crosses and why]. [Part A] initiates when [what starts it].
2. [Outsider] to [Part C]: [what crosses and why]. [Outsider] initiates when [what starts it].

### 5. Shared things (optional)

1. [What several parts rely on], established by [Part A], relied on by [Part B] and [Part C].

### 6. Scenario paths (optional)

1. Realizes vision-3.1. Given [...], when [...], then [Part A] [does what], and [Part B] [does what].
2. Realizes vision-3.2. Given [...], when [...], then [Part B] [does what].

### 7. Costs (optional)

1. Given [the condition or volume], when [the subject is built, run or changed], then it costs [the amount, or Not supplied: the figure]. Paid by [who].

### 8. Risks (optional)

1. Given [a situation], when [it goes wrong], then [the harm]. Severity: [High, Medium, Low or Not rated]. Answered by [the id of a decision, assumption or rule, or Not supplied: the answer].

### 9. Open Concerns (optional)

1. Given [the unsettled situation], when [what would settle it happens], then [what follows, and what it feeds]. Raised by [who].

### 10. Assumptions

1. [What the division takes as true]. Basis: [why we think so]. If wrong: [what changes].

### 11. Decisions

1. [Why a part is a part of its own, or why two parts were kept apart]. Reason: [why].

## Layer 3: Detail

Scope: one part at a time. Each entry below describes one part from Layer 2: what it does, what it offers and needs at its seams, and what it is made with.

### [Part A] (part)

#### 1. Responsibility

[One or two sentences: what this part answers for, starting from its one-line responsibility in Layer 2.]

#### 2. Concepts and states (optional)

1. [A thing the part works with], with [its fields].
2. [Thing]'s state: [state one], [state two] or [state three].

#### 3. Seams (optional)

1. [Part A] to [Part B], offers: [what this part offers, in what form].
2. [Part C] to [Part A], needs: [what this part needs, in what condition].

#### 4. Rules

1. Realizes vision-3.1. Given [...], when [...], then [Part A] [does what].
2. Given [an edge or failure the owner gave], when [...], then [Part A] [does what].

#### 5. Inside (optional)

1. [A piece] (piece), which [does what].
2. [Another piece] (piece), which [does what].

#### 6. Limits

1. [A number, a testable condition or an observable result] (Layer 1, [quality or topic]).
2. [Another limit] (Layer 1, Not supplied: [the quality]).

#### 7. Construction (optional)

1. [The means chosen: tool, material or method, and the value it is set to]. Reason: [the Limit it meets].
Not supplied: [a value nobody has chosen].

#### 8. Costs (optional)

1. Given [the condition or volume], when [the subject is built, run or changed], then it costs [the amount, or Not supplied: the figure]. Paid by [who].

#### 9. Risks (optional)

1. Given [a situation], when [it goes wrong], then [the harm]. Severity: [High, Medium, Low or Not rated]. Answered by [the id of a decision, assumption or rule, or Not supplied: the answer].

#### 10. Open Concerns (optional)

1. Given [the unsettled situation], when [what would settle it happens], then [what follows, and what it feeds]. Raised by [who].

#### 11. Assumptions

1. [What the part's rules rest on]. Basis: [why we think so]. If wrong: [what changes].

#### 12. Decisions

1. [What was chosen about the part's shape]. Reason: [why].

### [Part B] (part)

#### 1. Responsibility

[...]

#### 2. Concepts and states

None.

#### 3. Seams

None.

#### 4. Rules

1. Realizes vision-3.2. Given [...], when [...], then [Part B] [does what].

#### 5. Inside

None.

#### 6. Limits

1. [...] (Layer 1, [quality or topic]).

#### 7. Construction

None.

#### 8. Costs

None.

#### 9. Risks

None.

#### 10. Open Concerns

None.

#### 11. Assumptions

None.

#### 12. Decisions

None.
