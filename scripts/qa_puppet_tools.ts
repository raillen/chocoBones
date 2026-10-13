/** Native Slint QA for the imported-image puppet workflow; run on isolated Xvfb without MIT-SHM. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as slint from "slint-ui";
import { decodePng } from "../src/assets/png";
import { bindSlintWindow, createInitialAppState, exportPngSync } from "../src/ui/bridge";
import { defaultAppPaths } from "../src/ui/app_config";
import { loadProjectFile, stateToProject } from "../src/ui/actions/project_io";
import { pinWorldPoint } from "../src/ui/viewport/pin_space";
import type { Pin } from "../src/mesh/mesh";
import { createPose } from "../src/rig/joint";
import { drawSpriteScene, renderArtwork } from "../src/render/sprite_scene";
import { ViewportBuffer } from "../src/render/viewport_buffer";

const exec = promisify(execFile);
const output = process.env.CHOCOBONES_QA_OUTPUT ?? "/workspace/.artifacts/chocobones-puppet-tools";
const display = process.env.DISPLAY ?? ":107";
process.env.DISPLAY ??= display;
const pause = (ms = 300) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const hash = (bytes: Uint8Array | Uint8ClampedArray) => createHash("sha256")
  .update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest("hex");

async function until(condition: () => boolean | Promise<boolean>, description: string): Promise<void> {
  const start = Date.now();
  while (!(await condition())) {
    assert.ok(Date.now() - start < 15000, `Timed out: ${description}`);
    await pause(100);
  }
}

async function tree(): Promise<string> {
  return (await exec("xwininfo", ["-display", display, "-root", "-tree"], { timeout: 15000 })).stdout;
}

async function main(): Promise<void> {
  await mkdir(output, { recursive: true });
  const source = path.resolve("assets/test-kits/frontier-survival/vector-rig/base-survivor.png");
  const sourcePng = await readFile(source);
  const sourceImage = decodePng(sourcePng);
  const previous = new Set((await tree()).match(/0x[0-9a-f]+/g));
  const ui = slint.loadFile(path.resolve("ui/main.slint"));
  const window = new (ui as any).MainWindow();
  const state = createInitialAppState({ ...defaultAppPaths(output), suzanneObj: path.resolve("assets/models/suzanne.obj") });
  const cleanup = bindSlintWindow(window, state);
  const loop = window.run() as Promise<unknown>;
  const checks: string[] = [];
  const captures: Array<Record<string, unknown>> = [];
  const passed = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };
  let failure: string | undefined;

  try {
    window.window.logicalPosition = { x: 0, y: 0 };
    window.window.logicalSize = { width: 1400, height: 1000 };
    await pause();
    const ownWindow = (await tree()).split("\n").find((line) => {
      const id = line.match(/0x[0-9a-f]+/)?.[0];
      return id && !previous.has(id) && line.includes('"chocoBones');
    })?.match(/0x[0-9a-f]+/)?.[0];
    assert.ok(ownWindow, "A real Slint window must be visible");
    passed("native-window-visible");

    const capture = async (name: string): Promise<void> => {
      await pause();
      const frame = window.viewport_frame as slint.ImageData;
      assert.equal(hash(frame.data), hash(state.viewportBuffer.pixels), "Native image must contain the rendered RGBA scene");
      const file = path.join(output, `${name}.png`);
      await exec("import", ["-display", display, "-window", ownWindow, file], { timeout: 15000 });
      const png = await readFile(file);
      assert.equal(png.readUInt32BE(16), window.window.physicalSize.width);
      assert.equal(png.readUInt32BE(20), window.window.physicalSize.height);
      captures.push({ name, file, theme: state.themeMode, size: window.window.logicalSize,
        viewport: [window.viewport_width, window.viewport_height], dock: window.dock_tab,
        time: state.timelineTime, clip: state.activeClip.name,
        frameHash: hash(frame.data), screenshotHash: hash(png) });
      passed(`capture-${name}`);
    };

    window.import_png_file(source);
    await until(() => window.has_sprite && !window.import_busy, "PNG import callback");
    await pause();
    assert.equal(state.spriteAssets.size, 1);
    assert.deepEqual([state.canvasWidth, state.canvasHeight], [sourceImage.width, sourceImage.height]);
    assert.equal(state.isPlaying, false);
    window.auto_pins();
    window.fit_canvas();
    const meshId = state.meshLayer.get(state.selectedLayerId)!;
    const pins = state.pins.filter((p) => p.meshId === meshId);
    assert.ok(pins.length >= 3);
    for (const pin of pins) {
      const alpha = sourceImage.pixels[(Math.floor(pin.y) * sourceImage.width + Math.floor(pin.x)) * 4 + 3]!;
      assert.ok(alpha >= state.alphaThreshold, `${pin.name}: suggestion must attach to opaque artwork`);
    }
    const mesh = state.meshes[Number(meshId)]!;
    assert.ok(mesh.triangles.length > 0);
    assert.equal(state.meshUvs.get(meshId)!.length, mesh.vertices.length);
    assert.ok(Math.abs(state.cameraPan.x + state.canvasWidth * state.cameraZoom / 2 - state.viewportBuffer.width / 2) < 1e-6);
    assert.ok(Math.abs(state.cameraPan.y + state.canvasHeight * state.cameraZoom / 2 - state.viewportBuffer.height / 2) < 1e-6);
    passed("png-import-alpha-mesh-snapped-pins-and-centered-fit");
    window.dock_tab = "Puppet";
    await capture("dark-setup-1400x1000");

    const restPins = structuredClone(pins);
    window.set_sprite_parameter("amplitude", "28");
    window.set_sprite_parameter("frequency", "0.25");
    window.apply_pin_motion("breath");
    if (state.isPlaying) window.toggle_play();
    window.timeline_seek(0);
    const neutralPng = exportPngSync(state);
    await writeFile(path.join(output, "artwork-rest.png"), neutralPng);
    await capture("dark-motion-rest-1400x1000");
    window.timeline_seek(state.timelineDuration / 4);
    const posedPng = exportPngSync(state);
    assert.notEqual(hash(posedPng), hash(neutralPng), "A generated preset must visibly deform the texture");
    assert.deepEqual(pins, restPins, "Preset playback must preserve all pin rest positions");
    const decoded = decodePng(posedPng);
    assert.deepEqual([decoded.width, decoded.height], [state.canvasWidth, state.canvasHeight]);
    let transparent = 0, opaque = 0;
    for (let i = 3; i < decoded.pixels.length; i += 4) {
      if (decoded.pixels[i] === 0) transparent++;
      if (decoded.pixels[i]! > 0) opaque++;
    }
    assert.ok(transparent > 0 && opaque > 0, "PNG must contain the character and real transparency");
    await writeFile(path.join(output, "artwork-breath-quarter.png"), posedPng);
    passed("quarter-cycle-deforms-real-texture-and-transparent-canvas-export");

    const exportHash = hash(exportPngSync(state));
    window.toggle_sprite_overlay("mesh");
    window.toggle_sprite_overlay("skeleton");
    window.toggle_sprite_overlay("onion");
    assert.equal(hash(exportPngSync(state)), exportHash, "Grid, mesh, skeleton, pins and ghost overlays must stay out of artwork exports");
    window.toggle_sprite_overlay("mesh");
    window.toggle_sprite_overlay("skeleton");
    passed("editor-overlays-excluded-from-export");
    await capture("dark-motion-posed-1400x1000");
    for (const theme of ["Dim", "Light"]) {
      window.change_theme(theme);
      assert.equal(window.theme_mode, theme);
      await capture(`${theme.toLowerCase()}-motion-posed-1400x1000`);
    }
    window.window.logicalSize = { width: 900, height: 640 };
    await capture("light-puppet-compact-900x640");
    assert.equal(window.compact_layout, true);
    window.window.dispatchEvent({ type: "pointer-scrolled", position: { x: 780, y: 250 }, deltaX: 0, deltaY: -600 });
    await capture("light-puppet-controls-compact-900x640");
    window.window.logicalSize = { width: 1400, height: 1000 };
    window.change_theme("Dark");
    await pause();

    for (const preset of ["sway", "walk"]) {
      window.apply_pin_motion(preset);
      if (state.isPlaying) window.toggle_play();
      window.timeline_seek(0);
      const before = hash(exportPngSync(state));
      window.timeline_seek(state.timelineDuration / 4);
      assert.notEqual(hash(exportPngSync(state)), before, `${preset} must deform artwork`);
    }
    passed("breath-sway-walk-native-callbacks-produce-editable-motion");

    const nativePosition = (pin: Pin) => {
      const point = pinWorldPoint(state, pin);
      const [x, y] = state.viewportBuffer.worldToScreen(point[0], point[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      const scale = Math.min(window.viewport_width / state.viewportBuffer.width, window.viewport_height / state.viewportBuffer.height);
      return { x: 40 + (window.viewport_width - state.viewportBuffer.width * scale) / 2 + x * scale,
        y: 101 + (window.viewport_height - state.viewportBuffer.height * scale) / 2 + y * scale };
    };
    const dispatch = (kind: "pointer-moved" | "pointer-pressed" | "pointer-released", position: { x: number; y: number }) => {
      window.window.dispatchEvent(kind === "pointer-moved" ? { type: kind, position } : { type: kind, position, button: "left" });
    };
    const moving = pins.find((pin) => pin.name === "Superior" && !pin.locked)!;
    assert.ok(moving);
    const start = nativePosition(moving);
    const beforeOffset = [...(state.currentPose.pins.get(moving.id) ?? [0, 0])];
    dispatch("pointer-moved", start); dispatch("pointer-pressed", start);
    assert.equal(state.viewportDrag.mode, "pin", "Native stage press must select the visible transformed pin");
    const destination = { x: start.x + 32, y: start.y - 18 };
    dispatch("pointer-moved", destination); dispatch("pointer-released", destination);
    assert.notDeepEqual(state.currentPose.pins.get(moving.id), beforeOffset);
    assert.deepEqual([moving.x, moving.y], [restPins.find((p) => p.id === moving.id)!.x, restPins.find((p) => p.id === moving.id)!.y]);
    assert.equal(state.viewportDrag.mode, "none");
    passed("native-pointer-drag-edits-pin-motion-without-changing-rest");

    window.choose_pin(moving.id);
    window.lock_selected_pin();
    const lockedPoint = pinWorldPoint(state, moving);
    const lockedOffset = structuredClone(state.currentPose.pins.get(moving.id));
    const lockedStart = nativePosition(moving);
    dispatch("pointer-moved", lockedStart); dispatch("pointer-pressed", lockedStart);
    dispatch("pointer-moved", { x: lockedStart.x + 25, y: lockedStart.y + 10 });
    dispatch("pointer-released", { x: lockedStart.x + 25, y: lockedStart.y + 10 });
    assert.deepEqual(pinWorldPoint(state, moving), lockedPoint);
    assert.deepEqual(state.currentPose.pins.get(moving.id), lockedOffset);
    window.lock_selected_pin();
    passed("locked-native-pin-stays-at-transformed-rest-position");

    window.arm_performance();
    const gestureStart = nativePosition(moving);
    dispatch("pointer-moved", gestureStart); dispatch("pointer-pressed", gestureStart);
    assert.equal(state.viewportDrag.mode, "pin");
    for (let step = 1; step <= 3; step++) {
      await pause(100);
      dispatch("pointer-moved", { x: gestureStart.x + step * 18, y: gestureStart.y - step * 9 });
    }
    const finalPose = createPose();
    finalPose.pins = new Map([...state.currentPose.pins].map(([id, value]) => [id, [...value] as [number, number]]));
    dispatch("pointer-released", { x: gestureStart.x + 54, y: gestureStart.y - 27 });
    assert.equal(window.performance_armed, false);
    assert.equal(state.activeClip.loop, false);
    assert.ok(state.activeClip.frames.length >= 3);
    assert.ok(state.activeClip.duration > 0 && state.activeClip.duration <= 4);
    assert.ok(state.activeClip.frames.every((frame) => frame.time <= state.activeClip.duration));
    const expectedFinal = new ViewportBuffer(state.canvasWidth, state.canvasHeight);
    expectedFinal.clear(0, 0, 0, 0);
    drawSpriteScene(expectedFinal, state, finalPose);
    assert.equal(hash(renderArtwork(state, state.activeClip.duration).pixels), hash(expectedFinal.pixels), "Recorded endpoint must retain the exact last dragged pose");
    window.timeline_seek(0);
    const gestureNeutral = exportPngSync(state);
    window.timeline_seek(state.timelineDuration);
    assert.notEqual(hash(exportPngSync(state)), hash(gestureNeutral), "Gesture replay must change textured pixels");
    await writeFile(path.join(output, "artwork-gesture-end.png"), exportPngSync(state));
    passed("native-performance-recording-replays-and-preserves-final-pose");
    await capture("dark-recorded-gesture-1400x1000");

    window.export_spritesheet();
    await until(() => String(window.status_text).startsWith("Spritesheet exportada:"), "transparent spritesheet export");
    const sheet = decodePng(await readFile(path.join(output, "spritesheet_export.png")));
    assert.deepEqual([sheet.width, sheet.height], [state.canvasWidth * 4, state.canvasHeight * 2]);
    assert.equal(sheet.pixels[3], 0);
    passed("native-spritesheet-export-eight-frames-transparent");

    const document = stateToProject(state);
    const finalPixels = hash(renderArtwork(state).pixels);
    window.save_project();
    await until(async () => {
      try { return String(window.status_text).startsWith("Projeto salvo:") && (await stat(state.paths.projectFile)).size > 0; }
      catch { return false; }
    }, "portable project save");
    const restored = createInitialAppState();
    await loadProjectFile(restored, state.paths.projectFile);
    assert.deepEqual(stateToProject(restored), document);
    for (const [id, uvs] of state.meshUvs) assert.deepEqual(restored.meshUvs.get(id), uvs);
    assert.deepEqual(restored.meshLayer, state.meshLayer);
    assert.equal(hash([...restored.spriteAssets.values()][0]!.png), hash(sourcePng));
    assert.equal(hash(renderArtwork(restored, state.timelineTime).pixels), finalPixels);
    passed("portable-project-roundtrip-retains-source-png-mesh-uvs-motion-and-render");
    console.log(`Validated ${checks.length} native checks; ${captures.length} captures in ${output}`);
  } catch (error) {
    failure = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    await writeFile(path.join(output, "report.json"), JSON.stringify({ display, source, checks, captures, failure }, null, 2) + "\n");
    cleanup(); window.hide(); slint.quitEventLoop(); await loop;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
