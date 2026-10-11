# Interface do editor

A interface do chocoBones usa Odin, Dear ImGui com docking e o backend SDL2/OpenGL. A reformulação aproxima a composição de um editor criativo compacto: barra principal com espaços de trabalho, barra contextual, ferramentas verticais, palco central, painéis à direita e rodapé de estado. As ações de montagem, rig e animação continuam pertencendo ao editor existente.

## Temas, fontes e ferramentas

`src/ui/theme.odin` define `ThemeMode`, `AppearanceSettings`, `ThemePalette` e `apply_theme`. O estilo ImGui e os widgets personalizados compartilham cores semânticas para superfícies, campos, texto, divisórias, seleção e foco. Dark usa grafite; Light usa cinzas claros. A paleta deriva variantes do accent para alcançar os alvos de contraste de 4,5:1 em texto e 3:1 nos indicadores essenciais, sem alterar a cor escolhida nas preferências.

Aparência oferece Dark/Light, seletor RGB e campo `#RRGGBB`. Os presets são Ciano `#00B8D9`, Azul `#3B82F6`, Violeta `#8B5CF6`, Rosa `#EC4899`, Verde `#10B981` e Âmbar `#F59E0B`. A aplicação é imediata. Cores de erros e avisos mantêm papéis próprios; as cores do personagem pertencem ao documento.

