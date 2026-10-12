/**
 * chocoBones TypeScript Slint Desktop Bridge
 * Liga o motor reativo da aplicação à interface de usuário compilada no Slint.
 */

import * as slint from "slint-ui";
import * as fs from "fs";
import * as path from "path";
import { matApply, vec2Dist } from "../core/math";
import { OrbitCamera } from "../core/math3d";
import { createCubeMesh } from "../mesh3d/primitives";
import { Mesh3D } from "../mesh3d/mesh3d";
import { createPose, findJoint, Joint, Layer, Pose } from "../rig/joint";
import {
  jointAdd,
  jointRemove,
  rigCreatePreset,
  RigPreset,
} from "../rig/presets";
import { boneMatrices } from "../rig/fk";
import { solveIK } from "../rig/ik";
import { createIdleClip, createWalkClip } from "../animation/presets";
import { Clip, sampleClip } from "../animation/timeline";
import { HistoryStack } from "../history/history";
import {
  loadProjectFromJson,
  Project,
  saveProjectToJson,
} from "../project/project";
import { ViewportBuffer } from "../render/viewport_buffer";
import { encodeRgbaToPng } from "../render/png_export";

export interface AppState {
  activeWorkspace: string;
  viewportMode: string;
  isPlaying: boolean;
  timelineTime: number;
  timelineDuration: number;
  activeClipName: string;
  activeClip: Clip;
  joints: Joint[];
  layers: Layer[];
  selectedJointId: string;
  selectedLayerId: string;
  ikEnabled: boolean;
  cameraPan: { x: number; y: number };
  cameraZoom: number;
  orbitCamera: OrbitCamera;
  cubeMesh: Mesh3D;
  viewportBuffer: ViewportBuffer;
  history: HistoryStack;
  currentPose: Pose;
}

export function createInitialAppState(): AppState {
  const defaultLayers: Layer[] = [
    {
      id: "head_lyr",
      name: "Cabeça / Rosto",
      asset: "head.png",
      transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
      joint: "head",
      visible: true,
      locked: false,
      opacity: 1.0,
      hasSeamMask: false,
      seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    },
    {
      id: "torso_lyr",
      name: "Tronco / Peito",
      asset: "torso.png",
      transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
      joint: "root",
      visible: true,
      locked: false,
      opacity: 1.0,
      hasSeamMask: false,
      seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    },
    {
      id: "arm_l_lyr",
      name: "Braço Próximo",
      asset: "arm_near.png",
      transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
      joint: "forearm_near",
      visible: true,
      locked: false,
      opacity: 1.0,
      hasSeamMask: false,
      seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    },
    {
      id: "arm_r_lyr",
      name: "Braço Distante",
      asset: "arm_far.png",
      transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
      joint: "forearm_far",
      visible: true,
      locked: false,
      opacity: 1.0,
      hasSeamMask: false,
      seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    },
    {
      id: "leg_l_lyr",
      name: "Perna Próxima",
      asset: "leg_near.png",
      transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
      joint: "shin_near",
      visible: true,
      locked: false,
      opacity: 1.0,
      hasSeamMask: false,
      seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    },
    {
      id: "leg_r_lyr",
      name: "Perna Distante",
      asset: "leg_far.png",
      transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] },
      joint: "shin_far",
      visible: true,
      locked: false,
      opacity: 1.0,
      hasSeamMask: false,
      seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    },
  ];

  return {
    activeWorkspace: "Animacao",
    viewportMode: "2D",
    isPlaying: true,
    timelineTime: 0.0,
    timelineDuration: 1.6,
    activeClipName: "idle",
    activeClip: createIdleClip(),
    joints: rigCreatePreset(RigPreset.Humanoid),
    layers: defaultLayers,
    selectedJointId: "root",
    selectedLayerId: "head_lyr",
    ikEnabled: false,
    cameraPan: { x: 104, y: -40 },
    cameraZoom: 1.0,
    orbitCamera: new OrbitCamera([0, 0, 0], 3.8, 0.4, 0.25),
    cubeMesh: createCubeMesh(1.8),
    viewportBuffer: new ViewportBuffer(720, 500),
    history: new HistoryStack(50),
    currentPose: createPose(),
  };
}

