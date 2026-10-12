# Current Project State (chocoBones-ts)

- Project: **chocoBones-ts** (Worktree `feat/typescript`)
- Prumo: **0.6.0**
- Stack: **TypeScript (Strict) + Bun + Slint + WebGPU (WGSL)**
- Context methodology: **Lean Progressive Context (LPC)**
- Last updated: `2026-10-11T22:30:00Z`

## Estado da Implementação e Pareamento com Odin

Todas as funcionalidades centrais da versão Odin foram pareadas para TypeScript em arquitetura limpa:

1. **Core Math 2D/3D**: Álgebra afim 2x3, transformações 4x4, projeção perspectiva, `OrbitCamera` e solucionador de curvas cúbicas de Bézier via bisseção binária.
2. **Rigging & Cinemática**: Árvore esquelética de 14 juntas, cinemática direta hierárquica (**FK**), solver analítico 2-Bone **IK** com controle de dobra (*bend*), detecção e prevenção de ciclos (`jointHasCycle`) e heurística de mapeamento anatômico (`autoGuessJointForLayer`).
3. **Deformação de Malhas 2D**: Triangulação de quads em grade e algoritmo **Moving Least Squares (MLS)** rígido minimizando distorções de cisalhamento.
4. **Malhas 3D e Loaders**: Primitivas paramétricas (Cubo e Plano), recálculo de normais acumuladas e parsers para **Wavefront OBJ** e **glTF 2.0 / GLB**.
5. **Animação & Linha do Tempo**: Amostragem contínua de clipes em tempo real com atenuações (*easing*) Smooth/Hermite, Linear e Bézier, com presets *Idle* e *Walk Cycle*.
6. **Histórico (Undo/Redo)**: Pilha delimitada com snapshots semânticos de juntas, camadas e poses.
7. **Serialização Segura com Zod**: Validação em runtime de arquivos `.puppet.json` atendendo a regra estrita do skill `lang-typescript`.
8. **Renderização & UI**: Shaders **WGSL**, buffer contínuo RGBA para a viewport e interface declarativa em **Slint** com 4 espaços (*Montagem*, *Rig*, *Animação* e *Foco*).

## Evidência de Verificação

- **Testes Automatizados**: 29 testes passando em 7 suítes com 0 falhas (`bun test`).
- **Verificação de Tipos**: `tsc --noEmit` executado com 0 erros sob modo estrito (`strict`, `noImplicitAny`, `noUncheckedIndexedAccess`, `noUnusedLocals`).
- **Prumo Governance**: `prumo validate` e `prumo doctor` passaram sem avisos.
- **Execução End-to-End**: Interface Slint e ciclo de amostragem validados em ambiente headless Xvfb.
