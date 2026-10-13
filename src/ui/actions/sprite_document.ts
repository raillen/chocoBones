/** Browser-safe sprite document actions; file decoding belongs to the host. */
import { type SpriteImage, validateSpriteImage } from "../../assets/image";
import { generateId } from "../../core/ids";
import { buildSpriteMesh, nearestOpaquePoint } from "../../mesh/sprite_mesh";
import { buildAdaptiveSpriteMesh, insertMeshPoints } from "../../mesh/adaptive_sprite_mesh";
import { createPin, type SpriteDeformation, type Mesh, type Pin } from "../../mesh/mesh";
import { EditorMode } from "../modes";
import type { AppState } from "../store";
import type { Layer } from "../../rig/joint";
import type { Vec2 } from "../../core/types";

export function fitCanvas(state: AppState): void {
  state.cameraZoom = Math.min(5, Math.max(0.05, Math.min(
    (state.viewportBuffer.width - 40) / state.canvasWidth,
    (state.viewportBuffer.height - 40) / state.canvasHeight,
  )));
  state.cameraPan = {
    x: (state.viewportBuffer.width - state.canvasWidth * state.cameraZoom) / 2,
    y: (state.viewportBuffer.height - state.canvasHeight * state.cameraZoom) / 2,
  };
}

export function importDecodedSprite(state: AppState, image: SpriteImage, name: string): Layer {
  validateSpriteImage(image);
  const built = buildImageMesh(state, image);
  if (built.mesh.triangles.length === 0) throw new Error("O PNG não tem pixels acima do limiar de opacidade.");
  state.history.push("Importar PNG", state.joints, state.layers, state.currentPose, state.pins);
  const assetId = generateId("image");
  const layer: Layer = {
    id: generateId("layer"), name: name.split(/[\\/]/).pop() || "Imagem PNG", asset: assetId, joint: "",
    transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
    visible: true, locked: false, opacity: 1, hasSeamMask: false,
    seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
  };
  const first = state.spriteAssets.size === 0;
  const meshId = String(state.meshes.length);
  state.spriteAssets.set(assetId, image);
  state.layers.push(layer);
  state.meshes.push(built.mesh);
  state.meshLayer.set(layer.id, meshId);
  state.meshUvs.set(meshId, built.uvs);
  state.canvasWidth = first ? image.width : Math.max(state.canvasWidth, image.width);
  state.canvasHeight = first ? image.height : Math.max(state.canvasHeight, image.height);
  state.selectedLayerId = layer.id;
  state.selection.selectedLayerIds = [layer.id];
  state.selectedPinId = "";
  state.showSkeleton = false;
  state.editorMode = EditorMode.Setup;
  state.isPlaying = false;
  fitCanvas(state);
  return layer;
}

function buildImageMesh(state: AppState, image: SpriteImage) {
  const build = {
    rows: state.meshRows, cols: state.meshCols, alphaThreshold: state.alphaThreshold,
    refineEdges: state.refineEdges, edgeSize: state.edgeSize,
  };
  // Reserve room for inserted pin handles below the ARAP 4096-vertex ceiling.
  const adaptive = state.refineEdges ? buildAdaptiveSpriteMesh(image, { ...build, maxVertices: 3968 }) : undefined;
  const built = adaptive ?? buildSpriteMesh(image, build.rows, build.cols, build.alphaThreshold);
  built.mesh.build = build;
  built.mesh.buildStats = adaptive
    ? { refinedCells: adaptive.stats.refinedCells, budgetLimited: adaptive.stats.budgetLimited }
    : { refinedCells: 0, budgetLimited: false };
  return built;
}

/** Restore controls from the actual mesh on selection/load/undo. */
export function syncSpriteBuildSettings(state: AppState): void {
  const id = state.meshLayer.get(state.selectedLayerId);
  const build = id === undefined ? undefined : state.meshes[Number(id)]?.build;
  if (build) {
    state.meshRows = build.rows; state.meshCols = build.cols;
    state.alphaThreshold = build.alphaThreshold;
    state.refineEdges = build.refineEdges; state.edgeSize = build.edgeSize;
  }
}

