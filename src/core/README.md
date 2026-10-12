# Subsistema Core (`src/core`)

Fornece os tipos fundamentais, primitivas matemáticas 2D/3D e utilitários geométricos do **chocoBones**.

## Componentes

* [`types.ts`](types.ts): Definições de `Vec2`, `Mat2x3`, `Rect`, `Transform` e `SeamMask`.
* [`math.ts`](math.ts): Álgebra afim 2D, multiplicação matricial, inversão de matrizes, interpolações e solucionador de curvas de Bézier cúbicas via busca binária.
* [`math3d.ts`](math3d.ts): Álgebra linear 3D, matrizes 4x4, projeções em perspectiva, visão `LookAt` e `OrbitCamera` para manipulação de palco tridimensional.

## Padrões de Projeto

- Tipagem estrita com TypeScript, sem `any`.
- Imutabilidade em constantes fundamentais (`MAT_IDENTITY`, `MAT4_IDENTITY`).
- Precisão numérica e proteção contra singularidades e divisões por zero.
