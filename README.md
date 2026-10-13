# chocoBones-ts

Editor de personagens e animação 2D em **TypeScript**, com interface **SolidJS** e aplicativo desktop **Electrobun/Bun**. O palco usa WebGL2 para desenhar imagens e malhas; MLS/ARAP roda em um worker. O núcleo de rig, animação, deformação e projeto continua compartilhado com a implementação Slint preservada.

## Compilar e executar

Requer Node.js 20.19+ ou 22.12+, pnpm 12.9.1 e as dependências nativas da plataforma. O SDK Electrobun está fixado em 2.0.2 e prepara seu runtime Bun e toolchain pelo Hutch; SolidJS 1.9.17 e Vite 8.3.4 também estão fixados.

```sh
pnpm install
pnpm run desktop:prepare
pnpm run typecheck
pnpm test
pnpm start
```

`desktop:prepare` gera os módulos do SDK usados pelos tipos e pela view. `pnpm start` prepara o SDK, compila a view e abre o desktop. `pnpm dev` acompanha mudanças; `pnpm dev:web` abre apenas o editor web para desenvolvimento, com seleção de arquivos e downloads do browser. `pnpm run build` verifica/compila TypeScript e gera a view; `pnpm run build:desktop` empacota o aplicativo. A implementação anterior pode ser aberta com `pnpm run legacy:start`.

[Instalação, arquitetura e limites da migração](docs/development/desktop-migration.md).

## Fluxo do editor

- **Preparar:** importe PNGs como camadas independentes, ajuste transformações e vínculos e configure a malha por alfa. O refinamento acrescenta detalhe junto à silhueta.
- **Rig:** crie, selecione e ajuste pinos e juntas; fixe âncoras, escolha MLS ou ARAP e associe camadas ao esqueleto.
- **Animar:** edite poses, aplique Respiração/Balanço/Passos ou grave um gesto. A timeline mostra trilhas, keyframes, interpolação e controles de reprodução.

Assets e estrutura ficam à esquerda, propriedades da seleção à direita e o palco ao centro. Painéis e timeline têm dimensões ajustáveis; temas neutros e SVGs Phosphor mantêm a linguagem visual da referência. Tema e dimensões dos painéis persistem separados do personagem. Salvar/exportar oferece nome e pasta, e a spritesheet permite escolher quadros e colunas. Novo, abrir e fechar o desktop oferecem Salvar/Descartar/Cancelar quando há alterações. Projetos incorporam PNG, UVs, pinos e configuração das malhas; a exportação usa alfa e omite overlays.

## Arquitetura e status

| Módulo | Responsabilidade |
|---|---|
| [`src/editor/`](src/editor/) | Comandos, view model, histórico e documento portáveis para o browser |
| [`src/desktop/view/`](src/desktop/view/) | SolidJS, painéis contextuais, timeline e palco WebGL2/Canvas |
| [`src/desktop/host/`](src/desktop/host/) | IO/codecs nativos, validação de RPC, servidor local de imagens e exportação |
| [`src/core/`](src/core/) e [`src/rig/`](src/rig/) | Matemática 2D/3D, FK/IK, presets e constraints |
| [`src/animation/`](src/animation/) | Avaliação comum de clipes, interpolação, canais e movimentos por pino |
| [`src/mesh/`](src/mesh/) e [`src/deform/`](src/deform/) | Malha por alfa, refinamento conforme, skinning, MLS e ARAP local/global esparso |
| [`src/project/`](src/project/) e [`src/history/`](src/history/) | Projeto v2/Zod, compatibilidade e undo/redo transacional |
| [`src/render/`](src/render/) e [`src/export/`](src/export/) | Raster CPU transparente e formatos/runtime de exportação |
| [`src/mesh3d/`](src/mesh3d/), [`src/player/`](src/player/) e [`src/procedural/`](src/procedural/) | Núcleo 3D, player e operadores; integração completa à nova GUI ainda pendente |
| [`src/ui/`](src/ui/) e [`ui/`](ui/) | Adaptador e componentes Slint legados preservados para compatibilidade |

O worker mantém o cálculo fora da thread da interface e evita acumular poses pendentes. Isso não torna o solver ARAP mais rápido: o benchmark anterior mediu cerca de 112 ms por pose com 1.304 vértices. WebGL2 acelera a rasterização; a exportação continua usando CPU. Não há garantia de 60 FPS em malhas densas ou identidade de pixels entre GPU e CPU.

Editor gráfico de curvas, mistura de clipes, pintura de pesos, caminhos e integração dos recursos avançados de BBW/cage/3D permanecem pendentes. A migração não equivale à paridade completa com Odin ou Cartoon Animator.

A suíte atual passou **303 testes em 30 suítes**, com checagem de tipos do núcleo, view e host. O QA da interface passou 19 verificações no Chromium/WebGL2 (DPR 2) e 20 no Electrobun/Bun/CEF Linux, usando Canvas2D no ambiente cloud. Os relatórios distinguem preview, host nativo e bundle; macOS/Windows e GPU física ainda não foram executados.

[Interface e funcionamento](docs/development/editor-ui.md) · [Capturas e relatórios da GUI Solid](docs/development/screenshots/solid-editor/README.md) · [Avaliação da stack](docs/development/electrobun-solid-evaluation.md) · [Ferramentas e referências](docs/development/puppet-tools-comparison.md) · [Evidência anterior de MLS/ARAP](docs/development/screenshots/deformation-tools/README.md).

## Desenvolvimento e Prumo

O projeto usa Prumo v0.6.0 e Lean Progressive Context. Com Prumo instalado:

```sh
prumo validate .
prumo doctor .
```
