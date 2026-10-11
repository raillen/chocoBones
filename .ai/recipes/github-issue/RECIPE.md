# GitHub Issue Workflow

## Purpose
Standardized issue authoring, refinement, and triaging with Goal linkage.

## Preconditions
- Repository context and active Goals accessible
- Issue tracker permissions available

## Required Inputs
- User request / bug report
- Repository context

## Step DAG & Dependencies
1. **Resolve repository and active Goal context** (`context`)
   - **Role:** `explorer`
   - **Skills:** `prumo-navigation`
   - **Input:** User request
   - **Output:** Context summary
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Search for duplicate issues** (`duplicates`)
   - **Role:** `issue-triager`
   - **Skills:** `github-issue-triage`
   - **Input:** Issue repository
   - **Output:** Duplicate analysis
   - **Evidence Required:** `review`
   - **Dependencies:** `context`
3. **Classify issue type, severity, and milestone** (`classify`)
   - **Role:** `issue-triager`
   - **Skills:** `github-issue-triage`
   - **Input:** Request analysis
   - **Output:** Classification metadata
   - **Evidence Required:** `review`
   - **Dependencies:** `duplicates`
4. **Draft issue with objective acceptance criteria** (`draft`)
   - **Role:** `issue-author`
   - **Skills:** `github-issue-create`, `github-issue-refine`
   - **Input:** Classification & scope
   - **Output:** Draft issue markdown
   - **Evidence Required:** `review`
   - **Dependencies:** `classify`
5. **Publish canonical issue record** (`publish`)
   - **Role:** `issue-author`
   - **Skills:** `github-issue-create`
   - **Input:** Draft issue
   - **Output:** Canonical issue record
   - **Evidence Required:** `review`
   - **Dependencies:** `draft`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `review`
- **Artifacts:** `Canonical GitHub issue record`

## Stop Conditions
- Issue authored with objective acceptance criteria
