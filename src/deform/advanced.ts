/**
 * chocoBones Fase 4: ARAP (modo Qualidade) + BBW aprox + cage/envelope + player.
 * ARAP: minimiza distorção por triângulo sob handles (iterativo, honesto e simples).
 * BBW: aproximação por distância+suavização (documentada como tal; full QP fora do escopo).
 */
import { Vec2 } from "../core/types";
import { Mesh } from "../mesh/mesh";

export interface ArapOptions {
  iterations?: number;
  handles?: Map<number, Vec2>; // vertIdx → alvo
}

/** ARAP simplificado: handles fixos + relaxamento laplaciano. */
export function solveArap(mesh: Mesh, deformed: Vec2[], opts: ArapOptions = {}): Vec2[] {
  const iters = opts.iterations ?? 3;
  const handles = opts.handles ?? new Map();
  const adj = new Map<number, Set<number>>();
  for (const [a, b, c] of mesh.triangles) {
    for (const [u, v] of [[a, b], [b, c], [c, a]] as Array<[number, number]>) {
      if (!adj.has(u)) adj.set(u, new Set());
      adj.get(u)!.add(v);
    }
  }
  let cur = deformed.map((v, i) => {
    const h = handles.get(i);
    return h ? ([h[0], h[1]] as Vec2) : ([v[0], v[1]] as Vec2);
  });
  for (let it = 0; it < iters; it++) {
    cur = cur.map((v, i) => {
      if (handles.has(i)) return v;
      const nb = adj.get(i);
      if (!nb || nb.size === 0) return v;
      let sx = 0;
      let sy = 0;
      for (const n of nb) {
        sx += cur[n]![0];
        sy += cur[n]![1];
      }
      const n = nb.size;
      return [(v[0] * 0.5 + (sx / n) * 0.5), (v[1] * 0.5 + (sy / n) * 0.5)] as Vec2;
    });
  }
  return cur;
}

export interface BbwOptions {
  falloff?: number;
  smoothIters?: number;
}

/**
 * BBW aproximado: pesos suaves por distância a handles + normalização +
 * suavização topológica. Útil no preprocessamento do autorig (dossiê §4).
 */
export function boundedBiharmonicApprox(
  mesh: Mesh,
  handles: Vec2[],
  opts: BbwOptions = {}
): number[][] {
  const fall = opts.falloff ?? 2.0;
  const weights: number[][] = mesh.vertices.map((v) =>
    handles.map((h) => {
      const d = Math.hypot(v[0] - h[0], v[1] - h[1]);
      return 1 / Math.pow(d + 4, fall);
    })
  );
  // Normaliza linhas
  for (const row of weights) {
    const s = row.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < row.length; i++) row[i]! /= s;
  }
  // Suavização simples por adjacência
  const adj = new Map<number, Set<number>>();
  for (const [a, b, c] of mesh.triangles) {
    for (const [u, v] of [[a, b], [b, c], [c, a]] as Array<[number, number]>) {
      if (!adj.has(u)) adj.set(u, new Set());
      adj.get(u)!.add(v);
    }
  }
  for (let it = 0; it < (opts.smoothIters ?? 2); it++) {
    for (let i = 0; i < weights.length; i++) {
      const nb = adj.get(i);
      if (!nb || nb.size === 0) continue;
      for (let k = 0; k < weights[i]!.length; k++) {
        let s = weights[i]![k]!;
        for (const n of nb) s += weights[n]![k]!;
        weights[i]![k] = s / (nb.size + 1);
      }
    }
  }
  for (const row of weights) {
    const s = row.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < row.length; i++) row[i]! /= s;
  }
  return weights;
}

export interface Cage {
  points: Vec2[]; // polígono de controle
}

/** Deformação por cage (coordenadas baricêntricas aproximadas por IDW). */
export function deformByCage(vertex: Vec2, rest: Vec2[], deformed: Vec2[]): Vec2 {
  if (rest.length === 0 || rest.length !== deformed.length) return vertex;
  let wsum = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < rest.length; i++) {
    const d = Math.hypot(vertex[0] - rest[i]![0], vertex[1] - rest[i]![1]);
    const w = 1 / Math.pow(d + 8, 2);
    const dx = deformed[i]![0] - rest[i]![0];
    const dy = deformed[i]![1] - rest[i]![1];
    x += dx * w;
    y += dy * w;
    wsum += w;
  }
  if (wsum < 1e-9) return vertex;
  return [vertex[0] + x / wsum, vertex[1] + y / wsum];
}
