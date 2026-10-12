/**
 * chocoBones TypeScript Rigging - Presets, Hierarchy Management & Heuristics
 */

import { findJoint, Joint, Layer, Pose } from "./joint";

export enum RigPreset {
  Humanoid = "Humanoid",
  BipedSimple = "BipedSimple",
  Quadruped = "Quadruped",
  Prop = "Prop",
  Empty = "Empty",
}

export function jointFindIndex(joints: readonly Joint[], id: string): number {
  return joints.findIndex((j) => j.id === id);
}

export function jointIsDescendant(
  joints: readonly Joint[],
  candidateId: string,
  ancestorId: string
): boolean {
  if (candidateId === "" || ancestorId === "") return false;
  let curr = candidateId;
  let visitedCount = 0;
  const maxDepth = joints.length;

  while (curr !== "" && visitedCount <= maxDepth) {
    const idx = jointFindIndex(joints, curr);
    if (idx < 0) break;
    const parent = joints[idx]!.parent;
    if (parent === ancestorId) return true;
    curr = parent;
    visitedCount++;
  }
  return false;
}

export function jointHasCycle(joints: readonly Joint[]): boolean {
  for (const j of joints) {
    let curr = j.parent;
    let visited = 0;
    while (curr !== "" && visited <= joints.length) {
      if (curr === j.id) return true;
      const pIdx = jointFindIndex(joints, curr);
      if (pIdx < 0) break;
      curr = joints[pIdx]!.parent;
      visited++;
    }
    if (visited > joints.length) return true;
  }
  return false;
}

export function jointAdd(joints: Joint[], joint: Joint): boolean {
  if (joint.id === "") return false;
  if (jointFindIndex(joints, joint.id) >= 0) return false;

  if (joint.parent !== "" && jointFindIndex(joints, joint.parent) < 0) {
    return false;
  }

  joints.push(joint);
  if (jointHasCycle(joints)) {
    joints.pop();
    return false;
  }
  return true;
}

export function jointRemove(
  joints: Joint[],
  id: string,
  reparentTo: string = ""
): boolean {
  const idx = jointFindIndex(joints, id);
  if (idx < 0) return false;

  const removedParent = joints[idx]!.parent;
  let targetParent = reparentTo !== "" ? reparentTo : removedParent;

  if (
    targetParent === id ||
    (targetParent !== "" && jointFindIndex(joints, targetParent) < 0)
  ) {
    targetParent = "";
  }

  for (const j of joints) {
    if (j.parent === id) {
      j.parent = targetParent;
    }
  }

  joints.splice(idx, 1);
  return true;
}

export function jointSetParent(
  joints: Joint[],
  id: string,
  newParent: string
): boolean {
  const idx = jointFindIndex(joints, id);
  if (idx < 0) return false;
  if (newParent === id) return false;

  if (newParent !== "") {
    if (jointFindIndex(joints, newParent) < 0) return false;
    if (jointIsDescendant(joints, newParent, id)) return false;
  }

  const oldParent = joints[idx]!.parent;
  joints[idx]!.parent = newParent;

  if (jointHasCycle(joints)) {
    joints[idx]!.parent = oldParent;
    return false;
  }
  return true;
}

export function jointRename(
  joints: Joint[],
  oldId: string,
  newId: string,
  newName: string,
  layers?: Layer[],
  pose?: Pose
): boolean {
  const idx = jointFindIndex(joints, oldId);
  if (idx < 0) return false;

  if (newId !== oldId && newId !== "") {
    if (jointFindIndex(joints, newId) >= 0) return false;
  }

  const finalId = newId !== "" ? newId : oldId;
  const finalName = newName !== "" ? newName : joints[idx]!.name;

  joints[idx]!.id = finalId;
  joints[idx]!.name = finalName;

  if (finalId !== oldId) {
    for (const j of joints) {
      if (j.parent === oldId) {
        j.parent = finalId;
      }
    }

    if (layers) {
      for (const l of layers) {
        if (l.joint === oldId) {
          l.joint = finalId;
        }
      }
    }

    if (pose) {
      const delta = pose.joints.get(oldId);
      if (delta) {
        pose.joints.delete(oldId);
        pose.joints.set(finalId, delta);
      }
    }
  }

  return true;
}

