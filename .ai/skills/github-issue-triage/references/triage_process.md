# GitHub Issue Triage Process

## Objective
To ensure every submitted issue is reviewed, categorized, and prioritized in a timely manner, preventing the issue tracker from becoming a graveyard.

## Daily Triage Routine
1. **Acknowledge**: Review all new issues. Thank the reporter.
2. **Clarify**: If an issue lacks necessary information (e.g., reproduction steps, logs), add the `needs-info` label and ask the reporter for details.
3. **Categorize**: Apply appropriate labels (e.g., `bug`, `enhancement`, `documentation`, `question`).
4. **Prioritize**: Apply priority labels:
   - `P0-critical`: Drops everything, fix immediately (e.g., data loss, security vulnerability, production crash).
   - `P1-high`: Important, schedule for next immediate milestone.
   - `P2-medium`: Standard priority.
   - `P3-low`: Nice to have, backlog.
5. **Assign**: If clear, assign to a specific developer or team.
6. **Close Invalid**: Close issues that are duplicates (reference the original), out of scope, or cannot be reproduced after a reasonable waiting period for information.

## Automations
We utilize GitHub Actions and `gh` CLI scripts to auto-label issues based on keywords (e.g., "panic" -> `bug`, "how do I" -> `question`). Triage maintainers should review these automated decisions.
