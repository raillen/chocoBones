# Web Feature Development

## Purpose
Implement fullstack web features across frontend components and backend API endpoints.

## Required Inputs
- Feature requirements
- API contract

## Step DAG & Dependencies
1. **Define API contracts and database schema** (`api-spec`)
   - **Role:** `backend-engineer`
   - **Skills:** `backend-api`, `database-review`
   - **Input:** Feature requirement
   - **Output:** API contract & schema migration
   - **Evidence Required:** `test`
   - **Dependencies:** None (entry step)
2. **Implement backend endpoints** (`backend`)
   - **Role:** `backend-engineer`
   - **Skills:** `backend-api`, `clean-code`
   - **Input:** API contract
   - **Output:** Backend service implementation
   - **Evidence Required:** `test`
   - **Dependencies:** `api-spec`
3. **Implement frontend components and state** (`frontend`)
   - **Role:** `frontend-engineer`
   - **Skills:** `frontend-web`, `ui-implementation`
   - **Input:** API endpoints and UI design
   - **Output:** Frontend components
   - **Evidence Required:** `test`
   - **Dependencies:** `backend`
4. **Run unit, API contract, and UI tests** (`test`)
   - **Role:** `tester`
   - **Skills:** `api-contract-testing`, `testing-quality`
   - **Input:** Fullstack changeset
   - **Output:** Test execution report
   - **Evidence Required:** `test`
   - **Dependencies:** `frontend`
   - **Gates:** `tests`
5. **Independent security and code review** (`review`)
   - **Role:** `reviewer`
   - **Skills:** `code-review`, `web-security`
   - **Input:** Diff and test evidence
   - **Output:** Review approval
   - **Evidence Required:** `review`
   - **Dependencies:** `test`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `tests`, `review`
- **Artifacts:** `API endpoints`, `UI components`, `Integration tests`

## Stop Conditions
- Fullstack feature verified with integration tests
