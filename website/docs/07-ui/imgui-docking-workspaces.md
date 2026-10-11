# Dear ImGui: aparência e espaços de trabalho

O chocoBones usa Dear ImGui com docking sobre SDL2/OpenGL. A interface organiza as ações existentes em uma barra principal, uma barra contextual, ferramentas verticais, palco central, painéis à direita e rodapé. As abas e divisórias dos painéis permitem ajustar o espaço disponível ao trabalho.

## Espaços de trabalho

| Aba | Organização inicial |
|---|---|
| Montagem | Camadas e Inspetor à direita; timeline oculta |
| Rig | Guia de juntas e Inspetor em destaque; timeline oculta |
| Animação | Camadas e Inspetor à direita; timeline existente na base, inicialmente com 25% da altura |
| Foco | Palco ampliado, com painéis auxiliares ocultos |

Cada espaço preserva seu próprio layout. A troca mantém documento, seleção, ferramenta ativa e modo 2D/3D. O menu de painéis permite reabrir painéis existentes e restaurar a organização inicial do espaço ativo. A timeline apresenta os controles de animação e keyframes disponíveis no aplicativo.

## Light/Dark e accent

Aparência oferece temas Dark e Light, seletor de cor livre e campo `#RRGGBB`. Os presets são ciano, azul, violeta, rosa, verde e âmbar; o padrão é Dark com ciano `#00B8D9`.

O tema usa cores semânticas compartilhadas com os controles personalizados. Variantes do accent ajustam contraste de seleção, foco e texto sem substituir o RGB escolhido nas preferências. Erros, avisos e cores do personagem mantêm seus papéis. Tema e accent não devem alterar os pixels exportados.

A tipografia usa Inter Regular/Medium 4.1, com licença SIL Open Font License 1.1 em `assets/fonts/LICENSE.txt`, junto aos ícones Phosphor. O palco preserva proporção e coordenadas de seleção ao se ajustar ao espaço central.

## Persistência

`SDL_GetPrefPath("chocoBones", "chocoBones-std")` define o diretório local. `preferences.json` guarda tema, accent, workspace ativo e visibilidade de painéis por espaço. `layouts.ini` guarda os dados de docking com IDs estáveis por espaço e painel. Estas preferências são independentes do arquivo de personagem.

Exemplo mínimo válido de preferências:

```json
{"version":1,"theme":"dark","accent":"#00B8D9","workspace":"assembly"}
```

O campo opcional `panels` pode guardar quatro objetos com os booleanos `layers`, `inspector`, `timeline` e `joints`, na ordem Montagem/Rig/Animação/Foco. Ausência usa os layouts iniciais. Leitura inválida retorna defaults; gravação usa temporário e rename, preservando o arquivo anterior se falhar.

O guia técnico canônico, incluindo o exemplo completo e os comandos de verificação, está em [Interface do editor](../../../docs/development/editor-ui.md). DockBuilder é encapsulado por ser uma [API interna do Dear ImGui](https://github.com/ocornut/imgui/wiki/Docking).

## Estado da verificação

Em 2026-10-11, check/build e os 41 testes passaram. A matriz de 18 capturas nativas SDL/OpenGL em Xvfb `:99` cobriu Dark/Light, resoluções 1280×720, 1440×900 e 1920×1080 e escalas 100%, 150% e 200%. A revisão confirmou ícones, legibilidade e adaptação por abas/menus/rolagem.

Os roteiros `scripts/qa_editor_ui.py` e `scripts/qa_editor_interactions.py` registram essa evidência. O roteiro de interação passou no binário final com código zero e 14 verificações de seleção/arrasto, undo/redo, exportação idêntica entre temas e accents extremos, spritesheet, espaços, painéis, docking, playback, 2D/3D, saída, reinício, rolagem em 200%, keyframes e foco/teclado da régua. A timeline compacta também foi validada em 1280×720 a 200%. A execução usou OpenGL por software em display virtual; validação no hardware do usuário não foi realizada. As instruções de reprodução estão no guia canônico.
