/**
 * chocoBones Slint Bridge — fachada fina (Item 5)
 * Compõe store + actions + viewport/controller + render/loop.
 * Mantém API legada (AppState, createInitialAppState, bindSlintWindow).
 */
import * as slint from "slint-ui";
import { promises as fsp } from "fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
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
import { mapViewportPoint } from "./viewport/geometry";
import { movePinRest } from "../mesh/mesh";
import { loadProjectFromJson } from "../project/project";
import { importSpriteFile, fitCanvas, rebuildSpriteMesh, autoSpritePins, setSpriteDeformation, syncSpriteBuildSettings } from "./actions/sprite_actions";
import { nearestOpaquePoint } from "../mesh/sprite_mesh";
import { pinLocalPoint, pickScenePin } from "./viewport/pin_space";
import { createPinMotionClip, upsertPinKeyframe, type PinMotionPreset } from "../animation/pin_motion";
import { createClip } from "../animation/timeline";
import { renderArtwork } from "../render/sprite_scene";
import { composeSpritesheet } from "../export/runtime";
import { matApply, matInverse } from "../core/math";
import { layerMatrix } from "../rig/fk";

export type { AppState };
export { createInitialAppState };

export function exportPngSync(state: AppState): Buffer {
  const buffer = state.spriteAssets.size ? renderArtwork(state) : state.viewportBuffer;
  return encodeRgbaToPng(buffer.width, buffer.height, buffer.pixels);
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

const selectedControlLayer = new WeakMap<object, string>();
function syncSpriteControls(window: any, state: AppState): void {
  const layer = state.layers.find((l) => l.id === state.selectedLayerId);
  const meshId = layer ? state.meshLayer.get(layer.id) : undefined;
  const image = layer ? state.spriteAssets.get(layer.asset) : undefined;
  const mesh = meshId === undefined ? undefined : state.meshes[Number(meshId)];
  if (selectedControlLayer.get(window) !== state.selectedLayerId) {
    syncSpriteBuildSettings(state);
    selectedControlLayer.set(window, state.selectedLayerId);
  }
  window.has_sprite = !!image;
  window.canvas_width = state.canvasWidth;
  window.canvas_height = state.canvasHeight;
  window.mesh_rows = state.meshRows; window.mesh_cols = state.meshCols;
  window.alpha_threshold = state.alphaThreshold;
  window.refine_edges = state.refineEdges; window.edge_size = state.edgeSize;
  window.deformation = mesh?.deformation ?? "MLS";
  window.mesh_vertices = mesh?.vertices.length ?? 0;
  window.mesh_budget_limited = mesh?.buildStats?.budgetLimited ?? false;
  window.mesh_triangles = mesh?.triangles.length ?? 0;
  window.show_mesh = state.showMesh; window.show_skeleton = state.showSkeleton;
  window.onion_skin = state.onionSkin; window.snap_pins = state.snapPins;
  window.motion_amplitude = state.motionAmplitude; window.motion_frequency = state.motionFrequency;
  window.motion_preset = state.motionPreset;
  window.zoom_level = state.cameraZoom;
  window.is_playing = state.isPlaying;
  window.timeline_time = state.timelineTime; window.timeline_duration = state.timelineDuration;
  window.active_clip_name = state.activeClipName;
  const pins = state.pins.filter((p) => p.meshId === meshId);
  window.pins_list = new slint.ArrayModel(pins.map((p) => ({ id: p.id, name: p.name, locked: p.locked })));
  const selected = pins.find((p) => p.id === state.selectedPinId);
  window.selected_pin_id = selected?.id ?? "";
  window.selected_pin_name = selected?.name ?? "";
  window.selected_pin_locked = selected?.locked ?? false;
  window.selected_pin_radius = selected?.radius ?? 0;
  window.selected_pin_strength = selected?.strength ?? 1;
  syncSelectedLayer(window, state);
  syncEditorMode(window, state);
}

export function bindSlintWindow(window: any, state: AppState): () => void {
  window.active_workspace = state.activeWorkspace;
  window.viewport_mode = state.viewportMode;
  window.status_text = "Pronto · selecione uma junta ou camada";
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
  syncSpriteControls(window, state);
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
    if (ws === "Rig" || ws === "Montagem" || ws === "Animacao") {
      state.elementTab = ws === "Rig" ? "Juntas" : "Camadas";
      window.element_tab = state.elementTab;
    }
    window.status_text = `Espaço de trabalho: ${ws}`;
  };
  window.set_viewport_mode = (mode: string) => {
    state.viewportMode = mode;
    window.viewport_mode = mode;
  };
  window.set_editor_mode = (mode: string) => {
    state.editorMode = mode === "Setup" ? EditorMode.Setup : EditorMode.Animate;
    if (state.editorMode === EditorMode.Setup) { state.isPlaying = false; restoreBindPose(state.currentPose); }
    else seekTimeline(state, state.timelineTime);
    window.is_playing = state.isPlaying;
    syncEditorMode(window, state);
    window.status_text = state.editorMode === EditorMode.Setup ? "Modo Setup — edita repouso" : "Modo Animar — edita pose (Alt+R restaura bind)";
  };
  window.toggle_editor_mode = () => {
    window.set_editor_mode(state.editorMode === EditorMode.Setup ? EditorMode.Animate : EditorMode.Setup);
  };
  window.undo = () => {
    const desc = state.history.undo(state.joints, state.layers, state.currentPose, state.pins);
    if (desc) {
      syncJointsList(window, state);
      syncLayersList(window, state);
      syncSelectedJoint(window, state);
      syncSpriteControls(window, state);
      window.status_text = `Desfazer: ${desc}`;
    } else window.status_text = "Nenhuma ação anterior para desfazer.";
  };
  window.redo = () => {
    const desc = state.history.redo(state.joints, state.layers, state.currentPose, state.pins);
    if (desc) {
      syncJointsList(window, state);
      syncLayersList(window, state);
      syncSelectedJoint(window, state);
      syncSpriteControls(window, state);
      window.status_text = `Refazer: ${desc}`;
    } else window.status_text = "Nenhuma ação para refazer.";
  };
  window.new_project = () => {
    state.history.push("Novo projeto", state.joints, state.layers, state.currentPose, state.pins);
    applyProjectToState(state, stateToProject(createInitialAppState(state.paths)));
    state.isPlaying = false; state.showSkeleton = true; state.showMesh = true;
    state.cameraPan = { x: 104, y: -40 }; state.cameraZoom = 1;
    syncJointsList(window, state); syncLayersList(window, state);
    syncSelectedJoint(window, state); syncSpriteControls(window, state);
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
        fitCanvas(state); syncSpriteControls(window, state);
        window.status_text = "Projeto carregado com sucesso!";
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) window.status_text = "Arquivo choco_puppet.project.json não encontrado.";
        else window.status_text = `Erro ao carregar: ${msg}`;
      });
  };
  window.export_png = () => {
    let buffer;
    try { buffer = state.spriteAssets.size ? renderArtwork(state) : state.viewportBuffer; }
    catch (error) { window.status_text = error instanceof Error ? error.message : String(error); return; }
    encodeRgbaToPngAsync(buffer.width, buffer.height, buffer.pixels)
      .then(async (png) => {
        await fsp.writeFile(state.paths.exportPng, png);
        window.status_text = `Frame exportado: ${path.basename(state.paths.exportPng)}`;
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
    syncSpriteControls(window, state);
  };
  window.select_layer_range = (id: string, extend: boolean) => {
    selectionSelectLayerRange(state.layers, state.selection, id, extend);
    const last = state.selection.selectedLayerIds[state.selection.selectedLayerIds.length - 1];
    if (last) state.selectedLayerId = last;
    syncSelectedLayer(window, state);
    syncSpriteControls(window, state);
  };
  window.add_layer = () => {
    const lyr = addLayer(state);
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    syncSpriteControls(window, state);
    window.status_text = `Camada criada: ${lyr.name}`;
  };
  window.remove_layer = (id: string) => {
    removeLayer(state, id);
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    syncSpriteControls(window, state);
    window.status_text = "Camada removida.";
  };
  window.remove_selected_layers = () => {
    const gone = removeSelectedLayers(state);
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    syncSpriteControls(window, state);
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
    syncSpriteControls(window, state);
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
    if (state.isPlaying) { state.editorMode = EditorMode.Animate; syncEditorMode(window, state); }
    window.is_playing = state.isPlaying;
  };
  window.timeline_seek = (time: number) => {
    seekTimeline(state, time);
    window.timeline_time = state.timelineTime;
  };
  window.select_clip = (clipName: string) => {
    if (state.spriteAssets.size) { window.apply_pin_motion(clipName === "walk" ? "walk" : "breath"); return; }
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

  const runSpriteAction = (action: () => void, success: string) => {
    try { action(); syncSpriteControls(window, state); syncLayersList(window, state); window.status_text = success; }
    catch (error) { window.status_text = error instanceof Error ? error.message : String(error); }
  };
  window.import_png_file = (filename: string) => {
    if (window.import_busy) return;
    window.import_busy = true;
    return importSpriteFile(state, filename).then(() => {
      state.activeTool = "Pin"; window.active_tool = "Pin"; window.dock_tab = "Puppet";
      state.elementTab = "Camadas"; window.element_tab = "Camadas";
      syncLayersList(window, state); syncSpriteControls(window, state);
      window.status_text = "PNG importado. Sugira pinos ou clique na imagem para criá-los.";
    }).catch((error: unknown) => { window.status_text = error instanceof Error ? error.message : String(error); })
      .finally(() => { window.import_busy = false; });
  };
  window.choose_png = () => {
    promisify(execFile)("python3", [path.resolve("scripts/native_dialog.py"), "open", "Importar PNG", "png"], { timeout: 120000 })
      .then(({ stdout }) => { const filename = stdout.trim(); if (filename) window.import_png_file(filename); })
      .catch(() => { window.status_text = "Use o campo de caminho PNG para importar neste ambiente."; });
  };
  window.fit_canvas = () => { fitCanvas(state); syncSpriteControls(window, state); };
  window.rebuild_mesh = () => runSpriteAction(() => rebuildSpriteMesh(state), "Malha reconstruída; pinos preservados.");
  window.set_deformation = (mode: string) => runSpriteAction(() => {
    if (mode !== "MLS" && mode !== "ARAP") throw new Error("Escolha MLS ou ARAP.");
    setSpriteDeformation(state, mode);
  }, mode === "ARAP" ? "ARAP: pinos na malha são restrições exatas; âncoras mantêm o repouso." : "MLS: influência por distância, raio e peso do pino.");
  window.auto_pins = () => runSpriteAction(() => autoSpritePins(state), "Sugestões adicionadas; ajuste a posição e as âncoras.");
  window.set_sprite_parameter = (name: string, value: string) => runSpriteAction(() => {
    const v = Number(value); if (!Number.isFinite(v)) throw new Error("Digite um número finito.");
    if (name === "rows") state.meshRows = Math.round(Math.max(4, Math.min(48, v)));
    else if (name === "cols") state.meshCols = Math.round(Math.max(4, Math.min(48, v)));
    else if (name === "alpha") state.alphaThreshold = Math.round(Math.max(1, Math.min(255, v)));
    else if (name === "edge") state.edgeSize = Math.max(2, Math.min(32, v));
    else if (name === "amplitude") state.motionAmplitude = Math.max(0, Math.min(200, v));
    else if (name === "frequency") state.motionFrequency = Math.max(0.1, Math.min(6, v));
    else if (name === "radius" || name === "strength") {
      const pin = state.pins.find((p) => p.id === state.selectedPinId);
      if (!pin) throw new Error("Selecione um pino.");
      state.history.push("Ajustar influência do pino", state.joints, state.layers, state.currentPose, state.pins);
      setPinInfluence(state, pin.id, name === "radius" ? Math.max(0, Math.min(4096, v)) : pin.radius ?? 0,
        pin.falloff ?? 2, name === "strength" ? Math.max(0, Math.min(1, v)) : pin.strength ?? 1);
    }
  }, "Parâmetro atualizado.");
  window.toggle_sprite_overlay = (name: string) => {
    if (name === "mesh") state.showMesh = !state.showMesh;
    else if (name === "skeleton") state.showSkeleton = !state.showSkeleton;
    else if (name === "onion") state.onionSkin = !state.onionSkin;
    else if (name === "snap") state.snapPins = !state.snapPins;
    else if (name === "refine") state.refineEdges = !state.refineEdges;
    syncSpriteControls(window, state);
  };
  window.choose_pin = (id: string) => { state.selectedPinId = id; syncSpriteControls(window, state); };
  window.lock_selected_pin = () => runSpriteAction(() => {
    togglePinLock(state, state.selectedPinId);
  }, "Âncora do pino atualizada.");
  window.remove_selected_pin = () => runSpriteAction(() => {
    deletePin(state, state.selectedPinId); state.selectedPinId = "";
  }, "Pino removido.");
  window.apply_pin_motion = (preset: string) => runSpriteAction(() => {
    if (!["breath", "sway", "walk"].includes(preset)) throw new Error("Preset desconhecido.");
    const layerMesh = state.meshLayer.get(state.selectedLayerId);
    const pins = state.pins.filter((p) => p.meshId === layerMesh);
    if (pins.filter((p) => !p.locked && p.enabled !== false).length < 1) throw new Error("Crie ao menos um pino livre.");
    state.history.push("Aplicar movimento de pinos", state.joints, state.layers, state.currentPose, state.pins);
    state.activeClip = createPinMotionClip(pins, { preset: preset as PinMotionPreset,
      amplitude: state.motionAmplitude, frequency: state.motionFrequency, duration: 4, intensity: 1 });
    state.activeClipName = state.activeClip.name; state.timelineDuration = state.activeClip.duration;
    seekTimeline(state, 0); state.motionPreset = preset; state.isPlaying = true;
    state.editorMode = EditorMode.Animate; state.activeWorkspace = "Animacao";
    window.active_workspace = "Animacao"; window.dock_tab = "Puppet";
  }, "Movimento aplicado como keyframes editáveis no clipe ativo.");
  window.key_pin_pose = () => runSpriteAction(() => {
    state.history.push("Gravar pose de pinos", state.joints, state.layers, state.currentPose, state.pins);
    upsertPinKeyframe(state.activeClip, state.currentPose, state.timelineTime);
  }, "Pose gravada na timeline.");
  let performanceArmed = false;
  let performanceStart: number | null = null;
  window.arm_performance = () => {
    performanceArmed = !performanceArmed; window.performance_armed = performanceArmed;
    state.isPlaying = false; state.editorMode = EditorMode.Animate;
    syncSpriteControls(window, state);
    window.status_text = performanceArmed ? "Arraste um pino livre para gravar um gesto de até 4 segundos." : "Gravação desarmada.";
  };
  window.export_spritesheet = () => runSpriteAction(() => {
    if (!state.spriteAssets.size) throw new Error("Importe um PNG primeiro.");
    const frameCount = 8; const columns = 4;
    if (state.canvasWidth * state.canvasHeight * frameCount > 16_777_216) throw new Error("Spritesheet excede 16 milhões de pixels.");
    const frames = Array.from({ length: frameCount }, (_, i) => renderArtwork(state, i / (state.activeClip.loop ? frameCount : frameCount - 1) * state.activeClip.duration).pixels);
    const sheet = composeSpritesheet(frames, state.canvasWidth, state.canvasHeight, columns);
    const target = path.join(path.dirname(state.paths.exportPng), "spritesheet_export.png");
    fsp.writeFile(target, encodeRgbaToPng(sheet.width, sheet.height, sheet.pixels))
      .then(() => { window.status_text = "Spritesheet exportada: 8 quadros, 4 colunas, fundo transparente."; })
      .catch((error: unknown) => { window.status_text = String(error); });
  }, "Exportando spritesheet...");

  // --- viewport mouse (usa controller + Setup/Animate + picking por ferramenta P1-8) ---
  const drag = state.viewportDrag;
  const viewportPoint = (x: number, y: number) => mapViewportPoint(
    state.viewportBuffer.width,
    state.viewportBuffer.height,
    window.viewport_width ?? state.viewportBuffer.width,
    window.viewport_height ?? state.viewportBuffer.height,
    x,
    y,
  );
  window.viewport_mouse_down = (x: number, y: number) => {
    const point = viewportPoint(x, y);
    if (!point?.inside) return;
    const { x: sx, y: sy } = point;
    drag.lastMouse = [sx, sy];
    drag.startMouse = [sx, sy];
    drag.startPan = { ...state.cameraPan };
    if (state.viewportMode === "2D") {
      const [wx, wy] = state.viewportBuffer.screenToWorld(sx, sy, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      const pinHit = pickScenePin(state, [wx, wy], 16 / Math.max(0.05, state.cameraZoom));
      const hit = pinHit ? { kind: "pin", id: pinHit } : pickEntity(state.showSkeleton ? state.joints : [], [], state.currentPose, wx, wy, state.activeTool, state.cameraZoom);
      if (hit.kind === "pin") {
        const pin = state.pins.find((p) => p.id === hit.id)!;
        state.selectedPinId = hit.id;
        const owner = [...state.meshLayer].find(([, meshId]) => meshId === pin.meshId)?.[0];
        if (owner) state.selectedLayerId = owner;
        syncSpriteControls(window, state);
        if (pin.locked) { window.status_text = "Pino âncora: desbloqueie para mover."; return; }
        state.isPlaying = false; window.is_playing = false;
        drag.beginPin(sx, sy, hit.id, state.cameraPan);
        state.history.push(`Arrastar Pino ${hit.id}`, state.joints, state.layers, state.currentPose, state.pins);
        if (performanceArmed) {
          performanceStart = Date.now();
          state.activeClip = createClip("gesture", "Gesto gravado", 4, 60, false);
          state.activeClipName = state.activeClip.name; state.timelineDuration = 4; state.timelineTime = 0;
          upsertPinKeyframe(state.activeClip, state.currentPose, 0);
        }
        syncSpriteControls(window, state);
        window.status_text = performanceArmed ? "Gravando gesto..." : "Pino selecionado.";
        return;
      }
      if (state.activeTool === "Pin" && state.editorMode === EditorMode.Setup && state.spriteAssets.size) {
        const layer = state.layers.find((l) => l.id === state.selectedLayerId);
        const image = layer ? state.spriteAssets.get(layer.asset) : undefined;
        const meshId = layer ? state.meshLayer.get(layer.id) : undefined;
        if (layer && image && meshId !== undefined && !layer.locked && layer.visible) {
          const matrix = layerMatrix(layer, state.joints, state.currentPose, boneMatrices(state.joints, state.currentPose));
          if (Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-10) return;
          let local = matApply(matInverse(matrix), [wx, wy]);
          if (local[0] >= 0 && local[1] >= 0 && local[0] < image.width && local[1] < image.height) {
            if (state.snapPins) local = nearestOpaquePoint(image, local[0], local[1], state.alphaThreshold) ?? local;
            runSpriteAction(() => {
              const pin = addPin(state, meshId, local[0], local[1]);
              state.selectedPinId = pin.id;
            }, "Pino criado.");
            return;
          }
        }
      }
      if (hit.kind === "joint") {
        state.isPlaying = false; window.is_playing = false;
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
  window.viewport_mouse_move = (x: number, y: number) => {
    if (drag.mode === "none") return;
    const point = viewportPoint(x, y);
    if (!point) return;
    const { x: sx, y: sy } = point;
    const dx = sx - drag.lastMouse[0];
    const dy = sy - drag.lastMouse[1];
    if (drag.mode === "pan") {
      if (state.viewportMode === "3D") {
        state.orbitCamera.yaw += dx * 0.01;
        state.orbitCamera.pitch = Math.max(-1.4, Math.min(1.4, state.orbitCamera.pitch - dy * 0.01));
      } else {
        state.cameraPan.x = drag.startPan.x + (sx - drag.startMouse[0]);
        state.cameraPan.y = drag.startPan.y + (sy - drag.startMouse[1]);
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
        const local = pinLocalPoint(state, pin, [wx, wy]);
        if (!local) return;
        if (state.editorMode === EditorMode.Setup) {
          const layer = state.layers.find((l) => state.meshLayer.get(l.id) === pin.meshId);
          const image = layer ? state.spriteAssets.get(layer.asset) : undefined;
          const snapped = state.snapPins && image ? nearestOpaquePoint(image, local[0], local[1], state.alphaThreshold) : local;
          if (snapped) movePinRest(state.pins, pin.id, snapped[0], snapped[1]);
        }
        else {
          state.currentPose.pins.set(pin.id, [local[0] - pin.x, local[1] - pin.y]);
          if (performanceStart !== null) {
            state.timelineTime = Math.min(4, (Date.now() - performanceStart) / 1000);
            upsertPinKeyframe(state.activeClip, state.currentPose, state.timelineTime);
            window.timeline_time = state.timelineTime;
          }
        }
      }
    }
    drag.lastMouse = [sx, sy];
  };
  window.viewport_mouse_up = () => {
    if (drag.mode === "pin" && state.editorMode === EditorMode.Animate) {
      state.timelineTime = Math.min(state.activeClip.duration, Math.round(state.timelineTime * state.activeClip.fps) / state.activeClip.fps);
      if (performanceStart !== null) state.timelineTime = Math.max(1 / state.activeClip.fps, state.timelineTime);
      upsertPinKeyframe(state.activeClip, state.currentPose, state.timelineTime);
    }
    if (performanceStart !== null) {
      state.activeClip.frames = state.activeClip.frames.filter((frame) => frame.time <= state.timelineTime);
      state.activeClip.duration = Math.max(1 / 60, state.timelineTime);
      state.timelineDuration = state.activeClip.duration;
      performanceStart = null; performanceArmed = false; window.performance_armed = false;
      window.status_text = "Gesto gravado em keyframes. Reproduza para conferir.";
    }
    drag.end(); syncSpriteControls(window, state);
  };
  window.viewport_scroll = (deltaY: number) => {
    const factor = deltaY > 0 ? 0.9 : 1.1;
    state.cameraZoom = Math.min(5.0, Math.max(0.05, state.cameraZoom * factor));
    window.zoom_level = state.cameraZoom;
  };
  window.zoom_in = () => {
    state.cameraZoom = Math.min(5.0, state.cameraZoom * 1.25);
    window.zoom_level = state.cameraZoom;
  };
  window.zoom_out = () => {
    state.cameraZoom = Math.max(0.05, state.cameraZoom * 0.8);
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
