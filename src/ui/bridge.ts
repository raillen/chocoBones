/**
 * chocoBones Slint Bridge — fachada fina (Item 5)
 * Compõe store + actions + viewport/controller + render/loop.
 * Mantém API legada (AppState, createInitialAppState, bindSlintWindow).
 */
import * as slint from "slint-ui";
import { promises as fsp } from "fs";
import * as path from "path";
import { findJoint } from "../rig/joint";
import { OrbitCamera } from "../core/math3d";
import { boneMatrices } from "../rig/fk";
import { solveIK } from "../rig/ik";
import { encodeRgbaToPng, encodeRgbaToPngAsync } from "../render/png_export";
import { startRenderLoop } from "../render/loop";
import { EditorMode, restoreBindPose } from "./modes";
import { mapKeyToAction, moveLayerOrder, selectionSelectLayerRange } from "./selection";
import { AppState, createInitialAppState } from "./store";
import { addJoint, removeJoint, applyRigPreset } from "./actions/rig_actions";
import { addLayer, moveLayer, removeLayer, removeSelectedLayers, setLayerOpacity, toggleLayerVisibility } from "./actions/layer_actions";
import { addPin, deletePin, resetPin, setPinAnchor, setPinInfluence, togglePinLock } from "./actions/pin_actions";
import { applyProjectToState, loadProjectFile, saveProjectFile, stateToProject } from "./actions/project_io";
import { resetToRest, seekTimeline, selectClip, togglePlay } from "./actions/animation_actions";
import { applyJointDrag } from "./viewport/controller";
import { pickEntity } from "./viewport/picking";
import { movePinOffset, movePinRest } from "../mesh/mesh";
import { loadProjectFromJson } from "../project/project";

export type { AppState };
export { createInitialAppState };

export function exportPngSync(state: AppState): Buffer {
  return encodeRgbaToPng(state.viewportBuffer.width, state.viewportBuffer.height, state.viewportBuffer.pixels);
}

function syncJointsList(window: any, state: AppState): void {
  const rows = state.joints.map((j) => ({ id: j.id, name: j.name, parent: j.parent, color: j.color }));
  window.joints_list = new slint.ArrayModel(rows);
}

function syncLayersList(window: any, state: AppState): void {
  const rows = state.layers.map((l) => ({ id: l.id, name: l.name, joint: l.joint, visible: l.visible, locked: l.locked, opacity: l.opacity }));
  window.layers_list = new slint.ArrayModel(rows);
}

function syncSelectedJoint(window: any, state: AppState): void {
  let j = findJoint(state.joints, state.selectedJointId);
  if (!j && state.joints.length > 0) {
    j = state.joints[0]!;
    state.selectedJointId = j.id;
  }
  if (!j) return;
  window.selected_joint_id = j.id;
  window.selected_joint_name = j.name;
  window.selected_joint_parent = j.parent;
  window.selected_joint_x = j.x;
  window.selected_joint_y = j.y;
  window.selected_joint_color = j.color;
  const delta = state.currentPose.joints.get(j.id);
  window.selected_joint_angle = delta ? delta.angle : 0.0;
}

function syncSelectedLayer(window: any, state: AppState): void {
  const lyr = state.layers.find((l) => l.id === state.selectedLayerId);
  if (lyr) {
    window.selected_layer_id = lyr.id;
    window.selected_layer_name = lyr.name;
    window.selected_layer_opacity = lyr.opacity;
  } else {
    window.selected_layer_id = "";
    window.selected_layer_name = "";
    window.selected_layer_opacity = 1.0;
  }
}

function syncEditorMode(window: any, state: AppState): void {
  try {
    window.editor_mode = state.editorMode;
  } catch {
    // Slint antigo sem propriedade: ignora
  }
}

