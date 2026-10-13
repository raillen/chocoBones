import { describe, expect, it, vi } from "vitest";
import { createEditorController } from "../src/editor/controller";
import { decodePng } from "../src/assets/png";
import { encodeRgbaToPng } from "../src/render/png_export";
import { pinWorldPoint } from "../src/ui/viewport/pin_space";
import { createInitialAppState } from "../src/ui/store";
import { Easing } from "../src/animation/timeline";
import * as deformation from "../src/render/deformed_sprite";

function image() {
  const pixels = new Uint8ClampedArray(32 * 40 * 4);
  for (let y = 2; y < 38; y++) for (let x = 4; x < 28; x++) {
    const offset = (y * 32 + x) * 4;
    pixels.set([200, x * 8, y * 5, 255], offset);
  }
  return decodePng(encodeRgbaToPng(32, 40, pixels));
}
function editor(now?: () => number) {
  const e = createEditorController({ now });
  e.importDecoded(image(), "hero.png");
  return e;
}
function screen(e: ReturnType<typeof editor>, pinId: string) {
  const pin = e.state.pins.find((p) => p.id === pinId)!;
  const world = pinWorldPoint(e.state, pin);
  return e.state.viewportBuffer.worldToScreen(world[0], world[1], e.state.cameraPan.x, e.state.cameraPan.y, e.state.cameraZoom);
}

