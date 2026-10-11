# Security Review Workflow

## Purpose
Threat-model, audit, and remediate security-sensitive features.

## Preconditions
- Target feature design or implementation available

## Required Inputs
- Feature design / diff
- Security policy

## Step DAG & Dependencies
1. **Enumerate trust boundaries and threats** (`threat-model`)
   - **Role:** `security-architect`
   - **Skills:** `threat-modeling`
   - **Input:** Feature architecture
   - **Output:** Threat model specification
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Audit source for abuse paths** (`audit`)
   - **Role:** `security-reviewer`
   - **Skills:** `security-review`, `secure-coding`
   - **Input:** Source diff and threat model
   - **Output:** Security findings report
   - **Evidence Required:** `security-scan`
   - **Dependencies:** `threat-model`
   - **Gates:** `security-scan`
3. **Remediate findings at boundary** (`remediate`)
   - **Role:** `implementer`
   - **Skills:** `secure-coding`, `clean-code`
   - **Input:** Security findings
   - **Output:** Remediation patch
   - **Evidence Required:** `test`
   - **Dependencies:** `audit`
4. **Re-verify security gates** (`re-verify`)
   - **Role:** `security-reviewer`
   - **Skills:** `security-review`
   - **Input:** Remediated code
   - **Output:** Security audit sign-off
   - **Evidence Required:** `security-scan`, `test`
   - **Dependencies:** `remediate`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `security-scan`, `tests`, `review`
- **Artifacts:** `Threat model`, `Security audit report`, `Remediation verification`

## Stop Conditions
- Zero unresolved high/critical security findings
