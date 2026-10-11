# ChocoBones — Reimplementação e Arquitetura

Este site é o caderno vivo e a documentação arquitetural da reimplementação nativa do **ChocoBones** (anteriormente *Puppet Studio / Custom Char Creator*) em **Odin**.

A meta não é reescrever por mero capricho estético. A meta é migrar o compositor 2D do Canvas em software para uma arquitetura nativa orientada a dados (DOD), eliminando o overhead de garbage collection e o gargalo de rasterização de triângulos em software, preservando 100% da fidelidade matemática do rig, compatibilidade com o formato `survivor-puppet` v1 e a ergonomia de docking profissional.

## Prioridades

[Acompanhar todos os processos da reimplementação](#/progress) · [Regras de governança e atualização](12-reimplementation/index.md).

- **Odin nativo first:** Uso extensivo dos pacotes da stdlib (`core:`) e bindings oficiais integrados (`vendor:glfw`, `vendor:OpenGL`, `vendor:stb/image`).
- **Data-Oriented Design (DOD):** Estruturas lineares em memória contígua (`[dynamic]Joint`, `[dynamic]Vec2`), sem grafos de nós alocados dinamicamente no heap.
- **Gerenciamento de memória por arenas:** Alocadores scratch por frame para deformação de malha e computação de poses; zero GC pauses.
- **Pipeline GPU direto:** Substituição do clipping afim 2D em CPU por VBO/IBO batched e shaders GLSL simples.
- **Compatibilidade total com o ecossistema:** Leitura e escrita determinística do schema `survivor-puppet` v1.
- **Dear ImGui (Docking):** Interface nativa rápida com abas, painéis flutuantes e dopesheet desacoplado.
- **Sem over-engineering:** Álgebra 2D, cinemática direta e inversa (IK de 2 ossos), MLS rígido e curvas Bézier implementados do zero sem frameworks pesados de álgebra linear.

## Ordem de Implementação

1. **Core & Matemática:** Vetores `Vec2`, matrizes `Mat2x3`, hierarquia plana de juntas e arenas.
2. **Cinemática:** Solvers FK topológico e IK analítico de 2 ossos (lei dos cossenos).
3. **Deformação de Malha:** Triangulação regular, corte de triângulos, MLS rígido por pinos e Linear Blend Skinning com Dual Quaternions 2D.
4. **Renderer GPU:** Contexto GLFW, OpenGL 3.3 Core Profile, shader 2D de malha texturizada e batched drawing.
5. **Máscaras de Emenda:** Renderização em FBO offscreen com recorte suave de junções articulares.
6. **Timeline & Animação:** Trilhas por canal, avaliação de curvas Bézier cúbicas e amostragem de poses.
7. **Documento & I/O:** Parser JSON compatível com `survivor-puppet` v1 e escrita atômica.
8. **UI & Workspaces:** Janelas ImGui com docking (*Assembly*, *Rig*, *Animate*, *Focus*), gizmos de viewport e inspetor.
9. **Exportadores:** Renderizador offscreen para PNG transparente, geração de spritesheets e arquivo ZIP para runtime de jogos.
10. **Qualidade & Conformance:** Testes matemáticos de invariância com os testes legados do Playwright como baseline.

## Decisões Consolidadas

### Contratos Transversais

- [Princípios em Odin](./00-philosophy/principles-odin.md): dados crus, loops simples, arenas e ausência de abstrações desnecessárias.
- [Álgebra Afim 2D e Arenas](./01-core/affine-algebra-memory.md): matrizes 2x3 compactas com inversão analítica e transformações puras.
- [Hierarquia e IK](./02-rig/joint-hierarchy-fk-ik.md): representação em array plano com IDs inteiros ou strings internadas.
- [Deformação MLS e Skinning](./03-mesh-deformation/mls-rigid-pins.md): deformação rígida via Procrustes 2D ponderado ($1/d^4$) e Dual Quaternions para preservação de volume.
- [Pipeline OpenGL](./06-renderer/opengl-gpu-pipeline.md): renderização indexada de triângulos com texturas empacotadas via `vendor:stb/image`.
- [Formato de Documento](./08-project/survivor-puppet-schema.md): paridade bidirecional com arquivos gerados pelo editor web.

## Diretivas para Code Agents

A seção [Code Agents & Prumo](./11-code-agents/index.md) orienta assistentes de código e revisores a operar sob o protocolo Prumo Workforce:

- [Leitura, autoridade e contexto progressivo](./11-code-agents/reading-navigation.md)
- [Protocolo de implementação e gap matrix](./11-code-agents/implementation-protocol.md)
- [Índice do Prumo Workforce](./11-code-agents/workforce-index.md): **39 agents, 189 skills e 20 recipes**, incluindo `lang-odin`, `game-engine-architecture` e `clean-code`.
