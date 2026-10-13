# Current Project State (chocoBones-ts)

- Project: **chocoBones-ts** (Branch `codex/puppet-warp-workflow`)
- Prumo: **0.6.0**
- Stack: **TypeScript (Strict) + Electrobun 2.0.2/Bun + SolidJS 1.9.17 + Vite 8.3.4 + pnpm 12.9.1; Slint legado**
- Context methodology: **Lean Progressive Context (LPC)**
- Last updated: `2026-10-12`

## Estado da Implementação

Núcleo de domínio pareado do Odin e incrementos integrados ao editor:

1. **Core Math 2D/3D**: Afim 2x3, 4x4, perspectiva, `OrbitCamera`, Bézier por bisseção. `gl-matrix` declarada mas não usada — remover ou adotar.
2. **Rigging & Cinemática**: FK hierárquica com guarda anti-ciclo, **IK genérica** 2-bone sem dependência de IDs + `bend`/`limits`/`pole-vector`, presets Humanoid/Biped/Quadruped/Prop, `autoGuessJointForLayer`.
3. **Deformação 2D**: Grade + **alpha-hull por alfa** (`buildHullMeshFromRgba`), UVs, **auto-skin por distância a segmentos**, pincel `add/smooth/set` + heatmap, MLS rígido.
4. **Malhas 3D e Loaders**: Cubo/Plano, normais, AABB; OBJ com `usemtl` + índices negativos; glTF com `JOINTS_0/WEIGHTS_0`, `byteStride`, materiais e `parseGlb`.
5. **Animação**: `sampleClip` com limpeza de pose, **pins interpolados**, **channels**, sort sob demanda; `evaluateClip(t)` único p/ preview/export; `advanceTime` com `delta_time` + `FixedStepAccumulator`; IDs determinísticos (`nextKeyframeId`).
6. **Histórico**: Pilha 50, undo/redo de juntas+camadas+pose.
7. **Projeto v2 (Zod)**: `meshes/pins/clips/constraints` opcionais, `migrateV1ToV2`, `isProjectV2`, rejeição de ciclos e limite 20 MB.
8. **Render**: WGSL sprite + MLS compute real + `WebGpuRenderer` com fallback CPU; `ViewportBuffer` CPU; PNG sync + **async** com CRC pré-computado; loop com `delta_time`.
9. **UI/Editor legado**: Slint + `store/actions/viewport/loop` (bridge fina); modos **Setup/Animate** + `Alt+R`; multisseleção Shift, delete, reorder ▲▼, teclado `Space/C/F/Home`, `editor_mode` no Slint.
10. **IDs**: `generateId` estável (sem `Date.now` puro), validação de ciclo no load.
11. **Interface Slint adaptativa (histórica)**: chrome contínuo e neutro, três temas, seis acentos, fontes Inter e ícones Phosphor sem emojis; painéis contextuais com abas abaixo de 1100 px, Foco ampliado, timeline com teclado. Entrega RGBA ao Slint e transformação do mouse corrigidas. Análise da referência em `docs/development/editor-ui.md`.
12. **P2 Perf/Export/Skinning**: `rig/compiled.ts` (topo + O(n) iterativo), `mesh/cache.ts` (adjacência/bind + `GpuBufferManager` dirty-only + `VertexPool`), `export/runtime.ts` (contratos runtime v2/export v1, sequência determinística, spritesheet), `deform/lbs.ts` (LBS + DQ planar, ordem `bones-then-mls` v1).
13. **Fase 1**: `geometry/contour.ts` (mask, bbox, Moore, Douglas-Peucker, área, point-in-poly, triangulação intra-contorno, validação) + `mesh_edit.ts` (add/move/delete + `topologyClean`).
14. **Fase 2**: `rig/retarget.ts` (parent/aim/limit, SmartBones por janela, papéis anatômicos, `retargetByRole`) + `rig/constraints.ts` (IK metadata, FABRIK, sockets).
15. **Fase 3**: `procedural/operators.ts` (breath/gait/look/squash + mix/peso/máscara + `bakeOperators` fps-independente) sobre base `physics2d/spring` fixed-step.
16. **Fase 4**: `deform/advanced.ts` (relaxamento Laplaciano legado com handles, BBW aprox. documentada, cage IDW) + `player/runtime.ts` (`PuppetPlayer` clip+ops, track 3D separada).
17. **Puppet por imagem integrado**: PNG 8-bit real, textura RGBA por CPU, malha de ocupação alfa com UVs, pinos locais/locks/snap, presets por geometria e gravação de gesto em keyframes; export transparente e spritesheet de 8 quadros; PNG/canvas/UVs/vínculos persistidos com undo/redo completo.
18. **Refinamento e ARAP integrados**: `mesh/adaptive_sprite_mesh.ts` refina células mistas da borda com topologia conforme e UVs da imagem original. `deform/arap_solver.ts` implementa rotações locais + solução global esparsa por gradientes conjugados precondicionados, com handles exatos. O painel Puppet escolhe MLS/ARAP e configura borda de 2–32 px; método e parâmetros participam de projeto e histórico. Textura, wireframe, onion skin e export compartilham o pacote de geometria deformada. Comparação, contratos e limites em `docs/development/puppet-tools-comparison.md`.

