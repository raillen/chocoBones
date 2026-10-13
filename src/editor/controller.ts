/** Shared editor controller for Solid/Electrobun. No filesystem or desktop runtime imports. */
import { type SpriteImage } from "../assets/image";
import { createInitialAppState, type AppState, type InitialAppOptions } from "../ui/store";
import { type Project } from "../project/project";
import { type Vec2, type Mat2x3 } from "../core/types";
import { matApply, matInverse } from "../core/math";
import { LAYER_DELTA_IDENTITY, type LayerDelta } from "../rig/joint";
import { boneMatrices, layerMatrix } from "../rig/fk";
import { EditorMode, restoreBindPose } from "../ui/modes";
import { importDecodedSprite, fitCanvas, rebuildSpriteMesh, autoSpritePins, setSpriteDeformation, syncSpriteBuildSettings } from "../ui/actions/sprite_document";
import { nearestOpaquePoint } from "../mesh/sprite_mesh";
import { movePinRest } from "../mesh/mesh";
import { addPin, deletePin, resetPin, setPinEnabled } from "../ui/actions/pin_actions";
import { addLayer, removeLayer, moveLayer } from "../ui/actions/layer_actions";
import { addJoint, removeJoint, applyRigPreset } from "../ui/actions/rig_actions";
import { seekTimeline, togglePlay } from "../ui/actions/animation_actions";
import { selectionSelectLayerRange } from "../ui/selection";
import { pinLocalPoint, pickScenePin } from "../ui/viewport/pin_space";
import { pickJoint, applyJointDrag } from "../ui/viewport/controller";
import { createPinMotionClip, upsertPinKeyframe } from "../animation/pin_motion";
import { createClip, createKeyframe, sortClipFrames } from "../animation/timeline";
import { renderFrame, tickAnimation } from "./rendering";
import { renderArtwork } from "../render/sprite_scene";
import { deformSpriteMesh } from "../render/deformed_sprite";
import { computeGridUvs } from "../mesh/mesh";
import { editorStateToProject, prepareEditorProject, applyPreparedEditorProject } from "./project_document";
import { type EditorCommand, type EditorPhase } from "./commands";
export type { EditorCommand, EditorPhase, EditorTool } from "./commands";

/** Flattened geometry supplied by the worker for the pose actually displayed on stage. */
export interface EditorPickGeometry {
  vertices: ArrayLike<number>;
  triangles: ArrayLike<number>;
  uvs: ArrayLike<number>;
  matrix?: Mat2x3;
}
export interface EditorTrack {
  id: string;
  kind: "pin" | "joint" | "layer";
  name: string;
  keys: { id: string; time: number }[];
}
export interface EditorViewModel {
  revision: number;
  documentRevision: number;
  state: AppState;
  phase: EditorPhase;
  selectedLayer: AppState["layers"][number] | undefined;
  selectedPin: AppState["pins"][number] | undefined;
  selectedJoint: AppState["joints"][number] | undefined;
  selectedMesh: AppState["meshes"][number] | undefined;
  hasSprite: boolean;
  canUndo: boolean;
  canRedo: boolean;
  status: string;
  recording: boolean;
  tracks: EditorTrack[];
}
export interface EditorOptions extends InitialAppOptions {
  state?: AppState;
  /** Monotonic clock injected for deterministic gesture tests. */
  now?: () => number;
}
const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));
const finite = (n: number, label = "Valor"): number => {
  if (!Number.isFinite(n)) throw new Error(`${label} precisa ser um número finito.`);
  return n;
};

export class EditorController {
  readonly state: AppState;
  private listeners = new Set<() => void>();
  private revision = 0;
  private documentRevision = 0;
  private phase: EditorPhase = "prepare";
  private status = "Importe uma imagem ou abra um projeto para começar.";
  private tracks: EditorTrack[] = [];
  private tracksDirty = true;
  private gestureArmed = false;
  private gestureStartedAt: number | null = null;
  private layerDrag: { id: string; start: Vec2; pos: Vec2 } | null = null;
  private now: () => number;
  private pickGeometryProvider?: (layerId: string) => EditorPickGeometry | undefined;

