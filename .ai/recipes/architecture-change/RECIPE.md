# Architecture Change

## Purpose
Safely modify system boundaries, public contracts, and ADRs with staged execution.

## Preconditions
- Proposed architectural RFC or Goal

## Required Inputs
- RFC / Goal
- System architecture
- Dependency graph

## Step DAG & Dependencies
1. **Map affected consumers and interfaces** (`explore`)
   - **Role:** `explorer`
   - **Skills:** `prumo-navigation`
   - **Input:** Proposed RFC
   - **Output:** Interface impact map
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Author Architectural Decision Record** (`propose-adr`)
   - **Role:** `architect`
   - **Skills:** `architecture-quality`
   - **Input:** Interface impact map
   - **Output:** Canonical ADR document
   - **Evidence Required:** `review`
   - **Dependencies:** `explore`
   - **Gates:** `adr-approval`
3. **Design staged DAG migration plan** (`plan-staged`)
   - **Role:** `architect`
   - **Skills:** `architecture-quality`
   - **Input:** Approved ADR
   - **Output:** Staged Plan DAG
   - **Evidence Required:** `review`
   - **Dependencies:** `propose-adr`
4. **Implement contract transformation** (`implement`)
   - **Role:** `implementer`
   - **Skills:** `clean-code`, `refactoring`
   - **Input:** Staged tasks
   - **Output:** Refactored subsystems
   - **Evidence Required:** `test`
   - **Dependencies:** `plan-staged`
5. **Verify backwards compatibility** (`test`)
   - **Role:** `tester`
   - **Skills:** `testing-quality`
   - **Input:** Compatibility test suite
   - **Output:** Test evidence
   - **Evidence Required:** `test`
   - **Dependencies:** `implement`
   - **Gates:** `tests`
6. **Cross-provider architecture review** (`review`)
   - **Role:** `reviewer`
   - **Skills:** `architecture-quality`, `code-review`
   - **Input:** Diff and evidence
   - **Output:** Review sign-off
   - **Evidence Required:** `review`
   - **Dependencies:** `test`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `adr-approval`, `tests`, `review`
- **Artifacts:** `Approved ADR`, `Staged migration DAG`, `Verified implementation`

## Stop Conditions
- ADR approved and staged tasks completed
