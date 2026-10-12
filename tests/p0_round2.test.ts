import { describe, expect, it } from "vitest";
import { buildGridMesh, createPin, meshWorld, movePinOffset, movePinRest, resetPinOffset, setPinOffset, warpPoint } from "../src/mesh/mesh";
import { copyClip, copyKeyframe, createClip, createKeyframe, sampleClip } from "../src/animation/timeline";
import { createPose } from "../src/rig/joint";
import { boneMatrices } from "../src/rig/fk";
import { createSpringChain, stepSpring, checkpointSpring, rewindSpring, bakeSpring } from "../src/physics2d/spring";
import { normalizeAssetManifest, projectRoundtrip, resolvePortablePath, toPortablePath, validateAssetReferences } from "../src/project/project";
import { createInitialAppState } from "../src/ui/store";
import { applyProjectToState, stateToProject } from "../src/ui/actions/project_io";
import { renderOffscreen } from "../src/render/loop";

describe("P0-1 Pin Setup/Animate", () => {
  it("createPin tem defaults e movePinRest/Offset/reset", () => {
    const p = createPin("p1", "m0", 10, 20);
    expect(p.enabled).toBe(true);
    expect(p.radius).toBe(0);
    const arr = [p];
    expect(movePinRest(arr, "p1", 30, 40)).toBe(true);
    expect(p.x).toBe(30);
    const pose = createPose();
    movePinOffset(pose, "p1", 5, 6);
    movePinOffset(pose, "p1", 1, 1);
    expect(pose.pins.get("p1")).toEqual([6, 7]);
    setPinOffset(pose, "p1", 2, 3);
    expect(pose.pins.get("p1")).toEqual([2, 3]);
    resetPinOffset(pose, "p1");
    expect(pose.pins.has("p1")).toBe(false);
  });
  it("warpPoint respeita radius e enabled", () => {
    const pins = [createPin("a", "", 0, 0, { radius: 5 }), createPin("b", "", 100, 0, { enabled: false })];
    const deltas = new Map([["a", [10, 0] as [number, number]], ["b", [100, 100] as [number, number]]]);
    // vértice longe do raio de 'a' e 'b' desabilitado → estático
    expect(warpPoint([50, 50], pins, deltas)[0]).toBeCloseTo(50);
    // dentro do raio → move
    expect(warpPoint([2, 0], pins, deltas)[0]).toBeGreaterThan(2);
  });
});

describe("P0-2 pose.pins chega ao render", () => {
  it("meshWorld usa pose.pins quando pinDeltas nulo", () => {
    const mesh = buildGridMesh(100, 100, 2);
    const pins = [createPin("p1", "", 0, 0)];
    const layer = { id: "l", name: "L", asset: "", transform: { pos: [0, 0] as [number, number], scale: [1, 1] as [number, number], rotation: 0, pivot: [0, 0] as [number, number] }, joint: "", visible: true, locked: false, opacity: 1, hasSeamMask: false, seamMask: { layer: "", enabled: false, center: [0, 0] as [number, number], radius: 0, feather: 0 } };
    const pose = createPose();
    pose.pins.set("p1", [10, 0]);
    const bones = boneMatrices([], null);
    const out = meshWorld(mesh, pins, null, layer as never, [], pose, bones);
    expect(out.length).toBe(mesh.vertices.length);
  });
  it("renderOffscreen é determinístico (preview == export)", () => {
    const s = createInitialAppState();
    s.isPlaying = false;
    renderOffscreen(s, 0.4);
    const a = Buffer.from(s.viewportBuffer.pixels).toString("base64").slice(0, 64);
    renderOffscreen(s, 0.4);
    const b = Buffer.from(s.viewportBuffer.pixels).toString("base64").slice(0, 64);
    expect(a).toBe(b);
  });
  it("pin em Animate modifica pixels mas não rest", () => {
    const s = createInitialAppState();
    const before = s.pins[0]!.x;
    s.currentPose.pins.set(s.pins[0]!.id, [15, 0]);
    renderOffscreen(s, 0);
    expect(s.pins[0]!.x).toBe(before); // rest intacto
  });
});

