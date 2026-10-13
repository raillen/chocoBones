import { describe, expect, it } from "vitest";
import { createPin } from "../src/mesh/mesh";
import { createPose, type Layer } from "../src/rig/joint";
import { createInitialAppState } from "../src/ui/store";
import { pickScenePin, pinLocalPoint, pinWorldPoint } from "../src/ui/viewport/pin_space";

function scene() {
  const state = createInitialAppState();
  const layer: Layer = {
    id: "art", name: "Artwork", asset: "art.png", joint: "", visible: true, locked: false,
    opacity: 1, hasSeamMask: false,
    seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    transform: { pos: [100, 200], scale: [2, 3], rotation: 0, pivot: [0, 0] },
  };
  const pin = createPin("pin", "0", 10, 20);
  state.joints = [];
  state.layers = [layer];
  state.meshLayer = new Map([[layer.id, "0"]]);
  state.pins = [pin];
  state.currentPose = createPose();
  return { state, layer, pin };
}

describe("pin scene coordinates", () => {
  it("renders and picks a posed pin on translated, scaled artwork", () => {
    const { state, pin } = scene();
    state.currentPose.pins.set(pin.id, [5, -2]);
    expect(pinWorldPoint(state, pin)).toEqual([130, 254]);
    expect(pinLocalPoint(state, pin, [130, 254])).toEqual([15, 18]);
    expect(pickScenePin(state, [130, 254], 1)).toBe(pin.id);
    expect(pickScenePin(state, [15, 18], 1)).toBe("");
    expect([pin.x, pin.y]).toEqual([10, 20]);
  });

  it("accounts for rotation and pivot rather than using a world delta as a local delta", () => {
    const { state, layer, pin } = scene();
    layer.transform.rotation = Math.PI / 2;
    layer.transform.pivot = [5, 10];
    expect(pinWorldPoint(state, pin)[0]).toBeCloseTo(70);
    expect(pinWorldPoint(state, pin)[1]).toBeCloseTo(210);
    const local = pinLocalPoint(state, pin, [61, 214])!;
    expect(local[0]).toBeCloseTo(12);
    expect(local[1]).toBeCloseTo(23);
  });

  it("includes layer animation and uses an explicitly supplied pose for frame previews", () => {
    const { state, pin } = scene();
    state.currentPose.layers.set("art", { x: 50, y: -25, rotation: 0, sx: 0.5, sy: 2, opacity: 1, visible: true, asset: "" });
    state.currentPose.pins.set(pin.id, [2, 3]);
    expect(pinWorldPoint(state, pin)).toEqual([162, 313]);
    expect(pinLocalPoint(state, pin, [162, 313])).toEqual([12, 23]);
    const preview = createPose();
    preview.pins.set(pin.id, [-1, -2]);
    expect(pinWorldPoint(state, pin, preview)).toEqual([118, 254]);
  });

  it("matches artwork attached to a rotated animated joint", () => {
    const { state, layer, pin } = scene();
    state.joints = [{ id: "root", parent: "", name: "Root", x: 10, y: 20, color: "#fff" }];
    layer.joint = "root";
    layer.transform = { pos: [10, 20], scale: [1, 1], rotation: 0, pivot: [0, 0] };
    state.currentPose.joints.set("root", { x: 3, y: 4, angle: Math.PI / 2 });
    const world = pinWorldPoint(state, pin);
    expect(world[0]).toBeCloseTo(-7);
    expect(world[1]).toBeCloseTo(34);
    const local = pinLocalPoint(state, pin, world)!;
    expect(local[0]).toBeCloseTo(pin.x);
    expect(local[1]).toBeCloseTo(pin.y);
    expect(pickScenePin(state, world, 0.1)).toBe(pin.id);
  });

  it("keeps locked anchors at rest while allowing their selection", () => {
    const { state, pin } = scene();
    pin.locked = true;
    state.currentPose.pins.set(pin.id, [50, 50]);
    expect(pinWorldPoint(state, pin)).toEqual([120, 260]);
    expect(pickScenePin(state, [120, 260], 0)).toBe(pin.id);
    expect(pickScenePin(state, [220, 410], 1)).toBe("");
    expect(pinLocalPoint(state, pin, [120, 260])).toBeNull();
  });

  it.each(["hidden", "locked", "poseHidden"])("prevents picking or editing %s artwork", (reason) => {
    const { state, layer, pin } = scene();
    if (reason === "hidden") layer.visible = false;
    if (reason === "locked") layer.locked = true;
    if (reason === "poseHidden") state.currentPose.layers.set("art", { x: 0, y: 0, rotation: 0, sx: 1, sy: 1, opacity: 1, visible: false, asset: "" });
    expect(pickScenePin(state, [120, 260], 5)).toBe("");
    expect(pinLocalPoint(state, pin, [120, 260])).toBeNull();
  });

  it("ignores disabled pins and chooses the nearest enabled pin", () => {
    const { state, pin } = scene();
    pin.enabled = false;
    state.pins.push(createPin("near", "0", 11, 20), createPin("far", "0", 14, 20));
    expect(pickScenePin(state, [120, 260], 10)).toBe("near");
    expect(pinLocalPoint(state, pin, [120, 260])).toBeNull();
  });

  it("retains identity coordinates for legacy pins without an associated layer", () => {
    const { state, pin } = scene();
    state.meshLayer.clear();
    state.currentPose.pins.set(pin.id, [2, 3]);
    expect(pinWorldPoint(state, pin)).toEqual([12, 23]);
    expect(pinLocalPoint(state, pin, [12, 23])).toEqual([12, 23]);
    expect(pickScenePin(state, [12, 23], 0)).toBe(pin.id);
    pin.meshId = undefined;
    expect(pinWorldPoint(state, pin)).toEqual([12, 23]);
  });

  it("refuses an inverse for a singular or nonfinite layer transform", () => {
    const { state, layer, pin } = scene();
    layer.transform.scale = [0, 1];
    expect(pinLocalPoint(state, pin, [100, 220])).toBeNull();
    layer.transform.scale = [1, Infinity];
    expect(pinLocalPoint(state, pin, [100, 220])).toBeNull();
  });

  it("ignores nonfinite pointers and invalid hit radii", () => {
    const { state, pin } = scene();
    expect(pinLocalPoint(state, pin, [NaN, 0])).toBeNull();
    expect(pickScenePin(state, [NaN, 0], 10)).toBe("");
    expect(pickScenePin(state, [120, 260], -1)).toBe("");
    expect(pickScenePin(state, [120, 260], NaN)).toBe("");
  });
});