function syncJointsList(window: any, state: AppState): void {
  const rows = state.joints.map((j) => ({
    id: j.id,
    name: j.name,
    parent: j.parent,
    color: j.color,
  }));
  window.joints_list = new slint.ArrayModel(rows);
}

function syncLayersList(window: any, state: AppState): void {
  const rows = state.layers.map((l) => ({
    id: l.id,
    name: l.name,
    joint: l.joint,
    visible: l.visible,
    locked: l.locked,
    opacity: l.opacity,
  }));
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

export function bindSlintWindow(window: any, state: AppState): () => void {
  // Inicialização de Propriedades Reativas
  window.active_workspace = state.activeWorkspace;
  window.viewport_mode = state.viewportMode;
  window.status_text = "🦴 chocoBones Desktop — Pronto (Node + pnpm + Slint + WebGPU)";
  window.zoom_level = state.cameraZoom;
  window.timeline_duration = state.timelineDuration;
  window.timeline_time = state.timelineTime;
  window.is_playing = state.isPlaying;
  window.active_clip_name = state.activeClipName;
  window.ik_enabled = state.ikEnabled;

  syncJointsList(window, state);
  syncLayersList(window, state);
  syncSelectedJoint(window, state);
  syncSelectedLayer(window, state);

  // Histórico inicial
  state.history.push("Estado Inicial", state.joints, state.layers, state.currentPose);

  // Variáveis de Estado de Arraste da Viewport
  let dragMode: "none" | "pan" | "joint" = "none";
  let dragJointId = "";
  let dragStartMouse: [number, number] = [0, 0];
  let dragStartPan = { x: 0, y: 0 };
  let lastMouse: [number, number] = [0, 0];

  // ---------------------------------------------------------------------------
  // CALLBACKS DE ESPAÇOS, PROJETO E FERRAMENTAS
  // ---------------------------------------------------------------------------
  window.change_workspace = (ws: string) => {
    state.activeWorkspace = ws;
    window.active_workspace = ws;
    window.status_text = `Espaço de trabalho: ${ws}`;
  };

  window.set_viewport_mode = (mode: string) => {
    state.viewportMode = mode;
    window.viewport_mode = mode;
    window.status_text = `Modo da Viewport: ${mode}`;
  };

  window.undo = () => {
    const desc = state.history.undo(state.joints, state.layers, state.currentPose);
    if (desc) {
      syncJointsList(window, state);
      syncLayersList(window, state);
      syncSelectedJoint(window, state);
      window.status_text = `Desfazer: ${desc}`;
    } else {
      window.status_text = "Nenhuma ação anterior para desfazer.";
    }
  };

  window.redo = () => {
    const desc = state.history.redo(state.joints, state.layers, state.currentPose);
    if (desc) {
      syncJointsList(window, state);
      syncLayersList(window, state);
      syncSelectedJoint(window, state);
      window.status_text = `Refazer: ${desc}`;
    } else {
      window.status_text = "Nenhuma ação para refazer.";
    }
  };

  window.new_project = () => {
    state.history.push("Novo Projeto", state.joints, state.layers, state.currentPose);
    state.joints = rigCreatePreset(RigPreset.Humanoid);
    state.selectedJointId = "root";
    state.currentPose.joints.clear();
    state.cameraPan = { x: 104, y: -40 };
    state.cameraZoom = 1.0;
    window.zoom_level = 1.0;
    syncJointsList(window, state);
    syncSelectedJoint(window, state);
    window.status_text = "Novo projeto iniciado com rig Humanoide.";
  };

  window.save_project = () => {
    try {
      const proj: Project = {
        schema: "survivor-puppet",
        version: 1,
        name: "chocoBones Puppet",
        width: 512,
        height: 512,
        assets: [],
        joints: state.joints.map((j) => ({
          id: j.id,
          name: j.name,
          parent: j.parent,
          x: j.x,
          y: j.y,
          color: j.color,
        })),
        layers: state.layers.map((l) => ({
          id: l.id,
          name: l.name,
          asset: l.asset,
          transform: {
            x: l.transform.pos[0],
            y: l.transform.pos[1],
            rotation: l.transform.rotation,
            sx: l.transform.scale[0],
            sy: l.transform.scale[1],
            px: l.transform.pivot[0],
            py: l.transform.pivot[1],
          },
          joint: l.joint,
          visible: l.visible,
          locked: l.locked,
          opacity: l.opacity,
          blend: "normal",
          seamMask: {
            layer: l.seamMask.layer ?? "",
            enabled: l.seamMask.enabled,
            center: { x: l.seamMask.center[0], y: l.seamMask.center[1] },
            radius: l.seamMask.radius,
            feather: l.seamMask.feather,
          },
        })),
      };

      const jsonStr = saveProjectToJson(proj);
      const filePath = path.resolve(process.cwd(), "choco_puppet.project.json");
      fs.writeFileSync(filePath, jsonStr, "utf-8");
      window.status_text = `Projeto salvo com sucesso em: ${path.basename(filePath)}`;
    } catch (err: any) {
      window.status_text = `Erro ao salvar projeto: ${err?.message ?? String(err)}`;
    }
  };

  window.load_project = () => {
    try {
      const filePath = path.resolve(process.cwd(), "choco_puppet.project.json");
      if (!fs.existsSync(filePath)) {
        window.status_text = "Arquivo choco_puppet.project.json não encontrado para carregar.";
        return;
      }
      state.history.push("Carregar Projeto", state.joints, state.layers, state.currentPose);
      const jsonStr = fs.readFileSync(filePath, "utf-8");
      const proj = loadProjectFromJson(jsonStr);

      state.joints = proj.joints.map((j) => ({
        id: j.id,
        name: j.name,
        parent: j.parent,
        x: j.x,
        y: j.y,
        color: j.color,
      }));

      state.layers = proj.layers.map((l) => ({
        id: l.id,
        name: l.name,
        asset: l.asset,
        transform: {
          pos: [l.transform.x, l.transform.y],
          scale: [l.transform.sx, l.transform.sy],
          rotation: l.transform.rotation,
          pivot: [l.transform.px, l.transform.py],
        },
        joint: l.joint,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        hasSeamMask: l.seamMask.enabled,
        seamMask: {
          layer: l.seamMask.layer,
          enabled: l.seamMask.enabled,
          center: [l.seamMask.center.x, l.seamMask.center.y],
          radius: l.seamMask.radius,
          feather: l.seamMask.feather,
        },
      }));

      state.selectedJointId = state.joints[0]?.id ?? "root";
      syncJointsList(window, state);
      syncLayersList(window, state);
      syncSelectedJoint(window, state);
      window.status_text = "Projeto carregado com sucesso!";
    } catch (err: any) {
      window.status_text = `Erro ao carregar projeto: ${err?.message ?? String(err)}`;
    }
  };

  window.export_png = () => {
    try {
      const pngBuffer = encodeRgbaToPng(
        state.viewportBuffer.width,
        state.viewportBuffer.height,
        state.viewportBuffer.pixels
      );
      const filePath = path.resolve(process.cwd(), "screenshot_export.png");
      fs.writeFileSync(filePath, pngBuffer);
      window.status_text = `📸 Frame exportado com sucesso: ${path.basename(filePath)}`;
    } catch (err: any) {
      window.status_text = `Erro ao exportar PNG: ${err?.message ?? String(err)}`;
    }
  };

  // ---------------------------------------------------------------------------
  // CALLBACKS DE JUNTAS E RIG
  // ---------------------------------------------------------------------------
  window.select_joint = (id: string) => {
    state.selectedJointId = id;
    syncSelectedJoint(window, state);
    const j = findJoint(state.joints, id);
    if (j) window.status_text = `Junta selecionada: ${j.name} (${j.id})`;
  };

  window.add_joint = () => {
    state.history.push("Adicionar Junta", state.joints, state.layers, state.currentPose);
    const parentId = state.selectedJointId || "root";
    const parentJoint = findJoint(state.joints, parentId);
    const px = parentJoint ? parentJoint.x + 30 : 256;
    const py = parentJoint ? parentJoint.y + 40 : 300;

    const newId = `j_${Date.now().toString().slice(-4)}`;
    const newJoint: Joint = {
      id: newId,
      name: `Junta ${state.joints.length + 1}`,
      parent: parentId,
      x: px,
      y: py,
      color: "#10b981",
    };

    if (jointAdd(state.joints, newJoint)) {
      state.selectedJointId = newId;
      syncJointsList(window, state);
      syncSelectedJoint(window, state);
      window.status_text = `Nova junta criada: ${newJoint.name}`;
    }
  };

  window.remove_joint = (id: string) => {
    if (id === "root") {
      window.status_text = "A junta raiz (root) não pode ser removida.";
      return;
    }
    state.history.push(`Remover Junta ${id}`, state.joints, state.layers, state.currentPose);
    jointRemove(state.joints, id);
    state.selectedJointId = "root";
    syncJointsList(window, state);
    syncSelectedJoint(window, state);
    window.status_text = `Junta ${id} removida com sucesso.`;
  };

  window.update_joint_pos = (id: string, dx: number, dy: number) => {
    const j = findJoint(state.joints, id);
    if (!j) return;
    state.history.push(`Mover Junta ${j.name}`, state.joints, state.layers, state.currentPose);
    j.x += dx;
    j.y += dy;
    syncSelectedJoint(window, state);
    window.status_text = `${j.name}: posição (${Math.round(j.x)}, ${Math.round(j.y)})`;
  };

  window.update_joint_angle = (id: string, dAngle: number) => {
    const j = findJoint(state.joints, id);
    if (!j) return;
    state.history.push(`Girar Junta ${j.name}`, state.joints, state.layers, state.currentPose);

    const delta = state.currentPose.joints.get(id) ?? { angle: 0, x: 0, y: 0 };
    delta.angle += dAngle;
    state.currentPose.joints.set(id, delta);
    syncSelectedJoint(window, state);
    window.status_text = `${j.name}: ângulo ${Math.round(delta.angle * 57.2958)}°`;
  };

  window.set_rig_preset = (presetName: string) => {
    let preset: RigPreset;
    switch (presetName) {
      case "BipedSimple":
        preset = RigPreset.BipedSimple;
        break;
      case "Quadruped":
        preset = RigPreset.Quadruped;
        break;
      case "Prop":
        preset = RigPreset.Prop;
        break;
      default:
        preset = RigPreset.Humanoid;
    }

    state.history.push(`Preset: ${presetName}`, state.joints, state.layers, state.currentPose);
    state.joints = rigCreatePreset(preset);
    state.selectedJointId = state.joints[0]?.id ?? "root";
    state.currentPose.joints.clear();
    syncJointsList(window, state);
    syncSelectedJoint(window, state);
    window.status_text = `Preset de esqueleto aplicado: ${presetName}`;
  };

  window.toggle_ik = () => {
    state.ikEnabled = !state.ikEnabled;
    window.ik_enabled = state.ikEnabled;
    window.status_text = state.ikEnabled
      ? "Cinemática Inversa (IK) ATIVADA — Arraste as extremidades para deformar o membro"
      : "Cinemática Direta (FK) ATIVADA";
  };

  // ---------------------------------------------------------------------------
  // CALLBACKS DE CAMADAS E SPRITES
  // ---------------------------------------------------------------------------
  window.select_layer = (id: string) => {
    state.selectedLayerId = id;
    syncSelectedLayer(window, state);
    const lyr = state.layers.find((l) => l.id === id);
    if (lyr) window.status_text = `Camada selecionada: ${lyr.name}`;
  };

  window.add_layer = () => {
    state.history.push("Adicionar Camada", state.joints, state.layers, state.currentPose);
    const lyrId = `layer_${Date.now().toString().slice(-4)}`;
    const newLyr: Layer = {
      id: lyrId,
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
    state.layers.push(newLyr);
    state.selectedLayerId = lyrId;
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    window.status_text = `Camada criada: ${newLyr.name}`;
  };

  window.remove_layer = (id: string) => {
    state.history.push(`Remover Camada ${id}`, state.joints, state.layers, state.currentPose);
    state.layers = state.layers.filter((l) => l.id !== id);
    state.selectedLayerId = state.layers[0]?.id ?? "";
    syncLayersList(window, state);
    syncSelectedLayer(window, state);
    window.status_text = "Camada removida.";
  };

  window.toggle_layer_visibility = (id: string) => {
    const lyr = state.layers.find((l) => l.id === id);
    if (lyr) {
      lyr.visible = !lyr.visible;
      syncLayersList(window, state);
      window.status_text = `${lyr.name}: ${lyr.visible ? "Visível" : "Oculto"}`;
    }
  };

  window.update_layer_opacity = (id: string, opacity: number) => {
    const lyr = state.layers.find((l) => l.id === id);
    if (lyr) {
      lyr.opacity = Math.max(0, Math.min(1, opacity));
      syncLayersList(window, state);
      syncSelectedLayer(window, state);
    }
  };

  // ---------------------------------------------------------------------------
  // CALLBACKS DE ANIMAÇÃO E TIMELINE
  // ---------------------------------------------------------------------------
  window.toggle_play = () => {
    state.isPlaying = !state.isPlaying;
    window.is_playing = state.isPlaying;
    window.status_text = state.isPlaying ? "Reprodução iniciada." : "Reprodução pausada.";
  };

  window.timeline_seek = (time: number) => {
    state.timelineTime = Math.max(0, Math.min(state.timelineDuration, time));
    window.timeline_time = state.timelineTime;
  };

  window.select_clip = (clipName: string) => {
    state.activeClipName = clipName;
    window.active_clip_name = clipName;
    if (clipName === "walk") {
      state.activeClip = createWalkClip();
    } else {
      state.activeClip = createIdleClip();
    }
    state.timelineDuration = state.activeClip.duration;
    window.timeline_duration = state.timelineDuration;
    state.timelineTime = 0.0;
    window.timeline_time = 0.0;
    window.status_text = `Clipe ativo: ${state.activeClip.name}`;
  };

  window.reset_to_rest = () => {
    state.isPlaying = false;
    window.is_playing = false;
    state.timelineTime = 0.0;
    window.timeline_time = 0.0;
    state.currentPose.joints.clear();
    syncSelectedJoint(window, state);
    window.status_text = "Pose de repouso restaurada.";
  };

  // ---------------------------------------------------------------------------
  // CALLBACKS DE INTERAÇÃO DO MOUSE COM A VIEWPORT
  // ---------------------------------------------------------------------------
  window.viewport_mouse_down = (sx: number, sy: number) => {
    lastMouse = [sx, sy];
    dragStartMouse = [sx, sy];
    dragStartPan = { ...state.cameraPan };

    // Hit test em 2D para juntas
    if (state.viewportMode === "2D") {
      const [wx, wy] = state.viewportBuffer.screenToWorld(
        sx,
        sy,
        state.cameraPan.x,
        state.cameraPan.y,
        state.cameraZoom
      );

      const bones = boneMatrices(state.joints, state.currentPose);
      let closestId = "";
      let closestDist = Infinity;

      for (const j of state.joints) {
        const bMat = bones.get(j.id);
        if (!bMat) continue;
        const [jwX, jwY] = matApply(bMat, [0, 0]);
        const d = vec2Dist([jwX, jwY], [wx, wy]);
        if (d < closestDist) {
          closestDist = d;
          closestId = j.id;
        }
      }

      const hitRadius = Math.max(16, 20 / state.cameraZoom);
      if (closestDist <= hitRadius && closestId !== "") {
        dragMode = "joint";
        dragJointId = closestId;
        state.selectedJointId = closestId;
        syncSelectedJoint(window, state);
        state.history.push(`Arrastar Junta ${closestId}`, state.joints, state.layers, state.currentPose);
        const hitJoint = findJoint(state.joints, closestId);
        window.status_text = `Junta selecionada: ${hitJoint?.name ?? closestId}`;
        return;
      }
    }

    // Clique no fundo vazio: inicia pan ou rotação da câmera
    dragMode = "pan";
  };

  window.viewport_mouse_move = (sx: number, sy: number) => {
    const dx = sx - lastMouse[0];
    const dy = sy - lastMouse[1];

    if (dragMode === "pan") {
      if (state.viewportMode === "3D") {
        state.orbitCamera.yaw += dx * 0.01;
        state.orbitCamera.pitch = Math.max(-1.4, Math.min(1.4, state.orbitCamera.pitch - dy * 0.01));
      } else {
        state.cameraPan.x = dragStartPan.x + (sx - dragStartMouse[0]) / state.cameraZoom;
        state.cameraPan.y = dragStartPan.y + (sy - dragStartMouse[1]) / state.cameraZoom;
      }
    } else if (dragMode === "joint") {
      const [wx, wy] = state.viewportBuffer.screenToWorld(
        sx,
        sy,
        state.cameraPan.x,
        state.cameraPan.y,
        state.cameraZoom
      );

      if (state.ikEnabled) {
        // Cinemática Inversa (IK)
        solveIK(state.joints, state.currentPose, dragJointId, [wx, wy]);
      } else {
        // Cinemática Direta (FK) — Move posição rest ou ajusta junta
        const j = findJoint(state.joints, dragJointId);
        if (j) {
          j.x += dx / state.cameraZoom;
          j.y += dy / state.cameraZoom;
          syncSelectedJoint(window, state);
        }
      }
    }

    lastMouse = [sx, sy];
  };

  window.viewport_mouse_up = (_sx: number, _sy: number) => {
    dragMode = "none";
    dragJointId = "";
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
    window.status_text = "Visualização da câmera resetada.";
  };

  // ---------------------------------------------------------------------------
  // LOOP DE RENDERIZAÇÃO E AMOSTRAGEM A 60 FPS
  // ---------------------------------------------------------------------------
  const intervalId = setInterval(() => {
    if (state.isPlaying) {
      state.timelineTime += 1 / 60;
      if (state.timelineTime >= state.timelineDuration) {
        state.timelineTime = 0;
      }
      window.timeline_time = state.timelineTime;

      // Amostra clipe ativo se estiver reproduzindo
      sampleClip(state.activeClip, state.timelineTime, state.currentPose);

      if (state.viewportMode === "3D") {
        state.orbitCamera.yaw += 0.005; // Rotação sutil da câmera 3D
      }
    }

    // Calcula FK
    const bones = boneMatrices(state.joints, state.currentPose);

    // Rasterização no Buffer
    const buf = state.viewportBuffer;
    buf.clear(18, 18, 20);

    if (state.viewportMode === "2D") {
      buf.drawGrid(32, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      buf.renderLayers(
        state.layers,
        bones,
        state.selectedLayerId,
        state.cameraPan.x,
        state.cameraPan.y,
        state.cameraZoom
      );
      buf.renderSkeleton(
        state.joints,
        bones,
        state.selectedJointId,
        state.cameraPan.x,
        state.cameraPan.y,
        state.cameraZoom
      );
    } else {
      // Palco 3D
      buf.drawGrid(40, 0, 0, 1.0, 24, 24, 30);
      buf.render3D(state.cubeMesh, state.orbitCamera);
    }

    // Envia imagem atualizada para o elemento Image do Slint
    try {
      const SlintImageData = (slint as any).private_api?.SlintImageData;
      if (SlintImageData) {
        window.viewport_frame = new SlintImageData(
          buf.width,
          buf.height,
          Buffer.from(buf.pixels.buffer, buf.pixels.byteOffset, buf.pixels.byteLength)
        );
      }
    } catch {
      // Ignora erro se a janela foi fechada pelo usuário
    }
  }, 1000 / 60);

  return () => clearInterval(intervalId);
}
