/**
 * chocoBones TypeScript Animation Timeline & Interpolation
 */

import { bezierSolve, lerp } from "../core/math";
import { Vec2 } from "../core/types";
import { JointDelta, LayerDelta, Pose } from "../rig/joint";

export enum Easing {
  Linear = "Linear",
  Smooth = "Smooth",
  Hold = "Hold",
  Bezier = "Bezier",
}

export interface Keyframe {
  id: string;
  time: number;
  joints: Map<string, JointDelta>;
  layers: Map<string, LayerDelta>;
  pins: Map<string, Vec2>;
  easing: Easing;
  bezier: [number, number, number, number];
  channels: string[];
}

export interface Clip {
  id: string;
  name: string;
  duration: number;
  fps: number;
  loop: boolean;
  frames: Keyframe[];
}

export function createKeyframe(time = 0.0): Keyframe {
  return {
    id: `kf_${Math.random().toString(36).substring(2, 9)}`,
    time,
    joints: new Map(),
    layers: new Map(),
    pins: new Map(),
    easing: Easing.Smooth,
    bezier: [0.25, 0.1, 0.25, 1.0],
    channels: [],
  };
}

export function createClip(id: string, name: string, duration = 2.0, fps = 60.0, loop = true): Clip {
  return {
    id,
    name,
    duration,
    fps,
    loop,
    frames: [],
  };
}

export function easingFactor(k: Keyframe, t: number): number {
  switch (k.easing) {
    case Easing.Hold:
      return 0.0;
    case Easing.Smooth:
      return t * t * (3.0 - 2.0 * t);
    case Easing.Bezier:
      return bezierSolve(t, k.bezier[0], k.bezier[1], k.bezier[2], k.bezier[3]);
    case Easing.Linear:
    default:
      return t;
  }
}

export function sampleClip(clip: Clip, targetTime: number, outPose: Pose): void {
  if (clip.frames.length === 0) return;

  let t = targetTime;
  if (clip.loop && clip.duration > 0) {
    t = t % clip.duration;
    if (t < 0) t += clip.duration;
  }

  // Ordena os quadros por tempo se necessário
  const sorted = [...clip.frames].sort((a, b) => a.time - b.time);

  if (t <= sorted[0]!.time) {
    applyKeyframeToPose(sorted[0]!, outPose);
    return;
  }

  const lastFrame = sorted[sorted.length - 1]!;
  if (t >= lastFrame.time) {
    applyKeyframeToPose(lastFrame, outPose);
    return;
  }

  // Encontra o par de quadros adjacentes
  let prev = sorted[0]!;
  let next = lastFrame;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (t >= sorted[i]!.time && t <= sorted[i + 1]!.time) {
      prev = sorted[i]!;
      next = sorted[i + 1]!;
      break;
    }
  }

  const span = next.time - prev.time;
  const rawRatio = span > 0 ? (t - prev.time) / span : 0;
  const factor = easingFactor(prev, rawRatio);

  // Interpola juntas
  const jointKeys = new Set([...prev.joints.keys(), ...next.joints.keys()]);
  for (const jId of jointKeys) {
    const jd0 = prev.joints.get(jId) ?? { angle: 0, x: 0, y: 0 };
    const jd1 = next.joints.get(jId) ?? { angle: 0, x: 0, y: 0 };

    outPose.joints.set(jId, {
      angle: lerp(jd0.angle, jd1.angle, factor),
      x: lerp(jd0.x, jd1.x, factor),
      y: lerp(jd0.y, jd1.y, factor),
    });
  }

  // Interpola camadas
  const layerKeys = new Set([...prev.layers.keys(), ...next.layers.keys()]);
  for (const lId of layerKeys) {
    const ld0 = prev.layers.get(lId) ?? { x: 0, y: 0, rotation: 0, sx: 1, sy: 1, opacity: 1, visible: true, asset: "" };
    const ld1 = next.layers.get(lId) ?? { x: 0, y: 0, rotation: 0, sx: 1, sy: 1, opacity: 1, visible: true, asset: "" };

    outPose.layers.set(lId, {
      x: lerp(ld0.x, ld1.x, factor),
      y: lerp(ld0.y, ld1.y, factor),
      rotation: lerp(ld0.rotation, ld1.rotation, factor),
      sx: lerp(ld0.sx, ld1.sx, factor),
      sy: lerp(ld0.sy, ld1.sy, factor),
      opacity: lerp(ld0.opacity, ld1.opacity, factor),
      visible: ld1.visible,
      asset: ld1.asset || ld0.asset,
    });
  }
}

function applyKeyframeToPose(kf: Keyframe, pose: Pose): void {
  for (const [k, v] of kf.joints) {
    pose.joints.set(k, { ...v });
  }
  for (const [k, v] of kf.layers) {
    pose.layers.set(k, { ...v });
  }
}
