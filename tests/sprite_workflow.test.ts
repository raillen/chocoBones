import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPose } from "../src/rig/joint";
import { decodePng } from "../src/assets/png";
import { encodeRgbaToPng } from "../src/render/png_export";
import { drawSpriteScene, renderArtwork } from "../src/render/sprite_scene";
import { ViewportBuffer } from "../src/render/viewport_buffer";
import { tickAnimation } from "../src/render/loop";
import { importSpriteData, autoSpritePins, fitCanvas } from "../src/ui/actions/sprite_actions";
import { createInitialAppState } from "../src/ui/store";
import { pinWorldPoint } from "../src/ui/viewport/pin_space";

vi.mock("slint-ui", () => ({ ArrayModel: class { constructor(public rows: unknown[]) {} } }));
vi.mock("../src/render/loop", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/render/loop")>(), startRenderLoop: () => () => {},
}));
import { bindSlintWindow, exportPngSync } from "../src/ui/bridge";

afterEach(() => vi.restoreAllMocks());
const hash = (pixels: Uint8Array | Uint8ClampedArray) => createHash("sha256").update(pixels).digest("hex");

function fixture() {
  const width = 32, height = 48;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 5; y < 44; y++) for (let x = 5; x < 27; x++) {
    if (y < 14 && (x < 10 || x > 21)) continue;
    if (y > 35 && x >= 14 && x < 18) continue;
    rgba.set([40 + x * 6, 40 + y * 4, 120, 255], (y * width + x) * 4);
  }
  const png = encodeRgbaToPng(width, height, rgba);
  const state = createInitialAppState();
  const layer = importSpriteData(state, png, "test-hero.png");
  autoSpritePins(state);
  const window: any = { viewport_width: state.viewportBuffer.width, viewport_height: state.viewportBuffer.height };
  bindSlintWindow(window, state);
  const meshId = state.meshLayer.get(layer.id)!;
  const pins = state.pins.filter((p) => p.meshId === meshId);
  return { state, window, png, layer, pins, meshId };
}

