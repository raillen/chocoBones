# Curvas Bézier Cúbicas e Trajetórias de Movimento

Controle fino de aceleração, desaceleração e trajetórias espaciais no ChocoBones.

## 1. Avaliação de Curvas Bézier Cúbicas 1D

As transições personalizadas utilizam curvas Bézier cúbicas padronizadas com pontos de controle $(0, 0)$, $(x_1, y_1)$, $(x_2, y_2)$ e $(1, 1)$, idênticas à especificação de CSS timing functions.

A função paramétrica é definida como:
$$B(u, p_1, p_2) = 3(1-u)^2 u p_1 + 3(1-u) u^2 p_2 + u^3$$

Dado o tempo normalizado $t \in [0, 1]$, queremos encontrar $u$ tal que $X(u) = t$, e então calcular $Y(u)$ como o valor interpolado.

### Resolução Numérica por Busca Binária
Como $X(u)$ é monotonicamente crescente no intervalo $[0, 1]$, utiliza-se uma busca binária de 18 iterações para encontrar a raiz $u$:

```odin
bezier_solve :: proc(t: f32, x1, y1, x2, y2: f32) -> f32 {
    cubic :: proc(u, a, b: f32) -> f32 {
        return 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u
    }
    
    lo: f32 = 0.0
    hi: f32 = 1.0
    for _ in 0..<18 {
        mid := (lo + hi) * 0.5
        if cubic(mid, x1, x2) < t {
            lo = mid
        } else {
            hi = mid
        }
    }
    return cubic((lo + hi) * 0.5, y1, y2)
}
```
Essa rotina executa em nanossegundos e garante precisão superior a $10^{-5}$.

## 2. Trajetórias Espaciais de Pinos (Motion Paths)

Além da linha do tempo tradicional, o ChocoBones permite capturar a trajetória espacial $(x, y)$ de um pino durante um clipe e aplicá-la como modelo de animação reutilizável.
* A trajetória armazena uma lista de amostras temporalmente distribuídas.
* Pode ser redimensionada no espaço (escala espacial) e no tempo (tempo de execução).
* Ao ser aplicada, gera keyframes lineares com a trajetória preservada, permitindo criar efeitos de respiração, ricochete ou impacto físico em novos clipes sem reautoração manual.
