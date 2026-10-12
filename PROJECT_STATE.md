# Current Project State (chocoBones-ts)

- Project: **chocoBones-ts** (Worktree `feat/typescript`)
- Prumo: **0.6.0**
- Stack: **TypeScript (Strict) + Node.js + pnpm + Slint + WebGPU (WGSL)**
- Context methodology: **Lean Progressive Context (LPC)**
- Last updated: `2026-10-13T00:15:00Z`

## Estado da Implementação

Núcleo de domínio pareado do Odin + itens 1–14 implementados nesta iteração:

1. **Core Math 2D/3D**: Afim 2x3, 4x4, perspectiva, `OrbitCamera`, Bézier por bisseção. `gl-matrix` declarada mas não usada — remover ou adotar.
2. **Rigging & Cinemática**: FK hierárquica com guarda anti-ciclo, **IK genérica** 2-bone sem dependência de IDs + `bend`/`limits`/`pole-vector`, presets Humanoid/Biped/Quadruped/Prop, `autoGuessJointForLayer`.
3. **Deformação 2D**: Grade + **alpha-hull por alfa** (`buildHullMeshFromRgba`), UVs, **auto-skin por distância a segmentos**, pincel `add/smooth/set` + heatmap, MLS rígido.
4. **Malhas 3D e Loaders**: Cubo/Plano, normais, AABB; OBJ com `usemtl` + índices negativos; glTF com `JOINTS_0/WEIGHTS_0`, `byteStride`, materiais e `parseGlb`.
5. **Animação**: `sampleClip` com limpeza de pose, **pins interpolados**, **channels**, sort sob demanda; `evaluateClip(t)` único p/ preview/export; `advanceTime` com `delta_time` + `FixedStepAccumulator`; IDs determinísticos (`nextKeyframeId`).
6. **Histórico**: Pilha 50, undo/redo de juntas+camadas+pose.
7. **Projeto v2 (Zod)**: `meshes/pins/clips/constraints` opcionais, `migrateV1ToV2`, `isProjectV2`, rejeição de ciclos e limite 20 MB.
8. **Render**: WGSL sprite + MLS compute real + `WebGpuRenderer` com fallback CPU; `ViewportBuffer` CPU; PNG sync + **async** com CRC pré-computado; loop com `delta_time`.
9. **UI/Editor**: Slint + `store/actions/viewport/loop` (bridge fina); modos **Setup/Animate** + `Alt+R`; multisseleção Shift, delete, reorder ▲▼, teclado `Space/C/F/Home`, `editor_mode` no Slint.
10. **IDs**: `generateId` estável (sem `Date.now` puro), validação de ciclo no load.
11. **Estúdio Criativo Multi-Tema & Slint UI**: Sistema adaptativo com 3 temas (Dark `#121214`, Dim `#242428`, Light `#f4f4f6`), 6 acentos WCAG AA, dual-bar header, rail de ferramentas 46px com as 12 ferramentas do Odin, inspetor multi-card e rasterizador reativo com sincronização de cores de fundo/grade/3D.
12. **P2 Perf/Export/Skinning**: `rig/compiled.ts` (topo + O(n) iterativo), `mesh/cache.ts` (adjacência/bind + `GpuBufferManager` dirty-only + `VertexPool`), `export/runtime.ts` (contratos runtime v2/export v1, sequência determinística, spritesheet), `deform/lbs.ts` (LBS + DQ planar, ordem `bones-then-mls` v1).
13. **Fase 1**: `geometry/contour.ts` (mask, bbox, Moore, Douglas-Peucker, área, point-in-poly, triangulação intra-contorno, validação) + `mesh_edit.ts` (add/move/delete + `topologyClean`).
14. **Fase 2**: `rig/retarget.ts` (parent/aim/limit, SmartBones por janela, papéis anatômicos, `retargetByRole`) + `rig/constraints.ts` (IK metadata, FABRIK, sockets).
15. **Fase 3**: `procedural/operators.ts` (breath/gait/look/squash + mix/peso/máscara + `bakeOperators` fps-independente) sobre base `physics2d/spring` fixed-step.
16. **Fase 4**: `deform/advanced.ts` (ARAP c/ handles, BBW aprox. documentada, cage IDW) + `player/runtime.ts` (`PuppetPlayer` clip+ops, track 3D separada).

## Paridade honesta com Odin

Núcleo matemático/rig/animação e interface de estúdio criativo pareados com o padrão visual do Odin e o mockup de referência (Affinity/Canva). Visual adaptativo validado com exportações reais 2D e 3D em Dark, Dim e Light.

## Evidência de Verificação

- **Testes**: 115 passando em 14 suítes, 0 falhas (`pnpm test` / Vitest).
- **Tipos**: `tsc --noEmit` 0 erros (strict + `noUncheckedIndexedAccess` + `noUnusedLocals`).
- **Verificação Visual Xvfb**: Script `scripts/test_themes_and_accents.ts` executado com sucesso em display virtual Xvfb `:99` com exportação e validação de pixels de fundo e wireframe 3D nos 3 temas.
- **Prumo**: `prumo.json` alinhado para Node/pnpm.
