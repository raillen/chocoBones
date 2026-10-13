import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decodePng } from "../src/assets/png";
import { encodeRgbaToPng } from "../src/render/png_export";
import { AssetRegistry } from "../src/desktop/host/assets";
import { createDesktopServices, DesktopPreferencesSchema, ExportArtworkParamsSchema, ImportImagesParamsSchema } from "../src/desktop/host/services";
import { EditorController } from "../src/editor/controller";
import { loadProjectFromJson } from "../src/project/project";
import { renderArtwork } from "../src/render/sprite_scene";
import { LAYER_DELTA_IDENTITY } from "../src/rig/joint";

function fixture() {
  const pixels = new Uint8ClampedArray([
    240, 40, 20, 255, 20, 230, 40, 128,
    0, 0, 0, 0, 20, 40, 220, 255,
  ]);
  return decodePng(encodeRgbaToPng(2, 2, pixels));
}

describe("desktop binary asset contract", () => {
  it("serves original PNG and exact decoded RGBA through a session resource", async () => {
    const image = fixture();
    const registry = new AssetRegistry("http://127.0.0.1:12345/");
    const [descriptor] = registry.registerMany([{ id: "hero", name: "hero.png", image }]);
    expect(descriptor).toMatchObject({ id: "hero", name: "hero.png", width: 2, height: 2 });
    expect(descriptor!.pngUrl).toContain(`/${registry.token}/`);
    expect(descriptor!.pngUrl).not.toContain("hero.png");
    const png = registry.handleRequest(new Request(descriptor!.pngUrl));
    const rgba = registry.handleRequest(new Request(descriptor!.rgbaUrl));
    expect(png.status).toBe(200);
    expect(png.headers.get("Content-Type")).toBe("image/png");
    expect(rgba.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(new Uint8Array(await png.arrayBuffer())).toEqual(new Uint8Array(image.png));
    expect(new Uint8Array(await rgba.arrayBuffer())).toEqual(new Uint8Array(image.pixels));
    expect(png.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("owns an immutable copy of image buffers and deduplicates storage across project aliases", async () => {
    const image = fixture();
    const budget = image.pixels.byteLength + image.png.byteLength;
    const registry = new AssetRegistry("http://127.0.0.1:12345", budget);
    const [first, second] = registry.registerMany([
      { id: "asset-a", name: "hero.png", image },
      { id: "asset-b", name: "alternate.png", image },
    ]);
    expect(first!.pngUrl).toBe(second!.pngUrl);
    const originalRgba = new Uint8Array(image.pixels);
    const originalPng = new Uint8Array(image.png);
    image.pixels.fill(0);
    image.png.fill(0);
    expect(new Uint8Array(await registry.handleRequest(new Request(first!.rgbaUrl)).arrayBuffer())).toEqual(originalRgba);
    expect(new Uint8Array(await registry.handleRequest(new Request(second!.pngUrl)).arrayBuffer())).toEqual(originalPng);
    // Deduplication permits another alias even at the exact memory limit.
    expect(registry.registerMany([{ id: "asset-c", name: "again.png", image: fixture() }])).toHaveLength(1);
  });

  it("rejects an invalid import batch before publishing any resource or alias", () => {
    const registry = new AssetRegistry();
    const image = fixture();
    expect(() => registry.registerMany([
      { id: "good", name: "good.png", image },
      { id: "bad", name: "broken.png", image: { ...image, width: 3 } },
    ])).toThrow(/RGBA/);
    expect(registry.describe("good")).toBeUndefined();
    expect(registry.describe("bad")).toBeUndefined();
    expect(() => registry.registerMany([
      { id: "same", name: "a.png", image }, { id: "same", name: "b.png", image },
    ])).toThrow(/duplicado/);
    expect(registry.describe("same")).toBeUndefined();
    const tooSmall = new AssetRegistry("http://127.0.0.1:12345", image.pixels.byteLength);
    expect(() => tooSmall.registerMany([{ id: "oversized", name: "hero.png", image }])).toThrow(/memória/);
    expect(tooSmall.describe("oversized")).toBeUndefined();
  });

  it("does not expose filesystem paths, guessed tokens or unsupported methods", () => {
    const registry = new AssetRegistry("http://127.0.0.1:12345");
    const [asset] = registry.registerMany([{ id: "hero", name: "hero.png", image: fixture() }]);
    for (const url of [
      "http://127.0.0.1:12345/etc/passwd",
      asset!.pngUrl.replace(registry.token, "wrong-session"),
      `${asset!.pngUrl}/extra`,
      asset!.pngUrl.replace("/png", "/../png"),
      asset!.pngUrl.replace("/png", "/json"),
    ]) expect(registry.handleRequest(new Request(url)).status).toBe(404);
    expect(registry.handleRequest(new Request(asset!.pngUrl, { method: "POST" })).status).toBe(405);
    expect(registry.handleRequest(new Request(asset!.pngUrl, { method: "OPTIONS" })).status).toBe(204);
    registry.setBaseUrl("http://127.0.0.1:43210/");
    expect(registry.describe("hero")!.pngUrl).toContain("http://127.0.0.1:43210/");
  });
});

describe("native desktop file and codec contract", () => {
  let directory: string;
  beforeEach(async () => { directory = await fs.mkdtemp(path.join(tmpdir(), "chocobones-desktop-contract-")); });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });

  function services(registry = new AssetRegistry(), options: { imagePaths?: string[]; projectPath?: string | null; exportDirectory?: string | null } = {}) {
    return createDesktopServices({ assets: registry, configDir: path.join(directory, "preferences"), dialogs: {
      openImages: async () => options.imagePaths ?? [],
      openProject: async () => options.projectPath ?? null,
      chooseDirectory: async () => options.exportDirectory ?? null,
    } });
  }

  function document(registry: AssetRegistry) {
    const image = fixture();
    const editor = new EditorController();
    editor.importDecoded(image, "hero.png");
    const project = editor.toProject();
    const descriptors = registry.registerMany([{ id: project.assets[0]!.id, name: "hero.png", image }]);
    // Production IPC carries registry references, while portable files contain PNG bytes.
    project.assets[0]!.data = "";
    return { image, editor, project, descriptors };
  }

  it("validates native paths, finite values and bounded export/layout requests", () => {
    for (const paths of [["relative.png"], [""], ["/tmp/invalid\0.png"], Array(33).fill("/tmp/a.png")]) {
      expect(() => ImportImagesParamsSchema.parse({ paths })).toThrow();
    }
    expect(() => ImportImagesParamsSchema.parse({ paths: [], unexpected: true })).toThrow();
    const { project } = document(new AssetRegistry());
    for (const extra of [{ time: Number.NaN }, { time: -1 }, { frames: 241 }, { columns: 0 }, { kind: "gif" }, { path: "relative.png" }]) {
      expect(() => ExportArtworkParamsSchema.parse({ project, kind: "png", ...extra })).toThrow();
    }
    expect(() => DesktopPreferencesSchema.parse({ theme: "dark", leftPanelWidth: 100, rightPanelWidth: 304, timelineHeight: 186 })).toThrow();
    expect(() => DesktopPreferencesSchema.parse({ theme: "dark", leftPanelWidth: 236, rightPanelWidth: Infinity, timelineHeight: 186 })).toThrow();
  });

  it("imports actual PNG files and hydrates binary-free IPC manifests into portable projects", async () => {
    const imageFile = path.join(directory, "hero.png");
    await fs.writeFile(imageFile, fixture().png);
    const registry = new AssetRegistry("http://127.0.0.1:12345");
    const host = services(registry, { imagePaths: [imageFile] });
    const [asset] = await host.importImages();
    expect(asset).toMatchObject({ name: "hero.png", width: 2, height: 2 });
    expect(registry.get(asset!.id)!.pixels).toEqual(fixture().pixels);

    const { project } = document(registry);
    const target = path.join(directory, "hero.puppet.json");
    expect(await host.saveProject({ project, path: target })).toEqual({ path: target });
    const saved = loadProjectFromJson(await fs.readFile(target, "utf8"));
    expect(saved.assets[0]!.data).toBe(Buffer.from(fixture().png).toString("base64"));
    const payload = await host.openProject({ path: target });
    expect(payload!.path).toBe(target);
    expect(payload!.project.assets[0]!.data).toBe("");
    expect(payload!.assets[0]).toMatchObject({ id: project.assets[0]!.id, width: 2, height: 2 });
    expect(registry.get(payload!.assets[0]!.id)!.pixels).toEqual(fixture().pixels);
    const secondTarget = path.join(directory, "portable-again.puppet.json");
    await host.saveProject({ project: payload!.project, path: secondTarget });
    expect(loadProjectFromJson(await fs.readFile(secondTarget, "utf8"))).toEqual(saved);
  });

  it("exports transparent artwork with the same pixels as the shared renderer and bounded spritesheets", async () => {
    const registry = new AssetRegistry();
    const { editor, project } = document(registry);
    editor.state.showMesh = true;
    editor.state.onionSkin = true;
    editor.state.showSkeleton = true;
    const host = services(registry);
    const frame = path.join(directory, "artwork.png");
    expect(await host.exportArtwork({ project, path: frame, kind: "png" })).toMatchObject({ path: frame, width: 2, height: 2, frames: 1 });
    const exported = decodePng(await fs.readFile(frame));
    expect(exported.pixels).toEqual(renderArtwork(editor.state).pixels);
    expect(exported.pixels[11]).toBe(0);
    expect(exported.pixels[3]).toBeGreaterThan(0);
    const sheet = path.join(directory, "sheet.png");
    expect(await host.exportArtwork({ project, path: sheet, kind: "spritesheet", frames: 3, columns: 2 })).toMatchObject({ width: 4, height: 4, frames: 3 });
    expect(decodePng(await fs.readFile(sheet)).width).toBe(4);
    const huge = { ...project, width: 4096, height: 4096 };
    await expect(host.exportArtwork({ project: huge, path: path.join(directory, "too-large.png"), kind: "spritesheet", frames: 2 })).rejects.toThrow(/16 milhões/);
    await expect(fs.stat(path.join(directory, "too-large.png"))).rejects.toThrow();
  });

  it("preserves existing files until overwrite is explicit and cleans temporary files after rejection", async () => {
    const registry = new AssetRegistry();
    const { project } = document(registry);
    const host = services(registry);
    const projectFile = path.join(directory, "existing.puppet.json");
    const imageFile = path.join(directory, "existing.png");
    await fs.writeFile(projectFile, "existing project bytes");
    await fs.writeFile(imageFile, "existing image bytes");
    await expect(host.saveProject({ project, path: projectFile })).rejects.toThrow(/já existe/);
    await expect(host.exportArtwork({ project, path: imageFile, kind: "png" })).rejects.toThrow(/já existe/);
    expect(await fs.readFile(projectFile, "utf8")).toBe("existing project bytes");
    expect(await fs.readFile(imageFile, "utf8")).toBe("existing image bytes");
    expect((await fs.readdir(directory)).some(name => name.endsWith(".tmp"))).toBe(false);
    await host.saveProject({ project, path: projectFile, overwrite: true });
    await host.exportArtwork({ project, path: imageFile, kind: "png", overwrite: true });
    expect(loadProjectFromJson(await fs.readFile(projectFile, "utf8")).assets[0]!.data).not.toBe("");
    expect(decodePng(await fs.readFile(imageFile)).width).toBe(2);
    // Subsequent Save is authorized for the current project without a new path choice.
    await expect(host.saveProject({ project })).resolves.toEqual({ path: projectFile });
  });

  it("exports the edited joint and layer pose even when it has not been baked into keyframes", async () => {
    const registry = new AssetRegistry();
    const { editor } = document(registry);
    const state = editor.state;
    const layer = state.layers[0]!;
    state.canvasWidth = 32; state.canvasHeight = 32;
    state.joints = [{ id: "root", name: "Root", parent: "", x: 1, y: 1, color: "#38a6b5" }];
    layer.joint = "root";
    state.currentPose.joints.set("root", { angle: .15, x: 4, y: 3 });
    state.currentPose.layers.set(layer.id, { ...LAYER_DELTA_IDENTITY, x: 8, y: 8, sx: 5, sy: 4, opacity: .65 });
    state.currentPose.params.set("custom", .75);
    const project = editor.toProject();
    project.assets[0]!.data = "";
    const pose = {
      joints: Object.fromEntries(state.currentPose.joints), layers: Object.fromEntries(state.currentPose.layers),
      pins: Object.fromEntries(state.currentPose.pins), params: Object.fromEntries(state.currentPose.params),
    };
    const host = services(registry);
    const currentFile = path.join(directory, "current-edited-pose.png");
    const restFile = path.join(directory, "rest-pose.png");
    await host.exportArtwork({ project, kind: "png", path: currentFile, pose });
    await host.exportArtwork({ project, kind: "png", path: restFile });
    const current = decodePng(await fs.readFile(currentFile));
    const rest = decodePng(await fs.readFile(restFile));
    expect(current.pixels).toEqual(renderArtwork(state).pixels);
    expect(current.pixels).not.toEqual(rest.pixels);
    const invalidFile = path.join(directory, "invalid-pose.png");
    await expect(host.exportArtwork({ project, kind: "png", path: invalidFile,
      pose: { ...pose, pins: { bad: [Number.NaN, 0] } } })).rejects.toThrow();
    await expect(fs.stat(invalidFile)).rejects.toThrow();
  });

  it("rejects corrupt incoming projects before changing the current save destination", async () => {
    const registry = new AssetRegistry();
    const { project } = document(registry);
    const host = services(registry);
    const validFile = path.join(directory, "current.puppet.json");
    const badFile = path.join(directory, "broken.puppet.json");
    await host.saveProject({ project, path: validFile });
    const corrupt = structuredClone(project);
    corrupt.assets[0]!.data = "%%%";
    await fs.writeFile(badFile, JSON.stringify(corrupt));
    await expect(host.openProject({ path: badFile })).rejects.toThrow();
    await expect(host.saveProject({ project })).resolves.toEqual({ path: validFile });
    const rejectedTarget = path.join(directory, "rejected.puppet.json");
    await expect(host.saveProject({ project: corrupt, path: rejectedTarget })).rejects.toThrow();
    await expect(fs.stat(rejectedTarget)).rejects.toThrow();
    expect((await fs.readdir(directory)).some(name => name.endsWith(".tmp"))).toBe(false);
  });

  it("handles canceled native dialogs without creating files and persists validated layout preferences", async () => {
    const registry = new AssetRegistry();
    const { project } = document(registry);
    const host = services(registry);
    expect(await host.importImages()).toEqual([]);
    expect(await host.openProject()).toBeNull();
    expect(await host.chooseDirectory()).toBeNull();
    await expect(host.exportArtwork({ project, kind: "png" })).rejects.toThrow(/cancelada/);
    expect(await fs.readdir(directory)).toEqual([]);
    const preferences = { theme: "light" as const, leftPanelWidth: 250, rightPanelWidth: 330, timelineHeight: 210 };
    expect(await host.savePreferences({ preferences })).toEqual(preferences);
    expect((await services().bootstrap()).preferences).toEqual(preferences);
    await expect(host.savePreferences({ preferences: { ...preferences, rightPanelWidth: 900 } })).rejects.toThrow();
    expect((await host.bootstrap()).preferences).toEqual(preferences);
    expect(JSON.parse(await fs.readFile(path.join(directory, "preferences", "studio-preferences.json"), "utf8"))).toEqual(preferences);
  });
});
