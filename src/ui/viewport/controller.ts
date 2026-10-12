/**
 * chocoBones viewport controller (Item 5 — extraído de bridge.ts)
 * Estado de arraste + picking + pan/orbit. Sem dependência Slint.
 */
import { matApply, vec2Dist } from "../../core/math";
import { boneMatrices } from "../../rig/fk";
import { solveIK } from "../../rig/ik";
import { findJoint, Joint, Pose } from "../../rig/joint";
import { EditorMode } from "../modes";

export type DragMode = "none" | "pan" | "joint" | "pin";

export class ViewportDrag {
  public mode: DragMode = "none";
  public jointId = "";
  public pinId = "";
  public startMouse: [number, number] = [0, 0];
  public startPan = { x: 0, y: 0 };
  public lastMouse: [number, number] = [0, 0];

  public beginPan(sx: number, sy: number, pan: { x: number; y: number }): void {
    this.mode = "pan";
    this.startMouse = [sx, sy];
    this.startPan = { ...pan };
    this.lastMouse = [sx, sy];
  }

  public beginJoint(sx: number, sy: number, jointId: string, pan: { x: number; y: number }): void {
    this.mode = "joint";
    this.jointId = jointId;
    this.pinId = "";
    this.startMouse = [sx, sy];
    this.startPan = { ...pan };
    this.lastMouse = [sx, sy];
  }

  public beginPin(sx: number, sy: number, pinId: string, pan: { x: number; y: number }): void {
    this.mode = "pin";
    this.pinId = pinId;
    this.jointId = "";
    this.startMouse = [sx, sy];
    this.startPan = { ...pan };
    this.lastMouse = [sx, sy];
  }

  public end(): void {
    this.mode = "none";
    this.jointId = "";
    this.pinId = "";
  }
}

export interface ViewportGeom {
  pan: { x: number; y: number };
  zoom: number;
  screenToWorld: (sx: number, sy: number, panX: number, panY: number, zoom: number) => [number, number];
}

/** Hit-test de juntas em mundo. Retorna id mais próximo dentro do raio. */
export function pickJoint(
  joints: readonly Joint[],
  pose: Pose | null,
  worldX: number,
  worldY: number,
  hitRadius: number
): string {
  const bones = boneMatrices(joints, pose);
  let closestId = "";
  let closestDist = Infinity;
  for (const j of joints) {
    const bMat = bones.get(j.id);
    if (!bMat) continue;
    const [jwX, jwY] = matApply(bMat, [0, 0]);
    const d = vec2Dist([jwX, jwY], [worldX, worldY]);
    if (d < closestDist) {
      closestDist = d;
      closestId = j.id;
    }
  }
  return closestDist <= hitRadius ? closestId : "";
}

/**
 * Aplica arrasto de junta respeitando Setup vs Animate (Item 2).
 * Setup: muta repouso j.x/y. Animate: escreve delta em pose (FK) ou IK.
 */
export function applyJointDrag(
  joints: readonly Joint[],
  pose: Pose,
  jointId: string,
  dxScreen: number,
  dyScreen: number,
  zoom: number,
  editorMode: EditorMode | string,
  ikEnabled: boolean,
  worldTarget: [number, number]
): void {
  const j = findJoint(joints as Joint[], jointId);
  if (!j) return;
  if (ikEnabled && editorMode !== EditorMode.Setup) {
    solveIK(joints, pose, jointId, worldTarget);
    return;
  }
  if (editorMode === EditorMode.Setup) {
    j.x += dxScreen / Math.max(0.2, zoom);
    j.y += dyScreen / Math.max(0.2, zoom);
  } else {
    const delta = pose.joints.get(jointId) ?? { angle: 0, x: 0, y: 0 };
    delta.x += dxScreen / Math.max(0.2, zoom);
    delta.y += dyScreen / Math.max(0.2, zoom);
    pose.joints.set(jointId, delta);
  }
}
