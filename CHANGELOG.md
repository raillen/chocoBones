# Changelog

Todas as alterações notáveis deste projeto são documentadas neste arquivo.
O formato baseia-se no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- **Modos Setup e Animar com Proteção de Bind Pose**: separação estrita de modos de trabalho no topo da barra de contexto (`Modo: Setup` vs `Modo: Animar`), atalho global `Alt+R` e botão dedicado para restauração instantânea da pose de repouso canônica (Bind Pose).
- **Ferramenta Interativa de Criação de Ossos na Viewport (`CreateBone` / Atalho `C`)**: desenho interativo de cadeias de ossos diretamente sobre o personagem na viewport com linha guia em tempo real, medição de distância, snap a juntas existentes e encadeamento automático de hierarquia pai-filho.
- **Pintura de Pesos Multimodo com Mapa de Calor (Heatmap)**: pincel de influência com três modos operacionais (`+ Adicionar`, `~ Suavizar` via relaxamento topológico de vizinhos e `= Definir` valor fixo); visualização de wireframe da malha e gradiente térmico colorido (Azul -> Verde -> Amarelo -> Vermelho) com inspeção percentual ao passar o cursor.
- **Reordenação Livre de Camadas (Z-Index / Ordem de Desenho)**: controle de profundidade e ordem de sobreposição com botões de subir (`▲`) e descer (`▼`) no painel de camadas e no menu de clique direito, sincronizado com o histórico de desfazer/refazer.
- **Geração de Malha por Contorno de Silhueta Alfa (Alpha Hull)**: algoritmo `build_hull_mesh_from_rgba` que rasteriza o canal alfa da imagem e gera malhas triangulares justas apenas sobre as regiões não transparentes, descartando quads vazios e reduzindo custo de renderização e deformação.
- **Linha do Tempo Interativa (Dopesheet) e Curvas de Interpolação**: renderização de diamantes com hit-test, salto temporal ao clicar, tooltips informativos e seletores contextuais de curva de interpolação (`Linear`, `Suave` / Ease In-Out e `Hold` / Degrau).
- **Câmera 2D Pan / Tilt / Zoom (PTZ) na Viewport**: zoom suave com a roda do mouse em direção ao ponteiro, pan com botão do meio, botão direito ou `Alt + Arrastar`, reset de enquadramento via tecla `F` ou `Home`, com projeção de ossos, gizmos, pinos MLS e seleções perfeitamente sincronizadas ao espaço da câmera.
- **Seleção Múltipla com Shift e Exclusão no Painel de Camadas**: suporte a seleção em faixa com `Shift` (`selection_select_layer_range`), exclusão via teclado (`Delete` ou `Backspace`) com liberação completa de texturas OpenGL, malhas e pinos, e botão "Excluir" com confirmação visual e histórico de Desfazer.
- **Atalho de Play/Pause da Linha do Tempo**: alternância de reprodução via tecla `Espaço` com indicador visual nos botões da interface.
- **Alinhamento do Gizmo e Edição Ágil de Pivô**: resolução das dimensões reais das texturas das camadas no editor e adição de presets rápidos de pivô no painel Inspetor (`Centro`, `Base / Pés`, `Topo / Cabeça`).
- **Eliminação de Bordas Coloridas (Fringe) em PNGs Importados**: correção do pipeline de blend OpenGL para `gl.BlendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)`, preservando a nitidez de sprites com transparência direta (straight alpha).
- **Deformação Automática (Auto-Skinning) de Sprite Único**: algoritmo `mesh_auto_skin_to_joints` com pesos por distância inversa e Dual-Quaternion skinning, permitindo deformar suavemente qualquer personagem desenhado em folha única ao longo de todo o esqueleto.
- Assistente modal de criação de "Novo Projeto / Personagem" (`Ctrl+N` ou `Arquivo -> Novo Projeto...`), permitindo criar personagens a partir de: Imagem Única (Sprite com auto-posicionamento de esqueleto), Personagem Modular (seleção múltipla de imagens com lista gerenciável de peças), Vitrine Pronta de Demonstração ou Projeto em Branco.
- Importação nativa simultânea de múltiplas imagens 2D no painel de camadas e no menu (`Ctrl+I`), integrando automaticamente cada peça à anatomia do esqueleto através da heurística `auto_guess_joint_for_layer`.
- Resolução do congelamento na abertura do diálogo nativo de arquivos: substituição do monitoramento bloqueante do DBus por invocação direta de utilitários gráficos (`zenity`, `kdialog` e `tkinter`), eliminando bloqueios da fila de eventos SDL2 e restabelecendo estabilidade total no Linux/Wayland/X11.
- Kit de teste original Frontier Survival em `assets/test-kits/frontier-survival/`: seis humanos, seis animais e 24 roupas/equipamentos PNG transparentes, fontes SVG de humano modular com 15 partes e seis acessórios, manifests e catálogo local.
- Importação nativa de imagens 2D (.png, .jpg, .jpeg, .bmp, .tga) no editor via janela de diálogo nativa do sistema operacional (`Zenity`, `KDialog`, `Tkinter`) acionada por `Ctrl+I`, botão no painel de Camadas e arrasto de arquivos (`SDL_DROPFILE`).
- Janela de diálogo nativa do sistema também integrada para Abrir Projeto (`Ctrl+O`), Salvar Como e Importar Modelo 3D.
- Vitrine de animação integrada usando os assets originais de Frontier Survival: Sobrevivente Modular (18 camadas com textura real, rifle, mochila e colete tático sobre esqueleto humanoide de 14 juntas) e Lobo da Fronteira (quadrúpede), selecionáveis via `Arquivo -> Vitrine de Exemplos` e carregados por padrão na inicialização com playback de animação contínua.
- Sistema de rigging dinâmico: adição (`+ Nova Junta`), exclusão, renomeação e reparentamento de juntas com validação anti-ciclos e predefinições esqueléticas completas (`Humanoide`, `Bípede Simplificado`, `Quadrúpede`, `Prop`, `Vazio`).
- Pacote integrado de animações prontas (`Idle`, `Walk Cycle`, `Run Cycle`, `Melee Attack`, `Shield Block`) com seletor de clipes ativos na linha do tempo, criação de novos clipes e amostragem procedural.
- Temas Dark/Light com paleta semântica, accent livre/HEX e presets ciano, azul, violeta, rosa, verde e âmbar.
- Fontes Inter Regular/Medium 4.1 e licença SIL Open Font License 1.1 em `assets/fonts/LICENSE.txt`.
- Preferências JSON v1 independentes do personagem, com workspace e visibilidade de painéis por espaço; gravação atômica de preferências e layouts.
- Tipos dos espaços Montagem/Rig/Animação/Foco, associação explícita de ferramentas e transformação de coordenadas do palco.
- Composição do editor com barras principal/contextual, ferramentas verticais, palco central, painéis redimensionáveis, layouts por espaço e adaptação por abas/menus/rolagem.
- Roteiros de QA nativo `scripts/qa_editor_ui.py` e `scripts/qa_editor_interactions.py`, com configurações e documentos isolados.
- Guia canônico de desenvolvimento da interface em `docs/development/editor-ui.md` e inventário do pacote `src/ui/`.

