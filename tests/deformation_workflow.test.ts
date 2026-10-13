import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClip, createKeyframe, Easing } from "../src/animation/timeline";
import { decodePng } from "../src/assets/png";
import type { Vec2 } from "../src/core/types";
import { createPin, MeshMode, SkinningMode } from "../src/mesh/mesh";
import { deformSpriteMesh } from "../src/render/deformed_sprite";
import { encodeRgbaToPng } from "../src/render/png_export";
import { renderArtwork } from "../src/render/sprite_scene";
import { applyProjectToState, stateToProject } from "../src/ui/actions/project_io";
import { importSpriteData, rebuildSpriteMesh, setSpriteDeformation } from "../src/ui/actions/sprite_actions";
import { createInitialAppState, type AppState } from "../src/ui/store";
import { EditorMode } from "../src/ui/modes";
import { pinLocalPoint, pinWorldPoint, pickScenePin } from "../src/ui/viewport/pin_space";
import { loadProjectFromJson, saveProjectToJson } from "../src/project/project";

vi.mock("slint-ui", () => ({ ArrayModel: class { constructor(public rows: unknown[]) {} } }));
vi.mock("../src/render/loop", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/render/loop")>(), startRenderLoop: () => () => {},
}));
import { bindSlintWindow, exportPngSync } from "../src/ui/bridge";

afterEach(() => vi.restoreAllMocks());

const SMALL_PNG = (() => {
  const pixels = new Uint8ClampedArray(32 * 48 * 4);
  for (let y = 5; y < 44; y++) for (let x = 5; x < 27; x++) {
    if (y < 14 && (x < 10 || x > 21)) continue;
    if (y > 35 && x >= 14 && x < 18) continue;
    pixels.set([35 + x * 6, 35 + y * 4, 120, 255], (y * 32 + x) * 4);
  }
  return encodeRgbaToPng(32, 48, pixels);
})();

function fixture() {
  const state = createInitialAppState();
  state.joints = [];
  state.layers = [];
  state.meshes = [];
  state.pins = [];
  state.meshLayer.clear();
  state.meshUvs.clear();
  state.meshRows = 4;
  state.meshCols = 4;
  state.refineEdges = false;
  state.edgeSize = 4;
  state.activeClip = createClip("deformation", "Deformation", 1, 24, false);
  const layer = importSpriteData(state, SMALL_PNG, "off-grid-hero.png");
  const meshId = state.meshLayer.get(layer.id)!;
  const pins = [
    createPin("base", meshId, 13.25, 31.75, { locked: true }),
    createPin("head", meshId, 15.35, 12.45),
    createPin("side", meshId, 23.65, 25.2),
  ];
  state.pins = pins;
  const window: any = { viewport_width: state.viewportBuffer.width, viewport_height: state.viewportBuffer.height };
  bindSlintWindow(window, state);
  return { state, window, layer, meshId, pins };
}

function packet(state: AppState, meshId: string) {
  return deformSpriteMesh(
    state.meshes[Number(meshId)]!, state.meshUvs.get(meshId)!,
    state.pins.filter((pin) => pin.meshId === meshId), state.currentPose.pins,
  );
}

function expectPoint(actual: Vec2, expected: Vec2): void {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
}

function expectHandles(state: AppState, meshId: string): void {
  const output = packet(state, meshId);
  const strength = state.meshes[Number(meshId)]!.strength;
  state.pins.filter((pin) => pin.meshId === meshId).forEach((pin, i) => {
    if (pin.enabled === false) return;
    const index = output.pinIndices[i];
    expect(index).not.toBeNull();
    expect(index).toBeDefined();
    const delta = pin.locked ? [0, 0] : state.currentPose.pins.get(pin.id) ?? [0, 0];
    expectPoint(output.vertices[index!]!, [pin.x + delta[0]! * strength, pin.y + delta[1]! * strength]);
  });
}

