/**
 * chocoBones TypeScript 2D Mesh & Moving Least Squares (MLS) Deformation
 * Implementa malhas poligonais 2D e deformação de pele rígida/afim baseada em pinos MLS.
 */

import { lerp, vec2Dist } from "../core/math";
import { Mat2x3, Vec2 } from "../core/types";
import { layerMatrix } from "../rig/fk";
import { Joint, Layer, Pose } from "../rig/joint";

export type PinAnchorMode = "free" | "joint" | "world";

export interface Pin {
  id: string;
  name: string;
  meshId?: string;
  x: number; // rest position (Setup)
  y: number;
  locked: boolean;
  enabled?: boolean;
  anchorMode?: PinAnchorMode;
  anchorJoint?: string; // joint id quando anchorMode === "joint"
  radius?: number; // raio de influência (0 = infinito)
  falloff?: number; // expoente de queda
  strength?: number; // 0..1 por pino
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
 * Respeita enabled/locked/radius/falloff/strength por pino (P0-1).
 */
export function warpPoint(
  vertex: Vec2,
  pins: readonly Pin[],
  pinDeltas?: Map<string, Vec2> | null,
  strength = 1.0
): Vec2 {
  const samples: MLSSample[] = [];
  let totalWeight = 0;
  let px = 0;
  let py = 0;
  let qx = 0;
  let qy = 0;

  for (const pin of pins) {
    if (pin.enabled === false) continue;
    let delta: Vec2 = [0, 0];
    if (!pin.locked && pinDeltas) {
      const d = pinDeltas.get(pin.id);
      if (d) delta = d;
    }
    // Pino travado e sem delta: âncora pura (participa como fixo)
    const pinPos: Vec2 = [pin.x, pin.y];
    const dist = vec2Dist(vertex, pinPos);
    const radius = pin.radius ?? 0;
    if (radius > 0 && dist > radius) continue;
    let distSq = dist * dist;
    if (distSq < 0.001) distSq = 0.001;

    // Peso com decaimento configurável por pino (padrão ~1/d^4)
    const fall = (pin.falloff ?? 2.0) > 0 ? (pin.falloff ?? 2.0) : 2.0;
    const wBase = 1.0 / Math.pow(distSq, fall / 2);
    const w = wBase * ((pin.strength ?? 1) >= 0 ? (pin.strength ?? 1) : 1);
    const q: Vec2 = [pin.x + delta[0], pin.y + delta[1]];

    samples.push({ p: pinPos, q, w });

    totalWeight += w;
    px += w * pinPos[0];
    py += w * pinPos[1];
    qx += w * q[0];
    qy += w * q[1];
  }

  if (samples.length === 0 || totalWeight < 1e-9) return vertex;

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
  // P0-2: deslocamentos efetivos vêm de pose.pins quando pinDeltas omitido
  const deltas = pinDeltas ?? pose?.pins ?? null;
  const outVertices: Vec2[] = [];

  for (const v of mesh.vertices) {
    const warped = warpPoint(v, pins, deltas, mesh.strength);
    // Aplica matriz da camada sobre o vértice deformado
    const wx = lMat.a * warped[0] + lMat.c * warped[1] + lMat.tx;
    const wy = lMat.b * warped[0] + lMat.d * warped[1] + lMat.ty;
    outVertices.push([wx, wy]);
  }

  return outVertices;
}

// ---------------------------------------------------------------------------
// P0-1 — Puppet points Setup/Animate
// ---------------------------------------------------------------------------

export function createPin(
  id: string,
  meshId: string,
  x: number,
  y: number,
  opts: Partial<Pick<Pin, "name" | "locked" | "enabled" | "anchorMode" | "anchorJoint" | "radius" | "falloff" | "strength">> = {}
): Pin {
  return {
    id,
    name: opts.name ?? id,
    meshId,
    x,
    y,
    locked: opts.locked ?? false,
    enabled: opts.enabled ?? true,
    anchorMode: opts.anchorMode ?? "free",
    anchorJoint: opts.anchorJoint ?? "",
    radius: opts.radius ?? 0,
    falloff: opts.falloff ?? 2.0,
    strength: opts.strength ?? 1.0,
  };
}

/** Setup: mover pin muda apenas restPosition; não gera keyframe. */
export function movePinRest(pins: Pin[], id: string, x: number, y: number): boolean {
  const p = pins.find((e) => e.id === id);
  if (!p) return false;
  p.x = x;
  p.y = y;
  return true;
}

/** Animate: mover pin gera apenas offset relativo ao rest, por clip/tempo. */
export function movePinOffset(pose: Pose, id: string, dx: number, dy: number): void {
  const cur = pose.pins.get(id) ?? [0, 0];
  pose.pins.set(id, [cur[0] + dx, cur[1] + dy]);
}

/** Define offset absoluto (scrub/bake). */
export function setPinOffset(pose: Pose, id: string, dx: number, dy: number): void {
  pose.pins.set(id, [dx, dy]);
}

/** Reseta offset animado sem tocar rest. */
export function resetPinOffset(pose: Pose, id: string): void {
  pose.pins.delete(id);
}

// ---------------------------------------------------------------------------
// Item 6 — Alpha-hull, UV, auto-weights, weight-paint
// ---------------------------------------------------------------------------

/**
 * Gera malha justa a partir do canal alfa (alpha-hull por grade).
 * Rasteriza RGBA, mantém só quads com alfa médio acima do limiar.
 * Retorna malha + UVs em coordenadas da imagem [0..1].
 */
export function buildHullMeshFromRgba(
  imgWidth: number,
  imgHeight: number,
  rgba: Uint8ClampedArray | Uint8Array,
  cellSize = 16,
  alphaThreshold = 12
): { mesh: Mesh; uvs: Vec2[] } {
  const cols = Math.max(1, Math.ceil(imgWidth / cellSize));
  const rows = Math.max(1, Math.ceil(imgHeight / cellSize));
  const vertices: Vec2[] = [];
  const uvs: Vec2[] = [];
  const triangles: [number, number, number][] = [];
  const weights: Influence[][] = [];
  const indexOf = new Map<string, number>();

  const alphaAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= imgWidth || y >= imgHeight) return 0;
    return rgba[(y * imgWidth + x) * 4 + 3] ?? 0;
  };

  const vertIndex = (gx: number, gy: number): number => {
    const key = `${gx},${gy}`;
    const hit = indexOf.get(key);
    if (hit !== undefined) return hit;
    const vx = Math.min(imgWidth, gx * cellSize);
    const vy = Math.min(imgHeight, gy * cellSize);
    const idx = vertices.length;
    vertices.push([vx, vy]);
    uvs.push([vx / Math.max(1, imgWidth), vy / Math.max(1, imgHeight)]);
    weights.push([]);
    indexOf.set(key, idx);
    return idx;
  };

  const cellHasContent = (gx: number, gy: number): boolean => {
    // Amostra centro + 4 cantos para robustez
    const x0 = gx * cellSize;
    const y0 = gy * cellSize;
    const samples: Array<[number, number]> = [
      [x0 + cellSize / 2, y0 + cellSize / 2],
      [x0 + 1, y0 + 1],
      [x0 + cellSize - 1, y0 + 1],
      [x0 + 1, y0 + cellSize - 1],
      [x0 + cellSize - 1, y0 + cellSize - 1],
    ];
    let acc = 0;
    for (const [sx, sy] of samples) acc += alphaAt(Math.floor(sx), Math.floor(sy));
    return acc / samples.length >= alphaThreshold;
  };

  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      if (!cellHasContent(gx, gy)) continue; // descarta quads vazios
      const a = vertIndex(gx, gy);
      const b = vertIndex(gx + 1, gy);
      const c = vertIndex(gx, gy + 1);
      const d = vertIndex(gx + 1, gy + 1);
      triangles.push([a, b, d]);
      triangles.push([a, d, c]);
    }
  }

  const mesh: Mesh = {
    density: Math.max(2, Math.min(24, Math.max(cols, rows))),
    vertices,
    triangles,
    weights,
    erased: [],
    mode: MeshMode.Pins,
    skinning: SkinningMode.Linear,
    strength: 1.0,
  };
  return { mesh, uvs };
}