export function bindSlintWindow(window: any, state: AppState): () => void {
  window.active_workspace = state.activeWorkspace;
  window.viewport_mode = state.viewportMode;
  window.status_text = "🦴 chocoBones Desktop — Pronto (Node + pnpm + Slint + WebGPU)";
  window.theme_mode = state.themeMode;
  window.accent_name = state.accentName;
  window.active_tool = state.activeTool;
  window.element_tab = state.elementTab;
  window.search_filter = state.searchFilter;
  window.zoom_level = state.cameraZoom;
  window.timeline_duration = state.timelineDuration;
  window.timeline_time = state.timelineTime;
  window.is_playing = state.isPlaying;
  window.active_clip_name = state.activeClipName;
  window.ik_enabled = state.ikEnabled;
  syncEditorMode(window, state);

  syncJointsList(window, state);
  syncLayersList(window, state);
  syncSelectedJoint(window, state);
  syncSelectedLayer(window, state);
  state.history.push("Estado Inicial", state.joints, state.layers, state.currentPose);

  // --- tema e adaptabilidade ---
  window.change_theme = (theme: string) => {
    state.themeMode = theme;
    window.theme_mode = theme;
    window.status_text = `Tema alterado para: ${theme}`;
  };
  window.change_accent = (accent: string) => {
    state.accentName = accent;
    window.accent_name = accent;
    window.status_text = `Cor de destaque: ${accent}`;
  };
  window.select_tool = (tool: string) => {
    state.activeTool = tool;
    window.active_tool = tool;
    window.status_text = `Ferramenta selecionada: ${tool}`;
  };
  window.set_element_tab = (tab: string) => {
    state.elementTab = tab;
    window.element_tab = tab;
  };

  // --- workspaces / projeto ---
  window.change_workspace = (ws: string) => {
    state.activeWorkspace = ws;
    window.active_workspace = ws;
    window.status_text = `Espaço de trabalho: ${ws}`;
  };
  window.set_viewport_mode = (mode: string) => {
    state.viewportMode = mode;
    window.viewport_mode = mode;
  };
  window.set_editor_mode = (mode: string) => {
    state.editorMode = mode === "Setup" ? EditorMode.Setup : EditorMode.Animate;
    syncEditorMode(window, state);
    window.status_text = state.editorMode === EditorMode.Setup ? "Modo Setup — edita repouso" : "Modo Animar — edita pose (Alt+R restaura bind)";
  };
  window.toggle_editor_mode = () => {
    state.editorMode = state.editorMode === EditorMode.Setup ? EditorMode.Animate : EditorMode.Setup;
    syncEditorMode(window, state);
  };
  window.undo = () => {
    const desc = state.history.undo(state.joints, state.layers, state.currentPose);
    if (desc) {
      syncJointsList(window, state);
      syncLayersList(window, state);
      syncSelectedJoint(window, state);
      window.status_text = `Desfazer: ${desc}`;
    } else window.status_text = "Nenhuma ação anterior para desfazer.";
  };
  window.redo = () => {
    const desc = state.history.redo(state.joints, state.layers, state.currentPose);
    if (desc) {
      syncJointsList(window, state);
      syncLayersList(window, state);
      syncSelectedJoint(window, state);
      window.status_text = `Refazer: ${desc}`;
    } else window.status_text = "Nenhuma ação para refazer.";
  };
  window.new_project = () => {
    applyRigPreset(state, "Humanoid");
    state.currentPose.joints.clear();
    state.cameraPan = { x: 104, y: -40 };
    state.cameraZoom = 1.0;
    window.zoom_level = 1.0;
    syncJointsList(window, state);
    syncSelectedJoint(window, state);
    window.status_text = "Novo projeto iniciado com rig Humanoide.";
  };
  window.save_project = () => {
    saveProjectFile(state)
      .then((p) => {
        window.status_text = `Projeto salvo: ${path.basename(p)}`;
      })
      .catch((err: unknown) => {
        window.status_text = `Erro ao salvar: ${err instanceof Error ? err.message : String(err)}`;
      });
  };
  window.load_project = () => {
    loadProjectFile(state)
      .then(() => {
        syncJointsList(window, state);
        syncLayersList(window, state);
        syncSelectedJoint(window, state);
        window.status_text = "Projeto carregado com sucesso!";
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) window.status_text = "Arquivo choco_puppet.project.json não encontrado.";
        else window.status_text = `Erro ao carregar: ${msg}`;
      });
  };
  window.export_png = () => {
    encodeRgbaToPngAsync(state.viewportBuffer.width, state.viewportBuffer.height, state.viewportBuffer.pixels)
      .then(async (png) => {
        await fsp.writeFile(state.paths.exportPng, png);
        window.status_text = `📸 Frame exportado: ${path.basename(state.paths.exportPng)}`;
      })
      .catch((err: unknown) => {
        window.status_text = `Erro ao exportar PNG: ${err instanceof Error ? err.message : String(err)}`;
      });
  };

  // --- rig ---
  window.select_joint = (id: string) => {
    state.selectedJointId = id;
    state.selection.selectedJointIds = [id];
    syncSelectedJoint(window, state);
    const j = findJoint(state.joints, id);
    if (j) window.status_text = `Junta selecionada: ${j.name} (${j.id})`;
  };
  window.add_joint = () => {
    const created = addJoint(state);
    if (created) {
      syncJointsList(window, state);
      syncSelectedJoint(window, state);
      window.status_text = `Nova junta criada: ${created.name}`;
    }
  };
  window.remove_joint = (id: string) => {
    if (!removeJoint(state, id)) {
      window.status_text = id === "root" ? "A junta raiz (root) não pode ser removida." : `Junta ${id} não encontrada.`;
      return;
    }
    syncJointsList(window, state);
    syncSelectedJoint(window, state);
    window.status_text = `Junta ${id} removida.`;
  };
  window.update_joint_pos = (id: string, dx: number, dy: number) => {
    const j = findJoint(state.joints, id);
    if (!j) return;
    state.history.push(`Mover Junta ${j.name}`, state.joints, state.layers, state.currentPose);
    if (state.editorMode === EditorMode.Setup) {
      j.x += dx;
      j.y += dy;
    } else {
      const delta = state.currentPose.joints.get(id) ?? { angle: 0, x: 0, y: 0 };
      delta.x += dx;
      delta.y += dy;
      state.currentPose.joints.set(id, delta);
    }
    syncSelectedJoint(window, state);
  };
  window.update_joint_angle = (id: string, dAngle: number) => {
    const j = findJoint(state.joints, id);
    if (!j) return;
    state.history.push(`Girar Junta ${j.name}`, state.joints, state.layers, state.currentPose);
    const delta = state.currentPose.joints.get(id) ?? { angle: 0, x: 0, y: 0 };
    delta.angle += dAngle;
    state.currentPose.joints.set(id, delta);
    syncSelectedJoint(window, state);
  };
  window.set_rig_preset = (presetName: string) => {
    applyRigPreset(state, presetName);
    syncJointsList(window, state);
    syncSelectedJoint(window, state);
    window.status_text = `Preset aplicado: ${presetName}`;
  };
  window.toggle_ik = () => {
    state.ikEnabled = !state.ikEnabled;
    window.ik_enabled = state.ikEnabled;
    window.status_text = state.ikEnabled ? "IK ATIVADA — arraste extremidades" : "FK ATIVADA";
  };

  // --- layers (Item 11: multisseleção + reorder + delete) ---
  window.select_layer = (id: string) => {
    state.selectedLayerId = id;
    state.selection.selectedLayerIds = [id];
    const idx = state.layers.findIndex((l) => l.id === id);
    if (idx >= 0) state.selection.anchorLayerIdx = idx;
    syncSelectedLayer(window, state);
  };
  window.select_layer_range = (id: string, extend: boolean) => {
    selectionSelectLayerRange(state.layers, state.selection, id, extend);
    const last = state.selection.selectedLayerIds[state.selection.selectedLayerIds.length - 1];
    if (last) state.selectedLayerId = last;
    syncSelectedLayer(window, state);
  };
  window.add_layer = () => {
    const lyr = addLayer(state);
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    window.status_text = `Camada criada: ${lyr.name}`;
  };
  window.remove_layer = (id: string) => {
    removeLayer(state, id);
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    window.status_text = "Camada removida.";
  };
  window.remove_selected_layers = () => {
    const gone = removeSelectedLayers(state);
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    window.status_text = gone.length > 0 ? `${gone.length} camada(s) removida(s).` : "Nada selecionado.";
  };
  window.move_layer = (id: string, dir: number) => {
    const ok = moveLayer(state, id, dir >= 0 ? 1 : -1);
    if (ok) syncLayersList(window, state);
    void moveLayerOrder;
  };
  window.move_selected_layer_up = () => {
    if (state.selectedLayerId) window.move_layer(state.selectedLayerId, -1);
  };
  window.move_selected_layer_down = () => {
    if (state.selectedLayerId) window.move_layer(state.selectedLayerId, 1);
  };
  window.toggle_layer_visibility = (id: string) => {
    toggleLayerVisibility(state, id);
    syncLayersList(window, state);
  };
  window.update_layer_opacity = (id: string, opacity: number) => {
    setLayerOpacity(state, id, opacity);
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
  };

  // --- pinos (P1-7) ---
  window.add_pin = (meshId: string, x: number, y: number) => {
    const pin = addPin(state, meshId || "0", x, y);
    state.selectedPinId = pin.id;
    window.status_text = `Pino criado: ${pin.id}`;
    return pin.id;
  };
  window.delete_pin = (id: string) => {
    const ok = deletePin(state, id || state.selectedPinId);
    window.status_text = ok ? `Pino ${id} removido.` : "Pino não encontrado.";
    return ok;
  };
  window.select_pin = (id: string) => {
    state.selectedPinId = id;
    window.status_text = `Pino selecionado: ${id}`;
  };
  window.toggle_pin_lock = (id: string) => {
    return togglePinLock(state, id || state.selectedPinId);
  };
  window.reset_pin = (id: string) => {
    resetPin(state, id || state.selectedPinId);
    window.status_text = "Offset do pino resetado (rest intacto).";
  };
  window.set_pin_anchor = (id: string, mode: string, joint: string) => {
    return setPinAnchor(state, id, (mode as "free" | "joint" | "world") || "free", joint || "");
  };
  window.set_pin_influence = (id: string, radius: number, falloff: number, strength: number) => {
    return setPinInfluence(state, id, radius, falloff, strength);
  };

  // --- animação ---
  window.toggle_play = () => {
    togglePlay(state);
    window.is_playing = state.isPlaying;
  };
  window.timeline_seek = (time: number) => {
    seekTimeline(state, time);
    window.timeline_time = state.timelineTime;
  };
  window.select_clip = (clipName: string) => {
    selectClip(state, clipName);
    window.active_clip_name = state.activeClipName;
    window.timeline_duration = state.timelineDuration;
    window.timeline_time = 0;
    window.status_text = `Clipe ativo: ${state.activeClip.name}`;
  };
  window.reset_to_rest = () => {
    resetToRest(state);
    window.is_playing = false;
    window.timeline_time = 0;
    syncSelectedJoint(window, state);
    window.status_text = "Pose de repouso restaurada (bind).";
  };

  // --- teclado global (Item 11) ---
  window.handle_key = (key: string, alt = false) => {
    const action = mapKeyToAction(key, { alt, hasLayerSelection: state.selection.selectedLayerIds.length > 0 || state.selectedLayerId !== "" });
    if (action === "toggle-play") window.toggle_play();
    else if (action === "reset-bind") window.reset_to_rest();
    else if (action === "delete-selection") window.remove_selected_layers();
    else if (action === "reset-view") window.reset_view();
    return action;
  };

  // --- viewport mouse (usa controller + Setup/Animate + picking por ferramenta P1-8) ---
  const drag = state.viewportDrag;
  window.viewport_mouse_down = (sx: number, sy: number) => {
    drag.lastMouse = [sx, sy];
    drag.startMouse = [sx, sy];
    drag.startPan = { ...state.cameraPan };
    if (state.viewportMode === "2D") {
      const [wx, wy] = state.viewportBuffer.screenToWorld(sx, sy, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      const hit = pickEntity(state.joints, state.pins, state.currentPose, wx, wy, state.activeTool, state.cameraZoom);
      if (hit.kind === "pin") {
        drag.beginPin(sx, sy, hit.id, state.cameraPan);
        state.selectedPinId = hit.id;
        state.history.push(`Arrastar Pino ${hit.id}`, state.joints, state.layers, state.currentPose, state.pins);
        window.status_text = `Pino selecionado: ${hit.id}`;
        return;
      }
      if (hit.kind === "joint") {
        drag.beginJoint(sx, sy, hit.id, state.cameraPan);
        state.selectedJointId = hit.id;
        state.selection.selectedJointIds = [hit.id];
        syncSelectedJoint(window, state);
        state.history.push(`Arrastar Junta ${hit.id}`, state.joints, state.layers, state.currentPose, state.pins);
        return;
      }
    }
    drag.beginPan(sx, sy, state.cameraPan);
  };
  window.viewport_mouse_move = (sx: number, sy: number) => {
    const dx = sx - drag.lastMouse[0];
    const dy = sy - drag.lastMouse[1];
    if (drag.mode === "pan") {
      if (state.viewportMode === "3D") {
        state.orbitCamera.yaw += dx * 0.01;
        state.orbitCamera.pitch = Math.max(-1.4, Math.min(1.4, state.orbitCamera.pitch - dy * 0.01));
      } else {
        state.cameraPan.x = drag.startPan.x + (sx - drag.startMouse[0]) / state.cameraZoom;
        state.cameraPan.y = drag.startPan.y + (sy - drag.startMouse[1]) / state.cameraZoom;
      }
    } else if (drag.mode === "joint") {
      const [wx, wy] = state.viewportBuffer.screenToWorld(sx, sy, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      if (state.ikEnabled && state.editorMode !== EditorMode.Setup) {
        solveIK(state.joints, state.currentPose, drag.jointId, [wx, wy]);
      } else {
        applyJointDrag(state.joints, state.currentPose, drag.jointId, dx, dy, state.cameraZoom, state.editorMode, false, [wx, wy]);
        syncSelectedJoint(window, state);
      }
    } else if (drag.mode === "pin") {
      const [wx, wy] = state.viewportBuffer.screenToWorld(sx, sy, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      const pin = state.pins.find((p) => p.id === drag.pinId);
      if (pin) {
        if (state.editorMode === EditorMode.Setup) {
          movePinRest(state.pins, pin.id, wx, wy);
        } else {
          movePinOffset(state.currentPose, pin.id, dx / state.cameraZoom, dy / state.cameraZoom);
        }
      }
    }
    drag.lastMouse = [sx, sy];
  };
  window.viewport_mouse_up = () => {
    drag.end();
  };
  window.viewport_scroll = (deltaY: number) => {
    const factor = deltaY > 0 ? 0.9 : 1.1;
    state.cameraZoom = Math.min(5.0, Math.max(0.2, state.cameraZoom * factor));
    window.zoom_level = state.cameraZoom;
  };
  window.zoom_in = () => {
    state.cameraZoom = Math.min(5.0, state.cameraZoom * 1.25);
    window.zoom_level = state.cameraZoom;
  };
  window.zoom_out = () => {
    state.cameraZoom = Math.max(0.2, state.cameraZoom * 0.8);
    window.zoom_level = state.cameraZoom;
  };
  window.reset_view = () => {
    state.cameraZoom = 1.0;
    state.cameraPan = { x: 104, y: -40 };
    window.zoom_level = 1.0;
    state.orbitCamera = new OrbitCamera([0, 0, 0], 3.8, 0.4, 0.25);
    window.status_text = "Câmera resetada.";
  };

  // Loop com delta_time real (Item 3)
  const cleanup = startRenderLoop(state, window, { fps: 60 });
  void restoreBindPose;
  void stateToProject;
  void applyProjectToState;
  void loadProjectFromJson;
  void boneMatrices;
  return cleanup;
}
