/**
 * chocoBones layer actions (Item 5 + Item 11)
 */
import { generateId } from "../../core/ids";
import { Layer } from "../../rig/joint";
import { moveLayerOrder } from "../selection";
import type { AppState } from "../store";

function cleanRemovedLayers(state: AppState, removed: Layer[]): void {
  for (const layer of removed) {
    const meshId = state.meshLayer.get(layer.id);
    state.meshLayer.delete(layer.id);
    if (!state.layers.some((l) => l.asset === layer.asset)) state.spriteAssets.delete(layer.asset);
    if (meshId !== undefined && ![...state.meshLayer.values()].includes(meshId)) {
      state.meshUvs.delete(meshId);
      const mesh = state.meshes[Number(meshId)];
      if (mesh) { mesh.vertices = []; mesh.triangles = []; mesh.weights = []; }
      const gone = state.pins.filter((p) => p.meshId === meshId).map((p) => p.id);
      state.pins = state.pins.filter((p) => p.meshId !== meshId);
      for (const id of gone) {
        state.currentPose.pins.delete(id);
        for (const frame of state.activeClip.frames) {
          frame.pins.delete(id);
          frame.channels = frame.channels.filter((channel) => channel !== `pin:${id}`);
        }
      }
      if (gone.includes(state.selectedPinId)) state.selectedPinId = "";
    }
  }
}

export function addLayer(state: AppState): Layer {
  state.history.push("Adicionar Camada", state.joints, state.layers, state.currentPose);
  const layer: Layer = {
    id: generateId("layer"),
    name: `Nova Camada ${state.layers.length + 1}`,
    asset: "sprite.png",
    transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
    joint: state.selectedJointId || "root",
    visible: true,
    locked: false,
    opacity: 1.0,
    hasSeamMask: false,
    seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
  };
  state.layers.push(layer);
  state.selectedLayerId = layer.id;
  state.selection.selectedLayerIds = [layer.id];
  return layer;
}

export function removeLayer(state: AppState, id: string): void {
  state.history.push(`Remover Camada ${id}`, state.joints, state.layers, state.currentPose, state.pins);
  const removed = state.layers.filter((l) => l.id === id);
  state.layers = state.layers.filter((l) => l.id !== id);
  cleanRemovedLayers(state, removed);
  state.selection.selectedLayerIds = state.selection.selectedLayerIds.filter((s) => s !== id);
  if (state.selectedLayerId === id) state.selectedLayerId = state.layers[0]?.id ?? "";
}

export function removeSelectedLayers(state: AppState): string[] {
  const ids = state.selection.selectedLayerIds.length > 0 ? state.selection.selectedLayerIds : state.selectedLayerId ? [state.selectedLayerId] : [];
  if (ids.length === 0) return [];
  state.history.push(`Remover ${ids.length} camada(s)`, state.joints, state.layers, state.currentPose, state.pins);
  const gone = [...ids];
  const removed = state.layers.filter((l) => ids.includes(l.id));
  state.layers = state.layers.filter((l) => !ids.includes(l.id));
  cleanRemovedLayers(state, removed);
  state.selection.selectedLayerIds = [];
  state.selectedLayerId = state.layers[0]?.id ?? "";
  return gone;
}

export function moveLayer(state: AppState, id: string, dir: 1 | -1): boolean {
  state.history.push(`Reordenar Camada ${id}`, state.joints, state.layers, state.currentPose);
  return moveLayerOrder(state.layers, id, dir);
}

export function toggleLayerVisibility(state: AppState, id: string): void {
  const lyr = state.layers.find((l) => l.id === id);
  if (lyr) lyr.visible = !lyr.visible;
}

export function setLayerOpacity(state: AppState, id: string, opacity: number): void {
  const lyr = state.layers.find((l) => l.id === id);
  if (lyr) lyr.opacity = Math.max(0, Math.min(1, opacity));
}
