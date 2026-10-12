/**
 * chocoBones TypeScript Rigging - Inverse Kinematics (IK)
 * Solver analítico 2-Bone IK com fator de dobra (bend) para membros (braços/pernas).
 */

import { clamp, matApply, vec2Dist } from "../core/math";
import { Vec2 } from "../core/types";
import { boneMatrices } from "./fk";
import { findJoint, Joint, Pose } from "./joint";

export interface IkOptions {
  /** +1 dobra para um lado, -1 para o outro (padrão 1). */
  bend?: number;
  /** Limites angulares (rad) aplicados a base e mid após solver. */
  minAngle?: number;
  maxAngle?: number;
  /** Pole-vector em mundo para desambiguar o lado do cotovelo. */
  pole?: Vec2 | null;
}

function applyAngleLimits(angle: number, min?: number, max?: number): number {
  let a = angle;
  // Normaliza para [-PI, PI] antes de clampar
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  if (min !== undefined) a = Math.max(min, a);
  if (max !== undefined) a = Math.min(max, a);
  return a;
}

/**
 * Solver analítico 2-bone genérico: funciona com qualquer cadeia tip→mid→base,
 * sem depender de IDs ("root", "hand_near"...). Constraints via limites/pole.
 */
export function solveIK(
  joints: readonly Joint[],
  pose: Pose,
  tipId: string,
  target: Vec2,
  bend: number | IkOptions = 1.0
): boolean {
  const opts: IkOptions = typeof bend === "number" ? { bend } : bend;
  const bendSign = opts.bend ?? 1.0;
  const tip = findJoint(joints, tipId);
  if (!tip || tip.parent === "") return false;

  const mid = findJoint(joints, tip.parent);
  if (!mid || mid.parent === "") return false;

  const base = findJoint(joints, mid.parent);
  if (!base) return false;

  const bones = boneMatrices(joints, pose);
  const baseMat = bones.get(base.id);
  if (!baseMat) return false;

  const origin = matApply(baseMat, [0, 0]);

  const l1 = vec2Dist([base.x, base.y], [mid.x, mid.y]);
  const l2 = vec2Dist([mid.x, mid.y], [tip.x, tip.y]);
  if (l1 < 1.0 || l2 < 1.0) return false;

  const rawDist = vec2Dist(origin, target);
  const dist = clamp(rawDist, 0.01, l1 + l2 - 0.001);

  let direction = Math.atan2(target[1] - origin[1], target[0] - origin[0]);

  let cosRule = (l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist);
  cosRule = clamp(cosRule, -1.0, 1.0);

  // Pole-vector: escolhe lado do cotovelo conforme半 plano do pole
  let bendEff = bendSign;
  if (opts.pole) {
    const toPole = Math.atan2(opts.pole[1] - origin[1], opts.pole[0] - origin[0]);
    let diff = toPole - direction;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    bendEff = diff >= 0 ? 1 : -1;
    if (bendSign < 0) bendEff = -bendEff;
  }

  const a = direction - bendEff * Math.acos(cosRule);

  const elbow: Vec2 = [
    origin[0] + Math.cos(a) * l1,
    origin[1] + Math.sin(a) * l1,
  ];

  const b = Math.atan2(target[1] - elbow[1], target[0] - elbow[0]);

  let parentAngle = 0.0;
  if (base.parent !== "") {
    const parentMat = bones.get(base.parent);
    if (parentMat) {
      parentAngle = Math.atan2(parentMat.b, parentMat.a);
    }
  }

  const baseRestAngle = Math.atan2(mid.y - base.y, mid.x - base.x);
  const midRestAngle = Math.atan2(tip.y - mid.y, tip.x - mid.x);

  let baseAngle = a - parentAngle - baseRestAngle;
  let midAngle = b - a + baseRestAngle - midRestAngle;
  baseAngle = applyAngleLimits(baseAngle, opts.minAngle, opts.maxAngle);
  midAngle = applyAngleLimits(midAngle, opts.minAngle, opts.maxAngle);

  pose.joints.set(base.id, {
    angle: baseAngle,
    x: 0,
    y: 0,
  });

  pose.joints.set(mid.id, {
    angle: midAngle,
    x: 0,
    y: 0,
  });

  return true;
}

/** Resolve IK para qualquer extremidade via metadados: encontra cadeia de 3. */
export function solveIKForTip(
  joints: readonly Joint[],
  pose: Pose,
  tipId: string,
  target: Vec2,
  opts: IkOptions = {}
): boolean {
  return solveIK(joints, pose, tipId, target, opts);
}