/** Calcula UVs [0..1] para malha de grade dado tamanho da imagem. */
export function computeGridUvs(mesh: Mesh, imgWidth: number, imgHeight: number): Vec2[] {
  return mesh.vertices.map(([x, y]) => [x / Math.max(1, imgWidth), y / Math.max(1, imgHeight)] as Vec2);
}

function distPointToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return vec2Dist(p, a);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return vec2Dist(p, [a[0] + dx * t, a[1] + dy * t]);
}

/**
 * Auto-skinning por distância inversa a segmentos ósseos.
 * Preenche mesh.weights com até maxInfluences por vértice, normalizados.
 * Preserva islands: vértices isolados mantêm influência única dominante.
 */
export function autoSkinToJoints(
  mesh: Mesh,
  joints: readonly { id: string; x: number; y: number; parent: string }[],
  falloff = 2.0,
  maxInfluences = 4
): void {
  const bones: Array<{ id: string; a: Vec2; b: Vec2 }> = [];
  const byId = new Map(joints.map((j) => [j.id, j]));
  for (const j of joints) {
    if (!j.parent) continue;
    const p = byId.get(j.parent);
    if (!p) continue;
    bones.push({ id: j.id, a: [p.x, p.y], b: [j.x, j.y] });
  }
  if (bones.length === 0) return;
  mesh.weights = mesh.vertices.map((v) => {
    const scored = bones.map((bn) => {
      const d = distPointToSegment(v, bn.a, bn.b);
      const w = 1 / Math.pow(d + 4, falloff);
      return { joint: bn.id, weight: w };
    });
    scored.sort((x, y) => y.weight - x.weight);
    const top = scored.slice(0, Math.max(1, maxInfluences));
    const sum = top.reduce((s, e) => s + e.weight, 0) || 1;
    return top.map((e) => ({ joint: e.joint, weight: e.weight / sum }));
  });
}

