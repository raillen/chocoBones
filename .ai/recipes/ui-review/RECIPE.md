# UI/UX Review

## Purpose
Review user interface ergonomics, visual fidelity, and accessibility standards.

## Required Inputs
- Rendered UI views
- Design tokens

## Step DAG & Dependencies
1. **Capture visual snapshots** (`capture`)
   - **Role:** `ux-architect`
   - **Skills:** `visual-regression`
   - **Input:** UI views
   - **Output:** Visual snapshots
   - **Evidence Required:** `screenshot`
   - **Dependencies:** None (entry step)
2. **Review interaction heuristics** (`heuristic-review`)
   - **Role:** `ux-architect`
   - **Skills:** `visual-qa`
   - **Input:** Snapshots & interaction flows
   - **Output:** Ergonomics findings
   - **Evidence Required:** `review`
   - **Dependencies:** `capture`
3. **Evaluate WCAG 2.2 AA compliance** (`accessibility`)
   - **Role:** `accessibility-reviewer`
   - **Skills:** `accessibility`, `keyboard-accessibility`
   - **Input:** UI components
   - **Output:** a11y compliance report
   - **Evidence Required:** `test`
   - **Dependencies:** `heuristic-review`
   - **Gates:** `accessibility`
4. **Emit prioritized findings** (`report`)
   - **Role:** `reviewer`
   - **Skills:** `code-review`
   - **Input:** All audit reports
   - **Output:** Prioritized UI review scorecard
   - **Evidence Required:** `review`
   - **Dependencies:** `accessibility`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `accessibility`, `review`
- **Artifacts:** `UI review findings`, `WCAG audit report`

## Stop Conditions
- UI review completed with prioritized findings
