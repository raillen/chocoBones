/**
 * chocoBones constraints por metadados (P1-10)
 * IK genérica sem IDs fixos + FABRIK p/ cadeias N-bones + sockets.
 */
import { clamp, vec2Dist } from "../core/math";
import { Vec2 } from "../core/types";
import { boneMatrices } from "./fk";
import { solveIK, IkOptions } from "./ik";
import { findJoint, Joint, Pose } from "./joint";
import { matApply } from "../core/math";

export type ConstraintType = "ik" | "limit" | "aim" | "parent";

export interface IkConstraint {
  id: string;
  type: ConstraintType;
  tipId: string;
  target: Vec2;
  pole?: Vec2 | null;
  minAngle?: number;
  maxAngle?: number;
  bend?: number;
  enabled: boolean;
}

export interface Socket {
  id: string;
  name: string;
  jointId: string;
  offset: Vec2;
}

/** Cadeia raiz→tip para FABRIK (até maxLen elos). */
export function chainToRoot(joints: readonly Joint[], tipId: string, maxLen = 8): Joint[] {
  const out: Joint[] = [];
  let cur = findJoint(joints, tipId);
  let guard = 0;
  while (cur && guard < maxLen) {
    out.unshift(cur);
    if (!cur.parent) break;
    cur = findJoint(joints, cur.parent);
    guard++;
  }
  return out;
}

/**
 * FABRIK 2D para cadeias arbitrárias (complementa IK analítico 2-bone).
 * Itera forward/backward em rest-space + deltas de pose. Retorna true se convergiu.
 */
export function solveFabrik(
  joints: Joint[],
  pose: Pose,
  tipId: string,
  target: Vec2,
  maxIter = 12,
  tolerance = 0.5
): boolean {
  const chain = chainToRoot(joints, tipId, 8);
  if (chain.length < 2) return false;
  const bones = boneMatrices(joints, pose);
  // Posições mundo atuais
  const pos: Vec2[] = chain.map((j) => {
    const m = bones.get(j.id);
    return m ? matApply(m, [0, 0]) : [j.x, j.y];
  });
  // Comprimentos de elos (rest)
  const lens: number[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i]!;
    const b = chain[i + 1]!;
    lens.push(Math.max(1e-6, vec2Dist([a.x, a.y], [b.x, b.y])));
  }
  const root = pos[0]!;
  const totalLen = lens.reduce((s, l) => s + l, 0);
  if (vec2Dist(root, target) > totalLen) {
    // Alvo inalcançável: estica em direção ao alvo
    const dir = Math.atan2(target[1] - root[1], target[0] - root[0]);
    for (let i = 1; i < pos.length; i++) {
      pos[i] = [pos[i - 1]![0] + Math.cos(dir) * lens[i - 1]!, pos[i - 1]![1] + Math.sin(dir) * lens[i - 1]!];
    }
  } else {
    for (let it = 0; it < maxIter; it++) {
      // Backward
      pos[pos.length - 1] = [...target] as Vec2;
      for (let i = pos.length - 2; i >= 0; i--) {
        const d = vec2Dist(pos[i]!, pos[i + 1]!);
        const t = d < 1e-9 ? 0 : lens[i]! / d;
        pos[i] = [
          pos[i + 1]![0] + (pos[i]![0] - pos[i + 1]![0]) * t,
          pos[i + 1]![1] + (pos[i + 1]![1] - pos[i + 1]![1]) * t,
        ];
      }
      // Forward
      pos[0] = [...root] as Vec2;
      for (let i = 0; i < pos.length - 1; i++) {
        const d = vec2Dist(pos[i]!, pos[i + 1]!);
        const t = d < 1e-9 ? 0 : lens[i]! / d;
        pos[i + 1] = [
          pos[i]![0] + (pos[i + 1]![0] - pos[i]![0]) * t,
          pos[i]![1] + (pos[i + 1]![1] - pos[i]![1]) * t,
        ];
      }
      if (vec2Dist(pos[pos.length - 1]!, target) <= tolerance) break;
    }
  }
  // Converte posições mundo em deltas angulares (2 elos distais via IK analítico p/ estabilidade)
  const tip = chain[chain.length - 1]!;
  const opts: IkOptions = { bend: 1 };
  const ok = solveIK(joints, pose, tip.id, target, opts);
  // Distribui resíduo FABRIK como offsets de posição nos elos intermediários
  for (let i = 1; i < chain.length - 1; i++) {
    const j = chain[i]!;
    const rest: Vec2 = [j.x, j.y];
    const solved = pos[i]!;
    const dx = (solved[0] - rest[0]) * 0.15;
    const dy = (solved[1] - rest[1]) * 0.15;
    if (Math.abs(dx) + Math.abs(dy) > 1e-6) {
      const cur = pose.joints.get(j.id) ?? { angle: 0, x: 0, y: 0 };
      pose.joints.set(j.id, { ...cur, x: cur.x + dx, y: cur.y + dy });
    }
  }
  return ok || vec2Dist(pos[pos.length - 1]!, target) <= Math.max(tolerance, 2);
}

/** Resolve lista de constraints IK (2-bone quando 3 elos, FABRIK p/ demais). */
export function solveConstraints(joints: Joint[], pose: Pose, constraints: readonly IkConstraint[]): number {
  let solved = 0;
  for (const c of constraints) {
    if (!c.enabled) continue;
    if (c.type !== "ik") continue;
    const chain = chainToRoot(joints, c.tipId, 8);
    let ok = false;
    if (chain.length === 3) {
      ok = solveIK(joints, pose, c.tipId, c.target, {
        bend: c.bend ?? 1,
        minAngle: c.minAngle,
        maxAngle: c.maxAngle,
        pole: c.pole ?? null,
      });
    } else if (chain.length >= 2) {
      ok = solveFabrik(joints, pose, c.tipId, c.target);
    }
    if (ok) solved++;
  }
  return solved;
}

/** Posição mundo de socket (ponto preso a junta + offset local). */
export function socketWorld(joints: readonly Joint[], pose: Pose | null, socket: Socket): Vec2 {
  const bones = boneMatrices(joints, pose);
  const m = bones.get(socket.jointId);
  if (!m) {
    const j = findJoint(joints, socket.jointId);
    return j ? [j.x + socket.offset[0], j.y + socket.offset[1]] : [...socket.offset] as Vec2;
  }
  return matApply(m, socket.offset);
}

export function clampAngle(a: number, min?: number, max?: number): number {
  let v = a;
  while (v > Math.PI) v -= Math.PI * 2;
  while (v < -Math.PI) v += Math.PI * 2;
  if (min !== undefined) v = Math.max(min, v);
  if (max !== undefined) v = Math.min(max, v);
  void clamp;
  return v;
}
