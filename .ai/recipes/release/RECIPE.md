# Release Verification

## Purpose
Produce, verify, and audit release artifacts across target matrices.

## Preconditions
- Release Goal locked
- Working tree clean

## Required Inputs
- Release candidate commit
- Changelog delta

## Step DAG & Dependencies
1. **Lock release Goal and scope** (`freeze`)
   - **Role:** `architect`
   - **Skills:** `goal-management`
   - **Input:** Release scope
   - **Output:** LOCKED Goal record
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Clean build across target matrix** (`build-matrix`)
   - **Role:** `release-verifier`
   - **Skills:** `release-engineering`
   - **Input:** Release commit
   - **Output:** Release binaries / packages
   - **Evidence Required:** `build`
   - **Dependencies:** `freeze`
   - **Gates:** `build`
3. **Execute full test matrix** (`test-matrix`)
   - **Role:** `tester`
   - **Skills:** `testing-quality`
   - **Input:** Built artifacts
   - **Output:** Matrix test report
   - **Evidence Required:** `test`
   - **Dependencies:** `build-matrix`
   - **Gates:** `tests`
4. **Audit release dependencies & CVEs** (`security-audit`)
   - **Role:** `security-reviewer`
   - **Skills:** `security-review`, `supply-chain-security`
   - **Input:** Lockfile & packages
   - **Output:** Security scan report
   - **Evidence Required:** `security-scan`
   - **Dependencies:** `test-matrix`
   - **Gates:** `security-scan`
5. **Verify checksums and rollback plan** (`verify-release`)
   - **Role:** `release-verifier`
   - **Skills:** `release-engineering`
   - **Input:** All gate evidence
   - **Output:** Signed release verification scorecard
   - **Evidence Required:** `review`
   - **Dependencies:** `security-audit`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `build`, `tests`, `security-scan`
- **Artifacts:** `Release verification scorecard`, `Checksums`, `Rollback plan`

## Stop Conditions
- All release gates pass cleanly
