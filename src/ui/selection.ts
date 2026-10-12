/**
 * chocoBones seleção múltipla + reorder de camadas + teclado
 * Item 11: Shift-range, Delete/Backspace, Alt+R, Space, C, F/Home.
 */
import { Layer } from "../rig/joint";

export interface SelectionState {
  selectedJointIds: string[];
  selectedLayerIds: string[];
  anchorLayerIdx: number;
}

/** Seleção em faixa com Shift entre âncora e índice clicado. */
export function selectionSelectLayerRange(
  layers: readonly Layer[],
  state: SelectionState,
  clickedId: string,
  extend: boolean
): void {
  const idx = layers.findIndex((l) => l.id === clickedId);
  if (idx < 0) return;
  if (!extend) {
    state.selectedLayerIds = [clickedId];
    state.anchorLayerIdx = idx;
    return;
  }
  const a = Math.min(state.anchorLayerIdx < 0 ? idx : state.anchorLayerIdx, idx);
  const b = Math.max(state.anchorLayerIdx < 0 ? idx : state.anchorLayerIdx, idx);
  state.selectedLayerIds = layers.slice(a, b + 1).map((l) => l.id);
}

/** Move camada up/down (z-index / ordem de desenho). Retorna true se moveu. */
export function moveLayerOrder(layers: Layer[], id: string, dir: 1 | -1): boolean {
  const i = layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= layers.length) return false;
  const [item] = layers.splice(i, 1);
  layers.splice(j, 0, item!);
  return true;
}

export type EditorKeyAction =
  | "toggle-play"
  | "reset-bind"
  | "delete-selection"
  | "reset-view"
  | "new-bone-mode"
  | "none";

/** Mapeia eventos de teclado para ações do editor (usado por Slint e testes). */
export function mapKeyToAction(
  key: string,
  opts: { alt?: boolean; shift?: boolean; hasLayerSelection?: boolean } = {}
): EditorKeyAction {
  if (key === " " || key === "Spacebar") return "toggle-play";
  if ((key === "Delete" || key === "Backspace") && opts.hasLayerSelection) return "delete-selection";
  if ((key === "r" || key === "R") && opts.alt) return "reset-bind";
  if (key === "F" || key === "Home") return "reset-view";
  if (key === "c" || key === "C") return "new-bone-mode";
  return "none";
}
