/**
 * chocoBones Fase 2: transform constraints + SmartBones/correctives + retarget.
 */
import { lerp } from "../core/math";
import { Pose } from "../rig/joint";

export type TransformConstraintKind = "parent" | "aim" | "limit";

export interface TransformConstraint {
  id: string;
  kind: TransformConstraintKind;
  source: string; // joint driver
  target: string; // joint driven
  weight: number; // 0..1
  minAngle?: number;
  maxAngle?: number;
  enabled: boolean;
}

/** Aplica parent/aim/limit sobre pose (após IK, antes de bones). */
export function applyTransformConstraints(pose: Pose, constraints: readonly TransformConstraint[]): void {
  for (const c of constraints) {
    if (!c.enabled || c.weight <= 0) continue;
    const src = pose.joints.get(c.source);
    const dst = pose.joints.get(c.target) ?? { angle: 0, x: 0, y: 0 };
    if (c.kind === "parent" || c.kind === "aim") {
      if (!src) continue;
      pose.joints.set(c.target, {
        angle: lerp(dst.angle, src.angle, c.weight),
        x: lerp(dst.x, src.x, c.weight),
        y: lerp(dst.y, src.y, c.weight),
      });
    } else if (c.kind === "limit") {
      let a = dst.angle;
      if (c.minAngle !== undefined) a = Math.max(c.minAngle, a);
      if (c.maxAngle !== undefined) a = Math.min(c.maxAngle, a);
      pose.joints.set(c.target, { ...dst, angle: a });
    }
  }
}

export interface CorrectivePose {
  id: string;
  jointId: string; // junta-gatilho
  atAngle: number; // marco de rotação
  radius: number; // janela de blend
  deltaAngle: number; // correção aditiva
  deltaX: number;
  deltaY: number;
}

/**
 * SmartBones: interpola correções em marcos de ângulo.
 * Peso = clamp(1 - |atual - marco| / raio). Autoral, não auto-solver.
 */
export function applyCorrectives(pose: Pose, correctives: readonly CorrectivePose[]): void {
  for (const c of correctives) {
    const cur = pose.joints.get(c.jointId);
    if (!cur) continue;
    const dist = Math.abs(cur.angle - c.atAngle);
    if (dist > c.radius) continue;
    const w = 1 - dist / Math.max(1e-9, c.radius);
    pose.joints.set(c.jointId, {
      angle: cur.angle + c.deltaAngle * w,
      x: cur.x + c.deltaX * w,
      y: cur.y + c.deltaY * w,
    });
  }
}

export type AnatomicalRole =
  | "head" | "neck" | "hip" | "shoulder_l" | "shoulder_r" | "elbow_l" | "elbow_r"
  | "wrist_l" | "wrist_r" | "knee_l" | "knee_r" | "ankle_l" | "ankle_r" | "root";

/** Papel anatômico por heurística de nome/id (p/ retarget). */
export function anatomicalRole(jointId: string, jointName = ""): AnatomicalRole | null {
  const s = `${jointId} ${jointName}`.toLowerCase();
  if (s.includes("head")) return "head";
  if (s.includes("neck")) return "neck";
  if (s.includes("forearm_near") || s.includes("elbow") && s.includes("near")) return "elbow_l";
  if (s.includes("forearm_far") || s.includes("elbow") && s.includes("far")) return "elbow_r";
  if (s.includes("hand_near") || s.includes("wrist") && s.includes("near")) return "wrist_l";
  if (s.includes("hand_far") || s.includes("wrist") && s.includes("far")) return "wrist_r";
  if (s.includes("upper_arm_near") || s.includes("shoulder") && s.includes("near")) return "shoulder_l";
  if (s.includes("upper_arm_far") || s.includes("shoulder") && s.includes("far")) return "shoulder_r";
  if (s.includes("shin_near") || s.includes("knee") && s.includes("near")) return "knee_l";
  if (s.includes("shin_far") || s.includes("knee") && s.includes("far")) return "knee_r";
  if (s.includes("foot_near") || s.includes("ankle") && s.includes("near")) return "ankle_l";
  if (s.includes("foot_far") || s.includes("ankle") && s.includes("far")) return "ankle_r";
  if (s.includes("thigh") || s.includes("hip")) return "hip";
  if (s.includes("root")) return "root";
  return null;
}

/**
 * Retarget por papéis: copia ângulos de src→dst onde papéis coincidem.
 * Biblioteca simples de rig & poses.
 */
export function retargetByRole(
  srcPose: Pose,
  srcJoints: Array<{ id: string; name: string }>,
  dstJoints: Array<{ id: string; name: string }>,
  outPose: Pose
): number {
  const srcRole = new Map<AnatomicalRole, string>();
  for (const j of srcJoints) {
    const r = anatomicalRole(j.id, j.name);
    if (r) srcRole.set(r, j.id);
  }
  let copied = 0;
  for (const j of dstJoints) {
    const r = anatomicalRole(j.id, j.name);
    if (!r) continue;
    const srcId = srcRole.get(r);
    if (!srcId) continue;
    const d = srcPose.joints.get(srcId);
    if (!d) continue;
    outPose.joints.set(j.id, { ...d });
    copied++;
  }
  return copied;
}
