/**
 * chocoBones rig pré-compilado (P2-12)
 * Elimina findJoint linear por vértice e recursão por amostra.
 * Compila uma vez por pose: índices + matrizes + ordem topológica.
 */
import { MAT_IDENTITY, Mat2x3 } from "../core/types";
import { matMul } from "../core/math";
import { findJoint, Joint, JointDelta, Pose } from "./joint";

export interface CompiledRig {
  /** ordem topológica (pais antes dos filhos) */
  order: string[];
  /** id → índice na ordem */
  index: Map<string, number>;
  /** id → matriz óssea mundo */
  bones: Map<string, Mat2x3>;
  /** id → posição rest (para bind) */
  rest: Map<string, { x: number; y: number; parent: string }>;
}

/** Ordenação topológica por profundidade (pais antes, sem recursão). */
export function topoOrder(joints: readonly Joint[]): string[] {
  const byId = new Map(joints.map((j) => [j.id, j]));
  const depth = new Map<string, number>();
  const getDepth = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    let cur = byId.get(id);
    let guard = 0;
    const chain: string[] = [];
    while (cur && cur.parent !== "" && guard <= joints.length) {
      chain.push(cur.id);
      const p = byId.get(cur.parent);
      if (!p) break;
      cur = p;
      guard++;
      if (chain.includes(cur.id)) break; // ciclo: para
    }
    depth.set(id, guard);
    return guard;
  };
  return [...joints].sort((a, b) => getDepth(a.id) - getDepth(b.id)).map((j) => j.id);
}

/** Compila rig p/ pose atual em O(n) iterativo (sem recursão). */
export function compileRig(joints: readonly Joint[], pose?: Pose | null): CompiledRig {
  const order = topoOrder(joints);
  const byId = new Map(joints.map((j) => [j.id, j]));
  const bones = new Map<string, Mat2x3>();
  const index = new Map<string, number>();
  const rest = new Map<string, { x: number; y: number; parent: string }>();
  order.forEach((id, i) => index.set(id, i));

  for (const id of order) {
    const j = byId.get(id)!;
    rest.set(id, { x: j.x, y: j.y, parent: j.parent });
    let parentMat: Mat2x3 = { ...MAT_IDENTITY };
    let px = 0;
    let py = 0;
    if (j.parent !== "") {
      const pm = bones.get(j.parent);
      const pj = byId.get(j.parent);
      if (pm && pj) {
        parentMat = pm;
        px = pj.x;
        py = pj.y;
      }
    }
    let d: JointDelta = { angle: 0, x: 0, y: 0 };
    if (pose) {
      const found = pose.joints.get(j.id);
      if (found) d = found;
    }
    const cosA = Math.cos(d.angle);
    const sinA = Math.sin(d.angle);
    const local: Mat2x3 = { a: cosA, b: sinA, c: -sinA, d: cosA, tx: j.x - px + d.x, ty: j.y - py + d.y };
    bones.set(id, matMul(parentMat, local));
  }
  return { order, index, bones, rest };
}

/** Lookup O(1) de junta via índice compilado (substitui findJoint em loops quentes). */
export function compiledJointIndex(rig: CompiledRig, id: string): number {
  return rig.index.get(id) ?? -1;
}

export function compiledBone(rig: CompiledRig, id: string): Mat2x3 | undefined {
  return rig.bones.get(id);
}

/** Invalida/aceita: rig é válido enquanto joints.length e ids coincidirem. */
export function isRigFresh(rig: CompiledRig, joints: readonly Joint[]): boolean {
  if (rig.order.length !== joints.length) return false;
  for (const j of joints) {
    if (!rig.index.has(j.id)) return false;
  }
  return true;
}

export { findJoint };
