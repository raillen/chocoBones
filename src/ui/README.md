# UI do editor

Este pacote reúne a apresentação do editor e os auxiliares de interação compartilhados. A composição fica em `src/editor_shell.odin`, `src/editor_layout.odin` e `src/editor_properties.odin`; `src/main.odin` mantém o estado e as ações do aplicativo.

| Arquivo | Responsabilidade |
|---|---|
| `theme.odin` | Temas Dark/Light, accent, contraste e aplicação central do estilo ImGui |
| `preferences.odin` | Preferências JSON v1 independentes do personagem e gravação atômica de preferências/layouts |
| `editor_types.odin` | Espaços de trabalho, visibilidade inicial dos painéis, mapeamento explícito de ferramentas e coordenadas do palco |
| `widgets.odin` | Controles personalizados que compartilham os tokens do tema |
| `selection.odin` | Seleção simples/múltipla e operações geométricas de seleção |
| `gizmo.odin` | Estado e manipulação dos gizmos |
| `phosphor_icons.odin` | Constantes dos ícones Phosphor |

Use `apply_theme` para atualizar a aparência e `current_palette` para cores dos widgets; evite cores fixas em novos controles. Associe ferramentas por `ToolDescriptor.tool`, mantendo a ordem visual independente da ordem do enum. Preferências e layout não devem modificar o documento nem os pixels exportados.

O contrato dos temas, workspaces, fontes, persistência e aceitação está no [guia de desenvolvimento da interface](../../docs/development/editor-ui.md). A fonte Inter 4.1 e sua licença estão em `assets/fonts/`.

Verificação na raiz: `odin check src`, `odin build src -out:bin/chocobones` e `odin test tests`. Em 2026-10-11, check/build e os 41 testes passaram. `scripts/qa_editor_ui.py` validou a matriz de 18 capturas nativas SDL/OpenGL em Xvfb `:99`, com OpenGL por software. `scripts/qa_editor_interactions.py` passou no binário final com 14 verificações de arrasto/undo/redo, exportação invariável, spritesheet, espaços/painéis/docking, playback, modos 2D/3D, saída, reinício, rolagem em 200%, keyframes e foco/teclado da timeline. A validação no hardware do usuário não foi realizada.
