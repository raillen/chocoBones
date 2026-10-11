# Máscaras de Emenda e Junções Anatômicas (Seam Masks)

Um dos maiores desafios em animação 2D recortada (cutout) é a transição entre membros sobrepostos: o ombro com o tronco, a coxa com a cintura ou o antebraço com a manga. Se os recortes forem rígidos, surgem linhas duras ou aberturas visíveis.

## 1. O Problema das Emendas 2D

No estilo tradicional, artistas são forçados a criar tampas arredondadas artificiais nas juntas ou dividir o braço em partes isoladas. Quando o membro se dobra, essas tampas vazam ou produzem descontinuidades visíveis.

O ChocoBones resolve isso através do recurso de **Máscaras de Emenda (Seam Masks)** dinâmicas calculadas por quadro.

## 2. Parâmetros da Máscara

Cada camada pode declarar uma configuração `SeamMask`:
* `layer`: ID da camada de cobertura sobreposta (ex: a manga cobrindo o braço, ou o tronco cobrindo a coxa).
* `center`: Ponto central local da inserção articular.
* `radius`: Raio de influência em pixels da camada.
* `feather`: Suavidade do gradiente de desfoque/dissolvência.

## 3. Pipeline de Rasterização com FBOs

Durante o desenho de cada quadro:
1. Renderiza-se a geometria da camada em um Framebuffer Object (FBO) offscreen (`seam-art`).
2. Renderiza-se a camada de cobertura correspondente em um segundo FBO (`seam-cover`) com a opacidade corrente.
3. Aplica-se uma máscara de gradiente radial com raio e feather configurados sobre o `seam-cover`.
4. Combina-se o buffer da máscara com o buffer da arte usando operações de corte (`GL_DST_OUT` ou blending personalizado de shader).
5. O resultado mesclado é composto na cena principal.

Isso garante que, mesmo quando a mão ou o antebraço cruza pela frente do tórax, a silhueta continue intacta e apenas a inserção anatômica original na junta permaneça suavemente integrada.