  constructor(options: EditorOptions = {}) {
    this.state = options.state ?? createInitialAppState(undefined, { ...options, emptyDocument: options.emptyDocument ?? true });
    this.now = options.now ?? (() => performance.now());
    if (!options.state && this.state.layers.length === 0) {
      this.state.activeClip = createClip("animation", "Animação", 2, 60, true);
      this.state.activeClipName = "Animação";
      this.state.timelineDuration = 2;
    }
    this.phase = this.state.editorMode === EditorMode.Animate ? "animate" : "prepare";
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** The browser stage installs this provider so hit-testing never invokes ARAP on the UI thread. */
  setPickGeometryProvider(provider: (layerId: string) => EditorPickGeometry | undefined): () => void {
    this.pickGeometryProvider = provider;
    return () => { if (this.pickGeometryProvider === provider) this.pickGeometryProvider = undefined; };
  }

  getViewModel(): EditorViewModel {
    const state = this.state;
    if (this.tracksDirty) {
      const tracks: EditorTrack[] = [];
      const add = (kind: EditorTrack["kind"], id: string, name: string): void => {
        const keys = state.activeClip.frames.filter((f) => {
          const map = kind === "pin" ? f.pins : kind === "joint" ? f.joints : f.layers;
          return map.has(id) && (f.channels.length === 0 || f.channels.includes(id) || f.channels.includes(`${kind}:${id}`));
        }).map((f) => ({ id: f.id, time: f.time }));
        tracks.push({ id, kind, name, keys });
      };
      for (const layer of state.layers) add("layer", layer.id, layer.name);
      for (const joint of state.joints) add("joint", joint.id, joint.name);
      for (const pin of state.pins) add("pin", pin.id, pin.name);
      this.tracks = tracks;
      this.tracksDirty = false;
    }
    const meshId = state.meshLayer.get(state.selectedLayerId);
    return {
      revision: this.revision, documentRevision: this.documentRevision, state, phase: this.phase, status: this.status,
      recording: this.gestureArmed || this.gestureStartedAt !== null,
      selectedLayer: state.layers.find((l) => l.id === state.selectedLayerId),
      selectedPin: state.pins.find((p) => p.id === state.selectedPinId),
      selectedJoint: state.joints.find((j) => j.id === state.selectedJointId),
      selectedMesh: meshId === undefined ? undefined : state.meshes[Number(meshId)],
      hasSprite: state.spriteAssets.size > 0,
      canUndo: state.history.canUndo(), canRedo: state.history.canRedo(), tracks: this.tracks,
    };
  }

  private notify(documentChanged = false): void {
    this.revision++;
    if (documentChanged) { this.tracksDirty = true; this.documentRevision++; }
    for (const listener of this.listeners) listener();
  }

  private checkpoint(label: string): void {
    const s = this.state;
    s.history.push(label, s.joints, s.layers, s.currentPose, s.pins);
  }

  /** File decoding and checksum validation happen in the desktop host. */
  importDecoded(image: SpriteImage, name: string): void {
    importDecodedSprite(this.state, image, name);
    this.phase = "prepare"; restoreBindPose(this.state.currentPose);
    this.state.selectedJointId = ""; this.state.selection.selectedJointIds = [];
    this.status = `Imagem importada: ${name}. Prepare a malha e avance para Rig.`;
    this.notify(true);
  }

  loadProject(project: Project, decodedAssets: ReadonlyMap<string, SpriteImage>): void {
    // Validate the whole incoming document before altering history or the open scene.
    const prepared = prepareEditorProject(project, decodedAssets);
    // The desktop path belongs to this new document; undo must not restore a
    // previous document's contents under its filename.
    this.state.history.clear();
    applyPreparedEditorProject(this.state, prepared);
    const hasPose = prepared.pose.pins.size > 0 || prepared.pose.joints.size > 0 || prepared.pose.layers.size > 0;
    this.phase = hasPose ? "animate" : "rig";
    this.state.editorMode = hasPose ? EditorMode.Animate : EditorMode.Setup;
    this.gestureArmed = false; this.gestureStartedAt = null;
    fitCanvas(this.state);
    this.status = "Projeto aberto. Imagens, malhas, pinos e animação restaurados.";
    this.notify(true);
  }

  toProject(): Project { return editorStateToProject(this.state); }
  render(): AppState["viewportBuffer"] { renderFrame(this.state); return this.state.viewportBuffer; }
  artwork(time?: number): AppState["viewportBuffer"] { return renderArtwork(this.state, time); }

  resize(width: number, height: number): void {
    width = clamp(Math.round(finite(width)), 1, 4096);
    height = clamp(Math.round(finite(height)), 1, 4096);
    const buf = this.state.viewportBuffer;
    if (width === buf.width && height === buf.height) return;
    // Preserve the world position under the viewport center when panels change size.
    this.state.cameraPan.x += (width - buf.width) / 2;
    this.state.cameraPan.y += (height - buf.height) / 2;
    buf.resize(width, height);
    this.notify();
  }

  tick(deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    if (!this.state.isPlaying) return;
    tickAnimation(this.state, Math.min(deltaSeconds, 0.25));
    this.notify();
  }

  zoom(factor: number, anchor?: Vec2): void {
    const s = this.state;
    factor = finite(factor);
    if (factor <= 0) throw new Error("O fator de zoom precisa ser positivo.");
    if (s.viewportMode === "3D") {
      s.orbitCamera.distance = clamp(s.orbitCamera.distance / factor, 0.25, 50);
      this.notify();
      return;
    }
    const point = anchor ?? [s.viewportBuffer.width / 2, s.viewportBuffer.height / 2];
    const world = s.viewportBuffer.screenToWorld(point[0], point[1], s.cameraPan.x, s.cameraPan.y, s.cameraZoom);
    s.cameraZoom = clamp(s.cameraZoom * factor, 0.05, 5);
    s.cameraPan = { x: point[0] - world[0] * s.cameraZoom, y: point[1] - world[1] * s.cameraZoom };
    this.notify();
  }

  dispatch(command: EditorCommand): void {
    const s = this.state;
    try {
      switch (command.type) {
        case "phase":
          this.phase = command.value;
          s.isPlaying = false;
          s.editorMode = command.value === "animate" ? EditorMode.Animate : EditorMode.Setup;
          if (s.editorMode === EditorMode.Setup) restoreBindPose(s.currentPose);
          else seekTimeline(s, s.timelineTime);
          this.gestureArmed = false; this.gestureStartedAt = null;
          this.status = command.value === "prepare" ? "Prepare imagens, camadas e malhas." : command.value === "rig" ? "Adicione pinos ou ossos e ajuste o rig em repouso." : "Edite poses, grave gestos e ajuste os keyframes.";
          break;
        case "tool": s.activeTool = command.value; break;
        case "theme": s.themeMode = command.value; break;
        case "viewport": s.viewportMode = command.value; break;
        case "new": case "demo": {
          const fresh = createInitialAppState(s.paths, { emptyDocument: command.type === "new" });
          if (command.type === "new") {
            fresh.activeClip = createClip("animation", "Animação", 2, 60, true);
          }
          const prepared = prepareEditorProject(editorStateToProject(fresh), new Map());
          if (command.type === "new") s.history.clear();
          else this.checkpoint("Carregar demonstração");
          applyPreparedEditorProject(s, prepared);
          if (command.type === "demo" && command.preset) applyRigPreset(s, command.preset);
          this.phase = command.type === "new" ? "prepare" : "rig";
          s.editorMode = EditorMode.Setup; restoreBindPose(s.currentPose);
          this.gestureArmed = false; this.gestureStartedAt = null;
          this.status = command.type === "new" ? "Novo projeto. Importe imagens para começar." : "Demonstração do rig carregada.";
          fitCanvas(s); break;
        }
        case "undo": case "redo": {
          const label = s.history[command.type](s.joints, s.layers, s.currentPose, s.pins);
          if (!label) { this.notify(); return; }
          if (label) {
            syncSpriteBuildSettings(s);
            this.phase = s.layers.length === 0 && s.joints.length === 0 ? "prepare" : s.editorMode === EditorMode.Animate ? "animate" : "rig";
            s.isPlaying = false; this.status = `${command.type === "undo" ? "Desfeito" : "Refeito"}: ${label}`;
          }
          break;
        }
        case "fit": fitCanvas(s); break;
        case "zoom": this.zoom(command.factor, command.anchor); return;
        case "play":
          this.phase = "animate"; s.editorMode = EditorMode.Animate;
          togglePlay(s); break;
        case "stop": s.isPlaying = false; seekTimeline(s, 0); break;
        case "seek":
          s.isPlaying = false; this.phase = "animate"; s.editorMode = EditorMode.Animate;
          seekTimeline(s, finite(command.time)); break;
        case "reset-pose":
          this.checkpoint("Restaurar pose"); s.isPlaying = false; restoreBindPose(s.currentPose);
          this.status = "Pose restaurada ao repouso."; break;
        case "select-layer":
          if (!s.layers.some((l) => l.id === command.id)) break;
          s.selectedLayerId = command.id; s.selectedPinId = ""; s.selectedJointId = ""; s.selection.selectedJointIds = [];
          selectionSelectLayerRange(s.layers, s.selection, command.id, command.extend ?? false);
          syncSpriteBuildSettings(s); break;
        case "select-pin": {
          if (!s.pins.some((p) => p.id === command.id)) break;
          s.selectedPinId = command.id; s.selectedJointId = ""; s.selection.selectedJointIds = [];
          const pin = s.pins.find((p) => p.id === command.id)!;
          const layer = s.layers.find((l) => s.meshLayer.get(l.id) === pin.meshId);
          if (layer) { s.selectedLayerId = layer.id; s.selection.selectedLayerIds = [layer.id]; syncSpriteBuildSettings(s); }
          break;
        }
        case "select-joint":
          if (s.joints.some((j) => j.id === command.id)) { s.selectedJointId = command.id; s.selection.selectedJointIds = [command.id]; s.selectedPinId = ""; s.selectedLayerId = ""; s.selection.selectedLayerIds = []; }
          break;
        case "deformation": setSpriteDeformation(s, command.value); this.status = `Deformação ${command.value} aplicada.`; break;
        case "canvas-settings": {
          const width = command.width === undefined ? s.canvasWidth : clamp(Math.round(finite(command.width)), 1, 4096);
          const height = command.height === undefined ? s.canvasHeight : clamp(Math.round(finite(command.height)), 1, 4096);
          if (width * height > 16_777_216) throw new Error("O canvas excede 16 milhões de pixels.");
          this.checkpoint("Alterar tamanho do canvas"); s.canvasWidth = width; s.canvasHeight = height; fitCanvas(s); break;
        }
        case "mesh-settings": {
          // Build options are staged until rebuild; selecting another mesh restores its saved options.
          if (command.rows !== undefined) s.meshRows = clamp(Math.round(finite(command.rows)), 4, 48);
          if (command.cols !== undefined) s.meshCols = clamp(Math.round(finite(command.cols)), 4, 48);
          if (command.alphaThreshold !== undefined) s.alphaThreshold = clamp(Math.round(finite(command.alphaThreshold)), 1, 255);
          if (command.refineEdges !== undefined) s.refineEdges = command.refineEdges;
          if (command.edgeSize !== undefined) s.edgeSize = clamp(Math.round(finite(command.edgeSize)), 2, 32);
          if (command.strength !== undefined) {
            const mesh = this.getViewModel().selectedMesh;
            if (mesh) { this.checkpoint("Ajustar deformação da malha"); mesh.strength = clamp(finite(command.strength), 0, 1); }
          }
          break;
        }
        case "rebuild-mesh": rebuildSpriteMesh(s); this.status = "Malha reconstruída. Pinos e animação preservados."; break;
        case "auto-pins": autoSpritePins(s); restoreBindPose(s.currentPose); this.phase = "rig"; s.editorMode = EditorMode.Setup; this.status = "Pinos sugeridos. Ajuste as posições e as âncoras."; break;
        case "overlay": {
          const field = { mesh: "showMesh", skeleton: "showSkeleton", onion: "onionSkin", snap: "snapPins", ik: "ikEnabled" } as const;
          const key = field[command.name]; s[key] = command.value ?? !s[key]; break;
        }
        case "motion-settings":
          if (command.amplitude !== undefined) s.motionAmplitude = clamp(finite(command.amplitude), 0, 1000);
          if (command.frequency !== undefined) s.motionFrequency = clamp(finite(command.frequency), 0.1, 6);
          break;
        case "motion-preset": {
          const pins = s.pins.filter((p) => {
            const owner = s.layers.find((l) => s.meshLayer.get(l.id) === p.meshId);
            return owner && s.spriteAssets.has(owner.asset);
          });
          if (pins.filter((p) => !p.locked && p.enabled !== false).length === 0) throw new Error("Adicione ao menos um pino livre para gerar movimento.");
          const clip = createPinMotionClip(pins, { preset: command.value, amplitude: s.motionAmplitude, frequency: s.motionFrequency, duration: s.timelineDuration, fps: s.activeClip.fps });
          this.checkpoint("Aplicar movimento"); s.activeClip = clip; s.activeClipName = clip.name;
          s.timelineDuration = clip.duration; s.motionPreset = command.value; s.editorMode = EditorMode.Animate;
          this.phase = "animate"; s.isPlaying = false; seekTimeline(s, 0);
          this.status = `${clip.name} aplicada em keyframes editáveis.`; break;
        }
        case "clip-settings": this.setClipSettings(command); break;
        case "key-pose": this.checkpoint("Inserir keyframe"); this.keyCurrentPose(); this.status = "Pose gravada no quadro atual."; break;
        case "key-delete":
          if (s.activeClip.frames.some((f) => f.id === command.id)) {
            this.checkpoint("Remover keyframe"); s.activeClip.frames = s.activeClip.frames.filter((f) => f.id !== command.id); seekTimeline(s, s.timelineTime);
          }
          break;
        case "key-move": {
          const frame = s.activeClip.frames.find((f) => f.id === command.id);
          if (frame) {
            const time = clamp(Math.round(finite(command.time) * s.activeClip.fps) / s.activeClip.fps, 0, s.timelineDuration);
            if (s.activeClip.frames.some((f) => f.id !== frame.id && Math.abs(f.time - time) < 1e-8)) throw new Error("Já existe um keyframe nesse quadro.");
            this.checkpoint("Mover keyframe"); frame.time = time; sortClipFrames(s.activeClip); seekTimeline(s, time);
          }
          break;
        }
        case "key-easing": {
          const frame = s.activeClip.frames.find((f) => f.id === command.id);
          if (frame) { this.checkpoint("Alterar interpolação"); frame.easing = command.value; seekTimeline(s, s.timelineTime); }
          break;
        }
        case "record-gesture":
          if (s.pins.filter((p) => !p.locked && p.enabled !== false).length === 0) throw new Error("Adicione um pino livre antes de gravar um gesto.");
          this.gestureArmed = !this.gestureArmed; this.gestureStartedAt = null;
          this.phase = "animate"; s.editorMode = EditorMode.Animate; s.isPlaying = false;
          this.status = this.gestureArmed ? "Arraste um pino livre no palco para gravar o gesto." : "Gravação cancelada."; break;
        case "pin-add": this.addLocalPin(finite(command.x), finite(command.y), command.name); break;
        case "pin-delete": this.removePin(command.id ?? s.selectedPinId); break;
        case "pin-lock": {
          const pin = s.pins.find((p) => p.id === (command.id ?? s.selectedPinId));
          if (pin) { this.checkpoint("Alterar âncora do pino"); pin.locked = !pin.locked; } break;
        }
        case "pin-reset": this.checkpoint("Restaurar pino"); resetPin(s, command.id ?? s.selectedPinId); break;
        case "pin-properties": this.setPinProperties(command); break;
        case "layer-add": {
          const layer = addLayer(s); if (!s.joints.some((j) => j.id === layer.joint)) layer.joint = "";
          s.selectedJointId = ""; s.selection.selectedJointIds = []; s.selectedPinId = ""; break;
        }
        case "layer-delete": removeLayer(s, command.id ?? s.selectedLayerId); break;
        case "layer-order": moveLayer(s, command.id ?? s.selectedLayerId, command.direction); break;
        case "layer-properties": this.setLayerProperties(command); break;
        case "joint-add": this.addEditorJoint(command.name); s.showSkeleton = true; break;
        case "joint-delete": removeJoint(s, command.id ?? s.selectedJointId); break;
        case "rig-preset": applyRigPreset(s, command.value); s.showSkeleton = true; break;
        case "joint-properties": this.setJointProperties(command); break;
        case "delete-selection":
          if (s.selectedPinId) this.removePin(s.selectedPinId);
          else if (s.selectedLayerId) removeLayer(s, s.selectedLayerId);
          else if (s.selectedJointId) removeJoint(s, s.selectedJointId);
          break;
      }
      const transientCommands = new Set([
        "phase", "tool", "theme", "viewport", "fit", "play", "stop", "seek",
        "select-layer", "select-pin", "select-joint", "overlay", "motion-settings", "record-gesture",
      ]);
      this.notify(!transientCommands.has(command.type) && (command.type !== "mesh-settings" || command.strength !== undefined));
    } catch (error) {
      this.status = error instanceof Error ? error.message : String(error);
      this.notify();
      throw error;
    }
  }

  private keyCurrentPose(): void {
    const s = this.state;
    s.timelineTime = clamp(Math.round(s.timelineTime * s.activeClip.fps) / s.activeClip.fps, 0, s.timelineDuration);
    const existing = s.activeClip.frames.find((f) => Math.abs(f.time - s.timelineTime) < 1e-8);
    const frame = existing ?? createKeyframe(s.timelineTime);
    frame.joints = structuredClone(s.currentPose.joints);
    frame.layers = structuredClone(s.currentPose.layers);
    frame.pins = structuredClone(s.currentPose.pins);
    frame.params = new Map(s.currentPose.params);
    frame.channels = [];
    if (!existing) s.activeClip.frames.push(frame);
    sortClipFrames(s.activeClip);
  }

  private setClipSettings(c: Extract<EditorCommand, { type: "clip-settings" }>): void {
    const s = this.state;
    const duration = c.duration === undefined ? s.activeClip.duration : clamp(finite(c.duration), 1 / s.activeClip.fps, 60);
    if (s.activeClip.frames.some((f) => f.time > duration + 1e-8)) throw new Error("A duração não pode cortar keyframes existentes; mova ou remova os quadros finais.");
    const fps = c.fps === undefined ? s.activeClip.fps : clamp(Math.round(finite(c.fps)), 1, 120);
    this.checkpoint("Ajustar clipe");
    s.activeClip.duration = duration; s.timelineDuration = duration; s.activeClip.fps = fps;
    if (c.loop !== undefined) s.activeClip.loop = c.loop;
    if (c.name !== undefined) s.activeClip.name = c.name.trim() || "Animação";
    s.activeClipName = s.activeClip.name;
    seekTimeline(s, Math.min(s.timelineTime, duration));
  }

  private addLocalPin(x: number, y: number, name?: string): void {
    const s = this.state;
    if (s.editorMode !== EditorMode.Setup) throw new Error("Entre em Rig para adicionar pinos ao repouso.");
    const layer = s.layers.find((l) => l.id === s.selectedLayerId);
    const image = layer && s.spriteAssets.get(layer.asset);
    const meshId = layer && s.meshLayer.get(layer.id);
    if (!layer || !image || meshId === undefined) throw new Error("Selecione uma camada PNG.");
    if (layer.locked || !layer.visible) throw new Error("Desbloqueie e mostre a camada para editar seu rig.");
    const point = s.snapPins ? nearestOpaquePoint(image, x, y, s.alphaThreshold) : [x, y] as Vec2;
    if (!point || point[0] < 0 || point[1] < 0 || point[0] >= image.width || point[1] >= image.height) throw new Error("Posicione o pino dentro da imagem.");
    const pin = addPin(s, meshId, point[0], point[1], name);
    s.selectedPinId = pin.id;
  }

  private removePin(id: string): void {
    const s = this.state;
    if (!deletePin(s, id)) return;
    for (const frame of s.activeClip.frames) { frame.pins.delete(id); frame.channels = frame.channels.filter((ch) => ch !== `pin:${id}` && ch !== id); }
    if (s.selectedPinId === id) s.selectedPinId = "";
  }

  private setPinProperties(c: Extract<EditorCommand, { type: "pin-properties" }>): void {
    const s = this.state;
    const pin = s.pins.find((p) => p.id === (c.id ?? s.selectedPinId));
    if (!pin) return;
    for (const value of [c.x, c.y, c.radius, c.falloff, c.strength]) if (value !== undefined) finite(value);
    this.checkpoint("Ajustar pino");
    if (c.enabled !== undefined && !setPinEnabled(s, pin.id, c.enabled)) throw new Error("Reduza a densidade da malha para habilitar mais pinos ARAP.");
    if (c.name !== undefined) pin.name = c.name.trim() || pin.id;
    if (c.locked !== undefined) pin.locked = c.locked;
    if (c.radius !== undefined) pin.radius = Math.max(0, c.radius);
    if (c.falloff !== undefined) pin.falloff = clamp(c.falloff, 0.1, 16);
    if (c.strength !== undefined) pin.strength = clamp(c.strength, 0, 1);
    if (c.x !== undefined || c.y !== undefined) {
      if (s.editorMode === EditorMode.Setup) { pin.x = c.x ?? pin.x; pin.y = c.y ?? pin.y; }
      else {
        const old = s.currentPose.pins.get(pin.id) ?? [0, 0];
        s.currentPose.pins.set(pin.id, [(c.x ?? pin.x + old[0]) - pin.x, (c.y ?? pin.y + old[1]) - pin.y]);
      }
    }
  }

  private setLayerProperties(c: Extract<EditorCommand, { type: "layer-properties" }>): void {
    const s = this.state;
    const layer = s.layers.find((l) => l.id === (c.id ?? s.selectedLayerId));
    if (!layer) return;
    for (const value of [c.x, c.y, c.rotation, c.sx, c.sy, c.px, c.py, c.opacity]) if (value !== undefined) finite(value);
    this.checkpoint("Ajustar camada");
    if (c.name !== undefined) layer.name = c.name.trim() || layer.id;
    if (c.locked !== undefined) layer.locked = c.locked;
    if (c.joint !== undefined) {
      if (c.joint && !s.joints.some((j) => j.id === c.joint)) throw new Error("O osso selecionado não existe.");
      layer.joint = c.joint;
    }
    if (c.px !== undefined) layer.transform.pivot[0] = c.px;
    if (c.py !== undefined) layer.transform.pivot[1] = c.py;
    if (s.editorMode === EditorMode.Setup) {
      if (c.visible !== undefined) layer.visible = c.visible;
      if (c.opacity !== undefined) layer.opacity = clamp(c.opacity, 0, 1);
      if (c.x !== undefined) layer.transform.pos[0] = c.x;
      if (c.y !== undefined) layer.transform.pos[1] = c.y;
      if (c.rotation !== undefined) layer.transform.rotation = c.rotation;
      if (c.sx !== undefined) layer.transform.scale[0] = c.sx;
      if (c.sy !== undefined) layer.transform.scale[1] = c.sy;
    } else {
      const delta: LayerDelta = { ...LAYER_DELTA_IDENTITY, ...s.currentPose.layers.get(layer.id) };
      if (c.x !== undefined) delta.x = c.x;
      if (c.y !== undefined) delta.y = c.y;
      if (c.rotation !== undefined) delta.rotation = c.rotation;
      if (c.sx !== undefined) delta.sx = c.sx;
      if (c.sy !== undefined) delta.sy = c.sy;
      if (c.visible !== undefined) delta.visible = c.visible;
      if (c.opacity !== undefined) delta.opacity = clamp(c.opacity, 0, 1);
      s.currentPose.layers.set(layer.id, delta);
    }
  }

  private addEditorJoint(name?: string): void {
    const s = this.state;
    if (s.joints.length === 0) {
      this.checkpoint("Adicionar osso raiz");
      const root = { id: "root", name: name ?? "Raiz", parent: "", x: s.canvasWidth / 2, y: s.canvasHeight / 2, color: "#10b981" };
      s.joints.push(root); s.selectedJointId = root.id; s.selection.selectedJointIds = [root.id];
    } else addJoint(s, name);
    s.showSkeleton = true; s.selectedPinId = ""; s.selectedLayerId = ""; s.selection.selectedLayerIds = [];
    s.selection.selectedJointIds = [s.selectedJointId];
  }

  private setJointProperties(c: Extract<EditorCommand, { type: "joint-properties" }>): void {
    const s = this.state;
    const joint = s.joints.find((j) => j.id === (c.id ?? s.selectedJointId));
    if (!joint) return;
    for (const value of [c.x, c.y, c.angle]) if (value !== undefined) finite(value);
    if (c.parent !== undefined && c.parent !== "") {
      let ancestor = s.joints.find((j) => j.id === c.parent);
      if (!ancestor) throw new Error("O osso pai não existe.");
      const seen = new Set<string>();
      while (ancestor) {
        if (ancestor.id === joint.id || seen.has(ancestor.id)) throw new Error("O vínculo criaria um ciclo no rig.");
        seen.add(ancestor.id); ancestor = s.joints.find((j) => j.id === ancestor!.parent);
      }
    }
    this.checkpoint("Ajustar osso");
    if (c.name !== undefined) joint.name = c.name.trim() || joint.id;
    if (c.parent !== undefined) joint.parent = c.parent;
    if (s.editorMode === EditorMode.Setup) {
      if (c.x !== undefined) joint.x = c.x;
      if (c.y !== undefined) joint.y = c.y;
    } else {
      const delta = { angle: 0, x: 0, y: 0, ...s.currentPose.joints.get(joint.id) };
      if (c.x !== undefined) delta.x = c.x;
      if (c.y !== undefined) delta.y = c.y;
      if (c.angle !== undefined) delta.angle = c.angle;
      s.currentPose.joints.set(joint.id, delta);
    }
  }

  pointerDown(x: number, y: number, options: { pan?: boolean; button?: number } = {}): void {
    const s = this.state;
    if (![x, y].every(Number.isFinite)) return;
    this.layerDrag = null;
    if (options.pan || options.button === 1 || s.activeTool === "Pan" || s.viewportMode === "3D") {
      s.viewportDrag.beginPan(x, y, s.cameraPan); return;
    }
    const world = s.viewportBuffer.screenToWorld(x, y, s.cameraPan.x, s.cameraPan.y, s.cameraZoom);
    const pinId = pickScenePin(s, world, 12 / s.cameraZoom);
    if (pinId) {
      this.dispatch({ type: "select-pin", id: pinId });
      const pin = s.pins.find((p) => p.id === pinId)!;
      if (pin.locked) { this.status = "Pino âncora. Desbloqueie para mover."; this.notify(); return; }
      if (!pinLocalPoint(s, pin, world)) return;
      s.isPlaying = false; this.checkpoint("Arrastar pino");
      s.viewportDrag.beginPin(x, y, pinId, s.cameraPan);
      if (this.gestureArmed) {
        this.gestureStartedAt = this.now();
        s.activeClip = createClip("gesture", "Gesto gravado", 4, s.activeClip.fps, false);
        s.activeClipName = s.activeClip.name; s.timelineDuration = 4; s.timelineTime = 0;
        upsertPinKeyframe(s.activeClip, s.currentPose, 0);
        this.status = "Gravando gesto…";
      }
      this.notify(true); return;
    }
    if (s.activeTool === "Pin" && s.editorMode === EditorMode.Setup) {
      const layer = s.layers.find((l) => l.id === s.selectedLayerId);
      if (layer) {
        const matrix = layerMatrix(layer, s.joints, s.currentPose, boneMatrices(s.joints, s.currentPose));
        if (Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) > 1e-10) {
          const local = matApply(matInverse(matrix), world);
          this.dispatch({ type: "pin-add", x: local[0], y: local[1] }); return;
        }
      }
    }
    if (s.activeTool === "Bone" && s.editorMode === EditorMode.Setup) {
      this.addEditorJoint();
      const joint = s.joints.find((j) => j.id === s.selectedJointId);
      if (joint) { joint.x = world[0]; joint.y = world[1]; }
      this.notify(true); return;
    }
    if (s.showSkeleton) {
      const jointId = pickJoint(s.joints, s.currentPose, world[0], world[1], 12 / s.cameraZoom);
      if (jointId) {
        this.dispatch({ type: "select-joint", id: jointId });
        s.isPlaying = false; this.checkpoint("Arrastar osso");
        s.viewportDrag.beginJoint(x, y, jointId, s.cameraPan); this.notify(); return;
      }
    }
    if (s.activeTool === "Move") {
      const layer = this.pickLayer(world);
      if (layer) {
        this.dispatch({ type: "select-layer", id: layer.id });
        if (!layer.locked) {
          s.isPlaying = false; this.checkpoint("Arrastar camada");
          const delta = s.currentPose.layers.get(layer.id);
          this.layerDrag = { id: layer.id, start: [x, y], pos: s.editorMode === EditorMode.Setup ? [...layer.transform.pos] : [delta?.x ?? 0, delta?.y ?? 0] };
        }
        return;
      }
    }
    s.viewportDrag.beginPan(x, y, s.cameraPan);
  }

