/** Coordinates shared by pin rendering, picking and dragging on transformed artwork. */
import { matApply, matInverse, vec2Dist } from "../../core/math";
import { MAT_IDENTITY, type Mat2x3, type Vec2 } from "../../core/types";
import type { Pin } from "../../mesh/mesh";
import { boneMatrices, layerMatrix } from "../../rig/fk";
import type { Layer, Pose } from "../../rig/joint";
import type { AppState } from "../store";
import { EditorMode } from "../modes";

function pinMeshStrength(state: AppState, pin: Pin): number {
  const mesh = pin.meshId === undefined ? undefined : state.meshes[Number(pin.meshId)];
  return mesh?.deformation === "ARAP" && Number.isFinite(mesh.strength) ? Math.max(0, Math.min(1, mesh.strength)) : 1;
}

/** Coincident ARAP pins constrain one shared vertex, with fixed anchors taking priority. */
function handlePin(state: AppState, pin: Pin): Pin {
  const mesh = pin.meshId === undefined ? undefined : state.meshes[Number(pin.meshId)];
  if (mesh?.deformation !== "ARAP" || pin.enabled === false) return pin;
  const coincident = state.pins.filter((p) => p.meshId === pin.meshId && p.enabled !== false && p.x === pin.x && p.y === pin.y);
  return coincident.find((p) => p.locked) ?? coincident[0] ?? pin;
}

function pinLayer(state: AppState, pin: Pin): Layer | undefined {
  if (pin.meshId === undefined) return undefined;
  return state.layers.find((layer) => state.meshLayer.get(layer.id) === pin.meshId);
}

function pinMatrix(state: AppState, layer: Layer | undefined, pose: Pose): Mat2x3 {
  return layer
    ? layerMatrix(layer, state.joints, pose, boneMatrices(state.joints, pose))
    : MAT_IDENTITY;
}

function layerEditable(layer: Layer | undefined, pose: Pose): boolean {
  return !layer || (layer.visible && !layer.locked && pose.layers.get(layer.id)?.visible !== false);
}

/** Uses the same local pin offset and layer/FK transform as the deformed mesh. */
export function pinWorldPoint(state: AppState, pin: Pin, pose: Pose = state.currentPose): Vec2 {
  const handle = handlePin(state, pin);
  const delta = handle.locked || pin.enabled === false ? undefined : pose.pins.get(handle.id);
  const strength = pinMeshStrength(state, pin);
  const local: Vec2 = [pin.x + (delta?.[0] ?? 0) * strength, pin.y + (delta?.[1] ?? 0) * strength];
  return matApply(pinMatrix(state, pinLayer(state, pin), pose), local);
}

/** Returns a desired mesh-local position; callers convert it to a rest position or offset. */
export function pinLocalPoint(state: AppState, pin: Pin, world: Vec2): Vec2 | null {
  const layer = pinLayer(state, pin);
  if (pin.locked || pin.enabled === false || !layerEditable(layer, state.currentPose)) return null;
  if (state.editorMode !== EditorMode.Setup && handlePin(state, pin).id !== pin.id) return null;
  if (!world.every(Number.isFinite)) return null;
  const matrix = pinMatrix(state, layer, state.currentPose);
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  // matInverse deliberately returns identity for singular matrices; that is unsafe for editing.
  if (!Object.values(matrix).every(Number.isFinite) || Math.abs(determinant) < 1e-10) return null;
  const point = matApply(matInverse(matrix), world);
  if (state.editorMode !== EditorMode.Setup) {
    const strength = pinMeshStrength(state, pin);
    if (strength === 0) return null;
    point[0] = pin.x + (point[0] - pin.x) / strength;
    point[1] = pin.y + (point[1] - pin.y) / strength;
  }
  return point.every(Number.isFinite) ? point : null;
}

/** Finds the closest visible editable-layer pin in world units, retaining locked anchors for selection. */
export function pickScenePin(state: AppState, world: Vec2, hitRadius: number): string {
  if (!world.every(Number.isFinite) || !Number.isFinite(hitRadius) || hitRadius < 0) return "";
  let best = "";
  let bestDistance = Infinity;
  for (const pin of state.pins) {
    const layer = pinLayer(state, pin);
    if (state.spriteAssets.size > 0 && (!layer || !state.spriteAssets.has(layer.asset))) continue;
    if (pin.enabled === false || !layerEditable(layer, state.currentPose)) continue;
    const distance = vec2Dist(pinWorldPoint(state, pin), world);
    if (distance <= hitRadius && (distance < bestDistance || (distance === bestDistance && pin.id === state.selectedPinId))) {
      best = pin.id;
      bestDistance = distance;
    }
  }
  return best;
}
