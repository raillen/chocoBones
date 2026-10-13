import { afterEach, describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodePng } from "../src/assets/png";
import { createClip, createKeyframe, Easing } from "../src/animation/timeline";
import { encodeRgbaToPng } from "../src/render/png_export";
import { drawSpriteScene, renderArtwork } from "../src/render/sprite_scene";
import { tickAnimation } from "../src/render/loop";
import { ViewportBuffer } from "../src/render/viewport_buffer";
import { createPose } from "../src/rig/joint";
import { autoSpritePins, importSpriteData } from "../src/ui/actions/sprite_actions";
import { applyProjectToState, stateToProject } from "../src/ui/actions/project_io";
import { EditorMode } from "../src/ui/modes";
import { createInitialAppState, type AppState } from "../src/ui/store";

vi.mock("slint-ui", () => ({ ArrayModel: class { constructor(public rows: unknown[]) {} } }));
vi.mock("../src/render/loop", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/render/loop")>(), startRenderLoop: () => () => {},
}));
import { bindSlintWindow, exportPngSync } from "../src/ui/bridge";

afterEach(() => vi.restoreAllMocks());

const FIXTURE_PNG = (() => {
  const pixels = new Uint8ClampedArray(32 * 48 * 4);
  for (let y = 5; y < 44; y++) for (let x = 5; x < 27; x++) {
    if (y < 14 && (x < 10 || x > 21)) continue;
    if (y > 35 && x >= 14 && x < 18) continue;
    pixels.set([30 + x * 6, 30 + y * 4, 120, 255], (y * 32 + x) * 4);
  }
  return encodeRgbaToPng(32, 48, pixels);
})();

function fixture() {
  const state = createInitialAppState();
  const layer = importSpriteData(state, FIXTURE_PNG, "tiny-hero.png");
  autoSpritePins(state);
  const window: any = { viewport_width: state.viewportBuffer.width, viewport_height: state.viewportBuffer.height };
  bindSlintWindow(window, state);
  const meshId = state.meshLayer.get(layer.id)!;
  const pins = state.pins.filter((pin) => pin.meshId === meshId);
  return { state, window, layer, meshId, pins };
}

function nonLoopClip(state: AppState, id: string): void {
  const clip = createClip("regression-gesture", "Gesture", 1, 60, false);
  const start = createKeyframe(0), end = createKeyframe(1);
  start.easing = Easing.Linear;
  start.pins.set(id, [0, 0]); end.pins.set(id, [5, -4]);
  clip.frames = [start, end];
  state.activeClip = clip;
  state.activeClipName = clip.name;
  state.timelineDuration = 1;
  state.timelineTime = 0;
}

