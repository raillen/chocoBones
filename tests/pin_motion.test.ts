import { describe, expect, it } from "vitest";
import { createPinMotionClip, upsertPinKeyframe } from "../src/animation/pin_motion";
import { evaluateClip } from "../src/animation/evaluator";
import { createClip, createKeyframe, Easing } from "../src/animation/timeline";
import type { Pin } from "../src/mesh/mesh";
import { createPose } from "../src/rig/joint";
import { seekTimeline } from "../src/ui/actions/animation_actions";
import type { AppState } from "../src/ui/store";

function pin(id: string, x: number, y: number, overrides: Partial<Pin> = {}): Pin {
  return { id, name: id, x, y, locked: false, ...overrides };
}

const targets = [pin("dragon:eye", 50, 0), pin("left claw custom", 0, 100), pin("right claw custom", 100, 100)];

describe("image pin motion presets", () => {
  it("animates arbitrary real IDs with pixel amplitude and leaves rest untouched", () => {
    const before = structuredClone(targets);
    const clip = createPinMotionClip(targets, { preset: "breath", amplitude: 12, frequency: 1, duration: 2 });
    const pose = evaluateClip(clip, 0.25);
    expect(pose.pins.get("dragon:eye")![1]).toBeCloseTo(-12);
    expect(pose.pins.get("left claw custom")![1]).toBeCloseTo(-1.8);
    expect([...pose.pins.keys()]).toEqual(targets.map((target) => target.id));
    expect(pose.joints.size).toBe(0);
    expect(targets).toEqual(before);
  });

  it("keeps locked pins neutral and excludes disabled pins from bounds and animation", () => {
    const pins = [...targets, pin("anchor", 50, 50, { locked: true }), pin("disabled", 90000, -90000, { enabled: false })];
    const clip = createPinMotionClip(pins, { preset: "breath", amplitude: 8, frequency: 1, duration: 1 });
    const pose = evaluateClip(clip, 0.25);
    expect(pose.pins.get("anchor")).toEqual([0, 0]);
    expect(pose.pins.has("disabled")).toBe(false);
    expect(pose.pins.get("dragon:eye")![1]).toBeCloseTo(-8);
  });

  it("uses frequency as cycles per second and adjusts duration to close the loop", () => {
    const slow = createPinMotionClip(targets, { preset: "sway", amplitude: 10, frequency: 1, duration: 1.3 });
    const fast = createPinMotionClip(targets, { preset: "sway", amplitude: 10, frequency: 2, duration: 1.3 });
    expect(slow.duration).toBe(1);
    expect(fast.duration).toBe(1.5);
    expect(evaluateClip(slow, 0.25).pins.get("dragon:eye")![0]).toBeCloseTo(10);
    expect(evaluateClip(fast, 0.25).pins.get("dragon:eye")![0]).toBeCloseTo(0);
    expect(fast.frames.at(-1)!.pins).toEqual(fast.frames[0]!.pins);
    expect(evaluateClip(fast, fast.duration).pins).toEqual(fast.frames[0]!.pins);
  });

  it("alternates lower step arcs while upper pins bob less", () => {
    const clip = createPinMotionClip(targets, { preset: "walk", amplitude: 20, frequency: 1, duration: 1 });
    const first = evaluateClip(clip, 0.25);
    const other = evaluateClip(clip, 0.75);
    expect(first.pins.get("left claw custom")).toEqual([20, -12]);
    expect(first.pins.get("right claw custom")).toEqual([-20, 0]);
    expect(other.pins.get("left claw custom")![1]).toBeCloseTo(0);
    expect(other.pins.get("right claw custom")![1]).toBeCloseTo(-12);
    expect(Math.abs(first.pins.get("dragon:eye")![1])).toBeLessThan(12);
  });

  it("derives roles independently for each mesh and applies intensity", () => {
    const pins = [pin("a-top", 0, 0, { meshId: "a" }), pin("a-base", 0, 100, { meshId: "a" }),
      pin("b-top", 300, 700, { meshId: "b" }), pin("b-base", 300, 1700, { meshId: "b" })];
    const clip = createPinMotionClip(pins, { preset: "breath", amplitude: 16, frequency: 1, duration: 1, intensity: 0.5 });
    const pose = evaluateClip(clip, 0.25);
    expect(pose.pins.get("a-top")![1]).toBe(-8);
    expect(pose.pins.get("b-top")![1]).toBe(-8);
    const zero = createPinMotionClip(pins, { preset: "sway", amplitude: 16, frequency: 1, duration: 1, intensity: 0 });
    expect([...evaluateClip(zero, 0.25).pins.values()].every(([x, y]) => x === 0 && y === 0)).toBe(true);
  });

  it("returns the same pose for repeated scrubs irrespective of evaluation order", () => {
    const clip = createPinMotionClip(targets, { preset: "walk", amplitude: 14, frequency: 1.25, duration: 2, fps: 60 });
    const expected = evaluateClip(clip, 0.37);
    evaluateClip(clip, 1.2);
    evaluateClip(clip, 0);
    expect(evaluateClip(clip, 0.37)).toEqual(expected);
    const looped = evaluateClip(clip, 0.37 + clip.duration);
    for (const [id, [x, y]] of expected.pins) {
      expect(looped.pins.get(id)![0]).toBeCloseTo(x, 10);
      expect(looped.pins.get(id)![1]).toBeCloseTo(y, 10);
    }
  });

  it("rejects non-finite inputs and handles empty or coincident targets", () => {
    const options = { preset: "breath" as const, amplitude: 10, frequency: 1, duration: 1 };
    for (const key of ["amplitude", "frequency", "duration", "fps", "intensity"] as const) {
      expect(() => createPinMotionClip(targets, { ...options, [key]: Number.NaN })).toThrow(RangeError);
    }
    expect(() => createPinMotionClip([pin("bad", Infinity, 0)], options)).toThrow(RangeError);
    expect(() => createPinMotionClip(targets, { ...options, duration: 0 })).toThrow(RangeError);
    expect(() => createPinMotionClip([pin("same", 0, 0), pin("same", 1, 1)], options)).toThrow(RangeError);
    expect(evaluateClip(createPinMotionClip([], options), 0.25).pins.size).toBe(0);
    const coincident = createPinMotionClip([pin("one", 2, 3), pin("two", 2, 3)], options);
    expect([...evaluateClip(coincident, 0.25).pins.values()].flat().every(Number.isFinite)).toBe(true);
    const extreme = createPinMotionClip([pin("low", -1e308, -1e308), pin("high", 1e308, 1e308)], options);
    expect([...evaluateClip(extreme, 0.25).pins.values()].flat().every(Number.isFinite)).toBe(true);
  });
});

