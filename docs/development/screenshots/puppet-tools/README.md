# Ferramentas de puppet por imagem — capturas nativas

Capturas da janela Slint real, usando o PNG do próprio repositório `assets/test-kits/frontier-survival/vector-rig/base-survivor.png` (512 × 768, com transparência). Ícones Phosphor. Nenhuma tela foi simulada.

O [relatório](report.json) registra **18 verificações nativas e 8 capturas**, incluindo importação, malha e UVs, pinos sobre alfa, enquadramento, três presets que alteram a textura, arrasto nativo, âncora bloqueada, gravação e reprodução de gesto, exportação transparente e reabertura do projeto com os mesmos pixels.

| Estado | Captura |
| --- | --- |
| PNG importado, malha e cinco pinos | [Repouso inicial](dark-setup-1400x1000.png) |
| Primeiro quadro do movimento | [Antes da deformação](dark-motion-rest-1400x1000.png) |
| Respiração, um quarto do ciclo | [Escuro](dark-motion-posed-1400x1000.png) · [Grafite](dim-motion-posed-1400x1000.png) · [Claro](light-motion-posed-1400x1000.png) |
| Janela 900 × 640 | [Painel superior](light-puppet-compact-900x640.png) · [Controles após rolagem](light-puppet-controls-compact-900x640.png) |
| Gesto gravado pelo arrasto do pino | [Pose final reproduzida](dark-recorded-gesture-1400x1000.png) |

Os temas de desktop mostram o painel Puppet inteiro. No tamanho compacto, a segunda captura mostra os controles inferiores acessíveis pela rolagem. A mesma textura importada aparece em todos os temas.

As imagens abaixo são exportações da arte em seu canvas, sem grade, malha, pinos, ossos ou onion skin. O fundo transparente faz parte dos arquivos:

- [Arte em repouso](artwork-rest.png)
- [Arte deformada por respiração](artwork-breath-quarter.png)
- [Última pose do gesto](artwork-gesture-end.png)
- [Spritesheet de oito quadros](spritesheet_export.png)

O endpoint exportado do gesto é comparado pixel a pixel com a última pose arrastada. A spritesheet possui quatro colunas e duas linhas, com quadros de 512 × 768.

Para repetir as verificações, execute a partir da raiz do repositório com as dependências instaladas. É necessário X11, Xvfb, `xwininfo` e ImageMagick (`import`):

```bash
Xvfb :107 -screen 0 1600x1200x24 -nolisten tcp -extension MIT-SHM > /tmp/chocobones-puppet-xvfb.log 2>&1 &
DISPLAY=:107 CHOCOBONES_QA_OUTPUT=/tmp/chocobones-puppet-tools node node_modules/tsx/dist/cli.mjs scripts/qa_puppet_tools.ts
```

`tests/sprite_workflow.test.ts` cobre os mesmos comandos do bridge sem janela: enquadramento centrado, snap alfa, preservação dos pinos ao reconstruir a malha, desfazer, presets editáveis, exclusão de overlays da exportação e gravação com limite de quatro segundos e pose final íntegra.
