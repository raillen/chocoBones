/**
 * chocoBones TypeScript Core 2D Math
 * Operações com matrizes afins 2x3, vetores 2D e curvas de Bézier.
 */

import { Mat2x3, MAT_IDENTITY, Vec2 } from "./types";

export function translate(x: number, y: number): Mat2x3 {
  return {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    tx: x,
    ty: y,
  };
}

export function rotate(angleRad: number): Mat2x3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return {
    a: c,
    b: s,
    c: -s,
    d: c,
    tx: 0,
    ty: 0,
  };
}

export function scale(sx: number, sy: number): Mat2x3 {
  return {
    a: sx,
    b: 0,
    c: 0,
    d: sy,
    tx: 0,
    ty: 0,
  };
}

export function matMul(m1: Mat2x3, m2: Mat2x3): Mat2x3 {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    tx: m1.a * m2.tx + m1.c * m2.ty + m1.tx,
    ty: m1.b * m2.tx + m1.d * m2.ty + m1.ty,
  };
}

export function matInverse(m: Mat2x3): Mat2x3 {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-10) {
    return { ...MAT_IDENTITY };
  }
  const invDet = 1.0 / det;
  return {
    a: m.d * invDet,
    b: -m.b * invDet,
    c: -m.c * invDet,
    d: m.a * invDet,
    tx: (m.c * m.ty - m.d * m.tx) * invDet,
    ty: (m.b * m.tx - m.a * m.ty) * invDet,
  };
}

export function matApply(m: Mat2x3, p: Vec2): Vec2 {
  return [
    m.a * p[0] + m.c * p[1] + m.tx,
    m.b * p[0] + m.d * p[1] + m.ty,
  ];
}

export function vec2Dist(a: Vec2, b: Vec2): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function vec2Length(v: Vec2): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1]);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
  ];
}

export function clamp(val: number, minVal: number, maxVal: number): number {
  if (val < minVal) return minVal;
  if (val > maxVal) return maxVal;
  return val;
}

/**
 * Resolve valor Y correspondente ao tempo T [0, 1] em uma curva cúbica de Bézier
 * utilizando busca binária / bisseção numérica de alta precisão.
 */
export function bezierSolve(t: number, x1: number, y1: number, x2: number, y2: number): number {
  const cubic = (u: number, a: number, b: number): number => {
    return 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
  };

  let lo = 0.0;
  let hi = 1.0;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) * 0.5;
    if (cubic(mid, x1, x2) < t) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return cubic((lo + hi) * 0.5, y1, y2);
}

export function pointInTriangle(p: Vec2, a: Vec2, b: Vec2, c: Vec2): boolean {
  const sign = (x: Vec2, y: Vec2, z: Vec2): number => {
    return (x[0] - z[0]) * (y[1] - z[1]) - (y[0] - z[0]) * (x[1] - z[1]);
  };

  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);

  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

  return !(hasNeg && hasPos);
}
