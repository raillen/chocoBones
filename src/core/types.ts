/**
 * chocoBones TypeScript Core Types
 * Contratos geométricos e transformações afins fundamentais.
 */

export type Vec2 = [number, number];

export interface Mat2x3 {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export const MAT_IDENTITY: Readonly<Mat2x3> = Object.freeze({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0,
});

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Transform {
  pos: Vec2;
  rotation: number;
  scale: Vec2;
  pivot: Vec2;
}

export const TRANSFORM_DEFAULT: Readonly<Transform> = Object.freeze({
  pos: [0, 0] as Vec2,
  rotation: 0,
  scale: [1, 1] as Vec2,
  pivot: [0, 0] as Vec2,
});

export interface SeamMask {
  layer: string;
  enabled: boolean;
  center: Vec2;
  radius: number;
  feather: number;
}
