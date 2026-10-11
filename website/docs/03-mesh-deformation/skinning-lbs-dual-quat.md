# Linear Blend Skinning (LBS) e Dual Quaternions 2D

Quando uma malha é associada ao esqueleto, os vértices dobram sob a influência ponderada de múltiplas juntas.

## 1. Pesos por Vértice e Auto-Binding

Cada vértice $V_k$ pode ser influenciado por até 3 juntas. Os pesos $w_{kj}$ são normalizados para que $\sum_j w_{kj} = 1.0$.

### Auto-Binding por Segmento de Osso
O algoritmo de vinculação inicial calcula a distância entre o vértice no espaço global e o segmento linear formado pelo osso (da junta $J$ até a junta filha mais próxima $J_{child}$):
$$score(J) = \frac{1}{\max(4.0, \text{dist}(V, \text{segment}(J, J_{child})))^4}$$
Os 3 maiores scores são selecionados e normalizados.

## 2. Linear Blend Skinning (LBS)

No modo linear clássico, a posição transformada do vértice no espaço do mundo é a média ponderada das matrizes dos ossos atuando sobre o vértice na pose de repouso:

$$V_{world} = \sum_{j} w_j \cdot (M_j \cdot V_{rest})$$

*Vantagem:* Cálculo imediato e previsível.
*Limitação:* Em dobras extremas (> 90°), o LBS sofre de perda de volume (efeito *candy-wrapper* ou afinamento de cotovelo).

## 3. Preservação de Volume via Dual Quaternions 2D

Para eliminar o colapso de articulações em membros contínuos (como braços e pernas de peça única na demonstração de seis peças), o ChocoBones implementa **Dual Quaternions Planares 2D**.

Uma transformação afim rígida 2D com rotação $\theta$ e translação $(tx, ty)$ é expressa como um dual quaternion planar:
* Parte Real: $q_{real} = (\cos(\theta / 2), 0, 0, \sin(\theta / 2))$
* Parte Dual: $q_{dual} = \frac{1}{2} (0, tx \cos(\theta/2) + ty \sin(\theta/2), ty \cos(\theta/2) - tx \sin(\theta/2), 0)$

A mistura ponderada normaliza as partes ortogonais, garantindo que o movimento rotacional intermediário preserve rigorosamente a espessura do membro, eliminando qualquer afinamento não intencional durante a flexão da articulação.
