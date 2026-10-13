# QA nativo: malha adaptativa e deformação ARAP

Capturas da janela real do chocoBones em Slint, com o personagem `assets/test-kits/frontier-survival/vector-rig/base-survivor.png` (512 × 768). A GUI atual foi preservada. Os controles usam os ícones Phosphor do repositório.

O script [qa_deformation_tools.ts](../../../../scripts/qa_deformation_tools.ts) concluiu **15 verificações**, incluindo as sete capturas. O [report.json](report.json) registra os parâmetros e hashes do framebuffer e das imagens capturadas. Todas as capturas têm 1400 × 1000 pixels.

| Captura | O que mostra |
| --- | --- |
| [01 — MLS em repouso](01-mls-regular-rest.png) | Malha regular e pinos sugeridos sobre o PNG importado. |
| [02 — MLS com pose](02-mls-regular-posed.png) | Deformação após arraste real do pino superior no palco. |
| [03 — ARAP na mesma pose](03-arap-regular-posed.png) | Troca do modelo mantendo a pose e os pontos de repouso. |
| [04 — ARAP e contorno refinado](04-arap-refined-posed.png) | Refinamento em células que atravessam a transparência, com tamanho de borda de 8 px. |
| [05 — Detalhe da malha](05-arap-refined-detail.png) | Ampliação pelo controle de zoom da GUI. |
| [06 — Tema claro](06-arap-refined-light.png) | Os controles e a malha refinada no tema claro. |
| [07 — Arte deformada](07-arap-refined-artwork.png) | A mesma pose ARAP com a malha visual desativada. |

A malha inicial contém 101 vértices e 152 triângulos. O refinamento produz 1303 vértices e 2152 triângulos, após subdividir 462 células, sem atingir o orçamento. Esses números são específicos deste PNG e destes parâmetros.

O QA verifica que o arraste em Pose não altera o repouso; os pontos ARAP inseridos na triangulação chegam aos alvos locais com erro menor que `1e-7`; a âncora travada permanece fixa; reconstruir a malha preserva o modelo, os pinos e a pose; e o projeto salvo retém os parâmetros de refinamento e restaura a mesma arte da pose atual. A amostragem do clipe em outro tempo é uma operação distinta: o save desta verificação conserva os offsets da pose editada.

As exportações transparentes usam o canvas original, sem os overlays do editor:

- [MLS com pose](artwork-mls-posed.png)
- [ARAP com pose e malha regular](artwork-arap-posed.png)
- [ARAP com pose e malha refinada](artwork-arap-refined.png)

Para repetir a partir da raiz do repositório, instale as dependências e disponibilize Xvfb, `xwininfo` e ImageMagick (`import`). Este ambiente utiliza o binário local `/workspace/.tools/xvfb/usr/bin/Xvfb`; fora dele, use `Xvfb` do sistema.

```bash
Xvfb :119 -screen 0 1600x1200x24 -nolisten tcp -extension MIT-SHM > /tmp/chocobones-deformation-xvfb.log 2>&1 &
DISPLAY=:119 SLINT_BACKEND=winit-femtovg LIBGL_ALWAYS_SOFTWARE=1 LIBGL_DRI3_DISABLE=1 CHOCOBONES_QA_OUTPUT=/tmp/chocobones-deformation-tools node node_modules/tsx/dist/cli.mjs scripts/qa_deformation_tools.ts
```

O MIT-SHM está desativado para evitar que namespaces IPC distintos deixem a captura X11 desatualizada. Foi usado render por software em Linux headless. Este conjunto valida um personagem de uma imagem do próprio repositório; não certifica empacotamento desktop, taxa de quadros, rigs de várias camadas ou todas as dimensões aceitas pelo importador. O refinamento aproxima a borda pela malha; a transparência da textura continua definindo o recorte final.