export function rigCreatePreset(preset: RigPreset): Joint[] {
  switch (preset) {
    case RigPreset.Humanoid:
      return [
        { id: "root", name: "Centro / quadril", parent: "", x: 256, y: 300, color: "#eab308" },
        { id: "head", name: "Pescoço / cabeça", parent: "root", x: 256, y: 210, color: "#3b82f6" },
        { id: "upper_arm_near", name: "Ombro próximo", parent: "root", x: 220, y: 216, color: "#10b981" },
        { id: "forearm_near", name: "Cotovelo próximo", parent: "upper_arm_near", x: 195, y: 256, color: "#10b981" },
        { id: "hand_near", name: "Punho próximo", parent: "forearm_near", x: 175, y: 295, color: "#10b981" },
        { id: "upper_arm_far", name: "Ombro distante", parent: "root", x: 294, y: 216, color: "#6366f1" },
        { id: "forearm_far", name: "Cotovelo distante", parent: "upper_arm_far", x: 315, y: 256, color: "#6366f1" },
        { id: "hand_far", name: "Punho distante", parent: "forearm_far", x: 335, y: 295, color: "#6366f1" },
        { id: "thigh_near", name: "Quadril próximo", parent: "root", x: 239, y: 302, color: "#f97316" },
        { id: "shin_near", name: "Joelho próximo", parent: "thigh_near", x: 239, y: 360, color: "#f97316" },
        { id: "foot_near", name: "Tornozelo próximo", parent: "shin_near", x: 239, y: 420, color: "#f97316" },
        { id: "thigh_far", name: "Quadril distante", parent: "root", x: 278, y: 302, color: "#ec4899" },
        { id: "shin_far", name: "Joelho distante", parent: "thigh_far", x: 278, y: 360, color: "#ec4899" },
        { id: "foot_far", name: "Tornozelo distante", parent: "shin_far", x: 278, y: 420, color: "#ec4899" },
      ];

    case RigPreset.BipedSimple:
      return [
        { id: "root", name: "Tronco / Raiz", parent: "", x: 256, y: 290, color: "#eab308" },
        { id: "head", name: "Cabeça", parent: "root", x: 256, y: 200, color: "#3b82f6" },
        { id: "arm_l", name: "Braço Esquerdo", parent: "root", x: 210, y: 220, color: "#10b981" },
        { id: "hand_l", name: "Mão Esquerda", parent: "arm_l", x: 180, y: 280, color: "#10b981" },
        { id: "arm_r", name: "Braço Direito", parent: "root", x: 302, y: 220, color: "#6366f1" },
        { id: "hand_r", name: "Mão Direita", parent: "arm_r", x: 332, y: 280, color: "#6366f1" },
        { id: "leg_l", name: "Perna Esquerda", parent: "root", x: 230, y: 360, color: "#f97316" },
        { id: "leg_r", name: "Perna Direita", parent: "root", x: 282, y: 360, color: "#ec4899" },
      ];

    case RigPreset.Quadruped:
      return [
        { id: "spine_root", name: "Coluna / Centro", parent: "", x: 256, y: 280, color: "#eab308" },
        { id: "chest", name: "Peito", parent: "spine_root", x: 200, y: 270, color: "#f59e0b" },
        { id: "neck", name: "Pescoço", parent: "chest", x: 170, y: 230, color: "#3b82f6" },
        { id: "head", name: "Cabeça", parent: "neck", x: 150, y: 200, color: "#3b82f6" },
        { id: "leg_fl", name: "Pata Diant. Esq.", parent: "chest", x: 190, y: 330, color: "#10b981" },
        { id: "paw_fl", name: "Pé Diant. Esq.", parent: "leg_fl", x: 190, y: 380, color: "#10b981" },
        { id: "leg_fr", name: "Pata Diant. Dir.", parent: "chest", x: 210, y: 330, color: "#06b6d4" },
        { id: "paw_fr", name: "Pé Diant. Dir.", parent: "leg_fr", x: 210, y: 380, color: "#06b6d4" },
        { id: "pelvis_rear", name: "Pélvis Traseira", parent: "spine_root", x: 310, y: 280, color: "#f97316" },
        { id: "leg_bl", name: "Pata Tras. Esq.", parent: "pelvis_rear", x: 310, y: 335, color: "#ec4899" },
        { id: "paw_bl", name: "Pé Tras. Esq.", parent: "leg_bl", x: 310, y: 385, color: "#ec4899" },
        { id: "leg_br", name: "Pata Tras. Dir.", parent: "pelvis_rear", x: 330, y: 335, color: "#8b5cf6" },
        { id: "paw_br", name: "Pé Tras. Dir.", parent: "leg_br", x: 330, y: 385, color: "#8b5cf6" },
        { id: "tail", name: "Cauda", parent: "pelvis_rear", x: 360, y: 270, color: "#64748b" },
      ];

    case RigPreset.Prop:
      return [
        { id: "root", name: "Pivô Central", parent: "", x: 256, y: 256, color: "#eab308" },
        { id: "grip_socket", name: "Socket / Empunhadura", parent: "root", x: 256, y: 320, color: "#10b981" },
      ];

    case RigPreset.Empty:
    default:
      return [];
  }
}

