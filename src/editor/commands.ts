/** Public, serializable editor commands used by Solid controls and keyboard shortcuts. */
import type { PinMotionPreset } from "../animation/pin_motion";
import type { Easing } from "../animation/timeline";
import type { SpriteDeformation } from "../mesh/mesh";

export type EditorPhase = "prepare" | "rig" | "animate";
export type EditorTool = "Move" | "Pin" | "Bone" | "Pan";
export type EditorCommand =
  | { type: "phase"; value: EditorPhase }
  | { type: "tool"; value: EditorTool }
  | { type: "new" }
  | { type: "demo"; preset?: string }
  | { type: "undo" | "redo" | "fit" | "reset-pose" | "play" | "stop" | "key-pose" | "auto-pins" | "rebuild-mesh" | "record-gesture" | "delete-selection" }
  | { type: "seek"; time: number }
  | { type: "zoom"; factor: number; anchor?: [number, number] }
  | { type: "viewport"; value: "2D" | "3D" }
  | { type: "theme"; value: "Dark" | "Dim" | "Light" }
  | { type: "select-layer"; id: string; extend?: boolean }
  | { type: "select-pin" | "select-joint"; id: string }
  | { type: "deformation"; value: SpriteDeformation }
  | { type: "canvas-settings"; width?: number; height?: number }
  | { type: "mesh-settings"; rows?: number; cols?: number; alphaThreshold?: number; refineEdges?: boolean; edgeSize?: number; strength?: number }
  | { type: "overlay"; name: "mesh" | "skeleton" | "onion" | "snap" | "ik"; value?: boolean }
  | { type: "motion-settings"; amplitude?: number; frequency?: number }
  | { type: "motion-preset"; value: PinMotionPreset }
  | { type: "clip-settings"; duration?: number; fps?: number; loop?: boolean; name?: string }
  | { type: "key-delete"; id: string }
  | { type: "key-move"; id: string; time: number }
  | { type: "key-easing"; id: string; value: Easing }
  | { type: "pin-add"; x: number; y: number; name?: string }
  | { type: "pin-delete" | "pin-lock" | "pin-reset"; id?: string }
  | { type: "pin-properties"; id?: string; name?: string; enabled?: boolean; locked?: boolean; radius?: number; falloff?: number; strength?: number; x?: number; y?: number }
  | { type: "layer-add" }
  | { type: "layer-delete"; id?: string }
  | { type: "layer-order"; id?: string; direction: 1 | -1 }
  | { type: "layer-properties"; id?: string; name?: string; visible?: boolean; locked?: boolean; opacity?: number; joint?: string; x?: number; y?: number; rotation?: number; sx?: number; sy?: number; px?: number; py?: number }
  | { type: "joint-add"; name?: string }
  | { type: "joint-delete"; id?: string }
  | { type: "rig-preset"; value: string }
  | { type: "joint-properties"; id?: string; name?: string; parent?: string; x?: number; y?: number; angle?: number };
