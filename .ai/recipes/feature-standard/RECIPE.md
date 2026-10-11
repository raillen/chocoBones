# Standard Feature Implementation

## Purpose
Default multi-agent implementation flow for ordinary product and feature work with independent cross-model review.

## Preconditions
- Active Goal in LOCKED or PLANNED state
- Initial codebase context index available

## Required Inputs
- Active Goal
- Task specifications
- Acceptance criteria

## Step DAG & Dependencies
1. **Map impact and dependencies** (`explore`)
   - **Role:** `explorer`
   - **Skills:** `prumo-navigation`, `lean-progressive-context`
   - **Input:** Active Goal & docs/PRUMO.md
   - **Output:** Impact map and context plan
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Design minimal task plan** (`plan`)
   - **Role:** `architect`
   - **Skills:** `clean-code`, `architecture-quality`
   - **Input:** Impact map
   - **Output:** Approved Plan DAG
   - **Evidence Required:** `review`
   - **Dependencies:** `explore`
3. **Implement scoped changes** (`implement`)
   - **Role:** `implementer`
   - **Skills:** `clean-code`, `refactoring`, `error-handling`
   - **Input:** Task ContextPack
   - **Output:** Source code and unit tests
   - **Evidence Required:** `lint`
   - **Dependencies:** `plan`
4. **Execute test verification** (`test`)
   - **Role:** `tester`
   - **Skills:** `testing-quality`
   - **Input:** Changed implementation
   - **Output:** Test execution report
   - **Evidence Required:** `test`
   - **Dependencies:** `implement`
   - **Gates:** `tests`
5. **Independent review** (`review`)
   - **Role:** `reviewer`
   - **Skills:** `code-review`, `clean-code`
   - **Input:** Changeset diff and test evidence
   - **Output:** Review report and approval
   - **Evidence Required:** `review`
   - **Dependencies:** `test`
   - **Gates:** `review`
6. **Synchronize canonical documentation** (`docs`)
   - **Role:** `documentation-maintainer`
   - **Skills:** `documentation`, `lean-progressive-context`
   - **Input:** Verified changeset
   - **Output:** Canonical Markdown delta
   - **Evidence Required:** `review`
   - **Dependencies:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `tests`, `review`
- **Artifacts:** `Implementation changeset`, `Test suite evidence`, `Review report`, `Documentation delta`

## Stop Conditions
- Goal acceptance criteria met and verified with evidence
- Reviewer approval granted
