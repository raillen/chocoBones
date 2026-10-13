/** Native file/codec services, kept independent of Electrobun for contract tests. */
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { decodePng, MAX_PNG_BYTES } from "../../assets/png";
import { MAX_PROJECT_BYTES, ProjectSchema, ProjectJointDeltaSchema, ProjectLayerDeltaSchema, loadProjectFromJson, saveProjectToJson, type Project } from "../../project/project";
import { applyProjectToState } from "../../ui/actions/project_io";
import { createInitialAppState } from "../../ui/store";
import { renderArtwork } from "../../render/sprite_scene";
import { encodeRgbaToPngAsync } from "../../render/png_export";
import { composeSpritesheet } from "../../export/runtime";
import type { DesktopBootstrap, DesktopPreferences, ExportArtworkParams, ExportArtworkResult, ProjectPayload, SaveProjectParams } from "../shared";
import { AssetRegistry } from "./assets";

export const DesktopPreferencesSchema = z.object({
  theme: z.enum(["dark", "dim", "light", "system"]),
  leftPanelWidth: z.number().finite().min(180).max(420),
  rightPanelWidth: z.number().finite().min(240).max(480),
  timelineHeight: z.number().finite().min(100).max(480),
}).strict();

const NativePathSchema = z.string().min(1).max(4096).refine((value) => !value.includes("\0") && path.isAbsolute(value), "O caminho deve ser absoluto.");
export const ImportImagesParamsSchema = z.object({ paths: z.array(NativePathSchema).max(32).optional() }).strict();
export const SaveProjectParamsSchema = z.object({ project: ProjectSchema, path: NativePathSchema.optional(), overwrite: z.boolean().optional() }).strict();
export const ExportArtworkParamsSchema = SaveProjectParamsSchema.extend({
  kind: z.enum(["png", "spritesheet"]),
  time: z.number().finite().nonnegative().optional(),
  frames: z.number().int().min(1).max(240).optional(),
  columns: z.number().int().min(1).max(32).optional(),
  pose: z.object({
    joints: z.record(ProjectJointDeltaSchema.refine((delta) => Object.values(delta).every(Number.isFinite))),
    layers: z.record(ProjectLayerDeltaSchema.refine((delta) => Object.values(delta).every((v) => typeof v !== "number" || Number.isFinite(v)))),
    pins: z.record(z.tuple([z.number().finite(), z.number().finite()])),
    params: z.record(z.number().finite()),
  }).strict().optional(),
});

const DEFAULT_PREFERENCES: DesktopPreferences = { theme: "dark", leftPanelWidth: 236, rightPanelWidth: 304, timelineHeight: 186 };

export interface DesktopDialogs {
  openImages(): Promise<string[]>;
  openProject(): Promise<string | null>;
  chooseDirectory(): Promise<string | null>;
}

export interface DesktopServicesOptions {
  assets: AssetRegistry;
  dialogs: DesktopDialogs;
  configDir?: string;
  initialProjectPath?: string;
}

/** Write beside the destination, then publish complete bytes without silent overwrite. */
async function writeAtomicFile(target: string, bytes: string | Uint8Array, allowOverwrite: boolean): Promise<void> {
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  try {
    await fs.writeFile(temp, bytes, { flag: "wx" });
    if (allowOverwrite) await fs.rename(temp, target);
    else {
      // COPYFILE_EXCL enforces the choice even if a file appears during export.
      await fs.copyFile(temp, target, fsConstants.COPYFILE_EXCL);
      await fs.unlink(temp);
    }
  } catch (error) {
    await fs.unlink(temp).catch(() => undefined);
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("O arquivo já existe. Confirme a substituição ou escolha outro nome.");
    throw error;
  }
}