### Verificação

- Em 2026-10-11, check/build e os 41 testes passaram, incluindo preferências, contraste, ferramentas e coordenadas.
- Matriz de 18 screenshots SDL/OpenGL em Xvfb `:99`: Light/Dark, três resoluções e três escalas; saída limpa e persistência confirmadas.
- Roteiro de interação passou no binário final com código zero e 14 verificações de arrasto/undo/redo, exportação PNG idêntica entre temas e accents extremos, spritesheet de oito quadros (2048×1024), espaços/painéis/docking, playback, 2D/3D, saída, reinício com tema Light/accent `#123456` persistidos, rolagem em 200% e keyframes/foco/teclado da timeline. A timeline compacta foi validada em 1280×720 a 200%. A execução usou OpenGL por software; o hardware do usuário não foi validado.

## [0.1.0] - 2026-10-11

### Adicionado
- Inicialização da estrutura canônica do Prumo v0.5.
- Configuração do manifesto `prumo.json` e orquestração `.ai/`.
- Definição da hierarquia de documentação canônica em `docs/`.
- Contrato estrito de arquitetura em `docs/architecture/clean-code-contract.md`.
- Estratégia de testes exaustivos em `docs/development/testing-strategy.md` (unitários, integração, conformidade, segurança SAST/secrets, performance/stress, UI).
- Política de documentação mandatória com `README.md` explicativo em cada diretório do projeto.
