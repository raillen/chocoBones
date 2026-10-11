# Triangulação de Grade e Corte de Malha

Para permitir deformação por pinos e skinning suave, camadas de sprites podem ser convertidas em malhas trianguladas 2D.

## 1. Geração de Grade Regular

Dada uma imagem com largura $W$, altura $H$ e densidade $N$ ($2 \le N \le 24$ divisões):
* Gera-se $(N + 1) \times (N + 1)$ vértices posicionados uniformemente:
$$V(x, y) = \left( \frac{x \cdot W}{N}, \frac{y \cdot H}{N} \right)$$
* Para cada quadrilátero de células $(x, y)$, geram-se dois triângulos com índices no sentido horário:
  * Triângulo 1: $[A, B, D]$
  * Triângulo 2: $[A, D, C]$
  onde $A = y(N+1) + x$, $B = A + 1$, $C = A + N + 1$ e $D = C + 1$.

```odin
package mesh

import "../core"

Mesh :: struct {
    density:   int,
    vertices:  [dynamic]core.Vec2,
    triangles: [dynamic][3]u32,
    uvs:       [dynamic]core.Vec2,
    erased:    [dynamic]u32, // Índices de triângulos excluídos
}
```

## 2. Coordenadas UV Normalizadas

Cada vértice $V_i = (x, y)$ mapeia diretamente para $UV_i = (x / W, y / H)$, correspondendo perfeitamente à textura do sprite sem distorção inicial.

## 3. Corte de Malha (Mesh Erase)

Para roupas furadas, decotes, aberturas de mangas ou silhuetas complexas onde triângulos da grade caem em regiões transparentes indesejadas:
* O editor permite selecionar triângulos com a ferramenta de borracha de malha.
* Os triângulos marcados são adicionados à lista `erased`.
* O renderizador ignora qualquer índice contido em `erased`, evitando desenho desnecessário de polígonos invisíveis e economizando fill-rate na GPU.