export type WeightPaintMode = "add" | "smooth" | "set";

/**
 * Pincel de pesos multimodo: add incrementa, set fixa, smooth relaxa por vizinhança.
 * Retorna nº de vértices afetados. Heatmap via weightToHeatColor().
 */
export function paintWeights(
  mesh: Mesh,
  jointId: string,
  center: Vec2,
  radius: number,
  value: number,
  mode: WeightPaintMode = "add"
): number {
  let affected = 0;
  // Adjacência por triângulos para smooth topológico
  const adj = new Map<number, Set<number>>();
  if (mode === "smooth") {
    for (const [a, b, c] of mesh.triangles) {
      for (const [u, v] of [[a, b], [b, c], [c, a]] as Array<[number, number]>) {
        if (!adj.has(u)) adj.set(u, new Set());
        if (!adj.has(v)) adj.set(v, new Set());
        adj.get(u)!.add(v);
        adj.get(v)!.add(u);
      }
    }
  }
  const weightOf = (vi: number): number => mesh.weights[vi]?.find((w) => w.joint === jointId)?.weight ?? 0;

  mesh.vertices.forEach((v, vi) => {
    const d = vec2Dist(v, center);
    if (d > radius) return;
    const fall = 1 - d / Math.max(1e-6, radius);
    if (!mesh.weights[vi]) mesh.weights[vi] = [];
    let list = mesh.weights[vi]!;
    let entry = list.find((w) => w.joint === jointId);
    if (!entry) {
      entry = { joint: jointId, weight: 0 };
      list.push(entry);
    }
    if (mode === "add") entry.weight = Math.min(1, entry.weight + value * fall);
    else if (mode === "set") entry.weight = Math.min(1, Math.max(0, value));
    else {
      // smooth: média com vizinhos topológicos
      const nb = adj.get(vi);
      if (nb && nb.size > 0) {
        let sum = entry.weight;
        let n = 1;
        for (const ni of nb) {
          sum += weightOf(ni);
          n++;
        }
        entry.weight = sum / n;
      }
    }
    // Renormaliza influências do vértice
    const sum = list.reduce((s, w) => s + w.weight, 0);
    if (sum > 1e-9) for (const w of list) w.weight /= sum;
    affected++;
  });
  return affected;
}

/** Gradiente térmico Azul→Verde→Amarelo→Vermelho para valor [0..1]. */
export function weightToHeatColor(w: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, w));
  if (t < 0.33) {
    const k = t / 0.33;
    return [0, Math.round(120 + 135 * k), Math.round(255 - 105 * k)];
  }
  if (t < 0.66) {
    const k = (t - 0.33) / 0.33;
    return [Math.round(255 * k), 255, 0];
  }
  const k = (t - 0.66) / 0.34;
  return [255, Math.round(255 - 155 * k), 0];
}

// ---------------------------------------------------------------------------
// P1-11 — Pesos topológicos: prune / normalize / smooth / weld / islands
// ---------------------------------------------------------------------------