export function autoGuessJointForLayer(joints: readonly Joint[], layerName: string): string {
  const lower = layerName.toLowerCase();
  if (lower.includes("head") || lower.includes("cabeca")) {
    if (findJoint(joints, "head")) return "head";
  }

  if (lower.includes("forearm_r") || lower.includes("antabraco_d")) {
    if (findJoint(joints, "forearm_near")) return "forearm_near";
  }
  if (lower.includes("forearm_l") || lower.includes("antabraco_e")) {
    if (findJoint(joints, "forearm_far")) return "forearm_far";
  }

  if (lower.includes("hand_r") || lower.includes("mao_d")) {
    if (findJoint(joints, "hand_near")) return "hand_near";
    if (findJoint(joints, "hand_r")) return "hand_r";
  }
  if (lower.includes("hand_l") || lower.includes("mao_e")) {
    if (findJoint(joints, "hand_far")) return "hand_far";
    if (findJoint(joints, "hand_l")) return "hand_l";
  }

  if (lower.includes("upper_arm_r") || lower.includes("braco_d") || lower.includes("arm_near")) {
    if (findJoint(joints, "upper_arm_near")) return "upper_arm_near";
    if (findJoint(joints, "arm_r")) return "arm_r";
  }
  if (lower.includes("upper_arm_l") || lower.includes("braco_e") || lower.includes("arm_far")) {
    if (findJoint(joints, "upper_arm_far")) return "upper_arm_far";
    if (findJoint(joints, "arm_l")) return "arm_l";
  }

  if (lower.includes("foot_r") || lower.includes("pe_d")) {
    if (findJoint(joints, "foot_near")) return "foot_near";
  }
  if (lower.includes("foot_l") || lower.includes("pe_e")) {
    if (findJoint(joints, "foot_far")) return "foot_far";
  }

  if (lower.includes("shin_r") || lower.includes("canela_d")) {
    if (findJoint(joints, "shin_near")) return "shin_near";
  }
  if (lower.includes("shin_l") || lower.includes("canela_e")) {
    if (findJoint(joints, "shin_far")) return "shin_far";
  }

  if (lower.includes("thigh_r") || lower.includes("coxa_d") || lower.includes("leg_r")) {
    if (findJoint(joints, "thigh_near")) return "thigh_near";
    if (findJoint(joints, "leg_r")) return "leg_r";
  }
  if (lower.includes("thigh_l") || lower.includes("coxa_e") || lower.includes("leg_l")) {
    if (findJoint(joints, "thigh_far")) return "thigh_far";
    if (findJoint(joints, "leg_l")) return "leg_l";
  }

  if (lower.includes("torso") || lower.includes("body") || lower.includes("tronco") || lower.includes("root")) {
    if (findJoint(joints, "root")) return "root";
    if (findJoint(joints, "spine_root")) return "spine_root";
  }

  return "";
}
