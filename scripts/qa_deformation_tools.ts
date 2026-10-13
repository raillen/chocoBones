/** Real Slint QA for silhouette refinement and MLS/ARAP; use an isolated Xvfb without MIT-SHM. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as slint from "slint-ui";
import { decodePng } from "../src/assets/png";
import { deformSpriteMesh } from "../src/render/deformed_sprite";
import { renderArtwork } from "../src/render/sprite_scene";
import type { Pin } from "../src/mesh/mesh";
import { bindSlintWindow, createInitialAppState, exportPngSync } from "../src/ui/bridge";
import { defaultAppPaths } from "../src/ui/app_config";
import { loadProjectFile, stateToProject } from "../src/ui/actions/project_io";
import { pinWorldPoint } from "../src/ui/viewport/pin_space";

const exec = promisify(execFile);
const output = process.env.CHOCOBONES_QA_OUTPUT ?? "/workspace/.artifacts/chocobones-deformation-tools";
const display = process.env.DISPLAY ?? ":108";
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
    passed("native-slint-window-visible");

    window.import_png_file(source);
    await until(() => window.has_sprite && !window.import_busy, "PNG import callback");
    window.auto_pins();
    window.fit_canvas();
    window.timeline_seek(0);
    window.dock_tab = "Puppet";
    const meshId = state.meshLayer.get(state.selectedLayerId)!;
    const currentMesh = () => state.meshes[Number(meshId)]!;
    const currentPins = () => state.pins.filter((pin) => pin.meshId === meshId && pin.enabled !== false);
    const packet = () => deformSpriteMesh(currentMesh(), state.meshUvs.get(meshId)!, currentPins(), state.currentPose.pins);
    assert.deepEqual([state.canvasWidth, state.canvasHeight], [sourceImage.width, sourceImage.height]);
    assert.equal(currentMesh().deformation ?? "MLS", "MLS");
    assert.equal(state.refineEdges, false);
    passed("png-import-defaults-to-mls-and-unrefined-grid");

    const capture = async (name: string): Promise<void> => {
      await pause();
      const frame = window.viewport_frame as slint.ImageData;
      assert.equal(hash(frame.data), hash(state.viewportBuffer.pixels), "Native image must contain rendered RGBA scene");
      const file = `${name}.png`;
      await exec("import", ["-display", display, "-window", ownWindow, path.join(output, file)], { timeout: 15000 });
      const png = await readFile(path.join(output, file));
      assert.equal(png.readUInt32BE(16), window.window.physicalSize.width);
      assert.equal(png.readUInt32BE(20), window.window.physicalSize.height);
      captures.push({ name, file, theme: state.themeMode,
        size: { width: window.window.logicalSize.width, height: window.window.logicalSize.height },
        viewport: [window.viewport_width, window.viewport_height], deformation: currentMesh().deformation ?? "MLS",
        build: currentMesh().build, vertices: currentMesh().vertices.length, triangles: currentMesh().triangles.length,
        buildStats: currentMesh().buildStats, zoom: state.cameraZoom, pan: state.cameraPan,
        time: state.timelineTime, frameHash: hash(frame.data), screenshotHash: hash(png) });
      passed(`capture-${name}`);
    };

    await capture("01-mls-regular-rest");
    const coarse = { vertices: currentMesh().vertices.length, triangles: currentMesh().triangles.length };
    const restPinPositions = currentPins().map((pin) => [pin.id, pin.x, pin.y]);
    window.set_editor_mode("Animate");
    const moving = currentPins().find((pin) => pin.name === "Superior" && !pin.locked)!;
    const base = currentPins().find((pin) => pin.locked)!;
    assert.ok(moving && base, "Suggested controls must contain a movable point and a fixed point");
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
    const start = nativePosition(moving);
    const restPng = exportPngSync(state);
    dispatch("pointer-moved", start); dispatch("pointer-pressed", start);
    assert.equal(state.viewportDrag.mode, "pin", "Native stage press must select the visible control");
    const destination = { x: start.x + 70, y: start.y - 32 };
    dispatch("pointer-moved", destination); dispatch("pointer-released", destination);
    assert.ok(Math.hypot(...state.currentPose.pins.get(moving.id)!) > 1);
    assert.deepEqual(currentPins().map((pin) => [pin.id, pin.x, pin.y]), restPinPositions, "Animation drag preserves rest positions");
    const mlsPng = exportPngSync(state);
    assert.notEqual(hash(mlsPng), hash(restPng), "Native drag must deform imported texture");
    await writeFile(path.join(output, "artwork-mls-posed.png"), mlsPng);
    passed("native-pointer-drag-deforms-texture-without-editing-rest");
    await capture("02-mls-regular-posed");

    const retainedPose = structuredClone(state.currentPose.pins);
    window.set_deformation("ARAP");
    assert.equal(currentMesh().deformation, "ARAP");
    assert.deepEqual(state.currentPose.pins, retainedPose, "Choosing a solver must preserve the current pose");
    const verifyHandles = () => {
      const deformed = packet();
      for (const [index, pin] of currentPins().entries()) {
        const vertex = deformed.pinIndices[index];
        assert.ok(vertex !== null && vertex !== undefined, `${pin.name}: pin must be embedded into mesh topology`);
        const delta = pin.locked ? [0, 0] : state.currentPose.pins.get(pin.id) ?? [0, 0];
        const target = [pin.x + delta[0]! * currentMesh().strength, pin.y + delta[1]! * currentMesh().strength];
        assert.ok(Math.hypot(deformed.vertices[vertex]![0] - target[0]!, deformed.vertices[vertex]![1] - target[1]!) < 1e-7,
          `${pin.name}: ARAP handle must reach its exact local target`);
      }
      assert.equal(deformed.uvs.length, deformed.vertices.length);
      assert.ok(deformed.triangles.every((tri) => tri.every((index) => index >= 0 && index < deformed.vertices.length)));
    };
    verifyHandles();
    const arapPng = exportPngSync(state);
    assert.notEqual(hash(arapPng), hash(mlsPng), "MLS and ARAP must produce different texture deformation for the same pose");
    await writeFile(path.join(output, "artwork-arap-posed.png"), arapPng);
    passed("native-solver-choice-retains-pose-and-arap-exact-embedded-handles");
    await capture("03-arap-regular-posed");

    const lockedBefore = pinWorldPoint(state, base);
    const lockedStart = nativePosition(base);
    const lockedDelta = structuredClone(state.currentPose.pins.get(base.id));
    dispatch("pointer-moved", lockedStart); dispatch("pointer-pressed", lockedStart);
    dispatch("pointer-moved", { x: lockedStart.x + 30, y: lockedStart.y - 15 });
    dispatch("pointer-released", { x: lockedStart.x + 30, y: lockedStart.y - 15 });
    assert.deepEqual(pinWorldPoint(state, base), lockedBefore);
    assert.deepEqual(state.currentPose.pins.get(base.id), lockedDelta);
    verifyHandles();
    passed("native-locked-pin-cannot-drag-and-remains-exact-arap-anchor");

    window.toggle_sprite_overlay("refine");
    window.set_sprite_parameter("edge", "8");
    window.rebuild_mesh();
    assert.equal(state.refineEdges, true);
    assert.equal(state.edgeSize, 8);
    assert.equal(currentMesh().deformation, "ARAP", "Rebuild must preserve chosen deformation model");
    assert.equal(currentMesh().build?.refineEdges, true);
    assert.equal(currentMesh().build?.edgeSize, 8);
    assert.ok(currentMesh().buildStats!.refinedCells > 0, "Mixed alpha-border cells must be refined");
    assert.ok(currentMesh().vertices.length > coarse.vertices && currentMesh().triangles.length > coarse.triangles);
    assert.ok(currentMesh().vertices.length <= 4096, "Adaptive mesh must respect the bounded vertex budget");
    assert.equal(state.meshUvs.get(meshId)!.length, currentMesh().vertices.length);
    assert.deepEqual(currentPins().map((pin) => [pin.id, pin.x, pin.y]), restPinPositions, "Rebuilding preserves pins");
    assert.deepEqual(state.currentPose.pins, retainedPose, "Rebuilding preserves animation pose");
    verifyHandles();
    passed("native-alpha-refinement-rebuild-preserves-model-pins-and-pose-with-bounded-mesh");
    await capture("04-arap-refined-posed");
    for (let step = 0; step < 3; step++) window.zoom_in();
    await capture("05-arap-refined-detail");
    window.fit_canvas();
    window.change_theme("Light");
    await capture("06-arap-refined-light");

    const exportHash = hash(exportPngSync(state));
    window.toggle_sprite_overlay("mesh");
    window.toggle_sprite_overlay("onion");
    assert.equal(hash(exportPngSync(state)), exportHash, "Editor overlays cannot contaminate artwork export");
    window.toggle_sprite_overlay("mesh");
    window.toggle_sprite_overlay("onion");
    window.toggle_sprite_overlay("mesh");
    window.change_theme("Dark");
    await capture("07-arap-refined-artwork");
    window.toggle_sprite_overlay("mesh");
    const transparentPng = exportPngSync(state);
    const transparent = decodePng(transparentPng);
    assert.deepEqual([transparent.width, transparent.height], [sourceImage.width, sourceImage.height]);
    let empty = 0, painted = 0;
    for (let index = 3; index < transparent.pixels.length; index += 4) {
      if (transparent.pixels[index] === 0) empty++;
      else painted++;
    }
    assert.ok(empty > 0 && painted > 0, "Refined ARAP export must contain painted and transparent pixels");
    await writeFile(path.join(output, "artwork-arap-refined.png"), transparentPng);
    passed("refined-arap-transparent-export-excludes-editor-overlays");

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
    assert.equal(restored.refineEdges, true);
    assert.equal(restored.edgeSize, 8);
    assert.equal(restored.meshes[Number(meshId)]!.deformation, "ARAP");
    assert.deepEqual(restored.meshes[Number(meshId)]!.build, currentMesh().build);
    assert.equal(hash(renderArtwork(restored).pixels), finalPixels, "Saved pin offsets must restore the currently edited pose");
    passed("native-save-load-retains-arap-refinement-settings-and-identical-artwork");
    console.log(`Validated ${checks.length} native checks; ${captures.length} captures in ${output}`);
  } catch (error) {
    failure = error instanceof Error ? error.stack ?? error.message : String(error);
    throw error;
  } finally {
    await writeFile(path.join(output, "report.json"), JSON.stringify({ display,
      source: "assets/test-kits/frontier-survival/vector-rig/base-survivor.png",
      checks, captures, limitations: ["Headless Linux Slint software rendering; desktop platform packaging is outside this QA.",
        "This validates a repository-owned single-image puppet; larger images and multi-layer rigs require separate coverage."], failure }, null, 2) + "\n");
    cleanup(); window.hide(); slint.quitEventLoop(); await loop;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
