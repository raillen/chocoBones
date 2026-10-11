# Compiler/Language Change

## Purpose
Safely modify parsing, IR, AST, or runtime behavior with conformance test validation.

## Preconditions
- Language RFC or specification change proposed
- Existing grammar and conformance test suite available

## Required Inputs
- Language specification / RFC
- Grammar

## Step DAG & Dependencies
1. **Specify syntax/semantic changes in RFC** (`spec`)
   - **Role:** `architect`
   - **Skills:** `architecture-quality`
   - **Input:** Proposed language feature
   - **Output:** Language RFC specification
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Write failing conformance tests** (`conformance-tests`)
   - **Role:** `compiler-engineer`
   - **Skills:** `compiler-development`
   - **Input:** RFC spec
   - **Output:** Failing test fixtures
   - **Evidence Required:** `test`
   - **Dependencies:** `spec`
3. **Implement AST / IR transformations** (`implement`)
   - **Role:** `compiler-engineer`
   - **Skills:** `compiler-development`, `clean-code`
   - **Input:** Conformance tests and grammar
   - **Output:** Compiler pass implementation
   - **Evidence Required:** `test`
   - **Dependencies:** `conformance-tests`
4. **Execute full conformance test suite** (`test`)
   - **Role:** `tester`
   - **Skills:** `testing-quality`
   - **Input:** Modified compiler
   - **Output:** Conformance test report
   - **Evidence Required:** `test`
   - **Dependencies:** `implement`
   - **Gates:** `tests`
5. **Independent review of ABI & backwards compatibility** (`review`)
   - **Role:** `reviewer`
   - **Skills:** `code-review`
   - **Input:** Compiler diff and test report
   - **Output:** Review sign-off
   - **Evidence Required:** `review`
   - **Dependencies:** `test`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `tests`, `review`
- **Artifacts:** `Language RFC`, `AST passes`, `Conformance test suite`

## Stop Conditions
- 100% language conformance test suite pass rate
