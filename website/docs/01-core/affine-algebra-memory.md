# Álgebra Afim 2D e Arenas de Memória

A fundamentação matemática do ChocoBones baseia-se em geometria afim bidimensional direta.

## 1. Tipos Primitivos em Odin

As transformações utilizam matrizes 2x3 (representando a forma canônica 3x3 onde a terceira linha é sempre $[0, 0, 1]$):

```odin
package core

Vec2 :: [2]f32

// Matriz Afim 2D: [a, b, c, d, tx, ty]
// Corresponde a:
// | a   c   tx |
// | b   d   ty |
// | 0   0   1  |
Mat2x3 :: struct {
    a, b, c, d: f32,
    tx, ty:     f32,
}

MAT_IDENTITY :: Mat2x3{1, 0, 0, 1, 0, 0}
```

## 2. Operações de Matriz

* **Multiplicação:**
```odin
mat_mul :: proc(m1, m2: Mat2x3) -> Mat2x3 {
    return {
        a  = m1.a * m2.a + m1.c * m2.b,
        b  = m1.b * m2.a + m1.d * m2.b,
        c  = m1.a * m2.c + m1.c * m2.d,
        d  = m1.b * m2.c + m1.d * m2.d,
        tx = m1.a * m2.tx + m1.c * m2.ty + m1.tx,
        ty = m1.b * m2.tx + m1.d * m2.ty + m1.ty,
    }
}
```

* **Inversão Analítica:**
O determinante é $D = ad - bc$. Se $|D| < 10^{-10}$, retorna a matriz identidade.
```odin
mat_inverse :: proc(m: Mat2x3) -> Mat2x3 {
    det := m.a * m.d - m.b * m.c
    if abs(det) < 1e-10 do return MAT_IDENTITY
    inv_det := 1.0 / det
    return {
        a  =  m.d * inv_det,
        b  = -m.b * inv_det,
        c  = -m.c * inv_det,
        d  =  m.a * inv_det,
        tx = (m.c * m.ty - m.d * m.tx) * inv_det,
        ty = (m.b * m.tx - m.a * m.ty) * inv_det,
    }
}
```

* **Transformação de Ponto:**
```odin
mat_apply :: proc(m: Mat2x3, p: Vec2) -> Vec2 {
    return {
        m.a * p.x + m.c * p.y + m.tx,
        m.b * p.x + m.d * p.y + m.ty,
    }
}
```

## 3. Estratégia de Arenas de Memória

Para evitar pressão sobre o heap do sistema operacional, toda a computação dinâmica do quadro ocorre em um alocador scratch (`Arena`):

```odin
ScratchContext :: struct {
    arena: mem.Arena,
    allocator: mem.Allocator,
}

scratch_init :: proc(ctx: ^ScratchContext, size: int) {
    buffer := make([]byte, size)
    mem.arena_init(&ctx.arena, buffer)
    ctx.allocator = mem.arena_allocator(&ctx.arena)
}

scratch_reset :: proc(ctx: ^ScratchContext) {
    mem.arena_free_all(&ctx.arena)
}
```

Vértices transformados por malha, buffers transitórios de interpolação e listas temporárias de triângulos utilizam exclusivamente o `ctx.allocator`.
