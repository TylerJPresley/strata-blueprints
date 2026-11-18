<!-- strata-blueprints: condensed, published (generated; each omitted topic read None. or held only open questions) -->

# Example: a to-do app (companion to the Strata Blueprints guide)

Status: Review

This is a worked blueprint for a software product: an app where a person keeps tasks on lists, sees what is due, and reaches the same tasks from a phone and from a web page. It is one way to fill the layers, not a template. Every scenario stays as Given, When, Then down the layers, and specific means appear only in Layer 3 Construction.

## Contents

- [Layer 1: Vision](#layer-1-vision)
  - [1. Need](#1-need)
  - [2. Target audience](#2-target-audience)
  - [3. Value](#3-value)
  - [4. Focus](#4-focus)
  - [5. Success measures](#5-success-measures)
  - [6. Qualities and constraints](#6-qualities-and-constraints)
  - [7. Vocabulary](#7-vocabulary)
  - [8. Costs](#8-costs)
  - [9. Risks](#9-risks)
  - [10. Open Concerns](#10-open-concerns)
  - [11. Assumptions](#11-assumptions)
  - [12. Decisions](#12-decisions)
- [Layer 2: Structure](#layer-2-structure)
  - [1. Parts](#1-parts)
  - [2. Standing](#2-standing)
  - [3. Seams between parts](#3-seams-between-parts)
  - [4. Seams with the outside](#4-seams-with-the-outside)
  - [5. Shared things](#5-shared-things)
  - [6. Scenario paths](#6-scenario-paths)
  - [7. Costs](#7-costs)
  - [8. Risks](#8-risks)
  - [9. Open Concerns](#9-open-concerns)
  - [10. Assumptions](#10-assumptions)
  - [11. Decisions](#11-decisions)
- [Layer 3: Detail](#layer-3-detail)
  - [Access (part)](#access-part)
  - [Ledger (part)](#ledger-part)
  - [Folders (part)](#folders-part)
  - [Timing (part)](#timing-part)
  - [Notifier (part)](#notifier-part)
  - [Presence (part)](#presence-part)
- [View: Lifecycle](#view-lifecycle)

## Layer 1: Vision

Scope: the whole app, its people and the things beyond it that it leans on.

### 1. Need

A person carries many small commitments in their head: things to do today, things due later, things that belong to work and things that belong to home. Held only in memory, a commitment is forgotten until it is late, and the person cannot tell at a glance what needs doing now. They want a trusted place to put every commitment, grouped the way they think about it, that tells them what is due and lets them reach it wherever they are.

### 2. Target audience

- **The keeper (actor):** a person managing their own commitments, who adds things through the day on whatever device is at hand and wants to see what is due without hunting.
- **A household or team member (actor):** a person who shares a grouping of commitments with the keeper and adds to or completes items in it.
- **The keeper's devices (outsider):** the phone and the computer the keeper already owns, through which they reach the app.
- **The clock and calendar (outsider):** the passage of time, against which "due" is judged.
- **A notification channel (outsider):** the path by which a reminder reaches the keeper when the app is not open.

### 3. Value

- 3.1. Given the keeper has a commitment in mind, when they write it down in a few seconds, then it is saved and shows up as something to do.
- 3.2. Given the keeper has many commitments, when they open the app, then the commitments are grouped the way the keeper arranged them, each group shown on its own.
- 3.3. Given some commitments have a day or time they are due, when the keeper looks, then they see what is due today and what is overdue, in due order.
- 3.4. Given a commitment is due soon and the app is not open, when its due time approaches, then the keeper is alerted through a channel they chose.
- 3.5. Given the keeper finishes a commitment, when they mark it done, then it leaves the list of things to do and the keeper can still find it later.
- 3.6. Given the keeper added commitments on their phone, when they open the app on their computer, then the same commitments appear, up to date.
- 3.7. Given a grouping is shared with another person, when either person changes it, then both see the change without asking the other.

### 4. Focus

The app covers capturing commitments quickly, grouping them, judging what is due against time, alerting the keeper, marking things done and keeping them findable, reaching the same commitments from more than one device, and sharing a grouping with another person. It does not cover note-taking, long documents, project planning with dependencies, or team workflows beyond a shared grouping.

### 5. Success measures

- A commitment is captured in under five seconds from the moment the keeper decides to add it.
- When the keeper opens the app, what is due today and what is overdue are visible without any search or filter step.
- A change made on one device is visible on another device within a few seconds, without the keeper doing anything.
- When a commitment's due time arrives and the app is closed, the keeper is alerted within a minute.
- No commitment the keeper saved is ever lost or shown to a person it was not shared with.

### 6. Qualities and constraints

- **Durable:** once the app tells the keeper a commitment is saved, it survives a closed app, a dead battery and a lost connection.
- **Prompt:** opening the app and seeing today's commitments feels immediate; a change reaches the keeper's other devices within seconds.
- **Reachable offline:** the keeper can read and add commitments with no connection, and the app reconciles when the connection returns.
- **Private by default:** a keeper's commitments are visible only to that keeper and to anyone they deliberately share a grouping with; no one else, inside the product or out, can read them.
- **Trustworthy with identity:** only the rightful keeper reaches their commitments, and proving who they are is quick and does not expose their secret.
- **Within reach of one maintainer:** the app is built and run by a very small team, so its moving parts are few and its running cost is low.

### 7. Vocabulary

- **Commitment:** one thing the keeper means to do, the smallest unit the app holds. (Shown to the keeper as a task.)
- **Grouping:** a named collection of commitments the keeper arranges, such as "Work" or "Groceries".
- **Due:** having a day, or a day and time, by which a commitment is meant to be done.
- **Done:** marked by the keeper as finished; it leaves the active view but is kept.
- **Alert:** a message sent to the keeper about a due commitment when the app is not open.
- **Device:** one phone or computer through which the keeper reaches the app.
- **Shared grouping:** a grouping two or more people can both read and change.

### 8. Costs

- 8.1. Given the app is kept running, when the maintainer spends time on it, then it costs Not supplied: the hours each month. Paid by the maintainer.

### 9. Risks

- 9.1. Given a keeper shares a grouping with the wrong person, when that person opens it, then the keeper's commitments are read by someone they did not intend. Severity: High. Answered by vision-12.1.
- 9.2. Given the one maintainer is away, when the app stops working, then keepers wait for a fix. Severity: Low. Answered by Not supplied: who covers for the maintainer.

### 10. Open Concerns

- 10.1. Given keepers may want their commitments in more than one language, when the maintainer says whether the app must be translated, then the qualities are re-weighed and the costs that follow from them are priced again. Raised by a keeper.

### 11. Assumptions

- 11.1. The keeper reaches the app through devices they already own, over an ordinary consumer connection that is sometimes absent. Basis: the audience is a single person managing personal commitments, not an enterprise fleet. If wrong: the offline and reachable-anywhere qualities would be re-weighed.
- 11.2. Most keepers hold hundreds, not millions, of live commitments. Basis: personal task-keeping, not archival storage. If wrong: the prompt and durable qualities would need stricter limits.

### 12. Decisions

- 12.1. The app serves one keeper's own commitments first, with sharing as a deliberate, limited act, rather than being a team workspace. Reason: the need is a trusted personal place; a shared grouping meets the household case without the weight of team roles.
- Not supplied: whether the keeper may invite a person who has no account yet, or only an existing keeper, to a shared grouping.

## Layer 2: Structure

Scope: the whole app, divided into its parts, with the seams between them and with the outside.

### 1. Parts

- Access (part): establishes who the keeper is and admits only them to their own commitments.
- Ledger (part): holds each commitment and its state, and answers for what is saved, changed and done.
- Folders (part): holds the named groupings, their order, and who may see each one.
- Timing (part): judges each commitment against the clock and says what is due, overdue and upcoming.
- Notifier (part): sends the keeper a message about a due commitment when the app is not open.
- Presence (part): keeps every device and shared person showing the same commitments, and reconciles changes made apart.

### 2. Standing

- Access: sbp-detail-access.md
- Ledger: sbp-detail-ledger.md
- Folders: sbp-detail-folders.md
- Timing: sbp-detail-timing.md
- Notifier: sbp-detail-notifier.md
- Presence: sbp-detail-presence.md

### 3. Seams between parts

- Access to Ledger: a proven keeper identity crosses, so Ledger serves only that keeper's own items. Access initiates on each session.
- Folders to Ledger: a grouping's identity and its membership cross, so each commitment is held under one grouping and reached through it. Folders initiates when a commitment is filed or moved.
- Ledger to Timing: each commitment's due day or time crosses, so Timing can judge it. Ledger initiates when a due value is set or changed.
- Timing to Notifier: the fact that a commitment has become due, and when, crosses, so Notifier can decide to send. Timing initiates when a due moment arrives.
- Ledger to Presence: every change to a commitment crosses, so Presence can carry it to the keeper's other devices and to shared people. Ledger initiates on each change.
- Folders to Presence: a change to a grouping or its sharing crosses, so Presence carries it the same way. Folders initiates on each change.

### 4. Seams with the outside

- The keeper's devices to Access: a proof of who the keeper is crosses from the device, and an admission crosses back. The device initiates when the keeper signs in.
- The keeper's devices to Presence: up-to-date commitments and groupings cross to each device, and the device's own new changes cross back. The device initiates when it connects.
- Timing to the clock and calendar: the current time crosses in, so Timing can judge what is due. Timing initiates when it reads the time.
- Notifier to a notification channel: a message for the keeper crosses out to the channel. Notifier initiates when a commitment is due and the app is closed.

### 5. Shared things

- The keeper's proven identity, established by Access, is relied on by every other part to scope what it holds and shows to that one keeper.
- A single notion of "now", read from the clock and calendar, is relied on by Timing and Notifier so that "due" means the same thing everywhere.

### 6. Scenario paths

- 6.1. Realizes vision-3.1. Given the keeper has a commitment in mind, when they write it down in a few seconds, then Access admits the keeper, Ledger saves the new item under the keeper, and Presence carries it to the keeper's other devices.
- 6.2. Realizes vision-3.2. Given the keeper has many commitments, when they open the app, then Access admits the keeper and Folders returns the keeper's groupings in order, each holding its own Ledger.
- 6.3. Realizes vision-3.3. Given some commitments have a day or time they are due, when the keeper looks, then Ledger supplies the due values and Timing ranks them into today, overdue and upcoming for the keeper to see.
- 6.4. Realizes vision-3.4. Given a commitment is due soon and the app is not open, when its due time approaches, then Timing marks it due and Notifier sends the keeper a message through the chosen notification channel.
- 6.5. Realizes vision-3.5. Given the keeper finishes a commitment, when they mark it done, then Ledger records it done so it leaves the active view, Folders still lists it as kept, and Presence carries the change to other devices.
- 6.6. Realizes vision-3.6. Given the keeper added commitments on their phone, when they open the app on their computer, then Presence brings the computer up to date from the changes Ledger and Folders recorded, under the same Access.
- 6.7. Realizes vision-3.7. Given a grouping is shared with another person, when either person changes it, then Ledger or Folders records the change under the shared grouping and Presence carries it to every person the grouping is shared with.

### 7. Costs

- 7.1. Given the app needs a number of screens, when the phone app and the web page are built, then it costs 4,800 USD one-off. Paid by the maintainer.
- 7.2. Given keepers receive a number of alerts, when the notification channel sends them, then it costs 15 USD per month. Paid by the maintainer.

### 8. Risks

- 8.1. Given the keeper changes the same grouping on two devices while offline, when both devices reconnect, then one change can overwrite the other. Severity: Medium. Answered by structure-11.2.

### 9. Open Concerns

- 9.1. Given Notifier messages a keeper when the app is not open, when the maintainer says which channels a keeper may choose, then the seam between Notifier and the outside is fixed and structure-7.2 can be checked. Raised by the maintainer.

### 10. Assumptions

- 10.1. A commitment belongs to exactly one grouping at a time. Basis: the keeper arranges commitments into groups they think in, and a single home keeps "what is in this group" unambiguous. If wrong: Folders and Ledger would need a many-to-many seam.

### 11. Decisions

- 11.1. "Due" is judged by one part, Timing, rather than by each part that cares about time. Reason: the clock is a shared thing, and one judge keeps "due", "overdue" and "upcoming" meaning the same for both the keeper's view and the alerts.
- 11.2. Keeping devices and shared people in step is one part, Presence, separate from the parts that own the data. Reason: reconciling changes made apart is a single hard job; concentrating it keeps each data part simple and the reachable-anywhere quality in one place.
- Not supplied: whether a shared grouping has an owner who alone may unshare it, or any member may.

## Layer 3: Detail

Scope: one part in each entry below; there is one entry for every part listed in Layer 2.

### Access (part)

#### 1. Responsibility

Establishes that a keeper is who they claim to be, and hands every other part a proof it can trust, so that each keeper reaches only their own commitments and groupings, and shared people reach only what is shared with them.

#### 2. Concepts and states

- A keeper account, which is either unverified, active or locked.
- A session, which is either open (a device currently proven) or ended.
- A credential, the secret only the keeper knows, held so that even the maker cannot read it.

#### 3. Seams

- Access to Ledger, offers: a proven keeper identity that scopes every held item to that keeper.
- The keeper's devices to Access, offers and needs: needs a proof of who the keeper is from the device, and offers an admission that opens a session.

#### 4. Rules

- 4.1. Realizes vision-3.1. Given the keeper has a commitment in mind, when they write it down in a few seconds, then Access confirms the open session and attaches the keeper's identity so the item is saved as theirs.
- 4.2. Given a device presents a proof that does not match an active account, when Access checks it, then Access refuses and no session opens.
- 4.3. Given several wrong proofs arrive for one account in a short time, when the next arrives, then Access locks the account against further attempts and tells the keeper.

#### 5. Inside

- A verifier (piece), which checks a presented proof against what is held.
- A session keeper (piece), which marks a session open or ended and attaches identity to each request.

#### 6. Limits

- 6.1. Admitting a keeper, proof in hand, completes within two seconds (Layer 1, Trustworthy with identity).
- 6.2. A keeper's held secret is never readable by anyone, including the maker (Layer 1, Private by default).
- 6.3. A proof crossing from a device cannot be read or replayed by a third party (Layer 1, Trustworthy with identity).

#### 7. Construction

- 7.1. The keeper's secret is stored only as a slow one-way hash with a per-account salt, never in the clear. Reason: meets "the held secret is never readable" even if the store is copied.
- 7.2. Every proof and admission crosses over an encrypted transport, and a session is carried by a signed, expiring credential the device returns on each request. Reason: meets "cannot be read or replayed" and keeps the two-second admission without re-proving each time.
- Not supplied: how long a session stays open before the keeper must prove themselves again.

#### 11. Assumptions

- 11.1. A keeper proves themselves once per device and is then trusted until the session ends, rather than proving on every action. Basis: the keeper adds items many times a day and would abandon the app if made to re-prove each time. If wrong: the admission limit and session rules would tighten.

#### 12. Decisions

- 12.1. An account is locked, not silently throttled, after repeated wrong proofs. Reason: a lock the keeper is told about protects the account and keeps the keeper informed, meeting "only the rightful keeper reaches their commitments".

### Ledger (part)

#### 1. Responsibility

Holds each commitment and everything true about it, and answers for saving a new one, changing it, marking it done and keeping it findable, so that nothing the keeper saved is ever lost.

#### 2. Concepts and states

- A commitment, with its text, an optional due value, and the grouping it belongs to.
- A commitment's state: active (to do), done (finished but kept) or removed.
- A change, one recorded edit to a commitment, carrying when and by whom.

#### 3. Seams

- Access to Ledger, needs: a proven keeper identity, so every item is held and shown under the right keeper.
- Folders to Ledger, needs: the grouping a commitment belongs to and who may see it.
- Ledger to Timing, offers: each commitment's due day or time, for Timing to judge.
- Ledger to Presence, offers: every change to a commitment, for Presence to carry.

#### 4. Rules

- 4.1. Realizes vision-3.1. Given the keeper has a commitment in mind, when they write it down in a few seconds, then Ledger saves it as active and confirms it is saved before the keeper looks away.
- 4.2. Realizes vision-3.5. Given the keeper finishes a commitment, when they mark it done, then Ledger records it done so it leaves the active view and stays findable as a kept item.
- 4.3. Given the keeper edits a commitment while offline, when the device reconnects, then Ledger accepts the recorded change and offers it to Presence.

#### 5. Inside

- A store of commitments (piece), which holds each item and its current state.
- A change log (piece), which records each edit in order so a change made apart can be reconciled.

#### 6. Limits

- 6.1. A saved commitment survives a closed app, a dead battery and a lost connection (Layer 1, Durable).
- 6.2. A commitment is confirmed saved within one second of the keeper writing it (Layer 1, Prompt).
- 6.3. A done commitment remains findable and is never silently discarded (Layer 1, Durable).

#### 7. Construction

- 7.1. Each change is written to durable local storage before the save is confirmed, and only then offered to Presence. Reason: meets "survives a lost connection" and lets the one-second confirm happen without waiting for the network.
- 7.2. Every commitment carries the identity of its keeper, and a read returns only items under the asking keeper's identity. Reason: meets "shown only to that keeper" from Layer 1.
- 7.3. A done or removed commitment is kept in the store, out of the active view, until the keeper clears it. Reason: meets "never silently discarded" while keeping done items findable.

#### 8. Costs

- 8.1. Given a number of keepers use the app, when their commitments are held and served, then it costs 35 USD per month. Paid by the maintainer.

#### 11. Assumptions

- 11.1. A keeper holds hundreds, not millions, of live commitments, so the whole set can be held and reconciled on a single device. Basis: personal task-keeping, from Layer 1. If wrong: the store and the one-second confirm would need a different approach.

#### 12. Decisions

- 12.1. The change log is kept rather than only the current value of each commitment. Reason: a change made offline on one device can be reconciled against another only if the order of changes is known, which serves the reachable-offline quality.

### Folders (part)

#### 1. Responsibility

Holds the keeper's named groupings, the order the keeper put them in, and who may see each one, so that commitments appear arranged the way the keeper thinks and a grouping can be shared deliberately.

#### 2. Concepts and states

- A grouping, with its name, its position in the keeper's order, and its membership.
- A grouping's sharing state: private to the keeper, or shared with named people.
- A membership, the set of people who may read and change a shared grouping.

#### 3. Seams

- Folders to Ledger, offers: a grouping's identity and membership, so each commitment is filed under one grouping and reached through it.
- Folders to Presence, offers: every change to a grouping or its sharing, for Presence to carry.

#### 4. Rules

- 4.1. Realizes vision-3.2. Given the keeper has many commitments, when they open the app, then Folders returns the keeper's groupings in the order the keeper set, each ready to show its own commitments.
- 4.2. Realizes vision-3.7. Given a grouping is shared with another person, when either person changes it, then Folders records the change under the shared grouping for Presence to carry to every member.
- 4.3. Given the keeper reorders their groupings, when they move one, then Folders records the new order and keeps it for next time.

#### 5. Inside

- A grouping store (piece), which holds each grouping, its order and its membership.

#### 6. Limits

- 6.1. A grouping and its order are durable across app restarts and devices (Layer 1, Durable).
- 6.2. A shared grouping's content is visible only to its named members (Layer 1, Private by default).

#### 7. Construction

- 7.1. A grouping's membership is a list of keeper identities, checked on every read of the grouping so only members see its commitments. Reason: meets "visible only to its named members".
- 7.2. A grouping sits at the top level of the keeper's order and is not nested inside another grouping. Reason: a flat, ordered set matches how the keeper arranges groups and keeps "which group holds this" unambiguous.

#### 11. Assumptions

- 11.1. The keeper has a small number of groupings, few enough to show all at once. Basis: groupings mirror the areas of a person's life, which are few. If wrong: Folders would need its own browsing and search.

#### 12. Decisions

- 12.1. A commitment lives in exactly one grouping at a time. Reason: a single home keeps "what is in this group" unambiguous and matches the Layer 2 assumption, so the keeper never wonders where an item is.

### Timing (part)

#### 1. Responsibility

Judges each commitment's due value against the current time and says which commitments are due today, which are overdue and which are upcoming, so the keeper sees what needs doing now and the alerting part knows when a commitment has come due.

#### 2. Concepts and states

- A due value on a commitment: a day, or a day and time.
- A judgement: today, overdue or upcoming, computed against "now".
- The passing of a due moment, the instant a commitment's due time arrives.

#### 3. Seams

- Ledger to Timing, needs: each commitment's due day or time.
- Timing to Notifier, offers: the fact that a commitment has become due, and when.
- Timing to the clock and calendar, needs: the current time, to judge against.

#### 4. Rules

- 4.1. Realizes vision-3.3. Given some commitments have a day or time they are due, when the keeper looks, then Timing ranks them into today, overdue and upcoming, in due order.
- 4.2. Given a commitment's due moment arrives, when Timing next reads the time, then Timing marks it due and offers that fact to Notifier.
- 4.3. Given a commitment has no due value, when Timing judges the set, then it is left out of today and overdue and placed among the undated.

#### 6. Limits

- 6.1. A commitment that has become due is recognised as such within one minute of its due moment (Layer 1, Prompt).
- 6.2. The keeper's time zone is honoured so "today" matches the keeper's own day (Layer 1, Prompt).

#### 7. Construction

- 7.1. Timing reads the current moment in the keeper's own time zone each time it judges, rather than storing a precomputed verdict. Reason: keeps "today" correct as time passes and as the keeper travels, meeting the one-minute recognition limit without stale state.
- 7.2. A commitment due "today" with no time is treated as due at the end of the keeper's day. Reason: it is not overdue until the day is over, which matches how the keeper reads "due today".

#### 11. Assumptions

- 11.1. The keeper's device knows the keeper's current time zone. Basis: consumer devices track the local zone as the keeper travels. If wrong: the keeper would have to set a zone by hand for "today" to be right.

#### 12. Decisions

- 12.1. Timing holds no commitment data of its own and judges only what it is handed. Reason: keeping the judge stateless keeps "due" consistent with the Ledger and avoids two copies of the truth.

### Notifier (part)

#### 1. Responsibility

Sends the keeper a message about a commitment that has come due when the app is not open, through a channel the keeper chose, so a due commitment is not missed because the app was closed.

#### 2. Concepts and states

- An alert, pending or sent, for one due commitment.
- A chosen channel, the path the keeper picked to be reached by.
- A quiet setting, hours in which the keeper has asked not to be alerted.

#### 3. Seams

- Timing to Notifier, needs: the fact that a commitment has become due, and when.
- Notifier to a notification channel, offers: a message for the keeper about the due commitment.

#### 4. Rules

- 4.1. Realizes vision-3.4. Given a commitment is due soon and the app is not open, when its due time approaches, then Notifier sends the keeper a message through the chosen channel.
- 4.2. Given the keeper has set quiet hours, when a commitment comes due inside them, then Notifier holds the message until the quiet hours end.
- 4.3. Given the keeper has the app open, when a commitment comes due, then Notifier sends no outside message, because the keeper already sees it.

#### 5. Inside

- A sender (piece), which hands a message to the chosen channel.
- A schedule of pending alerts (piece), which holds what is to be sent and when.

#### 6. Limits

- 6.1. An alert reaches the keeper within one minute of the commitment becoming due, outside quiet hours (Layer 1, Prompt).
- 6.2. A message's content reveals a due commitment only to the keeper, not to anyone handling the channel (Layer 1, Private by default).

#### 7. Construction

- 7.1. A due message carries only a neutral prompt to open the app, not the commitment's text, so the channel's handler cannot read the content. Reason: meets "reveals a due commitment only to the keeper".
- 7.2. The keeper chooses one active channel at a time from those the app offers. Reason: one channel keeps the alert certain to arrive once and avoids a storm of duplicate messages.

#### 11. Assumptions

- 11.1. A notification channel can reach the keeper's device when the app is closed. Basis: the Layer 1 outsider is a channel that carries messages to a resting device. If wrong: the keeper would see a due commitment only on opening the app.

#### 12. Decisions

- 12.1. The Notifier sends nothing while the app is open and showing the keeper. Reason: the keeper already sees the due commitment, and a double prompt would be noise rather than help.

### Presence (part)

#### 1. Responsibility

Keeps every one of the keeper's devices, and every member of a shared grouping, showing the same commitments and groupings, and reconciles changes made on different devices while apart, so the keeper reaches up-to-date commitments wherever they are.

#### 2. Concepts and states

- A device's view, either up to date or behind.
- A pending change, recorded on one device and not yet carried to the others.
- A conflict, two changes to the same commitment made apart, and its resolution.

#### 3. Seams

- Ledger to Presence, needs: every change to a commitment, to carry.
- Folders to Presence, needs: every change to a grouping or its sharing, to carry.
- The keeper's devices to Presence, offers and needs: offers each device the up-to-date commitments and groupings, and needs the device's own new changes in return.

#### 4. Rules

- 4.1. Realizes vision-3.6. Given the keeper added commitments on their phone, when they open the app on their computer, then Presence brings the computer up to date from the recorded changes, under the same keeper identity.
- 4.2. Given two devices changed the same commitment while apart, when they reconnect, then Presence reconciles them by a stated rule and leaves both devices showing the same result.
- 4.3. Given a device has no connection, when the keeper reads or adds commitments, then Presence lets the work continue locally and carries the changes when the connection returns.

#### 5. Inside

- A reconciler (piece), which orders changes made apart and settles conflicts.
- A per-device tracker (piece), which remembers how far each device has caught up.

#### 6. Limits

- 6.1. A change made on one device is visible on another within a few seconds of both being connected (Layer 1, Prompt).
- 6.2. The keeper can read and add commitments with no connection, and nothing is lost when it returns (Layer 1, Reachable offline).
- 6.3. A carried change crosses only to the keeper's own devices and to members of a shared grouping (Layer 1, Private by default).

#### 7. Construction

- 7.1. Each change carries the moment it was made and the device that made it; the reconciler orders by that moment and, for a true tie on one commitment, keeps the latest and records the other as superseded. Reason: a stated, repeatable rule meets "both devices show the same result" without asking the keeper.
- 7.2. A device applies a change locally first and carries it when connected, and a connected device is refreshed within seconds. Reason: meets both the offline and the few-seconds limits.
- 7.3. When a conflicting edit is superseded, the keeper is shown that it happened so nothing is lost silently. Reason: a visible record keeps the keeper's trust in the durable quality.

#### 11. Assumptions

- 11.1. Two people rarely change the very same commitment in the very same instant. Basis: a shared grouping is used by a household or small team, not a crowd. If wrong: the last-writer rule would need to give way to a merge the keeper confirms.

#### 12. Decisions

- 12.1. A change is applied on its own device first and carried afterwards, rather than waiting for the network. Reason: this keeps the app usable offline and the confirm prompt fast, meeting the reachable-offline and prompt qualities.

## View: Lifecycle

Scope: how the app is produced, put into service, kept working and changed, written once for the whole subject.

- Given a change to the app is ready, when the maintainer releases it, then the phone app and the web page are updated so every device runs a compatible version, and a keeper on an older version is still served until they update.
- Given the app is running, when a keeper's commitments grow or a new keeper joins, then the running parts carry the added load within the prompt and durable limits, and the maintainer is warned before any part nears its capacity.
- Given a part fails or a connection drops, when the keeper uses the app, then saved commitments remain durable, reads and adds continue offline, and the app reconciles on recovery without losing a change.
- Given the maintainer must change how commitments or groupings are stored, when they roll the change out, then existing commitments are carried forward unchanged and no keeper loses access during the change.
- Given a keeper closes their account, when they ask for it, then their commitments are removed from every device and store, and nothing of theirs remains readable.