  /** Hit-test actual deformed image triangles and interpolated alpha, front to back. */
  private pickLayer(world: Vec2): AppState["layers"][number] | undefined {
    const s = this.state;
    const bones = boneMatrices(s.joints, s.currentPose);
    for (const layer of [...s.layers].reverse()) {
      if (!layer.visible || s.currentPose.layers.get(layer.id)?.visible === false) continue;
      const image = s.spriteAssets.get(layer.asset);
      const id = s.meshLayer.get(layer.id); const mesh = id === undefined ? undefined : s.meshes[Number(id)];
      if (!image || !mesh) continue;
      let packet = this.pickGeometryProvider?.(layer.id);
      if (!packet && this.pickGeometryProvider) continue;
      if (!packet) {
        // Deterministic Node/offscreen tests may not have a worker-backed stage installed.
        const solved = deformSpriteMesh(mesh, s.meshUvs.get(id!) ?? computeGridUvs(mesh, image.width, image.height), s.pins.filter((p) => p.meshId === id), s.currentPose.pins);
        packet = { vertices: solved.vertices.flat(), triangles: solved.triangles.flat(), uvs: solved.uvs.flat() };
      }
      const matrix = packet.matrix ?? layerMatrix(layer, s.joints, s.currentPose, bones);
      if (Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-10) continue;
      const local = matApply(matInverse(matrix), world);
      const vertex = (index: number): Vec2 => [packet.vertices[index * 2]!, packet.vertices[index * 2 + 1]!];
      const uv = (index: number): Vec2 => [packet.uvs[index * 2]!, packet.uvs[index * 2 + 1]!];
      for (let triangle = 0; triangle + 2 < packet.triangles.length; triangle += 3) {
        const ia = packet.triangles[triangle]!, ib = packet.triangles[triangle + 1]!, ic = packet.triangles[triangle + 2]!;
        const a = vertex(ia), b = vertex(ib), c = vertex(ic);
        const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        if (Math.abs(det) < 1e-10) continue;
        const u = ((b[1] - c[1]) * (local[0] - c[0]) + (c[0] - b[0]) * (local[1] - c[1])) / det;
        const v = ((c[1] - a[1]) * (local[0] - c[0]) + (a[0] - c[0]) * (local[1] - c[1])) / det;
        const w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const uvA = uv(ia), uvB = uv(ib), uvC = uv(ic);
        const px = clamp(Math.floor((uvA[0] * u + uvB[0] * v + uvC[0] * w) * image.width), 0, image.width - 1);
        const py = clamp(Math.floor((uvA[1] * u + uvB[1] * v + uvC[1] * w) * image.height), 0, image.height - 1);
        if (image.pixels[(py * image.width + px) * 4 + 3]! > 0) return layer;
      }
    }
    return undefined;
  }

