# Documentation Refactor

## Purpose
Reorganize canonical docs, docs/PRUMO.md navigation, and audience split without document proliferation.

## Required Inputs
- Current documentation set
- Audience definitions

## Step DAG & Dependencies
1. **Inventory current canonical documents** (`inventory`)
   - **Role:** `explorer`
   - **Skills:** `prumo-navigation`
   - **Input:** docs/ directory
   - **Output:** Documentation inventory
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Map audience needs (user, dev, ops, agent)** (`structure`)
   - **Role:** `documentation-maintainer`
   - **Skills:** `documentation`
   - **Input:** Documentation inventory
   - **Output:** Audience structure plan
   - **Evidence Required:** `review`
   - **Dependencies:** `inventory`
3. **Patch canonical Markdown files** (`patch`)
   - **Role:** `documentation-maintainer`
   - **Skills:** `documentation`, `documentation-for-llms`
   - **Input:** Structure plan
   - **Output:** Refactored documentation files
   - **Evidence Required:** `review`
   - **Dependencies:** `structure`
4. **Validate links and PRUMO routing** (`verify-links`)
   - **Role:** `reviewer`
   - **Skills:** `documentation`
   - **Input:** Refactored docs
   - **Output:** Link validation report
   - **Evidence Required:** `review`
   - **Dependencies:** `patch`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `review`
- **Artifacts:** `Synchronized canonical Markdown`, `Updated docs/PRUMO.md`

## Stop Conditions
- All documentation links valid and zero redundant files
