import type { AppState } from "./store";
import type { Mesh } from "../mesh/mesh";
import type { Clip } from "../animation/timeline";
import type { SpriteImage } from "../assets/image";
import type { Vec2 } from "../core/types";

interface EditorDocument {
  meshes: Mesh[];
  meshLayer: Map<string, string>;
  meshUvs: Map<string, Vec2[]>;
  spriteAssets: Map<string, SpriteImage>;
  clip: Clip;
  clipName: string;
  canvas: [number, number];
  time: number;
  playing: boolean;
  mode: AppState["editorMode"];
  camera: { pan: { x: number; y: number }; zoom: number };
  selection: { layer: string; pin: string; joint: string };
  meshSettings: [number, number, number, boolean, number];
}

export function captureEditorDocument(state: AppState): EditorDocument {
  return {
    meshes: structuredClone(state.meshes),
    meshLayer: new Map(state.meshLayer),
    meshUvs: structuredClone(state.meshUvs),
    // Imported images are immutable. History shares pixels instead of duplicating PNGs on every drag.
    spriteAssets: new Map(state.spriteAssets),
    clip: structuredClone(state.activeClip),
    clipName: state.activeClipName,
    canvas: [state.canvasWidth, state.canvasHeight],
    time: state.timelineTime,
    playing: state.isPlaying,
    mode: state.editorMode,
    camera: { pan: { ...state.cameraPan }, zoom: state.cameraZoom },
    selection: { layer: state.selectedLayerId, pin: state.selectedPinId, joint: state.selectedJointId },
    meshSettings: [state.meshRows, state.meshCols, state.alphaThreshold, state.refineEdges, state.edgeSize],
  };
}

export function restoreEditorDocument(state: AppState, value: unknown): void {
  const doc = value as EditorDocument;
  state.meshes = structuredClone(doc.meshes);
  state.meshLayer = new Map(doc.meshLayer);
  state.meshUvs = structuredClone(doc.meshUvs);
  state.spriteAssets = new Map(doc.spriteAssets);
  state.activeClip = structuredClone(doc.clip);
  state.activeClipName = doc.clipName;
  [state.canvasWidth, state.canvasHeight] = doc.canvas;
  state.timelineTime = doc.time;
  state.timelineDuration = doc.clip.duration;
  state.isPlaying = doc.playing;
  state.editorMode = doc.mode;
  state.cameraPan = { ...doc.camera.pan };
  state.cameraZoom = doc.camera.zoom;
  state.selectedLayerId = doc.selection.layer;
  state.selectedPinId = doc.selection.pin;
  state.selectedJointId = doc.selection.joint;
  state.selection.selectedLayerIds = state.layers.some((l) => l.id === doc.selection.layer) ? [doc.selection.layer] : [];
  state.selection.selectedJointIds = state.joints.some((j) => j.id === doc.selection.joint) ? [doc.selection.joint] : [];
  [state.meshRows, state.meshCols, state.alphaThreshold, state.refineEdges, state.edgeSize] = doc.meshSettings;
}