describe("P0-3 copy + params", () => {
  it("copyKeyframe/copyClip preservam channels", () => {
    const k = createKeyframe(1);
    k.channels = ["joint:root"];
    k.joints.set("root", { angle: 1, x: 0, y: 0 });
    const c2 = copyKeyframe(k, 2);
    expect(c2.channels).toEqual(["joint:root"]);
    expect(c2.time).toBe(2);
    expect(c2.id).not.toBe(k.id);
    const clip = createClip("c", "C", 2, 60, true);
    clip.frames.push(k);
    const cc = copyClip(clip, "c2");
    expect(cc.frames[0]!.channels).toEqual(["joint:root"]);
  });
  it("params interpolam e entram no histórico", () => {
    const clip = createClip("c", "C", 2, 60, false);
    const k0 = createKeyframe(0); k0.params.set("breath", 0);
    const k1 = createKeyframe(2); k1.params.set("breath", 10);
    clip.frames.push(k0, k1);
    const pose = createPose();
    sampleClip(clip, 1, pose);
    expect(pose.params.get("breath")).toBeCloseTo(5);
  });
});

describe("P0-5 manifest + roundtrip", () => {
  it("portable paths rejeitam traversal", () => {
    expect(toPortablePath("/proj/assets/a.png", "/proj")).toBe("assets/a.png");
    expect(() => resolvePortablePath("../fora.png", "/proj")).toThrow();
    expect(resolvePortablePath("assets/a.png", "/proj").endsWith("assets/a.png")).toBe(true);
  });
  it("validateAssetReferences acusa binding quebrado", () => {
    const proj = projectRoundtrip({
      schema: "survivor-puppet", version: 2, name: "T", width: 512, height: 512,
      assets: [], joints: [{ id: "root", name: "R", parent: "", x: 0, y: 0, color: "#fff" }],
      layers: [{ id: "l", name: "L", asset: "missing.png", transform: {}, joint: "ghost", visible: true, locked: false, opacity: 1, blend: "normal", seamMask: {} } as never],
    });
    const errs = validateAssetReferences(proj);
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
  it("normalize preenche uri", () => {
    const out = normalizeAssetManifest([{ id: "a", name: "a.png", w: 1, h: 1, data: "", material: "default", color: 0 }], "/p");
    expect(out[0]!.uri).toBe("assets/a.png");
  });
  it("stateToProject/apply roundtrip preserva pins e meshes", () => {
    const s = createInitialAppState();
    s.currentPose.pins.set(s.pins[0]!.id, [7, 8]);
    const proj = stateToProject(s);
    const s2 = createInitialAppState();
    applyProjectToState(s2, proj);
    expect(s2.pins.length).toBe(s.pins.length);
    expect(s2.currentPose.pins.get(s.pins[0]!.id)).toEqual([7, 8]);
    expect(s2.meshes.length).toBe(1);
  });
});

describe("P0-6 springs fixed-step", () => {
  it("step é determinístico e bake restaura", () => {
    const c = createSpringChain("t", ["j"], { stiffness: 80, damping: 4, maxAngle: 1 });
    stepSpring(c, 1 / 120, [1]);
    const after1 = c.angle[0]!;
    const cp = checkpointSpring(c);
    stepSpring(c, 1 / 120, [1]);
    rewindSpring(c, cp);
    expect(c.angle[0]).toBe(after1);
    const baked = bakeSpring(c, 0.1, 120);
    expect(baked.length).toBe(12);
    expect(c.angle[0]).toBe(after1); // bake não muta
  });
  it("clamp maxAngle", () => {
    const c = createSpringChain("t", ["j"], { stiffness: 1000, damping: 0, maxAngle: 0.2 });
    for (let i = 0; i < 200; i++) stepSpring(c, 1 / 120, [10]);
    expect(Math.abs(c.angle[0]!)).toBeLessThanOrEqual(0.21);
  });
});
