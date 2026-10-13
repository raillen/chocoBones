# Interface do editor

A GUI principal usa **SolidJS + TypeScript** numa webview **CEF do Electrobun 2.0.2**, com Bun no processo nativo. `src/desktop/view/App.tsx` compõe os painéis; `src/editor/controller.ts` mantém os comandos e o documento; `src/desktop/host/` cuida de arquivos e codecs. A implementação Slint permanece disponível por `pnpm run legacy:start`, como compatibilidade e referência histórica.

## Referência visual e organização

A referência fornecida mostra a mesma estrutura em quatro luminosidades: barras superiores compactas, documento dominante, ferramentas e painéis separados por divisórias finas. O azul externo é o fundo da apresentação; azul, laranja e rosa dentro das janelas pertencem à ilustração. A adaptação mantém chrome neutro, poucos destaques e ícones Phosphor; não usa a paleta da ilustração como tema do produto.

A primeira versão Slint concentrou importação, malha, pinos, presets e gravação numa coluna Puppet. A nova interface distribui esses controles conforme a tarefa e a seleção:

| Área | Conteúdo |
|---|---|
| Barra principal | Arquivo/Editar/Exibir, etapas Preparar/Rig/Animar, histórico, tema e salvar |
| Barra do documento | Documento ativo, dimensões do canvas, importar e exportar |
| Projeto à esquerda | Assets/camadas, estrutura de juntas e controles por pino |
| Palco central | Seleção/movimento, pinos, juntas, navegação, overlays e enquadramento |
| Inspetor à direita | Propriedades do documento ou seleção e ferramentas da etapa |
| Timeline inferior | Trilhas de pinos/juntas/camadas, reprodução, scrub, keyframes e interpolação |
| Estado | Mensagens de operações, seleção e contagem da malha |

Os painéis têm separadores arrastáveis e persistem suas dimensões localmente. Dark/Dim/Light persistem nas preferências do host desktop ou no armazenamento do browser, sem alterar o documento. O modo Foco amplia o palco. Em tela compacta, o inspetor pode ser aberto/fechado para conservar espaço de edição; listas e propriedades têm rolagem. As [capturas Solid](screenshots/solid-editor/README.md) registram os tamanhos efetivamente verificados, separados dos limites da implementação Slint.

## Preparar, Rig e Animar

**Preparar** recebe imagens PNG como camadas independentes. O inspetor apresenta propriedades da camada, vínculo a junta, transformações e construção da malha. Linhas/colunas, limiar alfa, refinamento e célula de contorno configuram a próxima reconstrução. O limite de vértices pode reduzir o detalhe pedido; o painel informa essa condição. Reconstruir preserva pinos e clipe.

**Rig** expõe propriedades do pino/junta selecionado, sugestões aditivas de pinos, Snap alfa, MLS/ARAP e estruturas de ossos. Em repouso, pinos mudam sua posição local; em animação, editam offsets. Âncora fixa mantém o repouso da imagem e não representa uma constraint IK global. MLS usa raio/peso; ARAP impõe alvos exatos sobre a malha, e esses campos deixam de aparecer.

**Animar** mostra controle da pose, presets Respiração/Balanço/Passos, amplitude/frequência, configuração do clipe e gravação. Presets substituem o clipe ativo com undo. Gesto grava um take de pino até quatro segundos. A timeline permite selecionar trilhas, inserir pose, mover/excluir keyframes e escolher Linear/Suave/Hold/Bézier. O seletor de interpolação não equivale a um editor gráfico de tangentes; mistura de clipes e editor gráfico de curvas continuam pendentes.

O documento possui comandos tipados; um arrasto constitui uma edição no histórico. Reatividade Solid acompanha o view model e as revisões, sem inserir pixels, buffers de geometria e caches na árvore reativa do DOM. Seleção e disponibilidade determinam as ações visíveis/ativas; estados vazios explicam o próximo passo.

## Palco e responsividade

Uma única webview compõe HTML, palco WebGL2 e overlay Canvas. Menus e diálogos podem ficar sobre o palco sem uma superfície GPU nativa separada. Texturas e buffers permanecem residentes na GPU; existe fallback de rasterização por software quando WebGL2 não está disponível.