describe("browser editor controller", () => {
  it("starts a clean browser document and preserves the legacy demo factory", () => {
    const e = createEditorController();
    expect(e.state.layers).toEqual([]);
    expect(e.state.pins).toEqual([]);
    expect(e.getViewModel().phase).toBe("prepare");
    expect(e.state.isPlaying).toBe(false);
    expect(createInitialAppState().joints.length).toBeGreaterThan(5);
    expect(createInitialAppState().mesh3D.vertices.length).toBeGreaterThan(0);
  });

  it("imports PNGs, publishes revisions, and switches contextual selections", () => {
    const e = createEditorController();
    let notifications = 0;
    const unsubscribe = e.subscribe(() => notifications++);
    e.importDecoded(image(), "folder/hero.png");
    expect(e.getViewModel().selectedLayer?.name).toBe("hero.png");
    expect(e.state.canvasWidth).toBe(32);
    e.dispatch({ type: "joint-add" });
    expect(e.getViewModel().selectedJoint?.id).toBe("root");
    e.dispatch({ type: "select-layer", id: e.state.layers[0]!.id });
    expect(e.getViewModel().selectedJoint).toBeUndefined();
    e.dispatch({ type: "auto-pins" });
    expect(e.getViewModel().selectedPin).toBeDefined();
    e.dispatch({ type: "select-joint", id: "root" });
    expect(e.getViewModel().selectedPin).toBeUndefined();
    expect(e.getViewModel().selectedLayer).toBeUndefined();
    expect(notifications).toBe(5);
    unsubscribe();
    e.dispatch({ type: "theme", value: "Light" });
    expect(notifications).toBe(5);
  });

  it("clears animation deltas when importing into preparation and restores them through undo", () => {
    const e = editor();
    e.dispatch({ type: "auto-pins" });
    e.dispatch({ type: "motion-preset", value: "sway" });
    e.dispatch({ type: "seek", time: 0.4 });
    const pose = structuredClone(e.state.currentPose.pins);
    expect([...pose.values()].some(([x, y]) => x !== 0 || y !== 0)).toBe(true);
    e.importDecoded(image(), "second.png");
    expect(e.state.currentPose.pins.size).toBe(0);
    expect(e.getViewModel().phase).toBe("prepare");
    e.dispatch({ type: "undo" });
    expect(e.state.currentPose.pins).toEqual(pose);
    expect(e.getViewModel().phase).toBe("animate");
  });

  it("keeps zoom anchors and viewport center stable when panels resize", () => {
    const e = editor(); const s = e.state;
    const anchor: [number, number] = [200, 180];
    const oldWorld = s.viewportBuffer.screenToWorld(...anchor, s.cameraPan.x, s.cameraPan.y, s.cameraZoom);
    e.zoom(0.4, anchor);
    expect(s.viewportBuffer.screenToWorld(...anchor, s.cameraPan.x, s.cameraPan.y, s.cameraZoom)).toEqual(oldWorld);
    const center = s.viewportBuffer.screenToWorld(s.viewportBuffer.width / 2, s.viewportBuffer.height / 2, s.cameraPan.x, s.cameraPan.y, s.cameraZoom);
    e.resize(1000, 660);
    expect(s.viewportBuffer.screenToWorld(500, 330, s.cameraPan.x, s.cameraPan.y, s.cameraZoom)).toEqual(center);
  });

  it("zooms the orbit camera in 3D without changing the saved 2D view", () => {
    const e = editor();
    const pan = { ...e.state.cameraPan }, zoom = e.state.cameraZoom;
    const distance = e.state.orbitCamera.distance;
    const revision = e.getViewModel().documentRevision;
    e.dispatch({ type: "viewport", value: "3D" });
    e.zoom(1.25, [200, 180]);
    expect(e.state.orbitCamera.distance).toBeCloseTo(distance / 1.25);
    e.dispatch({ type: "zoom", factor: .8 });
    expect(e.state.orbitCamera.distance).toBeCloseTo(distance);
    expect(e.state.cameraPan).toEqual(pan);
    expect(e.state.cameraZoom).toBe(zoom);
    expect(e.getViewModel().documentRevision).toBe(revision);
    e.zoom(1e6); expect(e.state.orbitCamera.distance).toBe(.25);
    e.zoom(1e-6); expect(e.state.orbitCamera.distance).toBe(50);
  });

  it("starts a separate undo history when opening or creating a document", () => {
    const e = editor();
    const projectA = e.toProject();
    const projectB = structuredClone(projectA);
    projectB.width = 48;
    projectB.layers[0]!.name = "Character B";
    e.loadProject(projectB, new Map([[projectB.assets[0]!.id, image()]]));
    expect(e.getViewModel().canUndo).toBe(false);
    expect(e.getViewModel().canRedo).toBe(false);
    const openedRevision = e.getViewModel().documentRevision;
    e.dispatch({ type: "undo" });
    expect(e.getViewModel().documentRevision).toBe(openedRevision);
    expect(e.state.layers[0]!.name).toBe("Character B");
    expect(e.state.canvasWidth).toBe(48);
    e.dispatch({ type: "layer-properties", name: "B edited" });
    e.dispatch({ type: "canvas-settings", width: 64 });
    e.dispatch({ type: "undo" });
    expect(e.state.canvasWidth).toBe(48);
    e.dispatch({ type: "undo" });
    expect(e.state.layers[0]!.name).toBe("Character B");
    expect(e.getViewModel().canRedo).toBe(true);
    e.dispatch({ type: "new" });
    expect(e.getViewModel().canUndo).toBe(false);
    expect(e.getViewModel().canRedo).toBe(false);
    e.dispatch({ type: "undo" });
    expect(e.state.layers).toHaveLength(0);
    e.importDecoded(image(), "new.png");
    e.dispatch({ type: "undo" });
    expect(e.state.layers).toHaveLength(0);
  });

  it("keys layer visibility and opacity in Animate without changing the bind layer", () => {
    const e = editor();
    const layerId = e.state.selectedLayerId;
    e.dispatch({ type: "layer-properties", opacity: .8 });
    e.dispatch({ type: "phase", value: "animate" });
    e.dispatch({ type: "layer-properties", opacity: .25, visible: false });
    expect(e.state.layers[0]!.opacity).toBe(.8);
    expect(e.state.layers[0]!.visible).toBe(true);
    expect(e.state.currentPose.layers.get(layerId)).toMatchObject({ opacity: .25, visible: false });
    e.dispatch({ type: "key-pose" });
    expect(e.state.activeClip.frames[0]!.layers.get(layerId)).toMatchObject({ opacity: .25, visible: false });
    e.dispatch({ type: "reset-pose" });
    e.dispatch({ type: "seek", time: 0 });
    expect(e.state.currentPose.layers.get(layerId)).toMatchObject({ opacity: .25, visible: false });
    expect(e.artwork().pixels.every((value, index) => index % 4 !== 3 || value === 0)).toBe(true);
    e.dispatch({ type: "phase", value: "prepare" });
    e.dispatch({ type: "layer-properties", opacity: .6, visible: false });
    expect(e.state.layers[0]!.opacity).toBe(.6);
    expect(e.state.layers[0]!.visible).toBe(false);
    expect(e.state.currentPose.layers.size).toBe(0);
  });

  it("preserves rig, motion and adaptive mesh across rebuild, history and portable projects", () => {
    const e = editor();
    e.dispatch({ type: "auto-pins" });
    e.dispatch({ type: "deformation", value: "ARAP" });
    e.dispatch({ type: "mesh-settings", rows: 4, cols: 4, refineEdges: true, edgeSize: 4 });
    e.dispatch({ type: "rebuild-mesh" });
    e.dispatch({ type: "motion-preset", value: "sway" });
    e.dispatch({ type: "seek", time: 0.4 });
    const saved = e.toProject();
    const fresh = createEditorController();
    fresh.loadProject(saved, new Map([[saved.assets[0]!.id, image()]]));
    expect(fresh.toProject()).toEqual(saved);
    expect(fresh.getViewModel().selectedMesh?.deformation).toBe("ARAP");
    expect(fresh.state.refineEdges).toBe(true);
    expect(fresh.getViewModel().phase).toBe("animate");
    e.dispatch({ type: "undo" });
    expect(e.state.activeClip.frames).toHaveLength(0);
    expect(e.getViewModel().selectedMesh?.deformation).toBe("ARAP");
    e.dispatch({ type: "redo" });
    expect(e.state.activeClip.name).toBe("Balanço");
    expect(e.state.activeClip.frames.length).toBeGreaterThan(20);
  });

  it("loads native capability payloads whose image bytes are detached from JSON", () => {
    const original = editor();
    original.dispatch({ type: "auto-pins" });
    original.dispatch({ type: "deformation", value: "ARAP" });
    const project = original.toProject();
    const payload = structuredClone(project);
    for (const asset of payload.assets) asset.data = "";
    const restored = createEditorController();
    restored.loadProject(payload, new Map([[project.assets[0]!.id, image()]]));
    expect(restored.state.spriteAssets.size).toBe(1);
    expect(restored.toProject()).toEqual(project);
    expect(restored.artwork().pixels).toEqual(original.artwork().pixels);
  });

  it("rejects malformed project geometry atomically, without adding undo entries", () => {
    const e = editor();
    const valid = e.toProject();
    const undoBefore = e.state.history.canUndo();
    const invalid = structuredClone(valid);
    invalid.meshes![0]!.triangles = [[0, 1, 999999]];
    expect(() => e.loadProject(invalid, new Map([[valid.assets[0]!.id, image()]]))).toThrow("inexistente");
    expect(e.toProject()).toEqual(valid);
    expect(e.state.history.canUndo()).toBe(undoBefore);
    e.dispatch({ type: "undo" });
    expect(e.state.layers).toHaveLength(0);
  });

  it("records a dragged pin into a deterministic editable gesture clip", () => {
    let now = 1000;
    const e = editor(() => now);
    e.dispatch({ type: "pin-add", x: 16, y: 20, name: "Control" });
    const pinId = e.state.selectedPinId;
    e.dispatch({ type: "record-gesture" });
    const [x, y] = screen(e, pinId);
    e.pointerDown(x, y);
    now += 300;
    e.pointerMove(x + 6 * e.state.cameraZoom, y - 4 * e.state.cameraZoom);
    e.pointerUp();
    expect(e.getViewModel().recording).toBe(false);
    expect(e.state.activeClip.loop).toBe(false);
    expect(e.state.activeClip.duration).toBeCloseTo(0.3);
    e.dispatch({ type: "seek", time: 0.3 });
    expect(e.state.currentPose.pins.get(pinId)?.[0]).toBeCloseTo(6);
    expect(e.state.currentPose.pins.get(pinId)?.[1]).toBeCloseTo(-4);
    expect(e.getViewModel().tracks.find((t) => t.id === pinId)?.keys.length).toBeGreaterThanOrEqual(2);
    e.dispatch({ type: "undo" });
    expect(e.state.activeClip.frames).toHaveLength(0);
    expect(e.state.pins[0]!.x).toBe(16);
  });

  it("selects locked ARAP anchors without beginning a drag", () => {
    const e = editor();
    e.dispatch({ type: "pin-add", x: 16, y: 20 });
    const id = e.state.selectedPinId;
    e.dispatch({ type: "pin-lock" });
    e.dispatch({ type: "deformation", value: "ARAP" });
    e.dispatch({ type: "phase", value: "animate" });
    const point = screen(e, id);
    e.pointerDown(...point); e.pointerMove(point[0] + 80, point[1] + 40); e.pointerUp();
    expect(e.state.viewportDrag.mode).toBe("none");
    expect(e.state.currentPose.pins.get(id)).toBeUndefined();
    expect(e.state.selectedPinId).toBe(id);
    expect(e.state.pins[0]!.locked).toBe(true);
  });

  it("edits animation keys and properties, and removes stale pin channels", () => {
    const e = editor();
    e.dispatch({ type: "pin-add", x: 16, y: 20 });
    const id = e.state.selectedPinId;
    e.dispatch({ type: "phase", value: "animate" });
    e.dispatch({ type: "seek", time: 0.5 });
    e.dispatch({ type: "pin-properties", x: 20, y: 19 });
    e.dispatch({ type: "key-pose" });
    const frame = e.state.activeClip.frames[0]!;
    expect(frame.pins.get(id)).toEqual([4, -1]);
    e.dispatch({ type: "key-move", id: frame.id, time: 0.75 });
    e.dispatch({ type: "key-easing", id: frame.id, value: Easing.Hold });
    expect(frame.time).toBe(0.75); expect(frame.easing).toBe(Easing.Hold);
    e.dispatch({ type: "pin-delete", id });
    expect(e.state.activeClip.frames[0]!.pins.has(id)).toBe(false);
    e.dispatch({ type: "undo" });
    expect(e.state.pins).toHaveLength(1);
    expect(e.state.activeClip.frames[0]!.pins.has(id)).toBe(true);
  });

  it("changes canvas dimensions with history and keeps export alpha intact", () => {
    const e = editor();
    e.dispatch({ type: "canvas-settings", width: 64, height: 48 });
    const exported = e.artwork();
    expect([exported.width, exported.height]).toEqual([64, 48]);
    expect(exported.pixels[3]).toBe(0);
    expect(exported.pixels.some((value, index) => index % 4 === 3 && value === 255)).toBe(true);
    e.dispatch({ type: "undo" });
    expect([e.state.canvasWidth, e.state.canvasHeight]).toEqual([32, 40]);
  });

  it("uses displayed worker geometry for body picking without solving ARAP on the UI thread", () => {
    const e = editor();
    e.dispatch({ type: "deformation", value: "ARAP" });
    const layer = e.state.layers[0]!;
    const mesh = e.getViewModel().selectedMesh!;
    const uvs = e.state.meshUvs.get(e.state.meshLayer.get(layer.id)!)!;
    const solve = vi.spyOn(deformation, "deformSpriteMesh");
    const detach = e.setPickGeometryProvider(() => ({ vertices: mesh.vertices.flat(), triangles: mesh.triangles.flat(), uvs: uvs.flat() }));
    e.state.selectedLayerId = "";
    const point = e.state.viewportBuffer.worldToScreen(16, 20, e.state.cameraPan.x, e.state.cameraPan.y, e.state.cameraZoom);
    e.pointerDown(...point);
    expect(e.state.selectedLayerId).toBe(layer.id);
    expect(solve).not.toHaveBeenCalled();
    e.pointerUp(); detach();
    const detachEmpty = e.setPickGeometryProvider(() => undefined);
    e.state.selectedLayerId = "";
    e.pointerDown(...point);
    expect(e.state.selectedLayerId).toBe("");
    expect(solve).not.toHaveBeenCalled();
    e.pointerUp(); detachEmpty(); solve.mockRestore();
  });

  it("changes document revision for edits while playback and camera keep it stable", () => {
    const e = editor();
    e.dispatch({ type: "auto-pins" });
    e.dispatch({ type: "motion-preset", value: "breath" });
    const revision = e.getViewModel().documentRevision;
    e.dispatch({ type: "play" }); e.tick(0.05); e.tick(0.05);
    e.zoom(0.8); e.resize(820, 560);
    e.dispatch({ type: "select-layer", id: e.state.layers[0]!.id });
    expect(e.getViewModel().documentRevision).toBe(revision);
    e.dispatch({ type: "layer-properties", name: "New name" });
    expect(e.getViewModel().documentRevision).toBeGreaterThan(revision);
  });

  it("creates a bone root directly on a clean stage and refuses hierarchy cycles", () => {
    const e = createEditorController();
    e.dispatch({ type: "phase", value: "rig" });
    e.dispatch({ type: "tool", value: "Bone" });
    e.pointerDown(200, 180);
    expect(e.state.joints).toHaveLength(1);
    e.pointerDown(240, 230);
    expect(e.state.joints).toHaveLength(2);
    const child = e.state.selectedJointId;
    expect(() => e.dispatch({ type: "joint-properties", id: "root", parent: child })).toThrow("ciclo");
    expect(e.state.joints[0]!.parent).toBe("");
  });
});