describe("deformation tools through the editor document", () => {
  it("inserts exact off-grid ARAP handles with valid texture topology and preserves the neutral artwork", () => {
    const { state, meshId, pins } = fixture();
    const mesh = state.meshes[Number(meshId)]!;
    const geometry = structuredClone(mesh);
    const uvs = structuredClone(state.meshUvs.get(meshId));
    const neutral = renderArtwork(state).pixels;
    setSpriteDeformation(state, "ARAP");
    const output = packet(state, meshId);
    expect(output.vertices.length).toBeGreaterThan(geometry.vertices.length);
    expect(output.uvs).toHaveLength(output.vertices.length);
    expectHandles(state, meshId);
    for (const tri of output.triangles) for (const index of tri) {
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(output.vertices.length);
    }
    output.pinIndices.forEach((index, i) => {
      expect(output.triangles.some((tri) => tri.includes(index!))).toBe(true);
      expectPoint(output.uvs[index!]!, [pins[i]!.x / 32, pins[i]!.y / 48]);
    });
    expect(renderArtwork(state).pixels).toEqual(neutral);
    expect(mesh.vertices).toEqual(geometry.vertices);
    expect(mesh.triangles).toEqual(geometry.triangles);
    expect(state.meshUvs.get(meshId)).toEqual(uvs);
  });

  it("holds locked handles and moves free handles exactly while deforming actual PNG pixels", () => {
    const { state, meshId, pins } = fixture();
    setSpriteDeformation(state, "ARAP");
    const rest = renderArtwork(state).pixels;
    const restPins = structuredClone(pins);
    state.currentPose.pins.set("base", [50, 50]);
    state.currentPose.pins.set("head", [7, -4]);
    state.currentPose.pins.set("side", [2, 3]);
    expectHandles(state, meshId);
    const deformed = renderArtwork(state).pixels;
    expect(deformed).not.toEqual(rest);
    expect(deformed.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
    expect(pins).toEqual(restPins);
    expect(decodePng(exportPngSync(state)).pixels).toEqual(deformed);
  });

  it("switches MLS and ARAP through the real callback, preserves motion and restores deterministic output on undo/redo", () => {
    const { state, window, meshId } = fixture();
    state.currentPose.pins.set("head", [7, -4]);
    state.currentPose.pins.set("side", [2, 3]);
    const restPins = structuredClone(state.pins);
    const clip = structuredClone(state.activeClip);
    const mls = exportPngSync(state);
    window.set_deformation("ARAP");
    expect(state.meshes[Number(meshId)]!.deformation).toBe("ARAP");
    expectHandles(state, meshId);
    const arap = exportPngSync(state);
    expect(arap).not.toEqual(mls);
    expect(state.pins).toEqual(restPins);
    expect(state.activeClip).toEqual(clip);
    window.undo();
    expect(state.meshes[Number(meshId)]!.deformation ?? "MLS").toBe("MLS");
    expect(exportPngSync(state)).toEqual(mls);
    window.redo();
    expect(state.meshes[Number(meshId)]!.deformation).toBe("ARAP");
    expect(exportPngSync(state)).toEqual(arap);
    window.set_deformation("MLS");
    expect(exportPngSync(state)).toEqual(mls);
    window.set_deformation("ARAP");
    expect(exportPngSync(state)).toEqual(arap);
  });

  it("uses global mesh strength for ARAP targets, including an exact zero-strength rest pose", () => {
    const { state, meshId, pins } = fixture();
    setSpriteDeformation(state, "ARAP");
    const rest = renderArtwork(state).pixels;
    state.currentPose.pins.set("head", [8, -6]);
    state.currentPose.pins.set("side", [4, 2]);
    state.meshes[Number(meshId)]!.strength = 0.35;
    expectHandles(state, meshId);
    expectPoint(pinWorldPoint(state, pins[1]!), [pins[1]!.x + 8 * 0.35, pins[1]!.y - 6 * 0.35]);
    expect(pickScenePin(state, pinWorldPoint(state, pins[1]!), 0)).toBe("head");
    expect(renderArtwork(state).pixels).not.toEqual(rest);
    state.meshes[Number(meshId)]!.strength = 0;
    expectHandles(state, meshId);
    expectPoint(pinWorldPoint(state, pins[1]!), [pins[1]!.x, pins[1]!.y]);
    expect(renderArtwork(state).pixels).toEqual(rest);
  });

  it("converts ARAP dragging back to offsets at fractional strength on a transformed layer", () => {
    const { state, meshId, pins, layer } = fixture();
    setSpriteDeformation(state, "ARAP");
    state.editorMode = EditorMode.Animate;
    state.meshes[Number(meshId)]!.strength = 0.25;
    layer.transform.pos = [40, 60];
    layer.transform.scale = [2, 3];
    const pin = pins[1]!;
    const destination: Vec2 = [40 + (pin.x + 2) * 2, 60 + (pin.y - 1) * 3];
    const local = pinLocalPoint(state, pin, destination)!;
    expectPoint(local, [pin.x + 8, pin.y - 4]);
    state.currentPose.pins.set(pin.id, [local[0] - pin.x, local[1] - pin.y]);
    expectPoint(pinWorldPoint(state, pin), destination);
    expect(pickScenePin(state, destination, 0.00001)).toBe(pin.id);
    expectHandles(state, meshId);
    state.editorMode = EditorMode.Setup;
    expectPoint(pinLocalPoint(state, pin, destination)!, [pin.x + 2, pin.y - 1]);
    state.editorMode = EditorMode.Animate;
    state.meshes[Number(meshId)]!.strength = 0;
    expect(pinLocalPoint(state, pin, destination)).toBeNull();
  });

  it.each(["MLS", "ARAP"] as const)("keeps disabled %s pin markers at rest and prevents picking and dragging them", (algorithm) => {
    const { state, meshId, pins, layer } = fixture();
    setSpriteDeformation(state, algorithm);
    layer.transform.pos = [40, 60];
    layer.transform.scale = [2, 3];
    const pin = pins[1]!;
    state.currentPose.pins.set(pin.id, [7, -4]);
    expect(pinWorldPoint(state, pin)).not.toEqual([40 + pin.x * 2, 60 + pin.y * 3]);
    pin.enabled = false;
    const rest: Vec2 = [40 + pin.x * 2, 60 + pin.y * 3];
    expectPoint(pinWorldPoint(state, pin), rest);
    expect(pickScenePin(state, rest, 0.00001)).toBe("");
    expect(pinLocalPoint(state, pin, rest)).toBeNull();
    if (algorithm === "ARAP") expect(packet(state, meshId).pinIndices[1]).toBeNull();
  });

  it("keeps ARAP hard handles independent of MLS radius and per-pin strength controls", () => {
    const { state, meshId, pins } = fixture();
    setSpriteDeformation(state, "ARAP");
    state.currentPose.pins.set("head", [6, -3]);
    const before = structuredClone(packet(state, meshId).vertices);
    pins[1]!.radius = 0.01;
    pins[1]!.falloff = 7;
    pins[1]!.strength = 0;
    expectHandles(state, meshId);
    expect(packet(state, meshId).vertices).toEqual(before);
  });

  it("invalidates same-object pin changes in Setup, lock and enabled state", () => {
    const { state, meshId, pins } = fixture();
    setSpriteDeformation(state, "ARAP");
    state.currentPose.pins.set("head", [6, -3]);
    const before = structuredClone(packet(state, meshId).vertices);
    pins[1]!.x += 0.4;
    pins[1]!.y += 0.3;
    expectHandles(state, meshId);
    expect(packet(state, meshId).vertices).not.toEqual(before);
    pins[1]!.locked = true;
    expectHandles(state, meshId);
    pins[1]!.locked = false;
    expectHandles(state, meshId);
    pins[1]!.enabled = false;
    const disabled = packet(state, meshId);
    expect(disabled.pinIndices[1]).toBeNull();
    const freshWithoutPin = deformSpriteMesh(
      structuredClone(state.meshes[Number(meshId)]!), structuredClone(state.meshUvs.get(meshId)!),
      pins.filter((pin) => pin.enabled !== false), state.currentPose.pins,
    );
    expect(disabled.vertices).toEqual(freshWithoutPin.vertices);
    expect(disabled.triangles).toEqual(freshWithoutPin.triangles);
    pins[1]!.enabled = true;
    expectHandles(state, meshId);
  });

  it("invalidates in-place rest geometry and triangle changes instead of reusing stale solver topology", () => {
    const { state, meshId, pins } = fixture();
    setSpriteDeformation(state, "ARAP");
    const mesh = state.meshes[Number(meshId)]!;
    const uvs = state.meshUvs.get(meshId)!;
    state.currentPose.pins.set("head", [6, -3]);
    packet(state, meshId);
    mesh.vertices[0]![0] += 0.7;
    const changedVertices = packet(state, meshId);
    const freshVertices = deformSpriteMesh(structuredClone(mesh), structuredClone(uvs), pins, state.currentPose.pins);
    expect(changedVertices.vertices).toEqual(freshVertices.vertices);
    const previousTriangles = structuredClone(changedVertices.triangles);
    mesh.triangles.splice(0, 1);
    const changedTopology = packet(state, meshId);
    const freshTopology = deformSpriteMesh(structuredClone(mesh), structuredClone(uvs), pins, state.currentPose.pins);
    expect(changedTopology.vertices).toEqual(freshTopology.vertices);
    expect(changedTopology.triangles).toEqual(freshTopology.triangles);
    expect(changedTopology.triangles).not.toEqual(previousTriangles);
  });

  it("samples ARAP frames identically after unrelated poses and exports without changing the editor pose", () => {
    const { state, window } = fixture();
    setSpriteDeformation(state, "ARAP");
    const first = createKeyframe(0), last = createKeyframe(1);
    first.easing = Easing.Linear;
    first.pins.set("head", [0, 0]); first.pins.set("side", [0, 0]);
    last.pins.set("head", [7, -4]); last.pins.set("side", [2, 3]);
    state.activeClip.frames = [first, last];
    const expected = new Uint8ClampedArray(renderArtwork(state, 0.4).pixels);
    renderArtwork(state, 0.99);
    renderArtwork(state, 0.1);
    renderArtwork(state, 0.75);
    window.timeline_seek(0.4);
    const pose = structuredClone(state.currentPose);
    const time = state.timelineTime;
    expect(renderArtwork(state).pixels).toEqual(expected);
    window.toggle_sprite_overlay("onion");
    expect(decodePng(exportPngSync(state)).pixels).toEqual(expected);
    renderArtwork(state, 0.9);
    expect(renderArtwork(state, 0.4).pixels).toEqual(expected);
    expect(state.currentPose).toEqual(pose);
    expect(state.timelineTime).toBe(time);
  });

  it("refines silhouette geometry through the UI and recovers texture, algorithm and editable motion with undo/redo", () => {
    const { state, window, meshId, layer } = fixture();
    setSpriteDeformation(state, "ARAP");
    const mesh = state.meshes[Number(meshId)]!;
    mesh.mode = MeshMode.Skin;
    mesh.skinning = SkinningMode.DualQuaternion;
    mesh.strength = 0.6;
    const beforeMesh = structuredClone(mesh);
    const beforeUvs = structuredClone(state.meshUvs.get(meshId));
    const beforePixels = renderArtwork(state).pixels;
    const beforePins = structuredClone(state.pins);
    const beforeClip = structuredClone(state.activeClip);
    const source = state.spriteAssets.get(layer.asset)!;
    window.toggle_sprite_overlay("refine");
    window.set_sprite_parameter("edge", "2");
    window.rebuild_mesh();
    const refined = state.meshes[Number(meshId)]!;
    expect(refined.vertices.length).toBeGreaterThan(beforeMesh.vertices.length);
    expect(refined.build).toMatchObject({ rows: 4, cols: 4, refineEdges: true, edgeSize: 2 });
    expect(refined.buildStats!.refinedCells).toBeGreaterThan(0);
    expect(refined.deformation).toBe("ARAP");
    expect(refined.mode).toBe(MeshMode.Skin);
    expect(refined.skinning).toBe(SkinningMode.DualQuaternion);
    expect(refined.strength).toBe(0.6);
    expect(state.pins).toEqual(beforePins);
    expect(state.activeClip).toEqual(beforeClip);
    expect(state.spriteAssets.get(layer.asset)).toBe(source);
    expect(renderArtwork(state).pixels).toEqual(beforePixels);
    const refinedMesh = structuredClone(refined);
    const refinedUvs = structuredClone(state.meshUvs.get(meshId));
    window.undo();
    expect(state.meshes[Number(meshId)]).toEqual(beforeMesh);
    expect(state.meshUvs.get(meshId)).toEqual(beforeUvs);
    expect(renderArtwork(state).pixels).toEqual(beforePixels);
    window.redo();
    expect(state.meshes[Number(meshId)]).toEqual(refinedMesh);
    expect(state.meshUvs.get(meshId)).toEqual(refinedUvs);
    expect(renderArtwork(state).pixels).toEqual(beforePixels);
    state.currentPose.pins.set("head", [4, -2]);
    expectHandles(state, meshId);
    expect(renderArtwork(state).pixels).not.toEqual(beforePixels);
  });

  it("captures build control values in document history instead of retaining parameters from a later operation", () => {
    const { state } = fixture();
    const controls = () => [state.meshRows, state.meshCols, state.alphaThreshold, state.refineEdges, state.edgeSize];
    const before = controls();
    state.history.push("Build controls", state.joints, state.layers, state.currentPose, state.pins);
    state.meshRows = 10; state.meshCols = 12; state.alphaThreshold = 40;
    state.refineEdges = true; state.edgeSize = 2;
    const after = controls();
    state.history.undo(state.joints, state.layers, state.currentPose, state.pins);
    expect(controls()).toEqual(before);
    state.history.redo(state.joints, state.layers, state.currentPose, state.pins);
    expect(controls()).toEqual(after);
  });

  it("roundtrips ARAP and edge options with the repository's real transparent PNG and matching exported pixels", () => {
    const state = createInitialAppState();
    const png = readFileSync("assets/test-kits/frontier-survival/vector-rig/base-survivor.png");
    state.meshRows = 8; state.meshCols = 8; state.refineEdges = true; state.edgeSize = 32;
    const layer = importSpriteData(state, png, "base-survivor.png");
    const meshId = state.meshLayer.get(layer.id)!;
    setSpriteDeformation(state, "ARAP");
    const image = state.spriteAssets.get(layer.asset)!;
    const occupied: Vec2[] = [];
    for (let y = 20; y < image.height; y += 80) {
      for (let x = 20; x < image.width; x += 80) {
        if (image.pixels[(y * image.width + x) * 4 + 3]! >= state.alphaThreshold) occupied.push([x + 0.25, y + 0.25]);
      }
    }
    expect(occupied.length).toBeGreaterThan(2);
    const anchor = occupied[Math.floor(occupied.length * 0.75)]!;
    const handle = occupied[0]!;
    state.pins = [createPin("real-anchor", meshId, ...anchor, { locked: true }), createPin("real-handle", meshId, ...handle)];
    state.currentPose.pins.set("real-handle", [9, -5]);
    const output = exportPngSync(state);
    const project = loadProjectFromJson(saveProjectToJson(stateToProject(state)));
    const restored = createInitialAppState();
    applyProjectToState(restored, project);
    expect(restored.meshes[Number(meshId)]!.deformation).toBe("ARAP");
    expect(restored.meshes[Number(meshId)]!.build).toEqual(state.meshes[Number(meshId)]!.build);
    expect(restored.meshes[Number(meshId)]!.buildStats).toEqual(state.meshes[Number(meshId)]!.buildStats);
    expect(restored.meshRows).toBe(8); expect(restored.meshCols).toBe(8);
    expect(restored.alphaThreshold).toBe(state.alphaThreshold);
    expect(restored.refineEdges).toBe(true); expect(restored.edgeSize).toBe(32);
    expect(restored.spriteAssets.get(layer.asset)!.png).toEqual(png);
    expect(restored.pins).toEqual(state.pins);
    expect(restored.currentPose.pins).toEqual(state.currentPose.pins);
    expect(exportPngSync(restored)).toEqual(output);
    expectHandles(restored, meshId);
    expect([decodePng(output).width, decodePng(output).height]).toEqual([512, 768]);
  });

  it("opens legacy projects with MLS and rejects unsupported deformation without changing the document", () => {
    const { state, meshId } = fixture();
    const legacy = JSON.parse(saveProjectToJson(stateToProject(state)));
    delete legacy.meshes[Number(meshId)].deformation;
    delete legacy.meshes[Number(meshId)].build;
    delete legacy.meshes[Number(meshId)].buildStats;
    const restored = createInitialAppState();
    applyProjectToState(restored, loadProjectFromJson(JSON.stringify(legacy)));
    expect(restored.meshes[Number(meshId)]!.deformation ?? "MLS").toBe("MLS");
    expect(exportPngSync(restored)).toEqual(exportPngSync(state));
    const before = stateToProject(restored);
    const invalid = JSON.parse(saveProjectToJson(before));
    invalid.meshes[Number(meshId)].deformation = "unsupported";
    expect(() => applyProjectToState(restored, invalid)).toThrow();
    expect(stateToProject(restored)).toEqual(before);
  });

  it("recovers missing legacy UVs before augmenting ARAP constraint triangles", () => {
    const { state, meshId } = fixture();
    setSpriteDeformation(state, "ARAP");
    state.currentPose.pins.set("head", [5, -3]);
    const expected = exportPngSync(state);
    const project = stateToProject(state);
    project.meshes![Number(meshId)]!.uvs = [];
    const restored = createInitialAppState();
    applyProjectToState(restored, loadProjectFromJson(saveProjectToJson(project)));
    expect(restored.meshUvs.get(meshId)).toEqual([]);
    expect(restored.meshes[Number(meshId)]!.deformation).toBe("ARAP");
    expect(exportPngSync(restored)).toEqual(expected);
  });

  it("keeps legacy UV recovery consistent when an animated texture has different pixel dimensions", () => {
    const { state, meshId, layer } = fixture();
    setSpriteDeformation(state, "ARAP");
    state.currentPose.pins.set("head", [5, -3]);
    const original = decodePng(SMALL_PNG);
    const larger = new Uint8ClampedArray(64 * 96 * 4);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 64; x++) {
      const source = (Math.floor(y / 2) * 32 + Math.floor(x / 2)) * 4;
      larger.set(original.pixels.subarray(source, source + 4), (y * 64 + x) * 4);
    }
    state.spriteAssets.set("larger-frame", decodePng(encodeRgbaToPng(64, 96, larger)));
    state.currentPose.layers.set(layer.id, {
      x: 0, y: 0, rotation: 0, sx: 1, sy: 1, opacity: 1, visible: true, asset: "larger-frame",
    });
    const expected = exportPngSync(state);
    state.meshUvs.set(meshId, []);
    expect(exportPngSync(state)).toEqual(expected);
    expect(state.currentPose.layers.get(layer.id)!.asset).toBe("larger-frame");
    expect(state.spriteAssets.get(layer.asset)!.png).toEqual(SMALL_PNG);
  });

  it("rebuilding one sprite preserves another layer's independent deformation settings", () => {
    const { state, meshId } = fixture();
    setSpriteDeformation(state, "ARAP");
    const first = structuredClone(state.meshes[Number(meshId)]);
    const secondLayer = importSpriteData(state, SMALL_PNG, "second-hero.png");
    const secondId = state.meshLayer.get(secondLayer.id)!;
    setSpriteDeformation(state, "MLS");
    state.refineEdges = true; state.edgeSize = 2;
    rebuildSpriteMesh(state);
    expect(state.meshes[Number(meshId)]).toEqual(first);
    expect(state.meshes[Number(secondId)]!.deformation ?? "MLS").toBe("MLS");
    expect(state.meshes[Number(secondId)]!.build!.refineEdges).toBe(true);
  });

  it("shares a locked coincident ARAP target and allows separating the free pin only in Setup", () => {
    const { state, meshId, pins } = fixture();
    const free = pins[1]!;
    const fixed = createPin("coincident-anchor", meshId, free.x, free.y, { locked: true });
    state.pins.push(fixed);
    state.currentPose.pins.set(free.id, [6, -3]);
    state.currentPose.pins.set(fixed.id, [50, 50]);
    setSpriteDeformation(state, "ARAP");
    const output = packet(state, meshId);
    expect(output.pinIndices[1]).toBe(output.pinIndices[3]);
    expectPoint(output.vertices[output.pinIndices[1]!]!, [fixed.x, fixed.y]);
    expectPoint(pinWorldPoint(state, free), [fixed.x, fixed.y]);
    expectPoint(pinWorldPoint(state, fixed), [fixed.x, fixed.y]);
    state.editorMode = EditorMode.Animate;
    expect(pinLocalPoint(state, free, [free.x + 2, free.y - 1])).toBeNull();
    state.editorMode = EditorMode.Setup;
    const separated = pinLocalPoint(state, free, [free.x + 2, free.y - 1])!;
    expectPoint(separated, [free.x + 2, free.y - 1]);
    [free.x, free.y] = separated;
    state.editorMode = EditorMode.Animate;
    expect(pinLocalPoint(state, free, [free.x, free.y])).not.toBeNull();
    const after = packet(state, meshId);
    expect(after.pinIndices[1]).not.toBe(after.pinIndices[3]);
  });

  it("uses the first coincident free ARAP handle and retains the selected pin when picking overlapping markers", () => {
    const { state, meshId, pins } = fixture();
    const first = pins[1]!;
    const second = createPin("another-head", meshId, first.x, first.y);
    state.pins.push(second);
    state.currentPose.pins.set(first.id, [3, -2]);
    state.currentPose.pins.set(second.id, [-4, 2]);
    setSpriteDeformation(state, "ARAP");
    let expected: Vec2 = [first.x + 3, first.y - 2];
    expectPoint(pinWorldPoint(state, first), expected);
    expectPoint(pinWorldPoint(state, second), expected);
    const output = packet(state, meshId);
    expect(output.pinIndices[1]).toBe(output.pinIndices[3]);
    expectPoint(output.vertices[output.pinIndices[1]!]!, expected);
    state.selectedPinId = second.id;
    expect(pickScenePin(state, expected, 0)).toBe(second.id);
    state.selectedPinId = first.id;
    expect(pickScenePin(state, expected, 0)).toBe(first.id);
    state.editorMode = EditorMode.Animate;
    expect(pinLocalPoint(state, second, expected)).toBeNull();
    expect(pinLocalPoint(state, first, expected)).not.toBeNull();
    state.pins = [pins[0]!, second, first, pins[2]!];
    expected = [second.x - 4, second.y + 2];
    expectPoint(pinWorldPoint(state, first), expected);
    expectPoint(pinWorldPoint(state, second), expected);
    expectPoint(packet(state, meshId).vertices[packet(state, meshId).pinIndices[1]!]!, expected);
    expect(pickScenePin(state, expected, 0)).toBe(first.id);
    expect(pinLocalPoint(state, first, expected)).toBeNull();
    expect(pinLocalPoint(state, second, expected)).not.toBeNull();
  });

  it("rejects an oversized ARAP switch and project atomically without adding history or changing pins", () => {
    const { state, meshId } = fixture();
    const mesh = state.meshes[Number(meshId)]!;
    const uvs = state.meshUvs.get(meshId)!;
    while (mesh.vertices.length < 4097) {
      mesh.vertices.push([100 + mesh.vertices.length, 0]);
      mesh.weights.push([]);
      uvs.push([0, 0]);
    }
    const before = stateToProject(state);
    const pins = state.pins;
    const push = vi.spyOn(state.history, "push");
    expect(() => setSpriteDeformation(state, "ARAP")).toThrow(/4096/);
    expect(push).not.toHaveBeenCalled();
    expect(state.pins).toBe(pins);
    expect(stateToProject(state)).toEqual(before);
    const project = structuredClone(before);
    project.meshes![Number(meshId)]!.deformation = "ARAP";
    const target = fixture().state;
    const targetBefore = stateToProject(target);
    const targetPins = target.pins;
    const targetPose = target.currentPose;
    const targetPush = vi.spyOn(target.history, "push");
    expect(() => applyProjectToState(target, project)).toThrow(/4096/);
    expect(targetPush).not.toHaveBeenCalled();
    expect(target.pins).toBe(targetPins);
    expect(target.currentPose).toBe(targetPose);
    expect(stateToProject(target)).toEqual(targetBefore);
  });
});