MLS/ARAP roda em worker com, no máximo, um cálculo em execução e uma pose pendente substituível. Alterações de geometria/configuração atualizam o worker; movimento e reprodução enviam poses. Buffers de saída são transferíveis e independentes dos arrays do documento/histórico. Resultados de um documento substituído são descartados; aceitar a última pose concluída do documento atual evita starvation em playback quando o solver demora mais que um refresh.

O worker conserva a responsividade do chrome, mas não reduz a latência matemática. O benchmark anterior do ARAP CPU mediu aproximadamente 112 ms com 1.304 vértices apenas em `solve()`. WebGL2 acelera desenho, não a solução da malha. Exportação PNG/spritesheet usa raster CPU; filtragem e cobertura podem diferir do preview GPU.

## Arquivos e atalhos

No desktop, diálogos nativos abrem PNGs/projetos e escolhem a pasta de destino. O SDK utilizado não oferece save dialog TS: **Salvar como/Exportar** combina um modal da aplicação, nome de arquivo e seletor nativo de pasta. O modal também configura quadros/colunas de spritesheet e substituição de arquivo. Projetos incorporam as imagens; não dependem do caminho de origem.

Novo/abrir projeto e fechar a janela desktop oferecem **Salvar/Descartar/Cancelar** quando há alterações. Cancelar a gravação mantém o documento aberto; alterações feitas durante uma gravação continuam marcadas como pendentes. Novo/abrir inicia um histórico próprio, evitando que undo restaure o documento anterior. Câmera, seleção, reprodução e tema não contam como alterações do projeto.

No desenvolvimento web, importação usa arquivos reais escolhidos pelo browser e salvar/exportar gera downloads. Esse adaptador permite QA da interface, mas não comprova diálogo nativo ou RPC Electrobun.

| Atalho | Ação |
|---|---|
| Ctrl/Cmd N, O, I | Novo, abrir projeto, importar PNG |
| Ctrl/Cmd S; Shift S | Salvar; salvar como |
| Ctrl/Cmd Z; Shift Z ou Y | Desfazer; refazer |
| Enter; Home | Play/pause no palco; início do clipe |
| Espaço + arrasto | Navegar no palco |
| K | Inserir keyframe da pose |
| V, P, B, H | Mover, pino, junta, navegar |
| F; M | Enquadrar; mostrar/ocultar malha |
| Delete/Backspace | Excluir seleção |

Atalhos de edição não interceptam campos, selects e diálogos. Controles usam nomes acessíveis, foco visível e SVGs Phosphor existentes em `assets/icons/`; Inter permanece em `assets/fonts/`. Não há emojis.

## Validação e histórico

```sh
pnpm run typecheck
pnpm test
pnpm run build
pnpm run qa:editor
```

`qa:editor` usa o servidor `pnpm dev:web` e um Chromium/Chrome disponível para Playwright, ou conecta ao CEF de uma aplicação real por `CHOCOBONES_QA_CDP`. `CHOCOBONES_QA_URL` escolhe a URL web e `CHOCOBONES_QA_OUTPUT` escolhe o diretório dos artefatos. Os [relatórios Solid](screenshots/solid-editor/README.md) identificam separadamente browser, host Electrobun em desenvolvimento e bundle nativo. O roteiro exercita arquivos/downloads reais no browser e RPC/arquivos reais no desktop; o seletor de arquivos do sistema operacional não foi automatizado.

A suíte atual passou **303 testes em 30 suítes**, além de tipos do núcleo/view/host e build da view. O [QA Solid](screenshots/solid-editor/README.md) passou **19 verificações no Chromium/WebGL2, DPR 2**, e **20 no Electrobun/Bun/CEF Linux em desenvolvimento**. O CEF cloud utilizou o fallback Canvas2D; o teste browser usou SwiftShader. Não há resultado de GPU física nem de builds macOS/Windows.

As evidências anteriores permanecem históricas: [Slint/referência](screenshots/slint-studio/README.md), [Puppet por imagem](screenshots/puppet-tools/README.md) e [MLS/ARAP/refinamento](screenshots/deformation-tools/README.md). A última entrega Slint passou 267 testes em 26 suítes e 15 verificações nativas de deformação. Esses números não comprovam a nova GUI.

[Arquitetura e execução da migração](desktop-migration.md) · [Avaliação da stack e fontes](electrobun-solid-evaluation.md) · [Comparação de ferramentas e limites](puppet-tools-comparison.md).
