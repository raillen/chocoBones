/**
 * chocoBones TypeScript Rigging - Inverse Kinematics (IK)
 * Solver analítico 2-Bone IK com fator de dobra (bend) para membros (braços/pernas).
 */

import { clamp, matApply, vec2Dist } from "../core/math";
import { Vec2 } from "../core/types";
import { boneMatrices } from "./fk";
import { findJoint, Joint, Pose } from "./joint";

export function solveIK(
  joints: readonly Joint[],
  pose: Pose,
  tipId: string,
  target: Vec2,
  bend = 1.0
): boolean {
  const tip = findJoint(joints, tipId);
  if (!tip || tip.parent === "") return false;

  const mid = findJoint(joints, tip.parent);
  if (!mid || mid.parent === "") return false;

  const base = findJoint(joints, mid.parent);
  if (!base || base.id === "root") return false;

  const bones = boneMatrices(joints, pose);
  const baseMat = bones.get(base.id);
  if (!baseMat) return false;

  const origin = matApply(baseMat, [0, 0]);

  const l1 = vec2Dist([base.x, base.y], [mid.x, mid.y]);
  const l2 = vec2Dist([mid.x, mid.y], [tip.x, tip.y]);
  if (l1 < 1.0 || l2 < 1.0) return false;

  const rawDist = vec2Dist(origin, target);
  const dist = clamp(rawDist, 0.01, l1 + l2 - 0.001);

  const direction = Math.atan2(target[1] - origin[1], target[0] - origin[0]);

  let cosRule = (l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist);
  cosRule = clamp(cosRule, -1.0, 1.0);

  const a = direction - bend * Math.acos(cosRule);

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

  pose.joints.set(base.id, {
    angle: a - parentAngle - baseRestAngle,
    x: 0,
    y: 0,
  });

  pose.joints.set(mid.id, {
    angle: b - a + baseRestAngle - midRestAngle,
    x: 0,
    y: 0,
  });

  return true;
}
