/**
 * chocoBones rig actions (Item 5)
 */
import { generateId } from "../../core/ids";
import { findJoint, Joint } from "../../rig/joint";
import { jointAdd, jointRemove, rigCreatePreset, RigPreset } from "../../rig/presets";
import type { AppState } from "../store";

export function addJoint(state: AppState, name?: string): Joint | null {
  const parentId = state.selectedJointId || "root";
  const parent = findJoint(state.joints, parentId);
  const newJoint: Joint = {
    id: generateId("j"),
    name: name ?? `Junta ${state.joints.length + 1}`,
    parent: parentId,
    x: parent ? parent.x + 30 : 256,
    y: parent ? parent.y + 40 : 300,
    color: "#10b981",
  };
  state.history.push("Adicionar Junta", state.joints, state.layers, state.currentPose);
  if (!jointAdd(state.joints, newJoint)) return null;
  state.selectedJointId = newJoint.id;
  return newJoint;
}

export function removeJoint(state: AppState, id: string): boolean {
  if (id === "root") return false;
  state.history.push(`Remover Junta ${id}`, state.joints, state.layers, state.currentPose);
  const ok = jointRemove(state.joints, id);
  if (ok && state.selectedJointId === id) state.selectedJointId = "root";
  return ok;
}

export function applyRigPreset(state: AppState, presetName: string): void {
  let preset = RigPreset.Humanoid;
  if (presetName === "BipedSimple") preset = RigPreset.BipedSimple;
  else if (presetName === "Quadruped") preset = RigPreset.Quadruped;
  else if (presetName === "Prop") preset = RigPreset.Prop;
  state.history.push(`Preset: ${presetName}`, state.joints, state.layers, state.currentPose);
  state.joints = rigCreatePreset(preset);
  state.selectedJointId = state.joints[0]?.id ?? "root";
  state.currentPose.joints.clear();
}
