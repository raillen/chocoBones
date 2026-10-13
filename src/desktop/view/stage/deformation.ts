import { createPose } from "../../../rig/joint";
import { evaluateClipInto } from "../../../animation/evaluator";
import { boneMatrices, layerMatrix } from "../../../rig/fk";
import { computeGridUvs } from "../../../mesh/mesh";
import type { AppState } from "../../../ui/store";
import type { DeformationRequest, DeformationResult, SpriteDraw, StageFrame, WorkerMesh } from "./protocol";

interface PendingFrame {
  document: string;
  geometries: WorkerMesh[];
  draws: SpriteDraw[];
  poses: DeformationRequest["poses"];
}

export function prepareStageFrame(state: AppState, snapshots = new Map<string, WorkerMesh>()): PendingFrame {
  if (state.viewportMode === "3D") return { document: "3d", geometries: [], draws: [], poses: [] };
  const geometries = new Map<string, WorkerMesh>();
  const draws: SpriteDraw[] = [];
  const poses: DeformationRequest["poses"] = [];
  const current = state.currentPose;
  const ghost = state.onionSkin && !state.isPlaying && state.timelineTime > 0 ? createPose() : null;
  if (ghost) evaluateClipInto(state.activeClip, Math.max(0, state.timelineTime - 1 / state.activeClip.fps), ghost);
  for (const [pose, ghostFrame] of ghost ? [[ghost, true], [current, false]] as const : [[current, false]] as const) {
    const bones = boneMatrices(state.joints, pose);
    for (const layer of state.layers) {
      const delta = pose.layers.get(layer.id);
      if (!layer.visible || delta?.visible === false) continue;
      const asset = delta?.asset || layer.asset;
      const image = state.spriteAssets.get(asset);
      const meshId = state.meshLayer.get(layer.id);
      const mesh = meshId === undefined ? undefined : state.meshes[Number(meshId)];
      if (!image || !mesh || meshId === undefined) continue;
      if (!geometries.has(meshId)) {
        const stored = state.meshUvs.get(meshId);
        const base = state.spriteAssets.get(layer.asset) ?? image;
        const uvs = stored?.length === mesh.vertices.length ? stored : computeGridUvs(mesh, base.width, base.height);
        const pins = state.pins.filter((pin) => pin.meshId === meshId);
        const signature = JSON.stringify([mesh, uvs, pins]);
        let snapshot = snapshots.get(meshId);
        if (snapshot?.signature !== signature) {
          // A pending solve may wait while Setup edits mutate the original arrays. Snapshot once
          // per rest-geometry change so its signature and its transferred data always agree.
          const copy = structuredClone({ mesh, uvs, pins });
          snapshot = { id: meshId, signature, ...copy };
          snapshots.set(meshId, snapshot);
        }
        geometries.set(meshId, snapshot);
      }
      const key = `${layer.id}${ghostFrame ? ":ghost" : ""}`;
      draws.push({ key, layer: layer.id, asset, matrix: layerMatrix(layer, state.joints, pose, bones),
        opacity: Math.max(0, Math.min(1, layer.opacity * (delta?.opacity ?? 1))) * (ghostFrame ? 0.2 : 1), ghost: ghostFrame });
      poses.push({ key, mesh: meshId, pins: [...pose.pins] });
    }
  }
  // Geometry changes invalidate old results. Advancing animation/camera does not: accepting the
  // last completed pose avoids starvation when ARAP takes longer than one display refresh.
  const document = JSON.stringify([...geometries.values()].map((g) => [g.id, g.signature]));
  return { document, geometries: [...geometries.values()], draws, poses };
}

/** At most one solve in flight and one replaceable pending pose; playback never builds a queue. */
export class DeformationQueue {
  private worker!: Worker;
  private pending: PendingFrame | null = null;
  private inFlight: { id: number; frame: PendingFrame } | null = null;
  private sent = new Map<string, string>();
  private snapshots = new Map<string, WorkerMesh>();
  private sequence = 0;
  private document = "";
  private requestedKey = "";
  private disposed = false;
  private failures = 0;
  private terminalFailure = false;

  constructor(private readonly ready: (frame: StageFrame) => void, private readonly failure: (message: string) => void,
    private readonly createWorker: () => Worker = () => new Worker(new URL("../workers/deformation.worker.ts", import.meta.url), { type: "module" })) {
    this.startWorker();
  }

  private startWorker(): void {
    this.worker = this.createWorker();
    this.worker.onmessage = (event: MessageEvent<DeformationResult>) => this.complete(event.data);
    this.worker.onerror = (event) => {
      event.preventDefault();
      const latest = this.pending ?? this.inFlight?.frame ?? null;
      this.worker.terminate();
      this.inFlight = null;
      this.pending = latest;
      this.sent.clear();
      const message = event.message || "O cálculo da malha foi interrompido.";
      if (this.failures++ === 0 && !this.disposed) {
        this.failure(`${message} Retomando o cálculo…`);
        this.startWorker();
        this.flush();
      } else {
        this.terminalFailure = true;
        this.failure(`${message} Use “Tentar novamente” para reiniciar o cálculo.`);
      }
    };
  }

  retry(): void {
    if (this.disposed || !this.terminalFailure) return;
    this.terminalFailure = false;
    this.failures = 0;
    this.startWorker();
    this.flush();
  }

  request(state: AppState): void {
    if (this.disposed) return;
    const frame = prepareStageFrame(state, this.snapshots);
    const keep = new Set(frame.geometries.map((g) => g.id));
    for (const id of this.snapshots.keys()) if (!keep.has(id)) this.snapshots.delete(id);
    this.document = frame.document;
    const key = frame.document + JSON.stringify([frame.draws, frame.poses]);
    if (key === this.requestedKey) return;
    this.requestedKey = key;
    this.pending = frame;
    this.flush();
  }

  private flush(): void {
    if (this.inFlight || !this.pending || this.disposed || this.terminalFailure) return;
    const frame = this.pending;
    this.pending = null;
    const id = ++this.sequence;
    this.inFlight = { id, frame };
    const keep = frame.geometries.map((g) => g.id);
    for (const mesh of this.sent.keys()) if (!keep.includes(mesh)) this.sent.delete(mesh);
    const updates = frame.geometries.filter((g) => this.sent.get(g.id) !== g.signature);
    for (const update of updates) this.sent.set(update.id, update.signature);
    const request: DeformationRequest = { type: "deform", id, document: frame.document, updates, keep, poses: frame.poses };
    // Structured cloning snapshots updates now; the worker never shares mutable editor arrays.
    this.worker.postMessage(request);
  }

  private complete(result: DeformationResult): void {
    const flight = this.inFlight;
    if (!flight || result.id !== flight.id || this.disposed) return;
    this.inFlight = null;
    if (result.document === this.document) {
      if (result.error) this.failure(result.error);
      else this.ready({ document: result.document, draws: flight.frame.draws,
        packets: new Map(result.packets.map((packet) => [packet.key, packet])), elapsedMs: result.elapsedMs });
    }
    this.flush();
  }

  dispose(): void {
    this.disposed = true;
    this.pending = null;
    this.worker.terminate();
  }
}
