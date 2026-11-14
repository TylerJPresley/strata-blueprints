# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 0.1.x | Yes |

Strata Blueprints is a draft before 1.0. Fixes go into the latest 0.1.x release.

## Reporting a vulnerability

Report a vulnerability privately through GitHub's private vulnerability reporting: open the repository's Security tab, choose Report a vulnerability, and describe the problem. Please do not open a public issue for it.

## What is in scope

- `skills/strata-blueprints/scripts/strata-blueprints-lint.mjs`, the lint script inside the skill, runs on your machine and reads the Markdown files you give it.

The Markdown standard (the guide, template and examples) has no runtime, so it has nothing to exploit. A wrong or misleading statement in it is a normal issue.
