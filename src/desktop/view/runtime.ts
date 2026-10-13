import { createSignal, type Accessor } from "solid-js";
import { createEditorController, type EditorController } from "../../editor/controller";
import { validateSpriteImage, MAX_PNG_BYTES, type SpriteImage } from "../../assets/image";
import { loadProjectFromJson, saveProjectToJson } from "../../project/project";
import { renderArtwork } from "../../render/sprite_scene";
import type { DesktopAsset, DesktopPreferences, DesktopRPC, ProjectPayload } from "../shared";

export interface DesktopHost {
  importImages(): Promise<void>;
  openProject(): Promise<void>;
  saveProject(saveAs?: boolean): Promise<void>;
  exportPng(): Promise<void>;
  exportSpritesheet(): Promise<void>;
  newProject(): Promise<void>;
  documentName: Accessor<string>;
  busy: Accessor<boolean>;
  status: Accessor<string>;
}
export interface FileChoice { name: string; directory: string; frames: number; columns: number; overwrite: boolean; }
export interface FileDialogRequest {
  title: string; name: string; directory: string; extension: string;
  exporting: boolean; spritesheet: boolean; native: boolean;
  resolve(value: FileChoice | null): void;
}
export interface UnsavedDialogRequest { action: string; resolve(value: "save" | "discard" | "cancel"): void; }
export interface EditorRuntime {
  editor: EditorController; host: DesktopHost; native: boolean;
  fileDialog: Accessor<FileDialogRequest | null>;
  unsavedDialog: Accessor<UnsavedDialogRequest | null>;
  chooseDirectory(): Promise<string | null>;
  closeFileDialog(value: FileChoice | null): void;
  closeUnsavedDialog(value: "save" | "discard" | "cancel"): void;
  ready: Promise<void>;
  dispose(): void;
}
type BrowserRpc = ReturnType<typeof import("electrobun/view").Electroview.defineRPC<DesktopRPC>>;

async function fetchAsset(asset: DesktopAsset): Promise<SpriteImage> {
  const [rgbaResponse, pngResponse] = await Promise.all([fetch(asset.rgbaUrl), fetch(asset.pngUrl)]);
  if (!rgbaResponse.ok || !pngResponse.ok) throw new Error(`Não foi possível carregar ${asset.name}.`);
  const image = {
    width: asset.width, height: asset.height,
    pixels: new Uint8ClampedArray(await rgbaResponse.arrayBuffer()),
    png: new Uint8Array(await pngResponse.arrayBuffer()),
  };
  validateSpriteImage(image);
  return image;
}

/** The browser development adapter uses real files and downloads; native decoding lives in Bun. */
async function browserPng(bytes: Uint8Array): Promise<SpriteImage> {
  if (bytes.length > MAX_PNG_BYTES || bytes.length < 33) throw new Error("Escolha um PNG com até 10 MiB.");
  if (![137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value) || bytes[24] !== 8 || bytes[28] !== 0) {
    throw new Error("Use um PNG de 8 bits por canal, sem entrelaçamento.");
  }
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = header.getUint32(16), height = header.getUint32(20);
  if (width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 16_777_216) throw new Error("O PNG excede os limites de tamanho.");
  const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer], { type: "image/png" }));
  try {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D indisponível.");
    context.drawImage(bitmap, 0, 0);
    return { width, height, pixels: context.getImageData(0, 0, width, height).data, png: bytes.slice() };
  } finally { bitmap.close(); }
}
function chooseFiles(accept: string, multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = accept; input.multiple = multiple; input.hidden = true;
    const finish = (files: File[]) => { input.remove(); resolve(files); };
    input.addEventListener("change", () => finish(Array.from(input.files ?? [])), { once: true });
    input.addEventListener("cancel", () => finish([]), { once: true });
    document.body.append(input); input.click();
  });
}
function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const directoryName = (path: string) => path.replace(/[\\/][^\\/]*$/, "");

