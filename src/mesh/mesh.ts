/**
 * chocoBones TypeScript 2D Mesh & Moving Least Squares (MLS) Deformation
 * Implementa malhas poligonais 2D e deformação de pele rígida/afim baseada em pinos MLS.
 */

import { lerp, vec2Dist } from "../core/math";
import { Mat2x3, Vec2 } from "../core/types";
import { layerMatrix } from "../rig/fk";
import { Joint, Layer, Pose } from "../rig/joint";

export interface Pin {
  id: string;
  name: string;
  x: number;
  y: number;
  locked: boolean;
}

export interface Influence {
  joint: string;
  weight: number;
}

export enum MeshMode {
  Pins = "Pins",
  Skin = "Skin",
}

export enum SkinningMode {
  Linear = "Linear",
  DualQuaternion = "DualQuaternion",
}

export interface Mesh {
  density: number;
  vertices: Vec2[];
  triangles: [number, number, number][];
  weights: Influence[][];
  erased: number[];
  mode: MeshMode;
  skinning: SkinningMode;
  strength: number;
}

export function buildGridMesh(width: number, height: number, density: number): Mesh {
  let n = density;
  if (n < 2) n = 2;
  if (n > 24) n = 24;

  const vertices: Vec2[] = [];
  const triangles: [number, number, number][] = [];
  const weights: Influence[][] = [];

  for (let y = 0; y <= n; y++) {
    for (let x = 0; x <= n; x++) {
      const vx = (x * width) / n;
      const vy = (y * height) / n;
      vertices.push([vx, vy]);
      weights.push([]);
    }
  }

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const a = y * (n + 1) + x;
      const b = a + 1;
      const c = a + (n + 1);
      const d = c + 1;
      triangles.push([a, b, d]);
      triangles.push([a, d, c]);
    }
  }

  return {
    density: n,
    vertices,
    triangles,
    weights,
    erased: [],
    mode: MeshMode.Pins,
    skinning: SkinningMode.Linear,
    strength: 1.0,
  };
}

interface MLSSample {
  p: Vec2;
  q: Vec2;
  w: number;
}

/**
 * Deforma um vértice utilizando o algoritmo Moving Least Squares (MLS) rígido.
 * Minimiza distorções de cisalhamento, preservando a área e o formato local.
 */
export function warpPoint(
  vertex: Vec2,
  pins: readonly Pin[],
  pinDeltas?: Map<string, Vec2> | null,
  strength = 1.0
): Vec2 {
  if (pins.length === 0) return vertex;

  const samples: MLSSample[] = [];
  let totalWeight = 0;
  let px = 0;
  let py = 0;
  let qx = 0;
  let qy = 0;

  for (const pin of pins) {
    let delta: Vec2 = [0, 0];
    if (!pin.locked && pinDeltas) {
      const d = pinDeltas.get(pin.id);
      if (d) delta = d;
    }

    const pinPos: Vec2 = [pin.x, pin.y];
    const dist = vec2Dist(vertex, pinPos);
    let distSq = dist * dist;
    if (distSq < 0.001) distSq = 0.001;

    // Peso com decaimento inverso quadrático
    const w = 1.0 / (distSq * distSq);
    const q: Vec2 = [pin.x + delta[0], pin.y + delta[1]];

    samples.push({ p: pinPos, q, w });

    totalWeight += w;
    px += w * pinPos[0];
    py += w * pinPos[1];
    qx += w * q[0];
    qy += w * q[1];
  }

  if (totalWeight < 1e-9) return vertex;

  px /= totalWeight;
  py /= totalWeight;
  qx /= totalWeight;
  qy /= totalWeight;

  let cosSum = 0;
  let sinSum = 0;

  for (const s of samples) {
    const ax = s.p[0] - px;
    const ay = s.p[1] - py;
    const bx = s.q[0] - qx;
    const by = s.q[1] - qy;

    cosSum += s.w * (ax * bx + ay * by);
    sinSum += s.w * (ax * by - ay * bx);
  }

  const lenRot = Math.sqrt(cosSum * cosSum + sinSum * sinSum);
  if (lenRot < 1e-9) {
    return [vertex[0] + qx - px, vertex[1] + qy - py];
  }

  const cosVal = cosSum / lenRot;
  const sinVal = sinSum / lenRot;

  const vx = vertex[0] - px;
  const vy = vertex[1] - py;

  const targetX = qx + vx * cosVal - vy * sinVal;
  const targetY = qy + vx * sinVal + vy * cosVal;

  return [
    lerp(vertex[0], targetX, strength),
    lerp(vertex[1], targetY, strength),
  ];
}

export function meshWorld(
  mesh: Mesh,
  pins: readonly Pin[],
  pinDeltas: Map<string, Vec2> | null,
  layer: Layer,
  joints: readonly Joint[],
  pose: Pose | null,
  bones: Map<string, Mat2x3>
): Vec2[] {
  const lMat = layerMatrix(layer, joints, pose, bones);
  const outVertices: Vec2[] = [];

  for (const v of mesh.vertices) {
    const warped = warpPoint(v, pins, pinDeltas, mesh.strength);
    // Aplica matriz da camada sobre o vértice deformado
    const wx = lMat.a * warped[0] + lMat.c * warped[1] + lMat.tx;
    const wy = lMat.b * warped[0] + lMat.d * warped[1] + lMat.ty;
    outVertices.push([wx, wy]);
  }

  return outVertices;
}
