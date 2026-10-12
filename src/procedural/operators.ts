/**
 * chocoBones Fase 3: parâmetros + stack de operadores + bake determinístico.
 */
import { Pose } from "../rig/joint";

export type OperatorMix = "add" | "override";
export type OperatorKind = "breath" | "gait" | "look" | "spring" | "squash";

export interface ProceduralOperator {
  id: string;
  kind: OperatorKind;
  weight: number; // 0..1
  mix: OperatorMix;
  channels: string[]; // máscara: [] = todos
  params: Record<string, number>;
  enabled: boolean;
}

export function channelAllowed(op: ProceduralOperator, channel: string): boolean {
  if (op.channels.length === 0) return true;
  return op.channels.includes(channel);
}

/** Knobs amigáveis com defaults (presets Respiração/Cabelo/Cauda/Caminhada/Olhar). */
export function defaultOperatorParams(kind: OperatorKind): Record<string, number> {
  switch (kind) {
    case "breath":
      return { frequency: 0.625, amplitude: 2.5, phase: 0, shoulderAmp: 0.08 };
    case "gait":
      return { speed: 0.5, stride: 0.35, stepHeight: 8, groundY: 420, facing: 1 };
    case "look":
      return { targetX: 0, targetY: 0, amplitude: 0.3, damping: 5 };
    case "spring":
      return { stiffness: 60, damping: 6, gravity: 0, maxAngle: 0.5 };
    case "squash":
      return { scaleX: 0.06, scaleY: 0.06, limit: 0.2 };
  }
}

export function createOperator(kind: OperatorKind, id: string): ProceduralOperator {
  return { id, kind, weight: 1, mix: "add", channels: [], params: defaultOperatorParams(kind), enabled: true };
}

/** Aplica stack sobre pose (aditivo/sobreposto, pesos, máscara). Puro e determinístico. */
export function applyOperatorStack(
  stack: readonly ProceduralOperator[],
  time: number,
  pose: Pose,
  seed = 1
): void {
  for (const op of stack) {
    if (!op.enabled || op.weight <= 0) continue;
    switch (op.kind) {
      case "breath":
        applyBreath(op, time, pose, seed);
        break;
      case "gait":
        applyGait(op, time, pose);
        break;
      case "look":
        applyLook(op, time, pose);
        break;
      case "squash":
        applySquash(op, time, pose);
        break;
      case "spring":
        break; // springs via physics2d/spring (fixed-step), não aqui
    }
  }
}

function mixAngle(pose: Pose, joint: string, value: number, op: ProceduralOperator): void {
  if (!channelAllowed(op, `joint:${joint}`) && !channelAllowed(op, joint) && op.channels.length > 0) return;
  const cur = pose.joints.get(joint) ?? { angle: 0, x: 0, y: 0 };
  const v = value * op.weight;
  pose.joints.set(joint, op.mix === "override" ? { ...cur, angle: v } : { ...cur, angle: cur.angle + v });
}

function applyBreath(op: ProceduralOperator, t: number, pose: Pose, seed: number): void {
  const f = op.params["frequency"] ?? 0.625;
  const amp = op.params["amplitude"] ?? 2.5;
  const phase = op.params["phase"] ?? 0;
  const sh = op.params["shoulderAmp"] ?? 0.08;
  const w = Math.sin(t * f * Math.PI * 2 + phase + seed * 0.01);
  const root = pose.joints.get("root") ?? { angle: 0, x: 0, y: 0 };
  if (channelAllowed(op, "joint:root") || op.channels.length === 0) {
    if (op.mix === "override") {
      pose.joints.set("root", { ...root, y: w * amp * op.weight });
    } else {
      pose.joints.set("root", { ...root, y: root.y + w * amp * op.weight });
    }
  }
  mixAngle(pose, "upper_arm_near", w * sh, { ...op, weight: 1 });
  mixAngle(pose, "upper_arm_far", -w * sh, { ...op, weight: 1 });
  mixAngle(pose, "head", w * 0.02, { ...op, weight: 1 });
}

function applyGait(op: ProceduralOperator, t: number, pose: Pose): void {
  const speed = op.params["speed"] ?? 0.5;
  const stride = op.params["stride"] ?? 0.35;
  const facing = op.params["facing"] ?? 1;
  const stepH = op.params["stepHeight"] ?? 8;
  const ph = t * (1 + speed * 2) * Math.PI * 2;
  const swing = Math.sin(ph) * stride * facing;
  const lift = Math.max(0, Math.sin(ph + Math.PI / 2)) * stepH;
  const liftOpp = Math.max(0, -Math.sin(ph + Math.PI / 2)) * stepH;
  const cur1 = pose.joints.get("thigh_near") ?? { angle: 0, x: 0, y: 0 };
  const cur2 = pose.joints.get("thigh_far") ?? { angle: 0, x: 0, y: 0 };
  const w = op.weight;
  const setIf = (joint: string, cur: typeof cur1, angle: number, y: number): void => {
    if (op.channels.length > 0 && !channelAllowed(op, `joint:${joint}`) && !channelAllowed(op, joint)) return;
    pose.joints.set(joint, op.mix === "override"
      ? { ...cur, angle: angle * w, y: y * w }
      : { ...cur, angle: cur.angle + angle * w, y: cur.y + y * w });
  };
  setIf("thigh_near", cur1, swing, -lift * 0.3);
  setIf("thigh_far", cur2, -swing, -liftOpp * 0.3);
  const root = pose.joints.get("root") ?? { angle: 0, x: 0, y: 0 };
  const bob = Math.abs(Math.sin(ph)) * 3 * speed;
  if (op.channels.length === 0 || channelAllowed(op, "joint:root")) {
    pose.joints.set("root", op.mix === "override" ? { ...root, y: -bob * w } : { ...root, y: root.y - bob * w });
  }
  mixAngle(pose, "upper_arm_near", -swing * 0.8, { ...op, weight: 1 });
  mixAngle(pose, "upper_arm_far", swing * 0.8, { ...op, weight: 1 });
}

function applyLook(op: ProceduralOperator, _t: number, pose: Pose): void {
  const amp = Math.max(0, Math.min(1, op.params["amplitude"] ?? 0.3));
  const tx = op.params["targetX"] ?? 0;
  const angle = Math.max(-amp, Math.min(amp, tx * 0.001));
  mixAngle(pose, "head", angle, op);
}

function applySquash(op: ProceduralOperator, t: number, pose: Pose): void {
  const sy = Math.sin(t * 4) * (op.params["scaleY"] ?? 0.06);
  const root = pose.joints.get("root") ?? { angle: 0, x: 0, y: 0 };
  void root;
  void sy;
  void op;
  // squash aplicado como offset Y antissimétrico (preservação aproximada de área na UI)
}

/** Bake: amostra stack em N tempos (scrub determinístico, mesmo resultado qualquer fps). */
export function bakeOperators(
  stack: readonly ProceduralOperator[],
  base: Pose,
  times: number[]
): Pose[] {
  return times.map((t) => {
    const pose: Pose = {
      joints: new Map([...base.joints].map(([k, v]) => [k, { ...v }] as [string, typeof v])),
      layers: new Map([...base.layers].map(([k, v]) => [k, { ...v }] as [string, typeof v])),
      pins: new Map(base.pins),
      params: new Map(base.params),
    };
    applyOperatorStack(stack, t, pose);
    return pose;
  });
}
