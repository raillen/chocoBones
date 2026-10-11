# Trilhas por Elemento, Canais e Linha do Tempo

A linha do tempo do ChocoBones abandona a dependência exclusiva de snapshots de pose global em favor de um sistema de canais e trilhas desacopladas.

## 1. Identificadores de Canais

Uma chave de animação pode afetar um canal específico ou a pose completa:
* `joint:<id>`: Afeta rotação ($\theta$) e translação relativa da junta indicada.
* `layer:<id>`: Afeta transformações da camada (posição, rotação, escala, opacidade, visibilidade ou troca de sprite).
* `pin:<id>`: Afeta o deslocamento $(dx, dy)$ de um pino específico da malha.

## 2. Estrutura de Clipes e Keyframes

```odin
package animation

import "../core"

Keyframe :: struct {
    id:       string,
    time:     f32, // Tempo em segundos
    easing:   EasingMode, // LINEAR, SMOOTH, HOLD, BEZIER
    bezier:   [4]f32,     // [x1, y1, x2, y2]
    channels: []string,   // Canais afetados (vazio = pose completa)
    // Dados da pose neste instante
}

Clip :: struct {
    id:       string,
    name:     string,
    duration: f32,
    fps:      f32,
    loop:     bool,
    frames:   [dynamic]Keyframe,
}
```

## 3. Compilação e Amostragem de Trilhas

Durante a reprodução, o motor compila e armazena em cache o mapa de trilhas ordenadas por tempo:
* Para qualquer instante $t \in [0, \text{duration}]$, o motor localiza o intervalo $[K_a, K_b]$ onde $K_a.time \le t < K_b.time$.
* O fator de progresso normalizado é calculado como:
$$u = \frac{t - K_a.time}{\max(0.0001, K_b.time - K_a.time)}$$
* O progresso $u$ é modulado pela curva de atenuação (`easing`) de $K_a$:
  * **Linear:** $t_{norm} = u$
  * **Smooth:** $t_{norm} = u^2 (3 - 2u)$
  * **Hold:** $t_{norm} = 0$ (mantém o valor de $K_a$ até atingir exatamente $K_b$)
  * **Bézier:** Resolvido numericamente via curva cúbica.

## 4. Modo Auto-Key

Quando ativado, qualquer manipulação direta no palco (arraste de junta, rotação de peça ou ajuste de pino) insere ou substitui keyframes exclusivamente nos canais dos elementos modificados no tempo atual do cursor (`playhead`).