async function withExportDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await fs.mkdtemp(path.join(tmpdir(), "chocobones-editor-regression-"));
  try { await run(directory); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

describe("sprite editor integration regressions", () => {
  it("exports the current Setup/rest pose and samples explicit animation times without mutating it", () => {
    const { state, window, pins } = fixture();
    nonLoopClip(state, pins.find((pin) => !pin.locked)!.id);
    window.timeline_seek(0.5);
    const animated = renderArtwork(state).pixels;
    window.set_editor_mode("Setup");
    expect(state.isPlaying).toBe(false);
    expect(state.currentPose.pins.size).toBe(0);
    expect(state.timelineTime).toBe(0.5);
    const rest = new ViewportBuffer(32, 48); rest.clear(0, 0, 0, 0);
    drawSpriteScene(rest, state, createPose());
    expect(renderArtwork(state).pixels).toEqual(rest.pixels);
    expect(decodePng(exportPngSync(state)).pixels).toEqual(rest.pixels);
    expect(renderArtwork(state, 0.5).pixels).toEqual(animated);
    expect(animated).not.toEqual(rest.pixels);
    expect(state.currentPose.pins.size).toBe(0);
    expect(state.timelineTime).toBe(0.5);
  });

  it("renders an embedded sprite after loading a legacy mesh with an empty UV array", () => {
    const { state, meshId } = fixture();
    const expected = renderArtwork(state).pixels;
    const project = stateToProject(state);
    project.meshes!.find((mesh) => mesh.id === meshId)!.uvs = [];
    const loaded = createInitialAppState();
    applyProjectToState(loaded, project);
    expect(loaded.meshUvs.get(meshId)).toEqual([]);
    expect(renderArtwork(loaded).pixels).toEqual(expected);
    expect(renderArtwork(loaded).pixels.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
  });

  it("keeps fit, minus and wheel zoom consistent below 0.2 and stops at 0.05", () => {
    const { state, window } = fixture();
    state.canvasWidth = 4096; state.canvasHeight = 4096;
    window.fit_canvas();
    const fitted = state.cameraZoom;
    expect(fitted).toBeGreaterThan(0.05); expect(fitted).toBeLessThan(0.2);
    window.zoom_out(); expect(state.cameraZoom).toBeLessThan(fitted);
    const reduced = state.cameraZoom;
    window.viewport_scroll(1); expect(state.cameraZoom).toBeLessThan(reduced);
    for (let i = 0; i < 40; i++) window.zoom_out();
    expect(state.cameraZoom).toBe(0.05);
    window.viewport_scroll(1); expect(state.cameraZoom).toBe(0.05);
    expect(window.zoom_level).toBe(0.05);
    window.zoom_in(); expect(state.cameraZoom).toBeGreaterThan(0.05);
  });

  it.each(["remove_layer", "remove_selected_layers"])("%s removes sprite resources and restores the whole document through undo/redo", (action) => {
    const { state, window, layer, meshId, pins } = fixture();
    window.apply_pin_motion("sway"); window.toggle_play(); window.timeline_seek(0.5);
    window.choose_pin(pins.find((pin) => !pin.locked)!.id);
    window.toggle_play();
    state.cameraPan = { x: 17, y: 29 }; state.cameraZoom = 1.4;
    const selectedPin = state.selectedPinId;
    const original = stateToProject(state);
    const originalPixels = renderArtwork(state).pixels;
    const originalSelection = [...state.selection.selectedLayerIds];
    const originalPose = structuredClone(state.currentPose.pins);
    window[action](layer.id);
    expect(state.layers.some((item) => item.id === layer.id)).toBe(false);
    expect(state.spriteAssets.has(layer.asset)).toBe(false);
    expect(state.meshLayer.has(layer.id)).toBe(false);
    expect(state.meshUvs.has(meshId)).toBe(false);
    expect(state.meshes[Number(meshId)]!.vertices).toEqual([]);
    expect(state.pins.some((pin) => pin.meshId === meshId)).toBe(false);
    expect(state.activeClip.frames.some((frame) => pins.some((pin) => frame.pins.has(pin.id)))).toBe(false);
    expect(state.selectedPinId).toBe("");
    expect(window.has_sprite).toBe(false); expect(window.selected_pin_id).toBe("");
    // Change transient state after deletion so undo proves the document hooks restore it.
    window.set_editor_mode("Setup");
    state.cameraPan = { x: 99, y: -13 }; state.cameraZoom = 0.3;
    const removed = stateToProject(state);
    window.undo();
    expect(stateToProject(state)).toEqual(original);
    expect(renderArtwork(state).pixels).toEqual(originalPixels);
    expect(state.currentPose.pins).toEqual(originalPose);
    expect(state.selectedLayerId).toBe(layer.id);
    expect(state.selectedPinId).toBe(selectedPin);
    expect(state.selection.selectedLayerIds).toEqual(originalSelection);
    expect(state.cameraPan).toEqual({ x: 17, y: 29 }); expect(state.cameraZoom).toBe(1.4);
    expect(state.editorMode).toBe(EditorMode.Animate); expect(state.isPlaying).toBe(true);
    expect(window.has_sprite).toBe(true); expect(window.selected_pin_id).toBe(selectedPin);
    window.redo();
    expect(stateToProject(state)).toEqual(removed);
    expect(state.spriteAssets.size).toBe(0); expect(window.has_sprite).toBe(false);
    expect(state.editorMode).toBe(EditorMode.Setup); expect(state.isPlaying).toBe(false);
    expect(state.cameraPan).toEqual({ x: 99, y: -13 }); expect(state.cameraZoom).toBe(0.3);
  });

  it("starts a clean project and recovers the previous PNG, pins, pose and camera on undo", () => {
    const { state, window, layer, meshId, pins } = fixture();
    window.apply_pin_motion("breath"); window.toggle_play(); window.timeline_seek(0.35);
    window.choose_pin(pins.find((pin) => !pin.locked)!.id);
    window.toggle_play();
    state.cameraPan = { x: 21, y: -7 }; state.cameraZoom = 0.6;
    const original = stateToProject(state), originalPixels = renderArtwork(state).pixels;
    const selectedPin = state.selectedPinId;
    window.new_project();
    expect(state.spriteAssets.size).toBe(0); expect(state.meshUvs.has(meshId)).toBe(false);
    expect(state.layers.some((item) => item.id === layer.id)).toBe(false);
    expect(window.has_sprite).toBe(false);
    expect(state.selectedPinId).toBe(""); expect(state.isPlaying).toBe(false);
    window.undo();
    expect(stateToProject(state)).toEqual(original);
    expect(renderArtwork(state).pixels).toEqual(originalPixels);
    expect(state.selectedLayerId).toBe(layer.id); expect(state.selectedPinId).toBe(selectedPin);
    expect(state.timelineTime).toBe(0.35);
    expect(state.cameraPan).toEqual({ x: 21, y: -7 }); expect(state.cameraZoom).toBe(0.6);
    expect(state.isPlaying).toBe(true);
    expect(window.has_sprite).toBe(true);
    window.redo(); expect(state.spriteAssets.size).toBe(0); expect(window.has_sprite).toBe(false);
  });

  it.each(["breath", "sway", "walk"])("applying %s immediately samples t=0 instead of retaining stale pin channels", (preset) => {
    const { state, window, pins } = fixture();
    const neutral = renderArtwork(state).pixels;
    state.currentPose.pins.set(pins.find((pin) => !pin.locked)!.id, [6, -4]);
    state.currentPose.pins.set("obsolete-channel", [100, 100]);
    state.timelineTime = 0.75;
    window.apply_pin_motion(preset);
    expect(state.timelineTime).toBe(0);
    expect(state.currentPose.pins.has("obsolete-channel")).toBe(false);
    for (const pin of pins) expect(state.currentPose.pins.get(pin.id)).toEqual([0, 0]);
    expect(renderArtwork(state).pixels).toEqual(neutral);
    expect(state.isPlaying).toBe(true); expect(state.editorMode).toBe(EditorMode.Animate);
  });

  it("holds a non-loop clip at its final pose and restarts it from t=0 when Play is pressed", () => {
    const { state, window, pins } = fixture();
    const pin = pins.find((item) => !item.locked)!;
    nonLoopClip(state, pin.id);
    window.timeline_seek(0.99); window.toggle_play();
    tickAnimation(state, 0.2);
    expect(state.timelineTime).toBe(1); expect(state.isPlaying).toBe(false);
    expect(state.currentPose.pins.get(pin.id)).toEqual([5, -4]);
    const endpoint = renderArtwork(state).pixels;
    tickAnimation(state, 0.2);
    expect(state.timelineTime).toBe(1); expect(renderArtwork(state).pixels).toEqual(endpoint);
    window.toggle_play();
    expect(state.isPlaying).toBe(true); expect(state.timelineTime).toBe(0);
    expect(state.currentPose.pins.get(pin.id)).toEqual([0, 0]);
    tickAnimation(state, 0.25);
    expect(state.timelineTime).toBe(0.25); expect(state.currentPose.pins.get(pin.id)).toEqual([1.25, -1]);
  });

  it("writes the actual non-loop endpoint as the final frame of the exported spritesheet", async () => {
    await withExportDirectory(async (directory) => {
      const { state, window, pins } = fixture();
      nonLoopClip(state, pins.find((pin) => !pin.locked)!.id);
      state.paths.exportPng = path.join(directory, "frame.png");
      const expected = renderArtwork(state, 1).pixels;
      expect(expected).not.toEqual(renderArtwork(state, 0).pixels);
      window.export_spritesheet();
      const sheet = await vi.waitFor(async () => {
        expect(window.status_text).toContain("Spritesheet exportada");
        return decodePng(await fs.readFile(path.join(directory, "spritesheet_export.png")));
      }, { timeout: 2000, interval: 10 });
      expect([sheet.width, sheet.height]).toEqual([32 * 4, 48 * 2]);
      const last = new Uint8ClampedArray(32 * 48 * 4);
      for (let y = 0; y < 48; y++) {
        const start = ((48 + y) * sheet.width + 32 * 3) * 4;
        last.set(sheet.pixels.subarray(start, start + 32 * 4), y * 32 * 4);
      }
      expect(last).toEqual(expected);
    });
  });

  it("writes the Setup pose through the asynchronous PNG callback with transparent canvas dimensions", async () => {
    await withExportDirectory(async (directory) => {
      const { state, window, pins } = fixture();
      nonLoopClip(state, pins.find((pin) => !pin.locked)!.id);
      window.timeline_seek(0.5); window.set_editor_mode("Setup");
      state.paths.exportPng = path.join(directory, "rest-frame.png");
      const expected = renderArtwork(state).pixels;
      window.export_png();
      const image = await vi.waitFor(async () => {
        expect(window.status_text).toBe("Frame exportado: rest-frame.png");
        return decodePng(await fs.readFile(state.paths.exportPng));
      }, { timeout: 2000, interval: 10 });
      expect([image.width, image.height]).toEqual([32, 48]);
      expect(image.pixels).toEqual(expected); expect(image.pixels[3]).toBe(0);
    });
  });
});