  pointerMove(x: number, y: number): void {
    const s = this.state; const drag = s.viewportDrag;
    if (![x, y].every(Number.isFinite)) return;
    if (this.layerDrag) {
      const layer = s.layers.find((l) => l.id === this.layerDrag!.id);
      if (!layer) return;
      const dx = (x - this.layerDrag.start[0]) / s.cameraZoom, dy = (y - this.layerDrag.start[1]) / s.cameraZoom;
      if (s.editorMode === EditorMode.Setup) layer.transform.pos = [this.layerDrag.pos[0] + dx, this.layerDrag.pos[1] + dy];
      else {
        const delta = { ...LAYER_DELTA_IDENTITY, ...s.currentPose.layers.get(layer.id) };
        delta.x = this.layerDrag.pos[0] + dx; delta.y = this.layerDrag.pos[1] + dy;
        s.currentPose.layers.set(layer.id, delta);
      }
      this.notify(true); return;
    }
    if (drag.mode === "none") return;
    if (drag.mode === "pan") {
      if (s.viewportMode === "3D") {
        s.orbitCamera.yaw += (x - drag.lastMouse[0]) * 0.01;
        s.orbitCamera.pitch = clamp(s.orbitCamera.pitch - (y - drag.lastMouse[1]) * 0.01, -1.4, 1.4);
      } else { s.cameraPan = { x: drag.startPan.x + x - drag.startMouse[0], y: drag.startPan.y + y - drag.startMouse[1] }; }
    } else {
      const world = s.viewportBuffer.screenToWorld(x, y, s.cameraPan.x, s.cameraPan.y, s.cameraZoom);
      if (drag.mode === "joint") {
        const scale = Math.max(0.2, s.cameraZoom) / s.cameraZoom;
        applyJointDrag(s.joints, s.currentPose, drag.jointId, (x - drag.lastMouse[0]) * scale, (y - drag.lastMouse[1]) * scale, s.cameraZoom, s.editorMode, s.ikEnabled, world);
      } else {
        const pin = s.pins.find((p) => p.id === drag.pinId);
        if (!pin) return;
        const local = pinLocalPoint(s, pin, world);
        if (!local) return;
        if (s.editorMode === EditorMode.Setup) {
          const layer = s.layers.find((l) => s.meshLayer.get(l.id) === pin.meshId);
          const image = layer && s.spriteAssets.get(layer.asset);
          const point = s.snapPins && image ? nearestOpaquePoint(image, local[0], local[1], s.alphaThreshold) : local;
          if (point) movePinRest(s.pins, pin.id, point[0], point[1]);
        } else {
          s.currentPose.pins.set(pin.id, [local[0] - pin.x, local[1] - pin.y]);
          if (this.gestureStartedAt !== null) {
            s.timelineTime = clamp((this.now() - this.gestureStartedAt) / 1000, 0, 4);
            upsertPinKeyframe(s.activeClip, s.currentPose, s.timelineTime);
          }
        }
      }
    }
    drag.lastMouse = [x, y]; this.notify(drag.mode !== "pan");
  }

