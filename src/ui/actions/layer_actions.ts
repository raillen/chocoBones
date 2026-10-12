/**
 * chocoBones layer actions (Item 5 + Item 11)
 */
import { generateId } from "../../core/ids";
import { Layer } from "../../rig/joint";
import { moveLayerOrder } from "../selection";
import type { AppState } from "../store";

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
  state.history.push(`Remover Camada ${id}`, state.joints, state.layers, state.currentPose);
  state.layers = state.layers.filter((l) => l.id !== id);
  state.selection.selectedLayerIds = state.selection.selectedLayerIds.filter((s) => s !== id);
  if (state.selectedLayerId === id) state.selectedLayerId = state.layers[0]?.id ?? "";
}

export function removeSelectedLayers(state: AppState): string[] {
  const ids = state.selection.selectedLayerIds.length > 0 ? state.selection.selectedLayerIds : state.selectedLayerId ? [state.selectedLayerId] : [];
  if (ids.length === 0) return [];
  state.history.push(`Remover ${ids.length} camada(s)`, state.joints, state.layers, state.currentPose);
  const gone = [...ids];
  state.layers = state.layers.filter((l) => !ids.includes(l.id));
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
