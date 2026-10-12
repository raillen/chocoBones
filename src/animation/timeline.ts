/**
 * chocoBones TypeScript Animation Timeline & Interpolation
 */

import { bezierSolve, lerp } from "../core/math";
import { nextKeyframeId } from "../core/ids";
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
  params: Map<string, number>;
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
    id: nextKeyframeId(),
    time,
    joints: new Map(),
    layers: new Map(),
    pins: new Map(),
    params: new Map(),
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

/** Ordena frames in-place por tempo. Chamar uma vez após edição, não por amostra. */
export function sortClipFrames(clip: Clip): void {
  clip.frames.sort((a, b) => a.time - b.time);
}

/** Verifica se frames já estão ordenados (O(n), sem alocação). */
export function isClipSorted(clip: Clip): boolean {
  for (let i = 1; i < clip.frames.length; i++) {
    if (clip.frames[i]!.time < clip.frames[i - 1]!.time) return false;
  }
  return true;
}

/** Limpa pose de saída para evitar resíduos do clipe anterior (P0-4). */
export function clearPose(outPose: Pose): void {
  outPose.joints.clear();
  outPose.layers.clear();
  outPose.pins.clear();
  outPose.params.clear();
}

function channelAllows(channels: string[], kind: string, id: string): boolean {
  if (channels.length === 0) return true;
  return channels.includes(`${kind}:${id}`) || channels.includes(id);
}

export function sampleClip(clip: Clip, targetTime: number, outPose: Pose): void {
  // Limpeza explícita a cada amostragem: distingue canal ausente de valor zero
  clearPose(outPose);
  if (clip.frames.length === 0) return;

  let t = targetTime;
  if (clip.loop && clip.duration > 0) {
    t = t % clip.duration;
    if (t < 0) t += clip.duration;
  }

  // Evita sort por amostra: só copia+ordena se detectado fora de ordem
  let sorted: Keyframe[];
  if (isClipSorted(clip)) {
    sorted = clip.frames;
  } else {
    sorted = [...clip.frames].sort((a, b) => a.time - b.time);
  }

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

  // Canais ativos: união dos channels declarados, ou todos se vazio (legado)
  const useChannels = prev.channels.length > 0 || next.channels.length > 0;
  const allowed = (kind: string, id: string): boolean => {
    if (!useChannels) return true;
    return channelAllows(prev.channels, kind, id) || channelAllows(next.channels, kind, id);
  };

  // Interpola juntas
  const jointKeys = new Set([...prev.joints.keys(), ...next.joints.keys()]);
  for (const jId of jointKeys) {
    if (!allowed("joint", jId)) continue;
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
    if (!allowed("layer", lId)) continue;
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

  // Interpola pinos MLS (offsets animados relativos ao rest)
  const pinKeys = new Set([...prev.pins.keys(), ...next.pins.keys()]);
  for (const pId of pinKeys) {
    if (!allowed("pin", pId)) continue;
    const p0 = prev.pins.get(pId) ?? [0, 0] as Vec2;
    const p1 = next.pins.get(pId) ?? [0, 0] as Vec2;
    outPose.pins.set(pId, [lerp(p0[0], p1[0], factor), lerp(p0[1], p1[1], factor)]);
  }

  // Interpola parâmetros procedurais (P0-3)
  const paramKeys = new Set([...prev.params.keys(), ...next.params.keys()]);
  for (const par of paramKeys) {
    if (!allowed("param", par)) continue;
    const v0 = prev.params.get(par) ?? 0;
    const v1 = next.params.get(par) ?? 0;
    outPose.params.set(par, lerp(v0, v1, factor));
  }
}

function applyKeyframeToPose(kf: Keyframe, pose: Pose): void {
  for (const [k, v] of kf.joints) {
    if (kf.channels.length > 0 && !channelAllows(kf.channels, "joint", k)) continue;
    pose.joints.set(k, { ...v });
  }
  for (const [k, v] of kf.layers) {
    if (kf.channels.length > 0 && !channelAllows(kf.channels, "layer", k)) continue;
    pose.layers.set(k, { ...v });
  }
  for (const [k, v] of kf.pins) {
    if (kf.channels.length > 0 && !channelAllows(kf.channels, "pin", k)) continue;
    pose.pins.set(k, [...v] as Vec2);
  }
  for (const [k, v] of kf.params) {
    if (kf.channels.length > 0 && !channelAllows(kf.channels, "param", k)) continue;
    pose.params.set(k, v);
  }
}

/** Deep-copy de keyframe preservando channels (P0-3). */
export function copyKeyframe(kf: Keyframe, newTime?: number): Keyframe {
  return {
    id: nextKeyframeId(),
    time: newTime ?? kf.time,
    joints: new Map([...kf.joints].map(([k, v]) => [k, { ...v }] as [string, JointDelta])),
    layers: new Map([...kf.layers].map(([k, v]) => [k, { ...v }] as [string, LayerDelta])),
    pins: new Map([...kf.pins].map(([k, v]) => [k, [...v] as Vec2] as [string, Vec2])),
    params: new Map(kf.params),
    easing: kf.easing,
    bezier: [...kf.bezier] as [number, number, number, number],
    channels: [...kf.channels],
  };
}

/** Deep-copy de clipe preservando channels e ordem. */
export function copyClip(clip: Clip, newId: string, newName?: string): Clip {
  return {
    id: newId,
    name: newName ?? clip.name,
    duration: clip.duration,
    fps: clip.fps,
    loop: clip.loop,
    frames: clip.frames.map((f) => copyKeyframe(f)),
  };
}
