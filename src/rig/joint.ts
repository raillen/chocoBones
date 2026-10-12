/**
 * chocoBones TypeScript Rigging - Joint and Pose Definitions
 */

import { SeamMask, Transform, Vec2 } from "../core/types";

export interface Joint {
  id: string;
  name: string;
  parent: string; // ID da junta pai ou "" se for raiz
  x: number;      // Posição de repouso absoluta X
  y: number;      // Posição de repouso absoluta Y
  color: string;
}

export interface JointDelta {
  angle: number; // Rotação em radianos
  x: number;     // Deslocamento X
  y: number;     // Deslocamento Y
}

export const JOINT_DELTA_ZERO: Readonly<JointDelta> = Object.freeze({
  angle: 0,
  x: 0,
  y: 0,
});

export interface LayerDelta {
  x: number;
  y: number;
  rotation: number;
  sx: number;
  sy: number;
  opacity: number;
  visible: boolean;
  asset: string;
}

export const LAYER_DELTA_IDENTITY: Readonly<LayerDelta> = Object.freeze({
  x: 0,
  y: 0,
  rotation: 0,
  sx: 1,
  sy: 1,
  opacity: 1,
  visible: true,
  asset: "",
});

export interface Layer {
  id: string;
  name: string;
  asset: string;
  transform: Transform;
  joint: string; // ID da junta vinculada ou ""
  visible: boolean;
  locked: boolean;
  opacity: number;
  hasSeamMask: boolean;
  seamMask: SeamMask;
}

export interface Pose {
  joints: Map<string, JointDelta>;
  layers: Map<string, LayerDelta>;
  pins: Map<string, Vec2>;
  params: Map<string, number>;
}

export function createPose(): Pose {
  return {
    joints: new Map<string, JointDelta>(),
    layers: new Map<string, LayerDelta>(),
    pins: new Map<string, Vec2>(),
    params: new Map<string, number>(),
  };
}

export function findJoint(joints: readonly Joint[], id: string): Joint | undefined {
  return joints.find((j) => j.id === id);
}
