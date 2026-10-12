import { describe, expect, it } from "vitest";
import { boneMatrices } from "../src/rig/fk";
import { solveIK } from "../src/rig/ik";
import { createPose, Joint } from "../src/rig/joint";
import {
  autoGuessJointForLayer,
  jointHasCycle,
  jointRemove,
  jointSetParent,
  rigCreatePreset,
  RigPreset,
} from "../src/rig/presets";

describe("Rigging & Forward Kinematics (FK)", () => {
  it("creates Humanoid preset with 14 joints without cycles", () => {
    const joints = rigCreatePreset(RigPreset.Humanoid);
    expect(joints.length).toBe(14);
    expect(jointHasCycle(joints)).toBe(false);
  });

  it("calculates bone matrices for a 2-bone chain", () => {
    const joints: Joint[] = [
      { id: "root", name: "Root", parent: "", x: 0, y: 0, color: "#fff" },
      { id: "arm", name: "Arm", parent: "root", x: 10, y: 0, color: "#fff" },
    ];
    const pose = createPose();
    pose.joints.set("root", { angle: Math.PI / 2, x: 0, y: 0 }); // 90 deg rotation

    const bones = boneMatrices(joints, pose);
    const armMat = bones.get("arm");
    expect(armMat).toBeDefined();
    // Ponto x=10 rotacionado em 90 graus vai para x=0, y=10
    expect(armMat!.tx).toBeCloseTo(0);
    expect(armMat!.ty).toBeCloseTo(10);
  });
});

describe("Inverse Kinematics (IK)", () => {
  it("solves 2-bone IK reaching towards target", () => {
    const joints: Joint[] = [
      { id: "root", name: "Root", parent: "", x: 0, y: 0, color: "#fff" },
      { id: "shoulder", name: "Shoulder", parent: "root", x: 0, y: 0, color: "#fff" },
      { id: "elbow", name: "Elbow", parent: "shoulder", x: 50, y: 0, color: "#fff" },
      { id: "hand", name: "Hand", parent: "elbow", x: 100, y: 0, color: "#fff" },
    ];
    const pose = createPose();

    const ok = solveIK(joints, pose, "hand", [60, 40], 1.0);
    expect(ok).toBe(true);

    // Verifica que após aplicar IK, a mão alcança próximo ao alvo
    const bones = boneMatrices(joints, pose);
    const handMat = bones.get("hand");
    expect(handMat).toBeDefined();
    expect(handMat!.tx).toBeCloseTo(60, 0);
    expect(handMat!.ty).toBeCloseTo(40, 0);
  });
});

describe("Rig Hierarchy Management & Presets", () => {
  it("prevents adding joint that causes a cycle", () => {
    const joints: Joint[] = [
      { id: "j1", name: "J1", parent: "", x: 0, y: 0, color: "#fff" },
      { id: "j2", name: "J2", parent: "j1", x: 10, y: 0, color: "#fff" },
    ];
    const added = jointSetParent(joints, "j1", "j2"); // Cria ciclo j1 -> j2 -> j1
    expect(added).toBe(false);
    expect(jointHasCycle(joints)).toBe(false);
  });

  it("safely removes joint and reparents children", () => {
    const joints: Joint[] = [
      { id: "root", name: "Root", parent: "", x: 0, y: 0, color: "#fff" },
      { id: "mid", name: "Mid", parent: "root", x: 10, y: 0, color: "#fff" },
      { id: "tip", name: "Tip", parent: "mid", x: 20, y: 0, color: "#fff" },
    ];
    const ok = jointRemove(joints, "mid");
    expect(ok).toBe(true);
    expect(joints.length).toBe(2);
    const tip = joints.find((j) => j.id === "tip");
    expect(tip?.parent).toBe("root");
  });

  it("guesses anatomical joint name for layers correctly", () => {
    const joints = rigCreatePreset(RigPreset.Humanoid);
    expect(autoGuessJointForLayer(joints, "hero_head_layer.png")).toBe("head");
    expect(autoGuessJointForLayer(joints, "forearm_r.png")).toBe("forearm_near");
    expect(autoGuessJointForLayer(joints, "hand_l_sword.png")).toBe("hand_far");
    expect(autoGuessJointForLayer(joints, "character_body.png")).toBe("root");
  });
});
