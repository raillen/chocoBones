# Current Project State

- Project: **chocoBones-std**
- Prumo: **0.6.0**
- Current phase: **P00 — Foundation**
- Current goal: **P00-G02 (Executando - Dynamic Rig, Animation Packs, and Native Image Import)**
- Context methodology: **Lean Progressive Context (LPC)**
- Last updated: `2026-10-11T20:28:00Z`

## Interface do editor

- Implementados temas Dark/Light, accent livre/HEX e seis presets, fontes Inter/Phosphor, composição compacta e espaços Montagem/Rig/Animação/Foco.
- Preferências e visibilidade dos painéis persistem em JSON v1; layouts de docking têm IDs por espaço e ficam em `layouts.ini`, no diretório SDL do aplicativo.
- Interface, estado do documento e exportação permanecem separados. A QA confirmou PNG idêntico entre temas e accents extremos.

## Evidência de verificação — 2026-10-11

- Verificação final às `16:18:20` (America/Sao_Paulo): `odin check src`, `odin build src -out:bin/chocobones` e `odin test tests` passaram; 41 testes automatizados.
- `scripts/qa_editor_ui.py`: matriz de 18 screenshots nativos Dark/Light, resoluções 1280×720/1440×900/1920×1080 e escalas 100%/150%/200%, com saída limpa e persistência verificadas.
- `scripts/qa_editor_interactions.py`: binário final, código zero e 14 verificações de arrasto/undo/redo, exportação invariável, spritesheet de oito quadros (2048×1024), espaços/painéis/restauração, docking, playback durante troca de tema, 2D/3D, saída, reinício, rolagem, keyframes e foco/teclado da régua. Timeline compacta validada em 1280×720 a 200%, com controles inteiros.
- Ambiente: Xvfb `:99` e OpenGL por software. Hardware/desktop físico do usuário não validado.
- Capturas e relatórios: `/home/raillen/.codex/visualizations/2026/10/11/01a12c37-d2a6-7871-8894-44640df44ef9/chocobones/` (`matrix.json` e `interaction.json`).

## Assets de teste — 2026-10-11

- Kit original Frontier Survival em `assets/test-kits/frontier-survival/`: seis humanos, seis animais, 24 roupas/equipamentos e um humano modular com fontes SVG reais (15 partes corporais e seis acessórios).
- Arte das pranchas gerada com `image_gen`, com aparência vetorial e alpha transparente; não contém assets extraídos de CryoFall. SVGs modulares e seus PNGs são um conjunto separado, com canvas e pivôs compartilhados.
- Catálogo, manifests e instruções de uso ficam junto ao kit. A importação de imagens 2D e o rigging dinâmico foram integrados nativamente com sucesso ao aplicativo no escopo do Goal P00-G02.

## Next action

Todas as entregas do Goal P00-G02 foram concluídas, testadas (54 testes passando com zero vazamentos) e integradas:
1. Resolução do travamento/congelamento na importação de imagens pelo diálogo nativo do sistema.
2. Assistente modal de Novo Projeto (`Ctrl+N` / menu) com 4 modos: Imagem Única (Sprite), Personagem Modular (Multi-imagem), Vitrines Prontas e Vazio.
3. Importação simultânea de múltiplas imagens com mapeamento anatômico heurístico (`auto_guess_joint_for_layer`).
4. Rigging Dinâmico com adição, remoção, renomeação, reparentamento e predefinições esqueléticas completas.
5. Pacote de animações prontas integrado com playback ativo.
Próximo passo: validação e novas interações com o usuário.

## Recovery order

1. `ENTRYPOINT.md` or the platform adapter.
2. `prumo.json`.
3. `PROJECT_STATE.md`.
4. `docs/PRUMO.md`.
5. Active Goal under `.ai/goals/`.
6. Only relevant canonical docs/symbols/tests selected by the context strategy.

Do not load the entire repository by default.
