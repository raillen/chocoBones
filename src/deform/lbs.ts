/**
 * chocoBones LBS + Dual-Quaternion planar + ordem explícita (P2-15)
 * Ordem fixa segura v1: Bones(LBS/DQ) -> MLS local. Versionada p/ documentos.
 * DQ planar: mistura transforms (R_avg + t_avg) e aplica uma vez —
 * preserva rigidez melhor que LBS em dobras 90°+; não promete área exata.
 */
import { matApply } from "../core/math";
import { Mat2x3, Vec2 } from "../core/types";
import { CompiledRig } from "../rig/compiled";
import { Mesh } from "../mesh/mesh";

export const DEFORM_ORDER_VERSION = 1;
export type DeformOrder = "bones-then-mls";
export const DEFORM_ORDER: DeformOrder = "bones-then-mls";

/** LBS 2D: soma ponderada de (bone * vértice), normalizada pelo peso total. */
export function skinLBS(
  vertex: Vec2,
  weights: Array<{ joint: string; weight: number }>,
  rig: CompiledRig,
  _bindMats?: Map<string, Mat2x3>
): Vec2 {
  if (weights.length === 0) return [vertex[0], vertex[1]];
  let x = 0;
  let y = 0;
  let wsum = 0;
  for (const w of weights) {
    const bone = rig.bones.get(w.joint);
    if (!bone) continue;
    const p = matApply(bone, vertex);
    x += p[0] * w.weight;
    y += p[1] * w.weight;
    wsum += w.weight;
  }
  if (wsum < 1e-9) return [vertex[0], vertex[1]];
  return [x / wsum, y / wsum];
}

/** DQ planar aproximado: R média circular + t média, aplicados uma vez. */
export function skinDualQuaternionPlanar(
  vertex: Vec2,
  weights: Array<{ joint: string; weight: number }>,
  rig: CompiledRig
): Vec2 {
  if (weights.length === 0) return [vertex[0], vertex[1]];
  let cosSum = 0;
  let sinSum = 0;
  let tx = 0;
  let ty = 0;
  let wsum = 0;
  for (const w of weights) {
    const bone = rig.bones.get(w.joint);
    if (!bone) continue;
    const ang = Math.atan2(bone.b, bone.a);
    cosSum += Math.cos(ang) * w.weight;
    sinSum += Math.sin(ang) * w.weight;
    tx += bone.tx * w.weight;
    ty += bone.ty * w.weight;
    wsum += w.weight;
  }
  if (wsum < 1e-9) return [vertex[0], vertex[1]];
  const angAvg = Math.atan2(sinSum / wsum, cosSum / wsum);
  const c = Math.cos(angAvg);
  const s = Math.sin(angAvg);
  return [vertex[0] * c - vertex[1] * s + tx / wsum, vertex[0] * s + vertex[1] * c + ty / wsum];
}

/** Deforma malha por skinning (LBS ou DQ) — etapa 1 da ordem bones-then-mls. */
export function deformSkinning(
  mesh: Mesh,
  rig: CompiledRig,
  bindMats?: Map<string, Mat2x3>,
  useDQ = false
): Vec2[] {
  return mesh.vertices.map((v, i) => {
    const w = mesh.weights[i] ?? [];
    return useDQ ? skinDualQuaternionPlanar(v, w, rig) : skinLBS(v, w, rig, bindMats);
  });
}

/** Compara LBS vs DQ: distância média/máx (p/ teste A/B 45/90/135°). */
export function compareSkinning(
  mesh: Mesh,
  rig: CompiledRig,
  bindMats?: Map<string, Mat2x3>
): { meanDist: number; maxDist: number } {
  let sum = 0;
  let max = 0;
  mesh.vertices.forEach((v, i) => {
    const w = mesh.weights[i] ?? [];
    const a = skinLBS(v, w, rig, bindMats);
    const b = skinDualQuaternionPlanar(v, w, rig);
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    sum += d;
    if (d > max) max = d;
  });
  return { meanDist: mesh.vertices.length ? sum / mesh.vertices.length : 0, maxDist: max };
}
