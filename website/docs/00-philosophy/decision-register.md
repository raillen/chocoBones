# Registro de Decisões Arquiteturais

Decisões tomadas para o motor e editor nativo do ChocoBones.

## ADR-001: Linguagem Nativa Central — Odin
* **Decisão:** Adotar Odin como linguagem única do motor gráfico e do editor.
* **Contexto:** O protótipo web sofria com o custo de garbage collection ao atualizar posições de malha e com o renderizador de triângulos afins em software do Canvas 2D.
* **Alternativas avaliadas:**
  * *Rust:* Alto atrito no borrow-checker para grafos de nós e timelines; tempo de compilação longo.
  * *Modern C++:* Fragilidade de build (CMake) e complexidade de dependências.
  * *Python/Qt:* Dificuldade de empacotamento em binário leve e lentidão na deformação de vértices.
* **Justificativa:** Odin entrega compilação em frações de segundo, tipos de matrizes embutidos, custom allocators na stdlib e bindings oficiais de GLFW, OpenGL e ImGui sem atrito.

## ADR-002: Framework de UI — Dear ImGui com Docking
* **Decisão:** Integrar Dear ImGui (branch docking) usando o pacote `odin-imgui`.
* **Justificativa:** Dockview no browser provou a necessidade de docking, abas móveis e divisores. No ecossistema nativo, Dear ImGui é o padrão consagrado em ferramentas de desenvolvimento de jogos.

## ADR-003: Renderização Gráfica — OpenGL 3.3 Core Profile
* **Decisão:** Utilizar OpenGL 3.3 moderno via shaders ao invés de APIs de software ou abstrações WebGPU pesadas.
* **Justificativa:** Ampla compatibilidade com GPUs integradas e antigas, baixa sobrecarga de driver e suporte nativo a VBOs e texturas 2D.

## ADR-004: Compatibilidade Estrita com Schema `survivor-puppet` v1
* **Decisão:** O binário em Odin deve ler e gravar arquivos `.puppet.json` sem corromper ou descartar campos legados.
* **Justificativa:** Preservação de assets já produzidos e viabilidade de transição gradual entre as ferramentas.