export function createDesktopServices({ assets, dialogs, configDir, initialProjectPath }: DesktopServicesOptions) {
  let currentProjectPath = initialProjectPath ? NativePathSchema.parse(initialProjectPath) : null;
  const preferenceFile = configDir ? path.join(configDir, "studio-preferences.json") : null;
  let preferences: DesktopPreferences = { ...DEFAULT_PREFERENCES };
  let preferencesLoaded = false;
  const exportedPaths = new Set<string>();

  /** Fill binary-free browser manifests from the session registry before validation. */
  function hydrateProject(input: Project): Project {
    const project = ProjectSchema.parse(input);
    project.assets = project.assets.map((asset) => {
      if (asset.data) return asset;
      const image = assets.get(asset.id);
      if (!image) return asset; // Legacy metadata-only manifests remain supported.
      if (image.width !== asset.w || image.height !== asset.h) throw new Error(`Asset '${asset.id}': dimensões não correspondem à imagem importada.`);
      return { ...asset, data: Buffer.from(image.png).toString("base64") };
    });
    return loadProjectFromJson(saveProjectToJson(project));
  }

  function prepareState(project: Project) {
    const state = createInitialAppState(undefined, { emptyDocument: true });
    applyProjectToState(state, project);
    return state;
  }

  async function bootstrap(_params: Record<string, never> = {}): Promise<DesktopBootstrap> {
    if (!preferencesLoaded) {
      preferencesLoaded = true;
      if (preferenceFile) {
        try {
          if ((await fs.stat(preferenceFile)).size <= 4096) preferences = DesktopPreferencesSchema.parse(JSON.parse(await fs.readFile(preferenceFile, "utf8")));
        } catch { /* A missing or obsolete preference file uses safe layout defaults. */ }
      }
    }
    return { preferences: { ...preferences }, platform: process.platform, version: "0.1.0" };
  }

  async function importImages(input: { paths?: string[] } = {}) {
    const params = ImportImagesParamsSchema.parse(input);
    const paths = params.paths ?? await dialogs.openImages();
    ImportImagesParamsSchema.parse({ paths });
    const decoded = [];
    let decodedBytes = 0;
    for (const filePath of paths) {
      const stat = await fs.stat(filePath);
      if (!stat.isFile() || stat.size > MAX_PNG_BYTES) throw new Error("Escolha um arquivo PNG com até 10 MiB.");
      const image = decodePng(await fs.readFile(filePath));
      decodedBytes += image.pixels.byteLength + image.png.byteLength;
      if (decodedBytes > assets.maxBytes) throw new Error("As imagens selecionadas excedem o limite de memória da sessão.");
      decoded.push({ name: path.basename(filePath), image });
    }
    return assets.registerMany(decoded);
  }

  async function openProject(input: { path?: string } = {}): Promise<ProjectPayload | null> {
    const params = z.object({ path: NativePathSchema.optional() }).strict().parse(input);
    const target = params.path ?? await dialogs.openProject();
    if (!target) return null;
    NativePathSchema.parse(target);
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size > MAX_PROJECT_BYTES) throw new Error("Escolha um projeto com até 20 MiB.");
    const project = loadProjectFromJson(await fs.readFile(target, "utf8"));
    // Geometry, decoded assets and references must all succeed before the open path changes.
    const state = prepareState(project);
    const descriptors = assets.registerMany(project.assets.flatMap((asset) => {
      const image = state.spriteAssets.get(asset.id);
      return image ? [{ id: asset.id, name: asset.name, image }] : [];
    }));
    currentProjectPath = path.resolve(target);
    return { project: { ...project, assets: project.assets.map((asset) => ({ ...asset, data: "" })) }, assets: descriptors, path: currentProjectPath };
  }

  async function chooseDirectory(_params: Record<string, never> = {}): Promise<string | null> {
    const target = await dialogs.chooseDirectory();
    if (!target) return null;
    NativePathSchema.parse(target);
    if (!(await fs.stat(target)).isDirectory()) throw new Error("Escolha uma pasta.");
    return target;
  }

  async function saveProject(input: SaveProjectParams): Promise<{ path: string }> {
    const params = SaveProjectParamsSchema.parse(input);
    const target = params.path ?? currentProjectPath;
    if (!target) throw new Error("Escolha uma pasta e um nome para salvar o projeto.");
    const project = hydrateProject(params.project);
    prepareState(project);
    const resolved = path.resolve(target);
    await writeAtomicFile(resolved, saveProjectToJson(project), params.overwrite === true || resolved === currentProjectPath);
    currentProjectPath = resolved;
    return { path: resolved };
  }

  async function exportArtwork(input: ExportArtworkParams): Promise<ExportArtworkResult> {
    const params = ExportArtworkParamsSchema.parse(input);
    const project = hydrateProject(params.project);
    const state = prepareState(project);
    if (!state.spriteAssets.size) throw new Error("Importe uma imagem antes de exportar.");
    if (params.pose && params.time === undefined) {
      state.currentPose = {
        joints: new Map(Object.entries(params.pose.joints)), layers: new Map(Object.entries(params.pose.layers)),
        pins: new Map(Object.entries(params.pose.pins)), params: new Map(Object.entries(params.pose.params)),
      };
    }
    let target = params.path;
    if (!target) {
      const directory = currentProjectPath ? path.dirname(currentProjectPath) : await chooseDirectory();
      if (!directory) throw new Error("Exportação cancelada.");
      target = path.join(directory, params.kind === "png" ? "chocobones-frame.png" : "chocobones-spritesheet.png");
    }
    const frameCount = params.kind === "png" ? 1 : params.frames ?? 8;
    const columns = Math.min(frameCount, params.columns ?? 4);
    const pixelCount = params.kind === "png" ? state.canvasWidth * state.canvasHeight : state.canvasWidth * state.canvasHeight * columns * Math.ceil(frameCount / columns);
    if (pixelCount > 16_777_216) throw new Error("A exportação excede o limite de 16 milhões de pixels. Reduza o canvas ou a quantidade de quadros.");
    let width: number, height: number, pixels: Uint8ClampedArray;
    if (params.kind === "png") {
      const frame = renderArtwork(state, params.time);
      ({ width, height, pixels } = frame);
    } else {
      const frames = [];
      for (let index = 0; index < frameCount; index++) {
        const divisor = state.activeClip.loop ? frameCount : Math.max(1, frameCount - 1);
        frames.push(renderArtwork(state, index / divisor * state.activeClip.duration).pixels);
      }
      ({ width, height, pixels } = composeSpritesheet(frames, state.canvasWidth, state.canvasHeight, columns));
    }
    const resolved = path.resolve(target);
    await writeAtomicFile(resolved, await encodeRgbaToPngAsync(width, height, pixels), params.overwrite === true || exportedPaths.has(resolved));
    exportedPaths.add(resolved);
    return { path: resolved, width, height, frames: frameCount };
  }

  async function savePreferences(input: { preferences: DesktopPreferences }): Promise<DesktopPreferences> {
    const parsed = DesktopPreferencesSchema.parse(input.preferences);
    if (preferenceFile && configDir) {
      await fs.mkdir(configDir, { recursive: true });
      await writeAtomicFile(preferenceFile, JSON.stringify(parsed, null, 2), true);
    }
    preferences = parsed;
    preferencesLoaded = true;
    return { ...preferences };
  }

  return { bootstrap, importImages, openProject, chooseDirectory, saveProject, exportArtwork, savePreferences };
}
