# UI Feature Engineering

## Purpose
End-to-end design, tokenization, implementation, and accessibility audit of UI features.

## Preconditions
- Product requirement or design spec available
- Design system tokens accessible

## Required Inputs
- Product requirement
- Design references

## Step DAG & Dependencies
1. **Design and interaction research** (`research`)
   - **Role:** `design-researcher`
   - **Skills:** `design-research`, `website-forensics`
   - **Input:** Product requirement
   - **Output:** Design research report
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **User flow and information architecture** (`ux`)
   - **Role:** `ux-architect`
   - **Skills:** `user-flows`, `information-architecture`
   - **Input:** Research findings
   - **Output:** User flow & layout hierarchy
   - **Evidence Required:** `review`
   - **Dependencies:** `research`
3. **Structured wireframing** (`wireframe`)
   - **Role:** `ux-architect`
   - **Skills:** `wireframing`, `interaction-design`
   - **Input:** User flow
   - **Output:** Structured wireframe spec
   - **Evidence Required:** `review`
   - **Dependencies:** `ux`
4. **Design tokens & component spec** (`design-tokens`)
   - **Role:** `design-system-engineer`
   - **Skills:** `design-system`, `design-tokens`, `component-specification`
   - **Input:** Wireframe spec
   - **Output:** Design tokens JSON & component spec
   - **Evidence Required:** `test`
   - **Dependencies:** `wireframe`
5. **Implement UI components** (`implement`)
   - **Role:** `frontend-engineer`
   - **Skills:** `ui-implementation`, `frontend-web`
   - **Input:** Tokens and wireframe spec
   - **Output:** UI components and component tests
   - **Evidence Required:** `test`
   - **Dependencies:** `design-tokens`
6. **Audit keyboard, focus, and screen readers** (`accessibility-audit`)
   - **Role:** `accessibility-reviewer`
   - **Skills:** `accessibility`, `keyboard-accessibility`, `contrast`
   - **Input:** Rendered UI views
   - **Output:** WCAG 2.2 AA audit scorecard
   - **Evidence Required:** `test`
   - **Dependencies:** `implement`
   - **Gates:** `accessibility`
7. **Visual regression and QA review** (`visual-qa`)
   - **Role:** `ux-architect`
   - **Skills:** `visual-regression`, `visual-qa`
   - **Input:** UI components & snapshots
   - **Output:** Visual QA sign-off
   - **Evidence Required:** `screenshot`, `test`
   - **Dependencies:** `accessibility-audit`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `accessibility`, `tests`, `review`
- **Artifacts:** `Research report`, `Wireframe spec`, `Design tokens`, `Tested UI components`, `a11y scorecard`

## Stop Conditions
- UI feature implemented, visually tested, and WCAG AA compliant