describe("recording and seeking pin keys", () => {
  it("creates neutral boundaries and replaces keys at the same quantized frame", () => {
    const clip = createClip("manual", "Manual", 2, 30, false);
    const pose = createPose();
    pose.pins.set("arbitrary", [20, -10]);
    upsertPinKeyframe(clip, pose, 0.501);
    expect(clip.frames.map((frame) => frame.time)).toEqual([0, 0.5, 2]);
    expect(evaluateClip(clip, 0).pins.get("arbitrary")).toEqual([0, 0]);
    expect(evaluateClip(clip, 0.5).pins.get("arbitrary")).toEqual([20, -10]);
    expect(evaluateClip(clip, 2).pins.get("arbitrary")).toEqual([0, 0]);
    pose.pins.set("arbitrary", [4, 6]);
    upsertPinKeyframe(clip, pose, 0.502);
    expect(clip.frames).toHaveLength(3);
    expect(evaluateClip(clip, 0.5).pins.get("arbitrary")).toEqual([4, 6]);
    pose.pins.get("arbitrary")![0] = 999;
    expect(evaluateClip(clip, 0.5).pins.get("arbitrary")).toEqual([4, 6]);
  });

  it("preserves existing joint, layer and parameter channels when inserting a pin snapshot", () => {
    const clip = createClip("base", "Base", 2, 30, false);
    for (const time of [0, 2]) {
      const frame = createKeyframe(time);
      frame.easing = Easing.Linear;
      frame.joints.set("head", { angle: time * 0.2, x: time, y: 0 });
      frame.layers.set("layer", { x: time * 10, y: 0, rotation: 0, sx: 1, sy: 1, opacity: 1, visible: true, asset: "dragon.png" });
      frame.params.set("blend", time / 2);
      frame.channels = ["joint:head", "layer:layer", "param:blend"];
      clip.frames.push(frame);
    }
    const expected = evaluateClip(clip, 0.75);
    const pose = createPose();
    pose.pins.set("custom", [8, -4]);
    pose.joints.set("head", { angle: 99, x: 99, y: 99 });
    upsertPinKeyframe(clip, pose, 1);
    const actual = evaluateClip(clip, 0.75);
    expect(actual.joints).toEqual(expected.joints);
    expect(actual.layers).toEqual(expected.layers);
    expect(actual.params).toEqual(expected.params);
    expect(evaluateClip(clip, 1).pins.get("custom")).toEqual([8, -4]);
    const before = structuredClone(clip.frames[1]!.joints);
    pose.pins.set("custom", [9, 2]);
    upsertPinKeyframe(clip, pose, 1);
    expect(clip.frames[1]!.joints).toEqual(before);
  });

  it("records complete snapshots and zeros channels missing from the current pose", () => {
    const clip = createClip("snapshots", "Snapshots", 2, 30, false);
    const pose = createPose();
    pose.pins.set("first", [7, 3]);
    upsertPinKeyframe(clip, pose, 0.5);
    pose.pins.clear();
    pose.pins.set("second", [-2, 4]);
    upsertPinKeyframe(clip, pose, 1);
    expect(evaluateClip(clip, 1).pins.get("first")).toEqual([0, 0]);
    expect(evaluateClip(clip, 1).pins.get("second")).toEqual([-2, 4]);
    expect(clip.frames.every((frame) => frame.pins.size === 2)).toBe(true);
  });

  it("preserves smooth and Bézier body easing across an inserted pin key", () => {
    for (const easing of [Easing.Smooth, Easing.Bezier]) {
      const clip = createClip("ease", "Easing", 2, 30, false);
      for (const time of [0, 2]) {
        const frame = createKeyframe(time);
        frame.easing = easing;
        frame.joints.set("moving", { angle: 0, x: time, y: 0 });
        clip.frames.push(frame);
      }
      const times = [0.2, 0.5, 0.75, 1, 1.25, 1.5, 1.8];
      const expected = times.map((time) => evaluateClip(clip, time).joints.get("moving")!.x);
      const pose = createPose();
      pose.pins.set("pin", [8, 3]);
      upsertPinKeyframe(clip, pose, 1);
      times.forEach((time, index) => {
        expect(evaluateClip(clip, time).joints.get("moving")!.x).toBeCloseTo(expected[index]!, 4);
      });
      expect(evaluateClip(clip, 1).pins.get("pin")![0]).toBeCloseTo(8, 4);
    }
  });

  it("adds neutral missing endpoints to an existing pin-only clip", () => {
    const clip = createClip("middle", "Middle", 2, 30, false);
    const key = createKeyframe(1);
    key.pins.set("pin", [4, 5]);
    clip.frames.push(key);
    const pose = createPose();
    pose.pins.set("pin", [8, 9]);
    upsertPinKeyframe(clip, pose, 0.5);
    expect(evaluateClip(clip, 0).pins.get("pin")).toEqual([0, 0]);
    expect(evaluateClip(clip, 2).pins.get("pin")).toEqual([0, 0]);
    expect(evaluateClip(clip, 1).pins.get("pin")).toEqual([4, 5]);
  });

  it("keeps a loop endpoint distinct from the preceding FPS-grid frame", () => {
    const clip = createPinMotionClip(targets, { preset: "sway", amplitude: 10, frequency: 6, duration: 0.1, fps: 25 });
    const pose = evaluateClip(clip, 0.16);
    pose.pins.set("dragon:eye", [5, 3]);
    upsertPinKeyframe(clip, pose, 0.16);
    expect(clip.frames.at(-1)!.time).toBe(clip.duration);
    expect(clip.frames.at(-1)!.pins).toEqual(clip.frames[0]!.pins);
    expect(evaluateClip(clip, 0.16).pins.get("dragon:eye")).toEqual([5, 3]);
  });

  it("mirrors edited loop boundary pins while preserving the other endpoint tracks", () => {
    const clip = createPinMotionClip(targets, { preset: "breath", amplitude: 5, frequency: 1, duration: 1 });
    clip.frames.at(-1)!.joints.set("end-joint", { angle: 0.2, x: 0, y: 0 });
    const pose = createPose();
    pose.pins.set("dragon:eye", [3, -2]);
    upsertPinKeyframe(clip, pose, 0);
    expect(clip.frames.at(-1)!.pins).toEqual(clip.frames[0]!.pins);
    expect(clip.frames.at(-1)!.joints.get("end-joint")!.angle).toBe(0.2);
    expect(clip.frames.at(-1)!.pins.get("dragon:eye")).not.toBe(clip.frames[0]!.pins.get("dragon:eye"));
  });

  it("rejects invalid recording data atomically", () => {
    const clip = createClip("bad", "Bad", 1, 30, false);
    const pose = createPose();
    pose.pins.set("bad", [NaN, 2]);
    expect(() => upsertPinKeyframe(clip, pose, 0.5)).toThrow(RangeError);
    expect(clip.frames).toEqual([]);
    pose.pins.set("bad", [1, 2]);
    expect(() => upsertPinKeyframe(clip, pose, Infinity)).toThrow(RangeError);
    expect(clip.frames).toEqual([]);
  });

  it("updates a paused pose immediately when seeking and leaves pin rest positions untouched", () => {
    const pins = structuredClone(targets);
    const clip = createPinMotionClip(pins, { preset: "breath", amplitude: 10, frequency: 1, duration: 1 });
    const state = { timelineTime: 0, timelineDuration: clip.duration, activeClip: clip,
      currentPose: createPose(), isPlaying: false, pins } as unknown as AppState;
    seekTimeline(state, 0.25);
    expect(state.timelineTime).toBe(0.25);
    expect(state.currentPose.pins.get("dragon:eye")![1]).toBeCloseTo(-10);
    expect(state.pins).toEqual(targets);
    expect(state.isPlaying).toBe(false);
    seekTimeline(state, 0.75);
    expect(state.currentPose.pins.get("dragon:eye")![1]).toBeCloseTo(10);
  });
});
