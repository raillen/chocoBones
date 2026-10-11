# Sobrevivente vetorial modular

Arte original de teste em SVG, com linguagem visual de sobrevivência e exploração sci-fi: contorno carvão, sombras sólidas, oliva, areia, ferrugem e teal. Não contém sprites extraídos de CryoFall.

São **15 peças do humano** e **6 overlays**: mochila, capacete, visor, colete, tronco de parka polar e carabina. As fontes são caminhos vetoriais reais; os sheets PNG artísticos do diretório pai são outro conjunto de imagens e não substituem estas fontes editáveis.

## Uso

- `svg/`: cada peça independente, com fundo transparente e canvas **512 × 768**.
- `png/`: rasterizações RGBA das mesmas peças no mesmo canvas, sem recorte.
- `manifest.json`: IDs, hierarquia sugerida, ordem `z`, pivôs e articulações em pixels globais. `l/r` são os lados anatômicos: `l` aparece à direita da imagem.
- Empilhe as peças na origem `(0, 0)`, por `z` crescente. Gire cada peça em seu pivô; as juntas foram desenhadas com sobreposição. Se recortar o PNG, subtraia o deslocamento do recorte do pivô.
- `base-survivor.*`: humano base; `assembled-survivor.*`: mochila e colete; `equipped-survivor.*`: capacete, visor e carabina adicionais.
- Abra [`rig-preview.html`](rig-preview.html) no navegador para comparar base/equipado/parka, iniciar um balanço de marcha, ajustar zoom, fundo e pivôs. É autossuficiente e funciona por `file://`: manifest e fontes SVG estão embutidos, sem rede ou dependências externas. As matrizes respeitam a hierarquia de peças e a montagem conserva a ordem global de camadas.
- A parka substitui o tronco base. Use sem o colete; ela é um overlay apenas do tronco, sem mangas de inverno.

As partes de corpo são `head`, `torso`, `pelvis`, `upper_arm_l/r`, `forearm_l/r`, `hand_l/r`, `thigh_l/r`, `shin_l/r` e `foot_l/r`. A mochila e o colete são visíveis na composição padrão; os demais acessórios são opcionais.

## Regenerar

```sh
node assets/test-kits/frontier-survival/vector-rig/build.mjs
node assets/test-kits/frontier-survival/vector-rig/build.mjs --png
```

A primeira opção requer Node.js e regenera SVG/manifest. A segunda também requer `rsvg-convert` para os PNGs. `build.mjs` contém toda a geometria original e a paleta.
Ambas também regeneram `rig-preview.html` a partir de `preview-template.html` e `build-preview.mjs`. Para atualizar somente o demonstrador, rode `node assets/test-kits/frontier-survival/vector-rig/build-preview.mjs`.

Este pacote está preparado como material de teste independente. Não foi importado pela interface do chocoBones nem validado no rig nativo do aplicativo. Os previews PNG/SVG são poses estáticas; o HTML oferece movimento simples de recorte para inspeção e não é um ciclo completo de caminhada para jogo.
