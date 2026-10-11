# Evidence-Driven Bug Fix

## Purpose
Reproduce, isolate, and repair defects without masking regressions.

## Preconditions
- Defect report or reproduction scenario available

## Required Inputs
- Defect report
- Reproduction steps
- Target codebase

## Step DAG & Dependencies
1. **Author failing regression test** (`reproduce`)
   - **Role:** `debugger`
   - **Skills:** `testing-quality`
   - **Input:** Reproduction steps
   - **Output:** Automated regression test demonstrating bug
   - **Evidence Required:** `test`
   - **Dependencies:** None (entry step)
2. **Isolate causal boundary and repair** (`isolate-and-fix`)
   - **Role:** `debugger`
   - **Skills:** `clean-code`, `refactoring`, `error-handling`
   - **Input:** Regression test and source
   - **Output:** Minimal repair patch
   - **Evidence Required:** `test`
   - **Dependencies:** `reproduce`
3. **Verify full suite without regression** (`verify`)
   - **Role:** `tester`
   - **Skills:** `testing-quality`
   - **Input:** Full test suite
   - **Output:** Clean test suite pass record
   - **Evidence Required:** `test`
   - **Dependencies:** `isolate-and-fix`
   - **Gates:** `tests`
4. **Independent review of fix** (`review`)
   - **Role:** `reviewer`
   - **Skills:** `code-review`
   - **Input:** Fix diff and regression evidence
   - **Output:** Review approval
   - **Evidence Required:** `review`
   - **Dependencies:** `verify`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `tests`, `review`
- **Artifacts:** `Regression test`, `Root-cause repair patch`, `Review sign-off`

## Stop Conditions
- Failing regression test passes after fix and full suite is green