As fontes Inter Regular/Medium 4.1 estão em `assets/fonts/`, com licença SIL Open Font License 1.1 em `assets/fonts/LICENSE.txt`. Os ícones Phosphor existentes são mantidos. Na fusão das fontes, a faixa privada dos ícones é excluída da Inter, permitindo que a fonte Phosphor forneça esses glifos. A base visual usa texto de 14 px, espaçamento de 4 px, bordas finas e cantos de 3 px. A origem da fonte é a [release oficial Inter 4.1](https://github.com/rsms/inter/releases/tag/v4.1).

`TOOL_DESCRIPTORS`, em `src/ui/editor_types.odin`, associa cada ícone, rótulo e atalho a um valor explícito de `Tool`. A ordem da barra não deve ser convertida em ordinal do enum. `tool_descriptor` fornece a apresentação da ferramenta selecionada. O palco usa `fit_canvas` e `screen_to_scene` para centralizar o conteúdo preservando proporção e coordenadas do documento.

## Espaços de trabalho e docking

| Espaço | Painéis iniciais |
|---|---|
| Montagem (`assembly`) | Camadas e Inspetor; timeline oculta |
| Rig (`rig`) | Guia de juntas e Inspetor; timeline oculta |
| Animação (`animate`) | Camadas, Inspetor e timeline inferior |
| Foco (`focus`) | Palco ampliado; painéis auxiliares ocultos |

Cada espaço tem IDs estáveis de dockspace e de janela, permitindo preservar divisórias, abas e posições independentemente. Os nomes internos usam o sufixo do espaço, como `Palco###stage_assembly` e `Inspetor###inspector_rig`; os rótulos visíveis podem mudar sem invalidar o layout. A troca de espaço mantém documento, seleção, ferramenta e modo 2D/3D e cancela gestos transitórios de edição. O menu de painéis permite reabrir os painéis existentes e restaurar o layout inicial do espaço ativo. O layout de Animação reserva inicialmente 25% da altura para a timeline existente.

DockBuilder fica encapsulado em `src/editor_layout.odin`: inicializa layouts ausentes ou restaura o espaço solicitado. Esta é uma API interna do Dear ImGui; ao atualizar os bindings, conferir a integração de docking. Dockspaces inativos usam `KeepAliveOnly` para preservar suas janelas. A [documentação oficial de docking](https://github.com/ocornut/imgui/wiki/Docking) descreve esse comportamento. `src/editor_shell.odin` reúne barras, Aparência, fontes e persistência; `src/editor_properties.odin` organiza os controles do Inspetor. As ações e o estado do documento continuam em `src/main.odin`.

Em janelas com menor espaço efetivo, Camadas e Inspetor compartilham abas, a troca de workspace usa o menu Espaços e ações secundárias permanecem acessíveis nos menus. A rail e o Inspetor têm rolagem vertical quando necessária. A timeline compacta oculta metadados secundários, usa ícone para Gravar e mantém uma régua fina; sua altura pode ser ampliada pela divisória. A régua mantém indicação de foco e navegação por teclado. `CHOCOBONES_UI_SCALE` aceita valores de `1` a `2`, incluindo `1.5`, para ajustar a escala sem mudar as coordenadas do documento.

## Preferências e arquivos locais

O diretório de configuração vem de `SDL_GetPrefPath("chocoBones", "chocoBones-std")`. Nele, `preferences.json` guarda aparência, espaço ativo e visibilidade dos painéis; `layouts.ini` guarda os dados de docking do ImGui. Estes arquivos são independentes dos arquivos de personagem.

O contrato JSON v1 é plano. Os valores de tema são `dark`/`light`; os de workspace são `assembly`/`rig`/`animate`/`focus`. Exemplo completo:

```json
{
  "version": 1,
  "theme": "dark",
  "accent": "#00B8D9",
  "workspace": "assembly",
  "panels": [
    {"layers": true, "inspector": true, "timeline": false, "joints": false},
    {"layers": false, "inspector": true, "timeline": false, "joints": true},
    {"layers": true, "inspector": true, "timeline": true, "joints": false},
    {"layers": false, "inspector": false, "timeline": false, "joints": false}
  ]
}
```

`panels` é opcional para compatibilidade com a versão 1 inicial. Quando presente, exige quatro objetos, na ordem Montagem/Rig/Animação/Foco, com os quatro campos booleanos. Quando ausente, usa `default_panel_visibility` para cada espaço.

`default_preferences` retorna Dark, ciano e Montagem. `load_preferences` retorna essas configurações e `false` para arquivo ausente, JSON inválido, versão desconhecida ou valores inválidos; a leitura não modifica o arquivo. O editor preserva um arquivo inválido até ocorrer uma alteração explícita de preferência. `preferences_from_json` valida também duplicação de chaves e conteúdo após o objeto. O accent aceita seis dígitos hexadecimais com `#`, em qualquer caixa, e é gravado em maiúsculas. RGB livre é quantizado para 8 bits por canal, com erro máximo de meio passo de 8 bits.

`save_preferences` e `save_layouts_atomic` gravam em um temporário no mesmo diretório e fazem rename após concluir a escrita. Falha retorna `false`, limpa o temporário criado e preserva o destino anterior. O editor mantém a sessão utilizável e exibe o erro. Tema, accent e fontes pertencem à interface e mantêm os pixels do personagem exportado.

## Verificação

Executar na raiz do repositório:

```sh
odin check src
odin build src -out:bin/chocobones
odin test tests
```

Os testes de preferências cobrem roundtrip de todos os temas/espaços, presets e extremos RGB, compatibilidade sem `panels`, arquivos inválidos sem modificação, quantização e falhas de IO/rename. Os testes de UI cobrem contraste, associação das ferramentas e transformação de coordenadas do palco.

Em 2026-10-11, a verificação final às `16:18:20` (America/Sao_Paulo) passou em `odin check src`, build e nos 41 testes automatizados. A integração da interface foi executada no aplicativo nativo SDL/OpenGL em Xvfb `:99`.

`scripts/qa_editor_ui.py` capturou e verificou 18 casos: Dark/Light × 1280×720, 1440×900 e 1920×1080 × escalas de 100%, 150% e 200%. Todos encerraram com código zero, persistiram preferências/layouts e não apresentaram mensagens inesperadas no log. A revisão das capturas confirmou legibilidade, ícones Phosphor corretos, palco proporcional e adaptação por abas/menus/rolagem.

`scripts/qa_editor_interactions.py` passou no binário final com código zero e 14 verificações de interação: seleção e arrasto, undo/redo, exportação, os quatro espaços, fechamento/reabertura/restauração de painéis, divisórias de docking, troca de tema durante playback, modo 2D/3D, saída limpa e reinício. O arrasto de 30 pixels produziu a transformação esperada `30 * 512 / 756` no documento. O PNG exportado permaneceu idêntico entre Light/Dark e accents preto, branco e livre. A exportação de spritesheet gerou os oito quadros existentes em PNG 2048×1024. No reinício, o roteiro confirmou tema Light, accent `#123456` e os quatro layouts persistidos, usando ImageMagick. Em 1280×720 a 200%, a rolagem expôs e permitiu selecionar a ferramenta Pesos; a timeline compacta manteve controles inteiros, sem corte ou rolagem desnecessária. Gravar/excluir keyframes e o foco/teclado da régua também passaram.

Os roteiros executam o editor em diretórios temporários e isolam preferências e documentos dos arquivos do usuário. Com Xvfb `:99` disponível, Python 3, `xdotool` e ImageMagick instalados, reproduzir:

```sh
python3 scripts/qa_editor_ui.py --display :99 --output /tmp/chocobones-ui-qa
python3 scripts/qa_editor_interactions.py --display :99 --output /tmp/chocobones-ui-qa
```

As capturas e os relatórios locais desta execução estão em `/home/raillen/.codex/visualizations/2026/10/11/01a12c37-d2a6-7871-8894-44640df44ef9/chocobones/`, incluindo `matrix.json` e `interaction.json`. A execução usou Xvfb com OpenGL por software. Ela valida o aplicativo nativo em um display virtual; a percepção de DPI físico, composição e driver no hardware do usuário e em outros desktops deve ser avaliada nos ambientes de distribuição.
