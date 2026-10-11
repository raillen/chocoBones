# Engine Renderer Change

## Purpose
Safely modify GPU, 2D/3D pipelines, and shader systems with visual fixture verification.

## Required Inputs
- Render pipeline spec
- Visual baseline fixtures

## Step DAG & Dependencies
1. **Map GPU pipeline boundaries** (`explore`)
   - **Role:** `explorer`
   - **Skills:** `prumo-navigation`
   - **Input:** Render subsystem
   - **Output:** Pipeline boundary map
   - **Evidence Required:** `review`
   - **Dependencies:** None (entry step)
2. **Establish visual fixtures** (`visual-fixture`)
   - **Role:** `renderer-engineer`
   - **Skills:** `shaders`, `rendering-2d`
   - **Input:** Visual requirements
   - **Output:** Baseline visual fixtures
   - **Evidence Required:** `screenshot`
   - **Dependencies:** `explore`
3. **Implement renderer / shader modifications** (`implement`)
   - **Role:** `renderer-engineer`
   - **Skills:** `rendering-2d`, `shaders`
   - **Input:** Visual fixture & shader spec
   - **Output:** Shader / pipeline changeset
   - **Evidence Required:** `test`
   - **Dependencies:** `visual-fixture`
4. **Profile draw calls and GPU timings** (`benchmark`)
   - **Role:** `tester`
   - **Skills:** `benchmarking`, `performance-native`
   - **Input:** Modified renderer
   - **Output:** GPU frame time benchmark
   - **Evidence Required:** `benchmark`
   - **Dependencies:** `implement`
   - **Gates:** `benchmark`
5. **Independent review of rendering architecture** (`review`)
   - **Role:** `reviewer`
   - **Skills:** `architecture-quality`
   - **Input:** Diff, benchmark, and visual diffs
   - **Output:** Review sign-off
   - **Evidence Required:** `review`
   - **Dependencies:** `benchmark`
   - **Gates:** `review`

## Fallback Strategy
- On `step_failed`: **retry_with_alternate_model** (Max Retries: 2)
- On `gate_failed`: **escalate_to_human**

## Required Gates & Evidence
- **Gates:** `benchmark`, `tests`, `review`
- **Artifacts:** `Shader pipelines`, `Visual regression diffs`, `GPU frame time benchmarks`

## Stop Conditions
- Visual fixtures match and frame timing budget met
