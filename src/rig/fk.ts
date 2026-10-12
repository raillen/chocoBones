/**
 * chocoBones TypeScript Rigging - Forward Kinematics (FK)
 * Resolução da cadeia esquelética hierárquica e transformações de camadas.
 */

import { Mat2x3, MAT_IDENTITY } from "../core/types";
import { matMul, translate } from "../core/math";
import {
  findJoint,
  Joint,
  JOINT_DELTA_ZERO,
  Layer,
  LAYER_DELTA_IDENTITY,
  Pose,
} from "./joint";

export function boneMatrices(
  joints: readonly Joint[],
  pose?: Pose | null
): Map<string, Mat2x3> {
  const result = new Map<string, Mat2x3>();

  const solve = (j: Joint): Mat2x3 => {
    const cached = result.get(j.id);
    if (cached) return cached;

    let parentMat = { ...MAT_IDENTITY };
    let px = 0;
    let py = 0;

    if (j.parent !== "") {
      const p = findJoint(joints, j.parent);
      if (p) {
        px = p.x;
        py = p.y;
        parentMat = solve(p);
      }
    }

    let d = JOINT_DELTA_ZERO;
    if (pose) {
      const delta = pose.joints.get(j.id);
      if (delta) d = delta;
    }

    const cosA = Math.cos(d.angle);
    const sinA = Math.sin(d.angle);

    const local: Mat2x3 = {
      a: cosA,
      b: sinA,
      c: -sinA,
      d: cosA,
      tx: j.x - px + d.x,
      ty: j.y - py + d.y,
    };

    const m = matMul(parentMat, local);
    result.set(j.id, m);
    return m;
  };

  for (const j of joints) {
    solve(j);
  }

  return result;
}

export function layerMatrix(
  layer: Layer,
  joints: readonly Joint[],
  pose: Pose | null,
  bones: Map<string, Mat2x3>
): Mat2x3 {
  const t = layer.transform;
  let d = LAYER_DELTA_IDENTITY;

  if (pose) {
    const delta = pose.layers.get(layer.id);
    if (delta) d = delta;
  }

  const angle = t.rotation + d.rotation;
  const sx = t.scale[0] * d.sx;
  const sy = t.scale[1] * d.sy;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  let m: Mat2x3 = {
    a: cosA * sx,
    b: sinA * sx,
    c: -sinA * sy,
    d: cosA * sy,
    tx: t.pos[0] + d.x,
    ty: t.pos[1] + d.y,
  };

  m = matMul(m, translate(-t.pivot[0], -t.pivot[1]));

  if (layer.joint !== "") {
    const j = findJoint(joints, layer.joint);
    if (j) {
      const boneMat = bones.get(j.id);
      if (boneMat) {
        const boneRel = matMul(boneMat, translate(-j.x, -j.y));
        return matMul(boneRel, m);
      }
    }
  }

  return m;
}