19. **GUI Electrobun/Solid principal**: `src/editor/` fornece documento/comandos/view model portáveis; `src/desktop/` separa host Bun, RPC validado por Zod e view Solid. Assets binários passam por loopback com token, sem framebuffer em JSON. Palco WebGL2 com recursos residentes e overlay Canvas; MLS/ARAP em worker com uma tarefa em execução e uma pose pendente substituível. Fluxo Preparar/Rig/Animar, árvore de assets/rig, propriedades contextuais, painéis redimensionáveis, temas persistidos e Phosphor, timeline por trilhas com edição de keyframes/easing. Salvar como/exportar combina modal de nome e seletor nativo de pasta; alterações pendentes oferecem Salvar/Descartar/Cancelar antes de novo/abrir/fechar. A fronteira entre documentos limpa undo/redo; opacidade/visibilidade em Animar editam a pose e preservam o repouso. `pnpm start/dev` usa o novo desktop; `legacy:start` preserva Slint. [Arquitetura e limites](docs/development/desktop-migration.md).

## Paridade honesta com Odin

Núcleo matemático/rig/animação conserva o trabalho anterior. A GUI principal agora usa Electrobun/Solid com etapas Preparar/Rig/Animar e propriedades contextuais; o adaptador Slint permanece legado. Painéis redimensionáveis não equivalem a docking livre. A visualização 3D existente foi preservada; editor gráfico de curvas, mistura de clipes, pintura de pesos, caminhos e integração completa de 3D/BBW/cage continuam pendentes; não se afirma paridade completa com Odin ou Cartoon Animator.

## Evidência de Verificação

A validação da migração é registrada separadamente da entrega Slint. Testes da view no browser não comprovam RPC ou diálogos nativos; configurar CEF em Linux/macOS/Windows não comprova execução nas três plataformas.

### GUI Electrobun/Solid

- **Testes atuais**: 303 passando em 30 suítes, sem falhas; incluem comandos/histórico, contratos do host e fila do worker, além do núcleo anterior.
- **Tipos e view**: checagens estritas do núcleo, view e host passaram; TypeScript/Vite geraram a view de produção.
- **Browser**: 19 verificações e 7 capturas, Chromium/WebGL2 com SwiftShader, DPR 2, incluindo layout compacto 960×720; importação/abertura por arquivos e export/download reais.
- **Host nativo em desenvolvimento**: 20 verificações, 7 capturas de fluxo e uma da janela X11 completa; Electrobun 2.0.2/Bun 1.4.0/CEF Linux com view servida pelo Vite. RPC, transporte binário e IO/export reais passaram; o seletor de arquivos do sistema operacional não foi automatizado.
- **Evidências**: [capturas e relatórios Solid](docs/development/screenshots/solid-editor/README.md). Browser exercitou WebGL2; CEF cloud usou Canvas2D por bloqueio da GPU software.

### Baseline anterior: Slint e ferramentas

- **Testes**: 267 passando em 26 suítes, 0 falhas (`pnpm test` / Vitest).
- **Tipos**: `tsc --noEmit` 0 erros (strict + `noUncheckedIndexedAccess` + `noUnusedLocals`).
- **Verificação Visual Xvfb**: `scripts/qa_studio.ts` passou 28 verificações com 15 capturas nativas: três temas, três tamanhos, mínimo 760×560, quatro espaços e aparência. Cliques, teclado, entrega RGBA, playback, undo e exportação passaram. Capturas e relatório versionados em `docs/development/screenshots/slint-studio/`. O roteiro também passou checagem TypeScript estrita separada.
- **Puppet por imagem**: 18 verificações nativas e 8 capturas passaram; exports com transparência, gesture replay, pinos bloqueados e roundtrip portátil verificados. Evidências em `docs/development/screenshots/puppet-tools/`.
- **Deformação/refinamento**: 15 verificações nativas e 7 capturas passaram, com 3 exports transparentes. Refinamento do PNG próprio gerou 1303 vértices/2152 triângulos; handles ARAP e roundtrip foram verificados. Evidências em `docs/development/screenshots/deformation-tools/`.
- **Prumo**: `prumo.json` atualizado para TypeScript/Electrobun/Bun/Solid/Vite/pnpm, preservando o envelope de inteligência sem inventar métricas de consumo.

## Limites do incremento de deformação

ARAP usa pesos uniformes positivos por aresta, sem cotangentes ou garantia contra colisões/auto-interseção. Raio e Peso são exclusivos do MLS; ARAP impõe a posição do pino em um vértice exato inserido na malha. Âncoras mantêm repouso local e têm prioridade se controles coincidem; controles fora dos triângulos não deformam a imagem. A força da malha escala o delta dos handles. Refinamento preserva alfa visual, mas não promete recorte geométrico exato de furos ou separação de ilhas menores que a célula. O editor reserva 128 vértices para pinos ao limitar a malha refinada a 3968; o pacote ARAP aceita no máximo 4096. CPU com malha densa não implica 60 FPS. O benchmark local mediu medianas de aproximadamente 3 ms/106 vértices e 112 ms/1304 vértices apenas para `solve()` (7 amostras, após aquecimento), sem UI/rasterização/export; dados em `docs/development/screenshots/deformation-tools/solver-benchmark.json`.

## Limites da migração desktop

Worker conserva responsividade do chrome, sem reduzir por si só o custo ARAP. WebGL2 acelera rasterização; exportação usa CPU e pode diferir em filtragem/cobertura. Footprint CEF, memória, startup e aceitação em GPU física permanecem sem medição. Builds macOS/Windows não foram executados nesta entrega; a versão Slint e suas evidências continuam históricas. Detalhes em `docs/development/desktop-migration.md`.

### Validação do pacote Linux

O [pacote stable sem Vite](docs/development/screenshots/solid-editor/packaged/report.json) passou **25 verificações de interface** e **4 de fechamento nativo**, com fontes/ícones, worker, transporte binário, salvamento, reabertura, exportação e preferências. A aplicação foi extraída com tar do sistema. O autoextrator Linux do SDK falhou com `TarUnsupportedFileType`; o instalador de distribuição permanece pendente. Windows/macOS e GPU física não foram executados.
