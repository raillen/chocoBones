# Interface do editor

O editor atual usa TypeScript, Node.js e Slint. `ui/main.slint` compõe os espaços de trabalho; `ui/studio-controls.slint` define paleta e controles; `src/ui/bridge.ts` liga as ações ao documento. As descrições antigas de docking em Odin/ImGui não representam esta implementação.

## Leitura da referência e adaptação

A imagem de referência apresenta a mesma interface em quatro níveis de luminosidade. A estrutura permanece estável: duas barras superiores, ferramentas verticais à esquerda, documento dominante e painéis contínuos à direita. O azul externo é o fundo da apresentação. As grandes áreas azuis, laranjas e rosas dentro das janelas pertencem à ilustração, não ao tema do editor.

O primeiro plano dedica aproximadamente 80% da largura interna ao documento. O chrome é neutro, com divisórias finas e poucos elementos em destaque. A persona ativa usa uma cápsula ciano; alternativas ficam discretas. Cabeçalhos e abas organizam painéis encaixados, sem margens entre cards. Ícones monocromáticos e controles curtos sustentam a densidade. Mudar a luminosidade mantém posição, hierarquia e leitura dos controles.

A adaptação ao chocoBones segue estes princípios:

| Referência | Aplicação no chocoBones |
|---|---|
| Personas de edição | Montagem, Rig, Animação e Foco |
| Barra contextual | Ferramenta, edição de repouso/pose, IK quando pertinente e vista 2D/3D |
| Rail estreita | Nove ferramentas existentes, com SVGs Phosphor, sem emojis |
| Documento dominante | Palco proporcional; buffer RGBA realmente entregue ao Slint |
| Painéis encaixados | Elementos, Transformação e Navegador, separados por linhas de 1 px |
| Abas de recursos de desenho | Camadas/juntas; opacidade para camada, posição/rotação para junta |
| Configuração de aparência | Painel próprio com três luminosidades e seis acentos |
| Barra inferior | Timeline dos clipes Idle/Walk e estado do editor |

Não foram incluídos controles decorativos de pincéis, cores do desenho ou efeitos sem vínculo com ações existentes. O painel de aparência modifica a interface; a cor de destaque não muda as cores do rig. O fundo/grid do preview e da exportação continua seguindo o comportamento existente de tema do renderizador; esta mudança não separa essas duas superfícies.

## Sistema visual

`StudioPalette` compartilha cores semânticas entre todos os componentes, inclusive hover, foco, campos e seleção. Os temas são Dark (base `#202020`), Dim (`#393939`) e Light (`#DEDEDE`). O palco conserva as cores do renderizador. Os acentos são Ciano, Azul, Violeta, Rosa, Verde e Âmbar; o fundo da seleção deriva do acento ativo com transparência.

`StudioButton`, `StudioScrub` e `StudioSwatch` substituem os botões e sliders de aparência fixa do sistema. Fontes Inter Regular/Medium e ícones Phosphor usam os arquivos e licenças existentes em `assets/`. Controles ativos, foco e hover acompanham o tema. As descrições acessíveis identificam ferramentas e ações iconográficas.

A composição usa barra principal de 40 px, contexto de 34 px, rail de 40 px e dock de 268 px. Em 1400 px, o palco dispõe de 1092 px de largura. A timeline fica sob o palco, mantendo o inspetor disponível durante animação. Os presets de estrutura ficam no inspetor do espaço Rig, em vez de ocupar a barra de todos os espaços.

## Adaptação e interação

| Espaço | Organização |
|---|---|
| Montagem | Camadas, opacidade, ordem e visibilidade |
| Rig | Juntas, vínculo, posição, rotação, IK e presets |
| Animação | Camadas e inspetor, timeline com reprodução e scrubbing |
| Foco | Palco ampliado; dock e timeline ocultos |

A troca de espaço adapta a aba de elementos sem reconstruir o documento, interromper playback ou apagar seleção. As duas abas continuam acessíveis em cada espaço.