/** Remove influências abaixo de minWeight e renormaliza. Retorna nº removidas. */
export function pruneWeights(mesh: Mesh, minWeight = 0.01): number {
  let removed = 0;
  mesh.weights = mesh.weights.map((list) => {
    const kept = list.filter((w) => {
      if (w.weight < minWeight) {
        removed++;
        return false;
      }
      return true;
    });
    // Garante ao menos 1 influência
    if (kept.length === 0 && list.length > 0) {
      const top = [...list].sort((a, b) => b.weight - a.weight)[0]!;
      return [{ joint: top.joint, weight: 1 }];
    }
    const sum = kept.reduce((s, w) => s + w.weight, 0) || 1;
    return kept.map((w) => ({ joint: w.joint, weight: w.weight / sum }));
  });
  return removed;
}

/** Renormaliza todos os vértices (soma = 1). */
export function normalizeWeights(mesh: Mesh): void {
  mesh.weights = mesh.weights.map((list) => {
    const sum = list.reduce((s, w) => s + w.weight, 0);
    if (sum < 1e-9) return list;
    return list.map((w) => ({ joint: w.joint, weight: w.weight / sum }));
  });
}

/** Adjacência topológica por triângulos (reuso em smooth/islands). */
export function meshAdjacency(mesh: Mesh): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  const link = (a: number, b: number): void => {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const [a, b, c] of mesh.triangles) {
    link(a, b);
    link(b, c);
    link(c, a);
  }
  return adj;
}

/** Relaxamento topológico global: média com vizinhos por N iterações. */
export function smoothWeightsTopological(mesh: Mesh, iterations = 1): void {
  const adj = meshAdjacency(mesh);
  for (let it = 0; it < iterations; it++) {
    const next: Influence[][] = mesh.weights.map((list, vi) => {
      const nb = adj.get(vi);
      if (!nb || nb.size === 0) return list.map((w) => ({ ...w }));
      const acc = new Map<string, number>();
      const push = (lst: Influence[], weight: number): void => {
        for (const w of lst) acc.set(w.joint, (acc.get(w.joint) ?? 0) + w.weight * weight);
      };
      push(list, 1);
      for (const ni of nb) push(mesh.weights[ni] ?? [], 1);
      const denom = 1 + nb.size;
      const out = [...acc.entries()].map(([joint, weight]) => ({ joint, weight: weight / denom }));
      const sum = out.reduce((s, w) => s + w.weight, 0) || 1;
      return out.map((w) => ({ joint: w.joint, weight: w.weight / sum }));
    });
    mesh.weights = next;
  }
}

/**
 * Weld: funde vértices duplicados dentro de epsilon.
 * Retorna mapa oldIdx → newIdx. Triângulos degenerados são descartados.
 */
export function weldVertices(mesh: Mesh, epsilon = 1e-4): Map<number, number> {
  const remap = new Map<number, number>();
  const fresh: Vec2[] = [];
  const freshW: Influence[][] = [];
  const keyOf = (v: Vec2): string => `${Math.round(v[0] / epsilon)}:${Math.round(v[1] / epsilon)}`;
  const seen = new Map<string, number>();
  mesh.vertices.forEach((v, i) => {
    const key = keyOf(v);
    const hit = seen.get(key);
    if (hit !== undefined) {
      remap.set(i, hit);
    } else {
      const ni = fresh.length;
      seen.set(key, ni);
      remap.set(i, ni);
      fresh.push(v);
      freshW.push(mesh.weights[i] ?? []);
    }
  });
  const tris: [number, number, number][] = [];
  for (const [a, b, c] of mesh.triangles) {
    const na = remap.get(a)!;
    const nb = remap.get(b)!;
    const nc = remap.get(c)!;
    if (na === nb || nb === nc || nc === na) continue; // degenerado
    tris.push([na, nb, nc]);
  }
  mesh.vertices = fresh;
  mesh.weights = freshW;
  mesh.triangles = tris;
  return remap;
}

/** Componentes conexos (islands) via BFS na adjacência. Retorna islands como listas de índices. */
export function detectIslands(mesh: Mesh): number[][] {
  const adj = meshAdjacency(mesh);
  const visited = new Set<number>();
  const islands: number[][] = [];
  for (let i = 0; i < mesh.vertices.length; i++) {
    if (visited.has(i)) continue;
    const queue = [i];
    const comp: number[] = [];
    visited.add(i);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }
    islands.push(comp);
  }
  return islands;
}
