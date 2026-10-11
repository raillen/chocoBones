# ChocoBones Source Architecture

Este diretório contém o código-fonte principal do estúdio de animação e rigging esquelético ChocoBones em Odin.

| Módulo | Responsabilidade |
|---|---|
| `main.odin` | Ponto de entrada, loop principal SDL2/OpenGL, orquestração e gerenciamento de estado (`AppState`) |
| `editor_shell.odin` | Shell do editor ImGui: topbar, toolrail, contextbar, statusbar, docking e alternância de espaços |
| `editor_new_project.odin` | Assistente modal de criação de novos projetos e personagens (modo imagem única, modular com várias imagens, vitrines prontas e vazio) |
| `editor_showcase.odin` | Modelos de vitrine prontos (Sobrevivente da Fronteira com 18 camadas e Lobo Quadrúpede) |
| `editor_layout.odin` | Persistência e gerenciamento de layouts de docking por espaço de trabalho |
| `editor_properties.odin` | Painel de propriedades e inspetor de nós |
| `animation/` | Estrutura de clipes, canais de animação, amostragem e interpolação Bezier |
| `core/` | Estruturas fundamentais de matemática, transformações afins e arenas de memória |
| `export/` | Exportação de pose atual em PNG e renderização de spritesheets de animação |
| `history/` | Pilha de histórico de ações com suporte a desfazer e refazer (Undo/Redo) |
| `mesh/` | Geração de malhas 2D, deformação MLS (Moving Least Squares) e pinos de deformação |
| `mesh3d/` | Carregamento de modelos 3D (.obj, .gltf, .glb) e primitivas geométricas |
| `project/` | Serialização e desserialização de arquivos de projeto (`.puppet.json`) |
| `render/` | Pipeline de renderização 2D em lote (batching), texturas, shaders e máscaras de emenda |
| `rig/` | Estrutura esquelética, cinemática direta (FK), inversa (IK), predefinições e rigging dinâmico |
| `ui/` | Componentes de interface com ImGui, paletas de cores, diálogo de arquivos nativo e toasts |