Abaixo de 1100 px, o dock usa 232 px e Elementos/Inspetor compartilham abas. Abaixo de 720 px de altura, a timeline fica compacta e o Navegador é oculto. Rail, listas e inspetor têm rolagem. O mínimo suportado é 760×560; não há docking livre ou persistência de layouts nesta versão Slint.

A imagem do palco usa `image-fit: contain`. `src/ui/viewport/geometry.ts` transforma coordenadas lógicas da janela em pixels do buffer, descontando margens e escala. Cliques nas margens não iniciam edição; um arrasto iniciado na imagem pode continuar fora dela. Isso evita deslocar o picking ao redimensionar a janela e mantém a proporção do personagem.

O palco encaminha atalhos existentes, incluindo Espaço, C, F/Home, Delete/Backspace e Alt+R, traduzindo os códigos especiais do Slint. Teclas não tratadas permanecem disponíveis para navegação de foco. Botões e acentos aceitam Espaço/Enter; timeline e opacidade aceitam setas e Home/End. Clique com Shift seleciona faixas de camadas. O painel de aparência intercepta cliques nas suas áreas vazias, evitando ações no palco ou nas barras por baixo dele.

## Verificação reproduzível

Na raiz do checkout:

```sh
pnpm run typecheck
pnpm run build
pnpm test
SLINT_BACKEND=winit-femtovg pnpm exec tsx scripts/test_themes_and_accents.ts
```

O último comando requer um display gráfico. A suíte unitária cobre entrega de RGBA, cleanup do loop, mudança de dimensões do buffer e picking/arrasto com escalas e margens. O teste de temas verifica callbacks, pixels renderizados e exportação 2D/3D; ele não é uma certificação de contraste ou uma comparação visual com a referência.

`scripts/qa_studio.ts` abre a janela Slint real, captura temas e resoluções, verifica pixels do chrome e compara o RGBA nativo com o framebuffer. Também exercita ações por eventos nativos e callbacks. Requer X11, Xvfb, ImageMagick (`import`) e `xwininfo`. Exemplo em um display isolado:

```sh
Xvfb :102 -screen 0 1600x1000x24 -nolisten tcp -extension MIT-SHM > /tmp/chocobones-xvfb.log 2>&1 &
qa_display_pid=$!
# Aguarde xdpyinfo -display :102 retornar sucesso.
DISPLAY=:102 LIBGL_ALWAYS_SOFTWARE=1 LIBGL_DRI3_DISABLE=1 \
  SLINT_BACKEND=winit-femtovg XDG_CACHE_HOME=/tmp/chocobones-qa-cache \
  CHOCOBONES_QA_OUTPUT=/tmp/chocobones-studio-qa pnpm exec tsx scripts/qa_studio.ts
kill "$qa_display_pid"
```

Em containers com namespaces IPC separados, desativar a extensão MIT-SHM do display virtual evita imagens desatualizadas por falha de compartilhamento de memória. Isso não desativa verificação de pacotes ou TLS. O aviso de D-Bus para configurações do desktop é separado da abertura/renderização da janela.

A matriz visual cobre Dark/Dim/Light em 900×640, 1280×720 e 1400×900, os quatro espaços, o painel de aparência e o mínimo 760×560. A execução produz PNGs e `report.json` com dimensões, hashes e verificações. Capturas devem ser revisadas junto do relatório; afirmar apenas que a propriedade de tema mudou não comprova que a janela foi redesenhada.

A verificação da implementação passou em tipagem, build e 132 testes em 16 suítes. O roteiro nativo passou 28 verificações e gerou 15 capturas; a revisão visual confirmou Phosphor, temas e composição em tela ampla e compacta. As [15 capturas nativas e o relatório](screenshots/slint-studio/README.md) estão versionados em `screenshots/slint-studio/`. O script QA também passou tipagem estrita própria, pois `scripts/` não faz parte do `tsconfig.json` principal.
