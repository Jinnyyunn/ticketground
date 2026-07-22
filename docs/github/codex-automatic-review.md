# Codex Automatic Pull Request Review

## Purpose

Ticketground uses the ChatGPT Codex GitHub connector to perform semantic code reviews on pull requests. The existing `github-actions[bot]` continues to handle deterministic labels, checklists, and CI. Codex adds behavioral review for defects, regressions, security boundaries, and missing high-value tests.

## Repository scope

- Connector access is limited to `Jinnyyunn/ticketground`.
- Automatic review is set to **all pull requests**, **every push**, with **thorough code review** enabled.
- The Codex Cloud environment is named `Ticketground PR Review` and uses automatic dependency setup with internet access disabled after setup.
- Credit overage is not enabled; reviews stop rather than consuming additional credits beyond the plan limit.
- The reviewer follows the root `AGENTS.md`, especially `## Code Review Rules`.
- Automatic review does not enable automatic merge or administrator overrides.

## Authentication boundary

Simple-login files are a protected boundary. The canonical file patterns live in `PROTECTED_AUTH_PATTERNS` in `.github/scripts/ticketground-bot.cjs`.

Codex must flag a pull request that changes this boundary unless the pull request explicitly states that the user requested the authentication change and includes focused tests. Review automation must never rewrite social-login credentials or expose provider secrets.

## Verification

For every setup or settings change:

1. Open a pull request from a non-default branch.
2. Confirm the normal Ticketground bot checklist and CI run.
3. Confirm Codex posts a GitHub review or a no-findings acknowledgement.
4. Confirm protected authentication files were not changed unintentionally.
5. Merge only after a human checks the findings and relevant runtime behavior.

## Operations

The connector, environment, and automatic-review trigger are managed in ChatGPT Codex settings, not with a repository API key. If automatic review stops appearing, check the connector installation, repository access, `Ticketground PR Review` environment, and code review toggle before changing workflow code.
