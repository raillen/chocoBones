# Changelog

Todas as alterações notáveis deste projeto são documentadas neste arquivo.
O formato baseia-se no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/) e adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Kit de teste original Frontier Survival em `assets/test-kits/frontier-survival/`: seis humanos, seis animais e 24 roupas/equipamentos PNG transparentes, fontes SVG de humano modular com 15 partes e seis acessórios, manifests e catálogo local.
- Importação nativa de imagens 2D (.png, .jpg, .jpeg, .bmp, .tga) no editor via janela de diálogo nativa do sistema operacional (`Zenity`, `KDialog`, `XDG Desktop Portal`, `Tkinter`) acionada por `Ctrl+I`, botão no painel de Camadas e arrasto de arquivos (`SDL_DROPFILE`).
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
