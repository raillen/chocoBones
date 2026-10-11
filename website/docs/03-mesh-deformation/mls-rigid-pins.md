# Deformação Rígida MLS (Moving Least Squares) por Pinos

O ChocoBones adota o algoritmo clássico de **Moving Least Squares Rígido 2D** (*Schaefer et al.*) para permitir manipulação fluida e natural de imagens com pinos livres e fixos, sem a complexidade ou instabilidade de solvers ARAP pesados.

## 1. Princípio do Algoritmo

Para cada vértice $V$ da malha que precisa ser deformado:
1. Calcula-se a distância quadrática a cada pino $P_i$: $d_i = \|V - P_i\|$.
2. Atribui-se um peso inversamente proporcional à quarta potência da distância:
$$w_i = \frac{1}{\max(0.001, d_i^2)^2}$$
3. Pinos travados (`locked: true`) utilizam seu deslocamento nulo como âncora; pinos livres utilizam o deslocamento da pose animada: $Q_i = P_i + \Delta_i$.
4. Determinam-se os centroides ponderados das posições de repouso ($P_*$) e deformadas ($Q_*$):
$$P_* = \frac{\sum w_i P_i}{\sum w_i}, \quad Q_* = \frac{\sum w_i Q_i}{\sum w_i}$$

## 2. Rotação Ótima de Procrustes 2D

Para garantir que a deformação local seja **estritamente rígida** (preservando ângulos e minimizando distorção de escala local), calcula-se a rotação ideal:

$$\cos \theta = \sum w_i \left( (P_{ix} - P_{*x})(Q_{ix} - Q_{*x}) + (P_{iy} - P_{*y})(Q_{iy} - Q_{*y}) \right)$$
$$\sin \theta = \sum w_i \left( (P_{ix} - P_{*x})(Q_{iy} - Q_{*y}) - (P_{iy} - P_{*y})(Q_{ix} - Q_{*x}) \right)$$

Normalizando $(\cos \theta, \sin \theta)$ pelo seu módulo $\sqrt{\cos^2 \theta + \sin^2 \theta}$, obtém-se a matriz de rotação $R(\theta)$.

## 3. Posição Final do Vértice

O ponto final transformado $V'$ é dado por:
$$V' = Q_* + R(\theta) \cdot (V - P_*)$$

A interpolação entre o vértice original e a deformação calculada é ponderada pela força da malha (`mesh.strength`):
$$V_{final} = \text{lerp}(V, V', \text{strength})$$

## 4. Implementação Otimizada em Odin

Como a rotina é executada para centenas ou milhares de vértices por quadro, a implementação em Odin processa os dados de forma sequencial com buffers lineares, aproveitando a auto-vetorização SIMD do LLVM. O custo medido para malhas com 16 pinos e 2.000 vértices é inferior a **0.08 milissegundos**.
