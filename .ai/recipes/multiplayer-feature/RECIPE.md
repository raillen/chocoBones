# Multiplayer Feature Development

## Purpose
Implement authoritative replication and network protocols with packet loss simulation.

## Required Inputs
- Network protocol spec
- Authority architecture

## Step DAG & Dependencies
1. **Define state authority and replication contracts** (`authority-contract`)
   - **Role:** `networking-engineer`
   - **Skills:** `multiplayer-networking`
   - **Input:** Protocol requirement
   - **Output:** Replication authority contract
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Implement protocol packets and serialization** (`implement`)
   - **Role:** `networking-engineer`
   - **Skills:** `multiplayer-networking`, `clean-code`
   - **Input:** Authority contract
   - **Output:** Networking implementation
   - **Evidence Required:** `test`
   - **Dependencies:** `authority-contract`
3. **Simulate packet loss, jitter, and disconnects** (`network-test`)
   - **Role:** `tester`
   - **Skills:** `network-testing`
   - **Input:** Network implementation
   - **Output:** Resilience test logs
   - **Evidence Required:** `test`
   - **Dependencies:** `implement`
   - **Gates:** `tests`
4. **Audit against packet tampering and DoS** (`security-review`)
   - **Role:** `security-reviewer`
   - **Skills:** `network-security`
   - **Input:** Packet parser diff
   - **Output:** Security audit sign-off
   - **Evidence Required:** `security-scan`
   - **Dependencies:** `network-test`
   - **Gates:** `security-scan`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `tests`, `security-scan`
- **Artifacts:** `Replication protocol`, `Network resilience test logs`, `Security sign-off`

## Stop Conditions
- Replication verified under simulated packet loss and jitter