describe("imported image puppet workflow", () => {
  it("fits the canvas in pixel pan coordinates and centers it at arbitrary zoom", () => {
    const { state } = fixture();
    state.canvasWidth = 512; state.canvasHeight = 768;
    fitCanvas(state);
    const center = state.viewportBuffer.worldToScreen(256, 384, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    expect(center).toEqual([state.viewportBuffer.width / 2, state.viewportBuffer.height / 2]);
    const topLeft = state.viewportBuffer.worldToScreen(0, 0, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    const bottomRight = state.viewportBuffer.worldToScreen(512, 768, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    expect(topLeft[0]).toBeGreaterThanOrEqual(20); expect(topLeft[1]).toBeGreaterThanOrEqual(20);
    expect(bottomRight[0]).toBeLessThanOrEqual(state.viewportBuffer.width - 20);
    expect(bottomRight[1]).toBeLessThanOrEqual(state.viewportBuffer.height - 20);
  });

  it("snaps suggested pins onto alpha and preserves existing hand-placed pins", () => {
    const { state, pins, meshId } = fixture();
    const image = [...state.spriteAssets.values()][0]!;
    for (const pin of pins) expect(image.pixels[(Math.floor(pin.y) * image.width + Math.floor(pin.x)) * 4 + 3]).toBe(255);
    const manual = { ...pins.find((p) => !p.locked)!, id: "manual-pin", name: "Hand placed", x: 13, y: 15 };
    state.pins.push(manual);
    autoSpritePins(state);
    expect(state.pins.find((pin) => pin.id === manual.id)).toEqual(manual);
    expect(state.pins.filter((pin) => pin.meshId === meshId).length).toBeGreaterThan(pins.length);
  });

  it("rebuilds geometry through the real bridge without losing pins, texture or editable motion and can undo", () => {
    const { state, window, pins, meshId, png } = fixture();
    window.apply_pin_motion("breath"); window.toggle_play();
    const originalMesh = structuredClone(state.meshes[Number(meshId)]);
    const originalUvs = structuredClone(state.meshUvs.get(meshId));
    const originalPins = structuredClone(pins);
    const originalClip = structuredClone(state.activeClip);
    window.set_sprite_parameter("rows", "24"); window.set_sprite_parameter("cols", "20");
    window.rebuild_mesh();
    expect(state.meshes[Number(meshId)]!.vertices.length).not.toBe(originalMesh!.vertices.length);
    expect(state.pins.filter((pin) => pin.meshId === meshId)).toEqual(originalPins);
    expect(state.activeClip).toEqual(originalClip);
    expect([...state.spriteAssets.values()][0]!.png).toEqual(png);
    window.undo();
    expect(state.meshes[Number(meshId)]).toEqual(originalMesh);
    expect(state.meshUvs.get(meshId)).toEqual(originalUvs);
    expect(state.activeClip).toEqual(originalClip);
  });

  it.each(["breath", "sway", "walk"])("%s callbacks bake real arbitrary pin IDs and visibly change exported texture", (preset) => {
    const { state, window, pins } = fixture();
    const rest = structuredClone(pins);
    window.set_sprite_parameter("frequency", "0.25"); window.set_sprite_parameter("amplitude", "5");
    window.apply_pin_motion(preset); window.toggle_play();
    window.timeline_seek(0);
    const neutral = hash(exportPngSync(state));
    window.timeline_seek(state.timelineDuration / 4);
    expect(hash(exportPngSync(state))).not.toBe(neutral);
    expect(pins).toEqual(rest);
    expect(state.activeClip.frames.length).toBeGreaterThan(2);
    expect(state.currentPose.pins.get(pins.find((p) => p.locked)!.id)).toEqual([0, 0]);
  });

  it("exports the transparent canvas identically regardless of editor overlays and theme", () => {
    const { state, window } = fixture();
    window.apply_pin_motion("sway"); window.toggle_play(); window.timeline_seek(0.4);
    const png = exportPngSync(state), decoded = decodePng(png);
    expect([decoded.width, decoded.height]).toEqual([32, 48]);
    expect(decoded.pixels[3]).toBe(0);
    expect(decoded.pixels.some((value, index) => index % 4 === 3 && value === 255)).toBe(true);
    window.toggle_sprite_overlay("mesh"); window.toggle_sprite_overlay("skeleton"); window.toggle_sprite_overlay("onion");
    window.change_theme("Light");
    expect(exportPngSync(state)).toEqual(png);
  });

  it("records a gesture, retains its exact final pose on export and stops at its non-loop endpoint", () => {
    const { state, window, pins } = fixture();
    let milliseconds = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => milliseconds);
    const pin = pins.find((p) => !p.locked)!;
    const world = pinWorldPoint(state, pin);
    const start = state.viewportBuffer.worldToScreen(world[0], world[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    window.arm_performance(); window.viewport_mouse_down(...start);
    expect(state.viewportDrag.mode).toBe("pin");
    milliseconds += 103; window.viewport_mouse_move(start[0] + 10, start[1] - 6);
    milliseconds += 118; window.viewport_mouse_move(start[0] + 20, start[1] - 12);
    const finalPose = createPose();
    finalPose.pins = structuredClone(state.currentPose.pins);
    window.viewport_mouse_up();
    expect(state.activeClip.loop).toBe(false);
    expect(window.performance_armed).toBe(false);
    expect(state.activeClip.duration).toBeCloseTo(13 / 60);
    expect(state.activeClip.frames.every((frame) => frame.time <= state.activeClip.duration)).toBe(true);
    const expected = new ViewportBuffer(state.canvasWidth, state.canvasHeight); expected.clear(0, 0, 0, 0);
    drawSpriteScene(expected, state, finalPose);
    expect(renderArtwork(state, state.activeClip.duration).pixels).toEqual(expected.pixels);
    window.timeline_seek(0); const before = hash(exportPngSync(state));
    window.timeline_seek(state.timelineDuration);
    expect(hash(exportPngSync(state))).not.toBe(before);
    state.isPlaying = true;
    state.timelineTime = state.timelineDuration - 0.01;
    tickAnimation(state, 0.2);
    expect(state.timelineTime).toBe(state.timelineDuration);
    expect(state.isPlaying).toBe(false);
    expect(state.currentPose.pins).toEqual(finalPose.pins);
  });

  it("caps gesture duration at four seconds and prevents dragging a locked anchor", () => {
    const { state, window, pins } = fixture();
    let milliseconds = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => milliseconds);
    const anchor = pins.find((p) => p.locked)!;
    const fixed = pinWorldPoint(state, anchor);
    const fixedScreen = state.viewportBuffer.worldToScreen(fixed[0], fixed[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    window.viewport_mouse_down(...fixedScreen); window.viewport_mouse_move(fixedScreen[0] + 15, fixedScreen[1]); window.viewport_mouse_up();
    expect(pinWorldPoint(state, anchor)).toEqual(fixed);
    const moving = pins.find((p) => !p.locked)!;
    const point = pinWorldPoint(state, moving);
    const start = state.viewportBuffer.worldToScreen(point[0], point[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    window.arm_performance(); window.viewport_mouse_down(...start);
    milliseconds += 5500; window.viewport_mouse_move(start[0] + 12, start[1] - 12); window.viewport_mouse_up();
    expect(state.activeClip.duration).toBe(4);
    expect(state.timelineTime).toBe(4);
    expect(state.activeClip.frames.at(-1)!.time).toBe(4);
  });
});
