/**
 * Native Slint visual matrix and input checks; artifacts stay in /tmp.
 * For a sandbox with isolated IPC, use Xvfb with `-extension MIT-SHM`.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import * as slint from "slint-ui";
import { bindSlintWindow, createInitialAppState, exportPngSync } from "../src/ui/bridge";
import { defaultAppPaths } from "../src/ui/app_config";

const exec = promisify(execFile);
const output = process.env.CHOCOBONES_QA_OUTPUT ?? "/tmp/chocobones-studio-qa";
const display = process.env.DISPLAY ?? ":99";
process.env.DISPLAY ??= display;
const pause = (milliseconds = 300) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
const hash = (bytes: Uint8Array | Uint8ClampedArray) => createHash("sha256")
  .update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest("hex");

interface Capture {
  name: string;
  file: string;
  theme: string;
  workspace: string;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  inspectorWidth: number;
  compact: boolean;
  short: boolean;
  frameHash: string;
  screenshotHash: string;
  chromeRGB: number[];
}

async function windowTree(): Promise<string> {
  const { stdout } = await exec("xwininfo", ["-display", display, "-root", "-tree"], { timeout: 15000 });
  return stdout;
}

async function main(): Promise<void> {
  await mkdir(output, { recursive: true });
  const before = new Set((await windowTree()).match(/0x[0-9a-f]+/g));
  const ui = slint.loadFile(path.resolve("ui/main.slint"));
  const window = new (ui as any).MainWindow();
  const state = createInitialAppState({ ...defaultAppPaths(output), suzanneObj: path.resolve("assets/models/suzanne.obj") });
  const cleanup = bindSlintWindow(window, state);
  const captures: Capture[] = [];
  const checks: string[] = [];
  const passed = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };
  const loop = window.run() as Promise<unknown>;

  try {
    window.window.logicalPosition = { x: 0, y: 0 };
    await pause();
    const ownWindow = (await windowTree()).split("\n").find((line) => {
      const id = line.match(/0x[0-9a-f]+/)?.[0];
      return id && !before.has(id) && line.includes('"chocoBones');
    })?.match(/0x[0-9a-f]+/)?.[0];
    assert.ok(ownWindow, "The real Slint window must be visible on X11");
    passed("native-window-visible");

    if (state.isPlaying) window.toggle_play();
    assert.equal(state.isPlaying, false);
    const selectedJoint = state.selectedJointId;
    const selectedLayer = state.selectedLayerId;
    const sizes = [[900, 640], [1280, 720], [1400, 900]] as const;
    const themeHashes = new Set<string>();

    const capture = async (name: string, width: number, height: number): Promise<void> => {
      await pause();
      assert.equal(window.window.logicalSize.width, width, `${name}: requested logical width`);
      assert.equal(window.window.logicalSize.height, height, `${name}: requested logical height`);
      assert.ok(window.viewport_width > 0 && window.viewport_height > 0, `${name}: stage must have usable dimensions`);
      assert.equal(window.compact_layout, width < 1100, `${name}: compact breakpoint`);
      assert.equal(window.short_layout, height < 720, `${name}: short breakpoint`);
      assert.equal(window.inspector_width === 0, state.activeWorkspace === "Foco", `${name}: focus hides inspector`);
      const frame = window.viewport_frame as slint.ImageData;
      assert.equal(frame.width, state.viewportBuffer.width, `${name}: native image width`);
      assert.equal(frame.height, state.viewportBuffer.height, `${name}: native image height`);
      assert.equal(frame.data.length, frame.width * frame.height * 4, `${name}: RGBA image size`);
      assert.equal(hash(frame.data), hash(state.viewportBuffer.pixels), `${name}: live native image contains the rendered scene`);
      const file = path.join(output, `${name}.png`);
      await exec("import", ["-display", display, "-window", ownWindow, file], { timeout: 15000 });
      const png = await readFile(file);
      const physical = window.window.physicalSize;
      assert.equal(png.readUInt32BE(16), physical.width, `${name}: captured physical width`);
      assert.equal(png.readUInt32BE(20), physical.height, `${name}: captured physical height`);
      const sampled = await exec("convert", [file, "-crop", "1x1+2+50", "-depth", "8", "rgb:-"], { encoding: "buffer", timeout: 15000 });
      const chromeRGB = [...sampled.stdout];
      const gray = state.themeMode === "Light" ? 222 : state.themeMode === "Dim" ? 57 : 32;
      assert.deepEqual(chromeRGB, [gray, gray, gray], `${name}: captured chrome reflects the requested theme`);
      captures.push({ name, file, theme: state.themeMode, workspace: state.activeWorkspace,
        width, height, viewportWidth: window.viewport_width, viewportHeight: window.viewport_height,
        inspectorWidth: window.inspector_width, compact: window.compact_layout, short: window.short_layout,
        frameHash: hash(frame.data), screenshotHash: hash(png), chromeRGB });
      passed(name);
    };

    for (const theme of ["Dark", "Dim", "Light"]) {
      window.change_theme(theme);
      assert.equal(window.theme_mode, theme);
      assert.equal(state.themeMode, theme);
      assert.equal(state.selectedJointId, selectedJoint, "Theme changes preserve the selected joint");
      assert.equal(state.selectedLayerId, selectedLayer, "Theme changes preserve the selected layer");
      window.change_workspace("Animacao");
      for (const [width, height] of sizes) {
        window.window.logicalSize = { width, height };
        await capture(`${theme.toLowerCase()}-${width}x${height}`, width, height);
      }
      themeHashes.add(captures.at(-1)!.frameHash);
    }
    assert.equal(themeHashes.size, 3, "All three themes must produce distinct live viewport pixels");
    passed("themes-preserve-selection-and-update-pixels");

    window.window.logicalSize = { width: 760, height: 560 };
    await capture("light-minimum-760x560", 760, 560);

    window.change_theme("Dark");
    window.window.logicalSize = { width: 1400, height: 900 };
    for (const workspace of ["Montagem", "Rig", "Animacao", "Foco"]) {
      const playing: boolean = state.isPlaying;
      window.change_workspace(workspace);
      assert.equal(window.active_workspace, workspace);
      assert.equal(state.activeWorkspace, workspace);
      assert.equal(state.isPlaying, playing, "Workspace changes preserve playback");
      assert.equal(state.selectedJointId, selectedJoint, "Workspace changes preserve selected joint");
      assert.equal(state.selectedLayerId, selectedLayer, "Workspace changes preserve selected layer");
      if (workspace !== "Foco") assert.equal(window.element_tab, workspace === "Rig" ? "Juntas" : "Camadas");
      await capture(`workspace-${workspace.toLowerCase()}`, 1400, 900);
    }

    window.change_workspace("Rig");
    window.appearance_open = true;
    await capture("appearance", 1400, 900);
    window.appearance_open = false;
    window.change_accent("Violeta");
    assert.equal(window.accent_name, "Violeta");
    assert.equal(state.accentName, "Violeta");
    window.change_accent("Ciano");
    passed("appearance-and-accent-callbacks");

    const click = (x: number, y: number) => {
      const position = { x, y };
      window.window.dispatchEvent({ type: "pointer-moved", position });
      window.window.dispatchEvent({ type: "pointer-pressed", position, button: "left" });
      window.window.dispatchEvent({ type: "pointer-released", position, button: "left" });
    };
    const key = (text: string) => {
      window.window.dispatchEvent({ type: "key-pressed", text });
      window.window.dispatchEvent({ type: "key-released", text });
    };
    window.appearance_open = true;
    await pause();
    click(1260, 55);
    assert.equal(state.viewportMode, "2D", "The appearance header blocks clicks on viewport controls below it");
    passed("native-appearance-blocks-click-through");
    click(1210, 179);
    window.change_accent("Ciano");
    key("\n");
    assert.equal(state.accentName, "Violeta", "Enter activates the focused accent swatch");
    window.change_accent("Ciano");
    key(" ");
    assert.equal(state.accentName, "Violeta", "Space activates the focused accent swatch");
    window.appearance_open = false;
    window.change_accent("Ciano");
    passed("native-accent-keyboard-activation");
    // Persona coordinates are checked at the documented 1400px desktop layout.
    for (const [workspace, x] of [["Montagem", 160], ["Rig", 220], ["Animacao", 280]] as const) {
      click(x, 20);
      assert.equal(state.activeWorkspace, workspace, `Native click activates ${workspace}`);
      await pause();
    }
    passed("native-persona-clicks");
    click(850, 180);
    key(" ");
    assert.equal(state.isPlaying, true, "Space on the focused stage starts playback");
    key(" ");
    assert.equal(state.isPlaying, false, "Space on the focused stage pauses playback");
    passed("native-stage-keyboard-playback");
    click(500, 101 + window.viewport_height + 34 + 23 + 13);
    const scrubbedTime = state.timelineTime;
    key("\uF703"); // Slint Key.RightArrow
    assert.ok(state.timelineTime > scrubbedTime, "Right arrow advances the focused timeline");
    key("\uF702"); // Slint Key.LeftArrow
    assert.ok(Math.abs(state.timelineTime - scrubbedTime) < 1e-6, "Left arrow restores the previous scrub time");
    key("\uF729"); // Slint Key.Home
    assert.equal(state.timelineTime, 0, "Home seeks to the start of the focused timeline");
    key("\uF72B"); // Slint Key.End
    assert.equal(state.timelineTime, state.timelineDuration, "End seeks to the end of the focused timeline");
    passed("native-timeline-keyboard-navigation");
    click(220, 20);
    window.change_workspace("Montagem");
    key("\n"); // Slint Key.Return
    assert.equal(state.activeWorkspace, "Rig", "Enter activates the focused persona button");
    passed("native-button-keyboard-activation");

    const zoom = state.cameraZoom;
    window.zoom_in();
    assert.equal(state.cameraZoom, zoom * 1.25);
    assert.equal(window.zoom_level, state.cameraZoom);
    window.zoom_out();
    assert.equal(state.cameraZoom, zoom);
    passed("zoom-callbacks");

    window.set_editor_mode("Setup");
    const jointId = state.selectedJointId;
    const original = state.joints.find((joint) => joint.id === jointId)!;
    const x = original.x;
    const y = original.y;
    window.update_joint_pos(jointId, 5, -5);
    assert.equal(state.joints.find((joint) => joint.id === jointId)!.x, x + 5);
    window.undo();
    assert.equal(state.joints.find((joint) => joint.id === jointId)!.x, x);
    assert.equal(state.joints.find((joint) => joint.id === jointId)!.y, y);
    passed("edit-and-undo");

    window.change_workspace("Animacao");
    window.timeline_seek(0.4);
    assert.equal(state.timelineTime, 0.4);
    assert.equal(window.timeline_time, 0.4);
    const time = state.timelineTime;
    window.toggle_play();
    await pause();
    assert.ok(state.timelineTime > time, "Playback must advance through the actual render loop");
    window.toggle_play();
    passed("timeline-seek-and-live-playback");

    const exported = exportPngSync(state);
    assert.equal(exported.readUInt32BE(16), 720);
    assert.equal(exported.readUInt32BE(20), 500);
    await writeFile(path.join(output, "viewport-export.png"), exported);
    passed("png-export-dimensions");

    await writeFile(path.join(output, "report.json"), JSON.stringify({ display, checks, captures }, null, 2) + "\n");
    console.log(`Validated ${checks.length} checks; ${captures.length} native captures in ${output}`);
  } finally {
    cleanup();
    window.hide();
    slint.quitEventLoop();
    await loop;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
