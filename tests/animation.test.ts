import { describe, expect, it } from "vitest";
import { createIdleClip, createWalkClip } from "../src/animation/presets";
import { createKeyframe, Easing, easingFactor, sampleClip } from "../src/animation/timeline";
import { createPose } from "../src/rig/joint";

describe("Animation Easing & Factors", () => {
  it("evaluates linear easing correctly", () => {
    const kf = createKeyframe(0.0);
    kf.easing = Easing.Linear;
    expect(easingFactor(kf, 0.5)).toBeCloseTo(0.5);
  });

  it("evaluates smooth easing (hermite curve)", () => {
    const kf = createKeyframe(0.0);
    kf.easing = Easing.Smooth;
    // Hermite em t=0.5: 0.5 * 0.5 * (3 - 2 * 0.5) = 0.25 * 2 = 0.5
    expect(easingFactor(kf, 0.5)).toBeCloseTo(0.5);
  });
});

describe("Clip Sampling & Presets", () => {
  it("samples idle clip at midpoint with smooth interpolation", () => {
    const clip = createIdleClip();
    const pose = createPose();

    sampleClip(clip, 0.4, pose);
    const rootDelta = pose.joints.get("root");
    expect(rootDelta).toBeDefined();
    // No frame 0.0s y=0, no frame 0.8s y=-2.5. Em 0.4s deve estar intermediário negativo
    expect(rootDelta!.y).toBeLessThan(0);
    expect(rootDelta!.y).toBeGreaterThan(-2.5);
  });

  it("loops clip time smoothly", () => {
    const clip = createWalkClip();
    const pose1 = createPose();
    const pose2 = createPose();

    sampleClip(clip, 0.2, pose1);
    sampleClip(clip, 1.8, pose2); // 1.8 % 1.6 = 0.2
    expect(pose1.joints.get("thigh_near")!.angle).toBeCloseTo(pose2.joints.get("thigh_near")!.angle);
  });
});
