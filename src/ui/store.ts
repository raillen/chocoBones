/**
 * chocoBones store reativo (Item 5 — extraído de bridge.ts)
 * Estado único + criação inicial. Bridge compõe actions/viewport/loop.
 */
import * as fs from "fs";
import { OrbitCamera } from "../core/math3d";
import { createCubeMesh } from "../mesh3d/primitives";
import { Mesh3D, mesh3dNormalizeAndCenter } from "../mesh3d/mesh3d";
import { loadObjFromString } from "../mesh3d/obj_loader";
import { createPose, Joint, Layer, Pose } from "../rig/joint";
import { rigCreatePreset, RigPreset } from "../rig/presets";
import { createIdleClip } from "../animation/presets";
import { Clip } from "../animation/timeline";
import { HistoryStack } from "../history/history";
import { ViewportBuffer } from "../render/viewport_buffer";
import { Mesh, Pin, buildGridMesh, createPin } from "../mesh/mesh";
import { SpringChain, createSpringChain } from "../physics2d/spring";
import { FixedStepAccumulator } from "../animation/clock";
import { EditorMode } from "./modes";
import { SelectionState } from "./selection";
import { AppPaths, defaultAppPaths } from "./app_config";
import { ViewportDrag } from "./viewport/controller";

export interface AppState {
  themeMode: string;
  accentName: string;
  activeTool: string;
  elementTab: string;
  searchFilter: string;
  activeWorkspace: string;
  viewportMode: string;
  editorMode: EditorMode;
  isPlaying: boolean;
  timelineTime: number;
  timelineDuration: number;
  activeClipName: string;
  activeClip: Clip;
  joints: Joint[];
  layers: Layer[];
  selectedJointId: string;
  selectedLayerId: string;
  selectedPinId: string;
  selection: SelectionState;
  ikEnabled: boolean;
  cameraPan: { x: number; y: number };
  cameraZoom: number;
  orbitCamera: OrbitCamera;
  mesh3D: Mesh3D;
  viewportBuffer: ViewportBuffer;
  history: HistoryStack;
  currentPose: Pose;
  paths: AppPaths;
  viewportDrag: ViewportDrag;
  lastFrameMs: number;
  // P0-2: malhas 2D + pinos MLS por personagem (mesma fonte p/ preview e export)
  meshes: Mesh[];
  meshLayer: Map<string, string>; // layerId -> meshIdx
  pins: Pin[];
  // P0-6: física determinística (springs + acumulador fixed-step)
  springs: SpringChain[];
  springAcc: FixedStepAccumulator;
  springHz: number;
}

export function createInitialAppState(paths?: AppPaths): AppState {
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

  const resolvedPaths = paths ?? defaultAppPaths();
  let mesh3D: Mesh3D;
  if (fs.existsSync(resolvedPaths.suzanneObj)) {
    try {
      const content = fs.readFileSync(resolvedPaths.suzanneObj, "utf-8");
      const m = loadObjFromString(content, "Suzanne (Blender Monkey)");
      mesh3dNormalizeAndCenter(m, 2.2);
      mesh3D = m;
    } catch {
      mesh3D = createCubeMesh(1.8);
    }
  } else {
    mesh3D = createCubeMesh(1.8);
  }

  return {
    themeMode: "Dark",
    accentName: "Ciano",
    activeTool: "Move",
    elementTab: "Juntas",
    searchFilter: "",
    activeWorkspace: "Animacao",
    viewportMode: "2D",
    editorMode: EditorMode.Animate,
    isPlaying: true,
    timelineTime: 0.0,
    timelineDuration: 1.6,
    activeClipName: "idle",
    activeClip: createIdleClip(),
    joints: rigCreatePreset(RigPreset.Humanoid),
    layers: defaultLayers,
    selectedJointId: "root",
    selectedLayerId: "head_lyr",
    selectedPinId: "",
    selection: { selectedJointIds: ["root"], selectedLayerIds: ["head_lyr"], anchorLayerIdx: 0 },
    ikEnabled: false,
    cameraPan: { x: 104, y: -40 },
    cameraZoom: 1.0,
    orbitCamera: new OrbitCamera([0, 0, 0], 3.5, 0.45, 0.25),
    mesh3D,
    viewportBuffer: new ViewportBuffer(720, 500),
    history: new HistoryStack(50),
    currentPose: createPose(),
    paths: resolvedPaths,
    viewportDrag: new ViewportDrag(),
    lastFrameMs: 0,
    // P0-2: malha demo vinculada ao torso + 2 pinos (rest em Setup, offset em Animate)
    meshes: [buildGridMesh(120, 120, 4)],
    meshLayer: new Map([["torso_lyr", "0"]]),
    pins: [
      createPin("pin_a", "0", 20, 20, { name: "Pino A" }),
      createPin("pin_b", "0", 100, 100, { name: "Pino B" }),
    ],
    springs: [createSpringChain("tail_demo", ["tail"], { stiffness: 50, damping: 5, maxAngle: 0.5 })],
    springAcc: new FixedStepAccumulator(120),
    springHz: 120,
  };
}
