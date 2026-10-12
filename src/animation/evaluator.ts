/**
 * chocoBones evaluate(t) único e determinístico
 * Mesma função alimenta preview, export e testes. Sem side-effects no clipe.
 */
import { Clip, sampleClip } from "./timeline";
import { createPose, Pose } from "../rig/joint";

/** Avalia clipe em tempo t e retorna nova Pose (pura, sem mutar entrada). */
export function evaluateClip(clip: Clip, t: number): Pose {
  const pose = createPose();
  sampleClip(clip, t, pose);
  return pose;
}

/** Avalia clipe em tempo t escrevendo em pose existente (reuso sem alocação). */
export function evaluateClipInto(clip: Clip, t: number, outPose: Pose): void {
  sampleClip(clip, t, outPose);
}

/** Normaliza tempo com loop determinístico (mesmo resultado em 30/60/120fps). */
export function wrapTime(t: number, duration: number, loop: boolean): number {
  if (duration <= 0) return Math.max(0, t);
  if (!loop) return Math.max(0, Math.min(t, duration));
  let w = t % duration;
  if (w < 0) w += duration;
  return w;
}
