# Frontier Survival — kit de teste

Sprites originais de sobrevivência e exploração sci-fi, inspirados na temática e leitura visual de [CryoFall, referência oficial](https://press.atomictorch.com/cryofall.html). Não são sprites extraídos do jogo.

- `sheets/`: três folhas PNG transparentes; a disposição nominal é 3 × 2 para humanos/animais e 6 × 4 para roupas/equipamentos. As grades servem para identificar itens; não são limites de recorte.
- `png/`: 36 sprites inteiros isolados mecanicamente por componentes alpha, com padding transparente de 4 px; sem redimensionar ou alterar seus pixels visíveis.
- `manifest.json`: IDs, categorias, retângulos de origem, dimensões, bounding boxes, transparência e sugestões de pontos de anexo **sem calibração**.
- `index.html`: catálogo local com busca, filtros e fundos claro/escuro/quadriculado. Abra no navegador; os dados estão embutidos e não dependem de servidor ou `fetch`.
- `previews/contact-sheet.png`: prancha de comparação; apenas essa prévia reduz os sprites para exibição.
- `prompts.json`: instruções de geração das folhas originais.
- `vector-rig/`: humano modular com fontes SVG reais, partes separadas, PNGs correspondentes, manifesto próprio e [demonstração local de pose/marcha](vector-rig/rig-preview.html). Veja o [guia vetorial](vector-rig/README.md).

**PNG com aparência vetorial não é SVG editável.** Os sheets raster e o humano modular são conjuntos distintos. Humanos/animais inteiros servem como referência de escala e composição; as peças SVG servem para testes de cutout/rig. As roupas raster não estão automaticamente alinhadas ao humano vetorial.

## Empacotar

Depois de salvar os três sheets em `sheets/humans.png`, `sheets/animals.png` e `sheets/wardrobe-equipment.png`, execute na raiz do repositório:

```sh
node assets/test-kits/frontier-survival/tools/package-kit.mjs
```

Requer Node.js e `sharp` (o script localiza o runtime empacotado do Codex; fora dele, instale `sharp` ou defina `CHOCOBONES_SHARP_PATH`). O comando exige alpha real, rotula núcleos com alpha >= 16 e conectividade 8, identifica os principais com área > 200 e atribui **todos os pixels com alpha > 0** ao pixel de núcleo mais próximo por distância euclidiana. Esse limiar separa os halos quase invisíveis que conectam itens vizinhos, sem alterar ou descartar pixels. Cada PNG é comparado byte a byte com a cópia RGBA original. Pares de botas/luvas são agrupados num item. Retângulos de origem podem se sobrepor, pois os pixels de cada sprite são isolados antes do recorte. Nunca remove fundos, altera cores ou completa arte cortada.

O comando recusa itens vazios ou arte com alpha >= 16 tocando a borda da própria folha. Halos abaixo desse limiar nas bordas são preservados e registrados no manifesto. Se objetos vizinhos estiverem unidos no núcleo, revise/regere a fonte. Para corrigir apenas a associação de núcleos separados, use `--assign caminho.json`, com formato `{"animals":{"1":"wolf"}}`; os IDs dos núcleos principais ficam no manifesto. A revisão visual das associações continua necessária.

As coordenadas começam no canto superior esquerdo, com X para a direita e Y para baixo. `nontransparent_bbox` cobre todos os pixels alpha > 0; `visible_bbox_alpha16` orienta escala, âncoras sugeridas e enquadramento no catálogo sem modificar o PNG. As âncoras usam pixels locais; o centro inferior da arte é apenas sugestão de solo para sprites inteiros. Pivôs anatômicos e empunhaduras precisam de ajuste manual. Para fontes SVG, siga o canvas e os pivôs do manifesto vetorial.

O kit não altera o aplicativo. O editor nativo ainda não carrega as imagens próprias de `assets` ao abrir `.puppet.json`; importação e animação deste material no chocoBones não foram validadas.