export function createRuntime(): EditorRuntime {
  const editor = createEditorController({ emptyDocument: true });
  const native = location.protocol === "views:" || "__electrobun" in window;
  const [busy, setBusy] = createSignal(false);
  const [status, setStatus] = createSignal("");
  const [name, setName] = createSignal("Sem título");
  const [fileDialog, setFileDialog] = createSignal<FileDialogRequest | null>(null);
  const [unsavedDialog, setUnsavedDialog] = createSignal<UnsavedDialogRequest | null>(null);
  let projectPath: string | null = null;
  let savedRevision = editor.getViewModel().documentRevision;
  let preferences: DesktopPreferences | null = null;
  let preferenceWrites = Promise.resolve();
  let previousTheme = editor.state.themeMode;
  let disposed = false;
  const [dirty, setDirty] = createSignal(false);
  const unsubscribe = editor.subscribe(() => {
    setDirty(editor.getViewModel().documentRevision !== savedRevision);
    if (!busy()) setStatus("");
    const theme = editor.state.themeMode;
    if (theme === previousTheme) return;
    previousTheme = theme;
    try { localStorage.setItem("chocobones.theme", theme); } catch { /* Storage may be unavailable in an ephemeral view. */ }
    if (preferences) {
      const next: DesktopPreferences = { ...preferences, theme: theme === "Light" ? "light" : theme === "Dim" ? "dim" : "dark" };
      preferences = next;
      // Preserve rapid theme choices in order, independently of document saves.
      preferenceWrites = preferenceWrites.then(async () => {
        const rpc = await rpcReady;
        if (rpc) await rpc.request.savePreferences({ preferences: next });
      }).catch((error) => { if (!disposed) setStatus(`Falha ao salvar preferências: ${String(error)}`); });
    }
  });
  const rpcReady: Promise<BrowserRpc | null> = native ? import("electrobun/view").then(({ Electroview }) => {
    const rpc = Electroview.defineRPC<DesktopRPC>({ maxRequestTime: 120_000, handlers: {
      requests: { confirmClose: () => confirmDiscard("fechar o aplicativo") }, messages: {},
    } });
    new Electroview({ rpc });
    return rpc;
  }) : Promise.resolve(null);
  const perform = async (action: (rpc: BrowserRpc | null) => Promise<void>) => {
    if (busy()) return;
    setBusy(true);
    try { await action(await rpcReady); }
    catch (error) { setStatus(error instanceof Error ? error.message : String(error)); throw error; }
    finally { setBusy(false); }
  };
  const askFile = (title: string, extension: string, exporting: boolean, spritesheet = false) => new Promise<FileChoice | null>((resolve) => {
    const stem = name().replace(/\.(?:puppet\.json|json|png)$/i, "");
    setFileDialog({ title, name: `${stem === "Sem título" ? "personagem" : stem}${spritesheet ? "-spritesheet" : ""}${extension}`,
      directory: projectPath ? directoryName(projectPath) : "", extension, exporting, spritesheet, native, resolve });
  });
  const filePath = (choice: FileChoice) => {
    if (!choice.name.trim() || /[\\/\0]/.test(choice.name) || choice.name === "." || choice.name === "..") throw new Error("Escolha um nome de arquivo sem separadores de caminho.");
    if (native && !choice.directory.trim()) throw new Error("Escolha a pasta de destino.");
    return `${choice.directory.replace(/[\\/]$/, "")}/${choice.name}`;
  };
  const loadPayload = async (payload: ProjectPayload) => {
    const images = await Promise.all(payload.assets.map(async (asset) => [asset.id, await fetchAsset(asset)] as const));
    editor.loadProject(payload.project, new Map(images));
    projectPath = payload.path; setName(payload.path ? baseName(payload.path) : payload.project.name);
    savedRevision = editor.getViewModel().documentRevision; setDirty(false);
  };
  const exportFile = async (kind: "png" | "spritesheet") => perform(async (rpc) => {
    const choice = await askFile(kind === "png" ? "Exportar PNG" : "Exportar spritesheet", ".png", true, kind === "spritesheet");
    if (!choice) return;
    if (rpc) {
      const result = await rpc.request.exportArtwork({ project: editor.toProject(), kind, path: filePath(choice),
        overwrite: choice.overwrite, frames: choice.frames, columns: choice.columns,
        pose: kind === "png" ? { joints: Object.fromEntries(editor.state.currentPose.joints), layers: Object.fromEntries(editor.state.currentPose.layers),
          pins: Object.fromEntries(editor.state.currentPose.pins), params: Object.fromEntries(editor.state.currentPose.params) } : undefined });
      setStatus(`Exportado: ${baseName(result.path)} · ${result.width} × ${result.height}`);
    } else {
      const state = editor.state;
      const frames = kind === "png" ? 1 : choice.frames, columns = kind === "png" ? 1 : Math.min(choice.columns, frames);
      const rows = Math.ceil(frames / columns), width = state.canvasWidth * columns, height = state.canvasHeight * rows;
      if (width * height > 16_777_216) throw new Error("A spritesheet excede 16 milhões de pixels; reduza a quantidade de quadros.");
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d"); if (!context) throw new Error("Canvas 2D indisponível.");
      for (let i = 0; i < frames; i++) {
        const time = kind === "png" ? undefined : state.activeClip.duration * i / (state.activeClip.loop ? frames : Math.max(1, frames - 1));
        const frame = renderArtwork(state, time);
        context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), (i % columns) * frame.width, Math.floor(i / columns) * frame.height);
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Falha ao codificar PNG.")), "image/png"));
      download(blob, choice.name); setStatus(`Exportado: ${choice.name} · ${width} × ${height}`);
    }
  });
  const confirmDiscard = async (action: string): Promise<boolean> => {
    if (busy() || unsavedDialog()) return false;
    if (!dirty()) return true;
    const decision = await new Promise<"save" | "discard" | "cancel">((resolve) => setUnsavedDialog({ action, resolve }));
    if (decision === "discard") return true;
    if (decision !== "save") return false;
    await host.saveProject();
    // A canceled save or an edit made while saving must keep the document open.
    return !dirty();
  };
  const host: DesktopHost = {
    busy, status, documentName: () => `${name()}${dirty() ? " •" : ""}`,
    importImages: () => perform(async (rpc) => {
      if (rpc) {
        const assets = await rpc.request.importImages({});
        const images = await Promise.all(assets.map(async (asset) => ({ name: asset.name, image: await fetchAsset(asset) })));
        for (const item of images) editor.importDecoded(item.image, item.name);
      } else {
        const files = await chooseFiles(".png,image/png", true);
        const images = await Promise.all(files.map(async (file) => ({ name: file.name, image: await browserPng(new Uint8Array(await file.arrayBuffer())) })));
        for (const item of images) editor.importDecoded(item.image, item.name);
      }
    }),
    openProject: async () => {
      if (!await confirmDiscard("abrir outro projeto")) return;
      await perform(async (rpc) => {
      if (rpc) { const payload = await rpc.request.openProject({}); if (payload) await loadPayload(payload); }
      else {
        const file = (await chooseFiles(".json,application/json"))[0]; if (!file) return;
        const project = loadProjectFromJson(await file.text()), assets = new Map<string, SpriteImage>();
        await Promise.all(project.assets.filter((asset) => asset.data).map(async (asset) => {
          const binary = atob(asset.data.replace(/^data:image\/png;base64,/i, ""));
          assets.set(asset.id, await browserPng(Uint8Array.from(binary, (char) => char.charCodeAt(0))));
        }));
        editor.loadProject(project, assets); projectPath = null; setName(file.name);
        savedRevision = editor.getViewModel().documentRevision; setDirty(false);
      }
      });
    },
    saveProject: (saveAs = false) => perform(async (rpc) => {
      let choice: FileChoice | null = null;
      if (!projectPath || saveAs || !rpc) choice = await askFile("Salvar projeto", ".puppet.json", false);
      if ((!projectPath || saveAs || !rpc) && !choice) return;
      const project = editor.toProject();
      const revision = editor.getViewModel().documentRevision;
      if (rpc) {
        const result = await rpc.request.saveProject({ project, path: choice ? filePath(choice) : projectPath!, overwrite: choice ? choice.overwrite : true });
        projectPath = result.path; setName(baseName(result.path));
      } else { download(new Blob([saveProjectToJson(project)], { type: "application/json" }), choice!.name); setName(choice!.name); }
      savedRevision = revision; setDirty(editor.getViewModel().documentRevision !== revision); setStatus("Projeto salvo com imagens e animação.");
    }),
    exportPng: () => exportFile("png"), exportSpritesheet: () => exportFile("spritesheet"),
    newProject: async () => {
      if (!await confirmDiscard("criar um novo projeto")) return;
      editor.dispatch({ type: "new" }); projectPath = null; setName("Sem título");
      savedRevision = editor.getViewModel().documentRevision; setDirty(false);
    },
  };
  const ready = rpcReady.then(async (rpc) => {
    if (rpc) {
      const bootstrap = await rpc.request.bootstrap({});
      const theme = bootstrap.preferences.theme;
      editor.dispatch({ type: "theme", value: theme === "light" ? "Light" : theme === "dim" ? "Dim" : theme === "dark" ? "Dark" : matchMedia("(prefers-color-scheme: light)").matches ? "Light" : "Dark" });
      preferences = bootstrap.preferences;
    } else {
      try {
        const theme = localStorage.getItem("chocobones.theme");
        if (theme === "Dark" || theme === "Dim" || theme === "Light") editor.dispatch({ type: "theme", value: theme });
      } catch { /* Use the default theme when browser storage is unavailable. */ }
    }
  }).catch((error) => { setStatus(`Falha na integração desktop: ${String(error)}`); });
  const runtime: EditorRuntime = {
    editor, host, native, ready, fileDialog, unsavedDialog,
    chooseDirectory: async () => (await rpcReady)?.request.chooseDirectory({}) ?? null,
    closeFileDialog: (choice) => { const request = fileDialog(); setFileDialog(null); request?.resolve(choice); },
    closeUnsavedDialog: (choice) => { const request = unsavedDialog(); setUnsavedDialog(null); request?.resolve(choice); },
    dispose: () => { disposed = true; unsubscribe(); editor.dispose(); fileDialog()?.resolve(null); unsavedDialog()?.resolve("cancel"); },
  };
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("qa")) Object.assign(window, { __CHOCOBONES_QA__: { editor, host, runtime, browserPng, rpcReady, fetchAsset } });
  return runtime;
}
