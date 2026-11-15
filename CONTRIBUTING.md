# Contributing to Strata Blueprints

Thank you for helping. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report vulnerabilities as in [SECURITY.md](SECURITY.md).

## Proposing a change

- Issue first for changes to the standard's rules or topics (use the "Standard change" issue template to propose the idea and build agreement).
- Direct pull request for small fixes (a typo, an example correction, improving the wording of a guide topic).
- Complete the pull request checklist, [.github/pull_request_template.md](.github/pull_request_template.md). It is the checklist for people and agents.
- Maintainers triage new issues and review pull requests as time allows; there is no fixed timeline.

## Git

Trunk-based. Commit directly to `main` until the project goes live; after that, every change is a short-lived branch from `main`, merged by pull request.

- Commits: Use conventional types (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`). One coherent change per commit. Each commit builds and passes all checks (`node gate.mjs` must pass). A bug fix carries its regression test in the same commit. A pushed commit is corrected with a new commit, never force-pushed.
- Changelog: Update [CHANGELOG.md](CHANGELOG.md) when you add a feature or fix a bug.
- When you change the guide: Update the worked examples and README so they agree. When you change the lint script, add a test. Every example must lint with 0 warnings.
- Exact commands: see [AGENTS.md](AGENTS.md).

## Standards

Testing: run `npm test` to run every test. Exact commands in [AGENTS.md](AGENTS.md).

A bug fix includes a regression test in the same commit. When adding or changing an example, run the examples test to confirm all checks pass.

Documents: check documents with the lint script (exact commands: [AGENTS.md](AGENTS.md)). When you add or change an example, add or update its entry in the test's MANIFEST. A new example numbers every item in the cited topics under its own topic (`3.1`, `7.1`, `7.2`), cites items by their full id (`vision-3.1`, `detail.ledger-7.2`), and its Layer 2 paths and Layer 3 rules say which scenario they realize with `Realizes`, and only the idea example may omit Layer 3. Edit the full template first, then the matching cut; the gate's `templates` check compares them.

Dependencies: none. The lint script runs on Node.js LTS only.

Style: the skill folder holds only `SKILL.md`, `LICENSE`, `references/` (the guides and examples), `assets/` (the templates) and `scripts/` (the lint). Nothing is generated or copied from elsewhere.

Exact build, test and lint commands: [AGENTS.md](AGENTS.md).

## AI-assisted contributions

AI-assisted pull requests are accepted. Disclose AI assistance in the pull request. A human verifies generated work before it is submitted. Agents follow [AGENTS.md](AGENTS.md).

## Licensing

Everything in this project is MIT. Contributions are accepted under MIT (see [LICENSE](LICENSE)). The project uses no CLA or DCO.
