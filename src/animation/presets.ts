/**
 * chocoBones TypeScript Animation Presets (Idle & Walk Clips)
 */

import { Easing, createClip, createKeyframe, Clip } from "./timeline";

export function createIdleClip(): Clip {
  const clip = createClip("idle", "Respiração / Repouso", 1.6, 60.0, true);

  const k0 = createKeyframe(0.0);
  k0.easing = Easing.Smooth;
  k0.joints.set("root", { angle: 0.0, x: 0, y: 0 });
  k0.joints.set("head", { angle: 0.0, x: 0, y: 0 });
  k0.joints.set("upper_arm_near", { angle: 0.1, x: 0, y: 0 });
  k0.joints.set("forearm_near", { angle: -0.15, x: 0, y: 0 });
  k0.joints.set("upper_arm_far", { angle: -0.1, x: 0, y: 0 });
  k0.joints.set("forearm_far", { angle: -0.15, x: 0, y: 0 });
  clip.frames.push(k0);

  const k1 = createKeyframe(0.8);
  k1.easing = Easing.Smooth;
  k1.joints.set("root", { angle: 0.0, x: 0, y: -2.5 });
  k1.joints.set("head", { angle: -0.04, x: 0, y: 0 });
  k1.joints.set("upper_arm_near", { angle: 0.18, x: 0, y: 0 });
  k1.joints.set("forearm_near", { angle: -0.24, x: 0, y: 0 });
  k1.joints.set("upper_arm_far", { angle: -0.18, x: 0, y: 0 });
  k1.joints.set("forearm_far", { angle: -0.24, x: 0, y: 0 });
  clip.frames.push(k1);

  const k2 = createKeyframe(1.6);
  k2.easing = Easing.Smooth;
  for (const [id, delta] of k0.joints) {
    k2.joints.set(id, { ...delta });
  }
  clip.frames.push(k2);

  return clip;
}

export function createWalkClip(): Clip {
  const clip = createClip("walk", "Ciclo de Caminhada", 1.6, 60.0, true);

  const k0 = createKeyframe(0.0);
  k0.easing = Easing.Smooth;
  k0.joints.set("root", { angle: 0.0, x: 0, y: 0 });
  k0.joints.set("thigh_near", { angle: 0.35, x: 0, y: 0 });
  k0.joints.set("thigh_far", { angle: -0.35, x: 0, y: 0 });
  k0.joints.set("upper_arm_near", { angle: -0.3, x: 0, y: 0 });
  k0.joints.set("upper_arm_far", { angle: 0.3, x: 0, y: 0 });
  clip.frames.push(k0);

  const k1 = createKeyframe(0.8);
  k1.easing = Easing.Smooth;
  k1.joints.set("root", { angle: 0.0, x: 0, y: 0 });
  k1.joints.set("thigh_near", { angle: -0.35, x: 0, y: 0 });
  k1.joints.set("thigh_far", { angle: 0.35, x: 0, y: 0 });
  k1.joints.set("upper_arm_near", { angle: 0.3, x: 0, y: 0 });
  k1.joints.set("upper_arm_far", { angle: -0.3, x: 0, y: 0 });
  clip.frames.push(k1);

  const k2 = createKeyframe(1.6);
  k2.easing = Easing.Smooth;
  for (const [id, delta] of k0.joints) {
    k2.joints.set(id, { ...delta });
  }
  clip.frames.push(k2);

  return clip;
}
