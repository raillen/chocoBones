/**
 * Browser QA for the actual Solid editor, using the production browser adapter,
 * its real canvas/worker and file inputs. Native Electrobun validation is recorded
 * separately: passing this script does not establish native runtime behavior.
 *
 * CHOCOBONES_QA_URL=http://127.0.0.1:5173 pnpm exec tsx scripts/qa_solid_editor.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright-core";
import { decodePng } from "../src/assets/png";

const url = process.env.CHOCOBONES_QA_URL ?? "http://127.0.0.1:5173";
const output = process.env.CHOCOBONES_QA_OUTPUT ?? "/workspace/.artifacts/chocobones-solid-editor";
const source = path.resolve("assets/test-kits/frontier-survival/vector-rig/base-survivor.png");
const cdp = process.env.CHOCOBONES_QA_CDP;
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const errors: string[] = [];
const checks: string[] = [];
const captures: Array<Record<string, unknown>> = [];
let actualUrl = url;
let packagedAssets: Record<string, unknown> | null = null;
const passed = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };

interface Snapshot {
  revision: number;
  phase: string;
  hasSprite: boolean;
  dimensions: number[];
  layers: Array<{ id: string; name: string; asset: string }>;
  selectedLayer: string;
  selectedPin: string;
  mesh: { vertices: number; triangles: number; deformation: string; build: unknown } | null;
  pins: Array<{ id: string; name?: string; x: number; y: number; locked: boolean; enabled?: boolean; meshId?: string }>;
  pose: Array<[string, number[]]>;
  time: number;
  isPlaying: boolean;
  clip: { duration: number; fps: number; frames: number; loop: boolean };
  camera: { zoom: number; x: number; y: number };
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const qa = (window as unknown as { __CHOCOBONES_QA__?: { editor: any } }).__CHOCOBONES_QA__;
    if (!qa) throw new Error("The dev-only editor QA hook is missing");
    const editor = qa.editor;
    const view = editor.getViewModel();
    const state = editor.state;
    const meshId = state.meshLayer.get(state.selectedLayerId);
    const mesh = meshId === undefined ? undefined : state.meshes[Number(meshId)];
    return {
      revision: view.revision, phase: view.phase, hasSprite: view.hasSprite,
      dimensions: [state.canvasWidth, state.canvasHeight],
      layers: state.layers.map((layer: any) => ({ id: layer.id, name: layer.name, asset: layer.asset })),
      selectedLayer: state.selectedLayerId, selectedPin: state.selectedPinId,
      mesh: mesh ? { vertices: mesh.vertices.length, triangles: mesh.triangles.length, deformation: mesh.deformation ?? "MLS", build: mesh.build } : null,
      pins: state.pins.map((pin: any) => ({ id: pin.id, name: pin.name, x: pin.x, y: pin.y, locked: pin.locked, enabled: pin.enabled, meshId: pin.meshId })),
      pose: [...state.currentPose.pins].map(([id, delta]: [string, number[]]) => [id, [...delta]]),
      time: state.timelineTime, isPlaying: state.isPlaying,
      clip: { duration: state.activeClip.duration, fps: state.activeClip.fps, frames: state.activeClip.frames.length, loop: state.activeClip.loop },
      camera: { zoom: state.cameraZoom, x: state.cameraPan.x, y: state.cameraPan.y },
    };
  });
}

async function until(page: Page, condition: (value: Snapshot) => boolean, description: string): Promise<Snapshot> {
  const start = Date.now();
  while (true) {
    const value = await snapshot(page);
    if (condition(value)) return value;
    assert.ok(Date.now() - start < 20000, `Timed out: ${description}`);
    await page.waitForTimeout(80);
  }
}

async function artworkHash(page: Page): Promise<string> {
  const canvas = page.getByTestId("stage-canvas");
  await canvas.waitFor({ state: "visible" });
  // Capture compositor pixels: the production WebGL canvas deliberately does not
  // preserveDrawingBuffer, so toDataURL would not establish visible rendering.
  return hash(await canvas.screenshot());
}

async function capture(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(350);
  const file = `${name}.png`;
  const bytes = await page.screenshot({ path: path.join(output, file), fullPage: false });
  const dimensions = page.viewportSize() ?? await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const state = await snapshot(page);
  const png = decodePng(bytes);
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  assert.deepEqual([png.width, png.height], [dimensions.width * dpr, dimensions.height * dpr]);
  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="stage-canvas"]')!;
    const rect = canvas.getBoundingClientRect();
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      stage: { width: rect.width, height: rect.height }, canvas: { width: canvas.width, height: canvas.height } };
  });
  assert.equal(geometry.overflow, false, "The editor must not overflow horizontally");
  assert.ok(geometry.stage.width >= 300 && geometry.stage.height >= 180, "The stage must remain usable beside inspector and timeline");
  assert.ok(Math.abs(geometry.canvas.width - geometry.stage.width * dpr) <= 2 &&
    Math.abs(geometry.canvas.height - geometry.stage.height * dpr) <= 2, "The stage backing buffer must honor display pixel density");
  captures.push({ name, file, viewport: dimensions, devicePixelRatio: dpr, geometry, state, screenshotHash: hash(bytes), stageHash: await artworkHash(page) });
  passed(`capture-${name}`);
}

async function saveDownload(page: Page, testId: string, filename: string): Promise<Buffer> {
  if (testId.startsWith("export-")) await page.getByRole("button", { name: "Exportar", exact: true }).click();
  await page.getByTestId(testId).click();
  await page.locator("dialog[open]").waitFor();
  await page.getByTestId("file-dialog-name").fill(filename);
  if (cdp) {
    await page.locator(".file-directory input").fill(output);
    await page.getByLabel("Permitir substituir um arquivo existente").check();
    await page.getByTestId("file-dialog-confirm").click();
    const started = Date.now();
    while (true) {
      try { return await readFile(path.join(output, filename)); }
      catch { assert.ok(Date.now() - started < 20000, `Native save did not publish ${filename}`); await page.waitForTimeout(100); }
    }
  }
  const download = page.waitForEvent("download");
  await page.getByTestId("file-dialog-confirm").click();
  await (await download).saveAs(path.join(output, filename));
  return readFile(path.join(output, filename));
}

async function seek(page: Page, fraction: number): Promise<void> {
  const ruler = page.getByTestId("timeline-slider");
  const bounds = await ruler.boundingBox();
  assert.ok(bounds, "Timeline ruler must be visible");
  await page.mouse.click(bounds.x + bounds.width * fraction, bounds.y + bounds.height / 2);
}

async function dragPin(page: Page, pin: Snapshot["pins"][number], dx: number, dy: number): Promise<void> {
  const state = await snapshot(page);
  const bounds = await page.getByTestId("stage").boundingBox();
  assert.ok(bounds);
  const delta = pin.locked ? [0, 0] : state.pose.find(([id]) => id === pin.id)?.[1] ?? [0, 0];
  const x = bounds.x + (pin.x + delta[0]!) * state.camera.zoom + state.camera.x;
  const y = bounds.y + (pin.y + delta[1]!) * state.camera.zoom + state.camera.y;
  assert.ok(x > bounds.x && x < bounds.x + bounds.width && y > bounds.y && y < bounds.y + bounds.height, "Pin must be visible within the stage");
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

async function main(): Promise<void> {
  await mkdir(output, { recursive: true });
  const browser = cdp ? await chromium.connectOverCDP(cdp) : await chromium.launch({ executablePath: process.env.CHOCOBONES_CHROMIUM ?? "/usr/bin/chromium", headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  let failure: string | undefined;
  try {
    const context = cdp ? browser.contexts()[0]! : await browser.newContext({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
    const page = cdp ? context.pages().find(candidate => candidate.url().startsWith("views://editor/") || candidate.url().includes(":5173"))! : await context.newPage();
    assert.ok(page, "The actual Electrobun editor webview must be open");
    page.on("pageerror", error => errors.push(error.stack ?? error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    if (cdp) await page.reload({ waitUntil: "networkidle" });
    else await page.goto(url, { waitUntil: "networkidle" });
    actualUrl = page.url();
    await until(page, () => true, "editor bootstrap");
    if (cdp) await page.evaluate(() => (window as any).__CHOCOBONES_QA__.runtime.ready);
    if (actualUrl.startsWith("views://")) {
      packagedAssets = await page.evaluate(async () => {
        await document.fonts.ready;
        const icons = await fetch(new URL("./icons/phosphor/svg/regular/bone.svg", location.href));
        return { origin: location.origin, fonts: document.fonts.check("12px Inter"), iconStatus: icons.status,
          iconIsSvg: (await icons.text()).includes("<svg"), resources: performance.getEntriesByType("resource").map(entry => entry.name) };
      });
      assert.equal(packagedAssets.fonts, true, "Packaged Inter fonts must load");
      assert.equal(packagedAssets.iconStatus, 200, "Packaged Phosphor icons must load");
      assert.equal(packagedAssets.iconIsSvg, true);
      passed("packaged-views-load-local-fonts-and-phosphor-icons");
    }
    await capture(page, "01-prepare-empty");

    if (cdp) {
      const importedNative = await page.evaluate(async filePath => {
        const qa = (window as any).__CHOCOBONES_QA__;
        if (!qa.runtime.native) throw new Error("CDP target is not the Electrobun view");
        const rpc = await qa.rpcReady;
        const assets = await rpc.request.importImages({ paths: [filePath] });
        for (const asset of assets) qa.editor.importDecoded(await qa.fetchAsset(asset), asset.name);
        return assets.map((asset: any) => ({ name: asset.name, width: asset.width, height: asset.height, pngUrl: asset.pngUrl, rgbaUrl: asset.rgbaUrl }));
      }, source);
      assert.ok(importedNative[0]!.pngUrl.startsWith("http://127.0.0.1:"));
      passed("native-electrobun-rpc-import-and-binary-asset-transport");
    } else {
      const chooseImage = page.waitForEvent("filechooser");
      await page.getByTestId("import-images").click();
      await (await chooseImage).setFiles(source);
    }
    const imported = await until(page, value => value.hasSprite, "PNG import");
    assert.deepEqual(imported.dimensions, [512, 768]);
    assert.equal(imported.mesh?.deformation, "MLS");
    if (actualUrl.startsWith("views://")) {
      await page.waitForFunction(() => Number(document.querySelector<HTMLCanvasElement>('[data-testid="stage-canvas"]')?.dataset.vertexCount) > 0);
      passed("packaged-module-worker-computes-visible-mesh");
    }
    passed(cdp ? "native-png-import-retains-texture-and-dimensions" : "real-png-file-input-imports-texture-and-dimensions");
    await capture(page, "02-prepare-imported");

    await page.getByTestId("phase-rig").click();
    await page.getByTestId("auto-pins").click();
    const rigged = await until(page, value => value.pins.length >= 3, "suggested rig controls");
    assert.ok(rigged.pins.some(pin => pin.locked));
    assert.ok(rigged.pins.some(pin => !pin.locked));
    passed("rig-tools-create-movable-and-fixed-controls");
    await capture(page, "03-rig-mls");

    await page.getByTestId("deformation-arap").click();
    await until(page, value => value.mesh?.deformation === "ARAP", "ARAP model selection");
    await page.locator("summary").filter({ hasText: "Construção da malha" }).click();
    await page.getByTestId("refine-edges").check();
    await page.getByTestId("edge-size").fill("8");
    await page.getByTestId("edge-size").press("Enter");
    await page.getByTestId("rebuild-mesh").click();
    const refined = await until(page, value => Boolean(value.mesh && value.mesh.vertices > rigged.mesh!.vertices), "adaptive silhouette mesh");
    assert.equal(refined.mesh?.deformation, "ARAP");
    assert.deepEqual(refined.pins, rigged.pins);
    passed("adaptive-arap-mesh-rebuild-preserves-rig");
    await capture(page, "04-rig-arap-refined");
    await page.getByTestId("undo").click();
    await until(page, value => value.mesh?.vertices === rigged.mesh!.vertices, "undo mesh rebuild");
    await page.getByTestId("redo").click();
    await until(page, value => value.mesh?.vertices === refined.mesh!.vertices, "redo mesh rebuild");
    passed("toolbar-undo-redo-restores-mesh-topology");

    await page.getByTestId("phase-animate").click();
    await page.getByTestId("preset-breath").click();
    const animated = await until(page, value => value.clip.frames > 2, "animation preset");
    assert.ok(animated.clip.loop);
    const initialHash = await artworkHash(page);
    await seek(page, .25);
    await until(page, value => Math.abs(value.time - animated.clip.duration / 4) < 0.05, "timeline scrub");
    await page.waitForTimeout(500);
    assert.notEqual(await artworkHash(page), initialHash, "Timeline scrub must change rendered texture");
    passed("timeline-scrub-updates-real-worker-canvas");
    await capture(page, "05-animate-breath");

    const moving = animated.pins.find(pin => pin.name === "Superior" && !pin.locked)!;
    const fixed = animated.pins.find(pin => pin.locked)!;
    assert.ok(moving && fixed);
    const poseBeforeDrag = await snapshot(page);
    await dragPin(page, moving, 35, -18);
    const posed = await snapshot(page);
    assert.equal(posed.selectedPin, moving.id);
    assert.notDeepEqual(posed.pose.find(([id]) => id === moving.id), poseBeforeDrag.pose.find(([id]) => id === moving.id));
    assert.deepEqual(posed.pins, poseBeforeDrag.pins, "Animation drag must preserve rest coordinates");
    passed("real-stage-pointer-drag-edits-pose-and-retains-rig");
    await dragPin(page, fixed, 24, -10);
    assert.deepEqual((await snapshot(page)).pose, posed.pose, "A fixed anchor cannot acquire a drag offset");
    passed("fixed-control-remains-locked-through-stage-pointer-drag");

    const fpsField = page.getByRole("spinbutton", { name: "FPS", exact: true }).first();
    await fpsField.focus();
    const beforeKeys = await snapshot(page);
    await page.keyboard.press("Space");
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Delete");
    const afterKeys = await snapshot(page);
    assert.equal(afterKeys.isPlaying, false);
    assert.deepEqual(afterKeys.pins, beforeKeys.pins);
    assert.deepEqual(afterKeys.pose, beforeKeys.pose);
    assert.deepEqual(afterKeys.clip, beforeKeys.clip);
    await page.getByTestId("stage").focus();
    passed("editing-fields-suppress-play-undo-and-delete-shortcuts");

    const png = await saveDownload(page, "export-png", "artwork-current.png");
    const exported = decodePng(png);
    assert.deepEqual([exported.width, exported.height], imported.dimensions);
    let painted = 0, transparent = 0;
    for (let index = 3; index < exported.pixels.length; index += 4) {
      if (exported.pixels[index] === 0) transparent++; else painted++;
    }
    assert.ok(painted > 0 && transparent > 0, "Exported PNG must contain the character and transparent background");
    passed(`${cdp ? "native" : "browser"}-png-export-has-canvas-dimensions-and-alpha`);

    const projectBytes = await saveDownload(page, "project-save", "portable.puppet.json");
    const project = JSON.parse(projectBytes.toString("utf8"));
    assert.ok(project.assets.some((asset: any) => asset.data.length > 0));
    assert.equal(project.meshes[0].deformation, "ARAP");
    assert.equal(project.meshes[0].build.refineEdges, true);
    passed(`${cdp ? "native-project-save" : "browser-project-download"}-retains-embedded-assets-and-model`);

    // Reopen the portable file through the real adapter. Native OS file picking is
    // not simulated: the native branch explicitly calls its existing typed RPC.
    await page.getByRole("button", { name: "Arquivo", exact: true }).click();
    await page.getByRole("button", { name: /^Novo projeto/ }).click();
    await until(page, value => !value.hasSprite, "new empty document");
    if (cdp) {
      await page.evaluate(async projectPath => {
        const qa = (window as any).__CHOCOBONES_QA__;
        const payload = await (await qa.rpcReady).request.openProject({ path: projectPath });
        const images = await Promise.all(payload.assets.map(async (asset: any) => [asset.id, await qa.fetchAsset(asset)]));
        qa.editor.loadProject(payload.project, new Map(images));
      }, path.join(output, "portable.puppet.json"));
    } else {
      const chooseProject = page.waitForEvent("filechooser");
      await page.getByTestId("project-open").click();
      await (await chooseProject).setFiles(path.join(output, "portable.puppet.json"));
    }
    const reopened = await until(page, value => value.hasSprite, "portable project reopen");
    assert.equal(reopened.mesh?.deformation, "ARAP");
    const restoredProject = await page.evaluate(() => (window as any).__CHOCOBONES_QA__.editor.toProject());
    assert.deepEqual(restoredProject, project, "Opening portable project must preserve assets, rig, mesh, clip and current pin pose");
    const reexported = decodePng(await saveDownload(page, "export-png", "artwork-reopened.png"));
    assert.deepEqual(reexported.pixels, exported.pixels, "Reopened project must export identical artwork pixels");
    passed(`${cdp ? "native-rpc" : "browser-file-input"}-project-reopen-preserves-document-and-export`);
    await page.getByTestId("phase-animate").click();
    if (actualUrl.startsWith("views://")) {
      const revision = await page.evaluate(() => (window as any).__CHOCOBONES_QA__.editor.getViewModel().documentRevision);
      await page.getByLabel("Tema da interface", { exact: true }).selectOption("Dim");
      await page.waitForFunction(async () => {
        const qa = (window as any).__CHOCOBONES_QA__;
        return (await (await qa.rpcReady).request.bootstrap({})).preferences.theme === "dim";
      });
      assert.equal(await page.evaluate(() => (window as any).__CHOCOBONES_QA__.editor.getViewModel().documentRevision), revision);
      passed("native-theme-preference-persists-without-changing-document");
    }
    await page.getByLabel("Tema da interface", { exact: true }).selectOption("Light");
    await capture(page, "06-animate-light");
    await page.getByLabel("Tema da interface", { exact: true }).selectOption("Dark");

    await page.setViewportSize({ width: 960, height: 720 });
    await capture(page, "07-animate-compact");
    if (actualUrl.startsWith("views://")) {
      await page.evaluate(() => {
        const editor = (window as any).__CHOCOBONES_QA__.editor;
        editor.dispatch({ type: "canvas-settings", width: editor.state.canvasWidth + 1, height: editor.state.canvasHeight });
      });
      const beforeCancel = await snapshot(page);
      await page.getByRole("button", { name: "Arquivo", exact: true }).click();
      await page.getByRole("button", { name: /^Novo projeto/ }).click();
      await page.getByTestId("unsaved-cancel").click();
      assert.deepEqual(await snapshot(page), beforeCancel);
      passed("unsaved-new-project-cancel-preserves-document");
      await page.getByRole("button", { name: "Arquivo", exact: true }).click();
      await page.getByRole("button", { name: /^Novo projeto/ }).click();
      await page.getByTestId("unsaved-discard").click();
      await until(page, value => !value.hasSprite, "confirmed new document");
      passed("unsaved-new-project-discard-creates-empty-document");
    }
    assert.equal(errors.length, 0, errors.join("\n"));
    passed("no-browser-errors-during-editor-workflow");
    if (!cdp) await context.close();
  } catch (error) {
    failure = error instanceof Error ? error.stack ?? error.message : String(error);
  } finally {
    await browser.close();
    await writeFile(path.join(output, "report.json"), JSON.stringify({ runtime: cdp ? "native-electrobun-cef" : "chromium-browser-preview", url: actualUrl, packaged: actualUrl.startsWith("views://"), packagedAssets, cdp: cdp ?? null, source: path.relative(process.cwd(), source), checks, captures, errors, failure: failure ?? null }, null, 2) + "\n");
  }
  if (failure) throw new Error(failure);
  console.log(`QA complete: ${checks.length} checks, ${captures.length} captures in ${output}`);
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