  pointerUp(): void {
    const s = this.state;
    if (s.viewportDrag.mode === "pin" && s.editorMode === EditorMode.Animate) {
      s.timelineTime = clamp(Math.round(s.timelineTime * s.activeClip.fps) / s.activeClip.fps, 0, s.timelineDuration);
      if (this.gestureStartedAt !== null) s.timelineTime = Math.max(1 / s.activeClip.fps, s.timelineTime);
      upsertPinKeyframe(s.activeClip, s.currentPose, s.timelineTime);
    } else if ((this.layerDrag || s.viewportDrag.mode === "joint") && s.editorMode === EditorMode.Animate) {
      this.keyCurrentPose();
    }
    if (this.gestureStartedAt !== null) {
      s.activeClip.frames = s.activeClip.frames.filter((f) => f.time <= s.timelineTime);
      s.activeClip.duration = Math.max(1 / s.activeClip.fps, s.timelineTime); s.timelineDuration = s.activeClip.duration;
      this.gestureArmed = false; this.gestureStartedAt = null;
      this.status = "Gesto gravado. Reproduza e edite os keyframes na timeline.";
    }
    const changed = this.layerDrag !== null || s.viewportDrag.mode === "pin" || s.viewportDrag.mode === "joint";
    this.layerDrag = null; s.viewportDrag.end(); this.notify(changed);
  }

  dispose(): void { this.listeners.clear(); this.pickGeometryProvider = undefined; this.layerDrag = null; this.state.viewportDrag.end(); }
}

export function createEditorController(options: EditorOptions = {}): EditorController {
  return new EditorController(options);
}