export function setSpriteDeformation(state: AppState, mode: SpriteDeformation): void {
  if (mode !== "MLS" && mode !== "ARAP") throw new Error("Escolha MLS ou ARAP.");
  const id = state.meshLayer.get(state.selectedLayerId);
  const layer = state.layers.find((l) => l.id === state.selectedLayerId);
  const mesh = id === undefined ? undefined : state.meshes[Number(id)];
  if (!mesh || !layer || !state.spriteAssets.has(layer.asset)) throw new Error("Selecione uma camada PNG importada.");
  if ((mesh.deformation ?? "MLS") === mode) return;
  if (mode === "ARAP") {
    const image = state.spriteAssets.get(layer.asset)!;
    const stored = state.meshUvs.get(id!);
    const uvs = stored?.length === mesh.vertices.length ? stored
      : mesh.vertices.map(([x, y]) => [x / image.width, y / image.height] as [number, number]);
    validateSpriteMeshDeformation({ ...mesh, deformation: mode }, uvs, state.pins.filter((p) => p.meshId === id));
  }
  state.history.push("Alterar deformação", state.joints, state.layers, state.currentPose, state.pins);
  mesh.deformation = mode;
}

export function rebuildSpriteMesh(state: AppState): void {
  const layer = state.layers.find((l) => l.id === state.selectedLayerId);
  const image = layer ? state.spriteAssets.get(layer.asset) : undefined;
  const meshId = layer ? state.meshLayer.get(layer.id) : undefined;
  if (!image || meshId === undefined) throw new Error("Selecione uma camada PNG importada.");
  const built = buildImageMesh(state, image);
  if (!built.mesh.triangles.length) throw new Error("O limiar removeu todo o conteúdo; reduza-o.");
  const previous = state.meshes[Number(meshId)]!;
  built.mesh.mode = previous.mode;
  built.mesh.skinning = previous.skinning;
  built.mesh.strength = previous.strength;
  built.mesh.deformation = previous.deformation;
  if (built.mesh.deformation === "ARAP") {
    validateSpriteMeshDeformation(built.mesh, built.uvs, state.pins.filter((p) => p.meshId === meshId));
  }
  state.history.push("Reconstruir malha", state.joints, state.layers, state.currentPose, state.pins);
  state.meshes[Number(meshId)] = built.mesh;
  state.meshUvs.set(meshId, built.uvs);
}

export function autoSpritePins(state: AppState): void {
  const layer = state.layers.find((l) => l.id === state.selectedLayerId);
  const image = layer ? state.spriteAssets.get(layer.asset) : undefined;
  const meshId = layer ? state.meshLayer.get(layer.id) : undefined;
  if (!image || meshId === undefined) throw new Error("Selecione uma camada PNG importada.");
  const targets = [
    { name: "Base", x: 0.5, y: 0.6, locked: true },
    { name: "Superior", x: 0.5, y: 0.15, locked: false },
    { name: "Lateral", x: 0.8, y: 0.45, locked: false },
    { name: "Pé esquerdo", x: 0.25, y: 0.9, locked: false },
    { name: "Pé direito", x: 0.75, y: 0.9, locked: false },
  ];
  const added = targets.flatMap((target) => {
    const p = nearestOpaquePoint(image, target.x * image.width, target.y * image.height, state.alphaThreshold);
    return p ? [createPin(generateId("pin"), meshId, p[0], p[1], { name: target.name, locked: target.locked })] : [];
  }).filter((pin, index, list) => !list.slice(0, index).some((p) => Math.hypot(p.x - pin.x, p.y - pin.y) < 1));
  if (added.length < 2) throw new Error("A imagem precisa de pelo menos duas regiões distintas para sugerir pinos.");
  const mesh = state.meshes[Number(meshId)]!;
  if (mesh.deformation === "ARAP" && mesh.vertices.length + state.pins.filter((p) => p.meshId === meshId && p.enabled !== false).length + added.length > 4096) {
    throw new Error("Não há espaço para mais pinos ARAP; reduza a densidade ou o refinamento da malha.");
  }
  state.history.push("Sugerir pinos", state.joints, state.layers, state.currentPose, state.pins);
  // Existing hand-placed pins are preserved. Suggestions are additive and editable.
  state.pins.push(...added);
  state.selectedPinId = added.find((p) => !p.locked)?.id ?? added[0]!.id;
}

/** Validate augmented topology without running the expensive ARAP pose solver on the UI thread. */
export function validateSpriteMeshDeformation(mesh: Mesh, uvs: Vec2[], pins: Pin[]): void {
  if (uvs.length !== mesh.vertices.length) throw new Error("A malha precisa de um UV por vértice.");
  if (mesh.deformation !== "ARAP") return;
  const enabled = pins.filter((p) => p.enabled !== false);
  const inserted = insertMeshPoints(mesh, uvs, enabled.map((p): Vec2 => [p.x, p.y]));
  if (inserted.mesh.vertices.length > 4096) throw new Error("ARAP aceita até 4096 vértices; reduza a densidade ou o refinamento.");
}
