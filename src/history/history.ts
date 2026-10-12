/**
 * chocoBones TypeScript History & Undo/Redo Engine
 */

import { Joint, JointDelta, Layer, LayerDelta, Pose } from "../rig/joint";

export interface Snapshot {
  description: string;
  joints: Joint[];
  layers: Layer[];
  poseJoints: Map<string, JointDelta>;
  poseLayers: Map<string, LayerDelta>;
}

export function createSnapshot(
  description: string,
  joints: readonly Joint[],
  layers: readonly Layer[],
  pose?: Pose | null
): Snapshot {
  const jointsCopy = joints.map((j) => ({ ...j }));
  const layersCopy = layers.map((l) => ({
    ...l,
    transform: {
      ...l.transform,
      pos: [...l.transform.pos] as [number, number],
      scale: [...l.transform.scale] as [number, number],
      pivot: [...l.transform.pivot] as [number, number],
    },
    seamMask: {
      ...l.seamMask,
      center: [...l.seamMask.center] as [number, number],
    },
  }));

  const poseJoints = new Map<string, JointDelta>();
  if (pose) {
    for (const [k, v] of pose.joints) {
      poseJoints.set(k, { ...v });
    }
  }

  const poseLayers = new Map<string, LayerDelta>();
  if (pose) {
    for (const [k, v] of pose.layers) {
      poseLayers.set(k, { ...v });
    }
  }

  return {
    description,
    joints: jointsCopy,
    layers: layersCopy,
    poseJoints,
    poseLayers,
  };
}

export class HistoryStack {
  private undoStack: Snapshot[] = [];
  private redoStack: Snapshot[] = [];
  private maxSnapshots: number;

  constructor(maxSnapshots = 50) {
    this.maxSnapshots = maxSnapshots;
  }

  public push(
    description: string,
    joints: readonly Joint[],
    layers: readonly Layer[],
    pose?: Pose | null
  ): void {
    this.redoStack = [];

    if (this.undoStack.length >= this.maxSnapshots) {
      this.undoStack.shift();
    }

    const snap = createSnapshot(description, joints, layers, pose);
    this.undoStack.push(snap);
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(
    currentJoints: Joint[],
    currentLayers: Layer[],
    currentPose?: Pose | null
  ): string | null {
    if (this.undoStack.length === 0) return null;

    const currentSnap = createSnapshot(
      this.undoStack[this.undoStack.length - 1]?.description ?? "Redo State",
      currentJoints,
      currentLayers,
      currentPose
    );
    this.redoStack.push(currentSnap);

    const snap = this.undoStack.pop()!;

    // Restaura juntas
    currentJoints.length = 0;
    currentJoints.push(...snap.joints.map((j) => ({ ...j })));

    // Restaura camadas
    currentLayers.length = 0;
    currentLayers.push(...snap.layers.map((l) => ({ ...l })));

    // Restaura pose
    if (currentPose) {
      currentPose.joints.clear();
      for (const [k, v] of snap.poseJoints) {
        currentPose.joints.set(k, { ...v });
      }
      currentPose.layers.clear();
      for (const [k, v] of snap.poseLayers) {
        currentPose.layers.set(k, { ...v });
      }
    }

    return snap.description;
  }

  public redo(
    currentJoints: Joint[],
    currentLayers: Layer[],
    currentPose?: Pose | null
  ): string | null {
    if (this.redoStack.length === 0) return null;

    const currentSnap = createSnapshot(
      "Undo State",
      currentJoints,
      currentLayers,
      currentPose
    );
    this.undoStack.push(currentSnap);

    const snap = this.redoStack.pop()!;

    currentJoints.length = 0;
    currentJoints.push(...snap.joints.map((j) => ({ ...j })));

    currentLayers.length = 0;
    currentLayers.push(...snap.layers.map((l) => ({ ...l })));

    if (currentPose) {
      currentPose.joints.clear();
      for (const [k, v] of snap.poseJoints) {
        currentPose.joints.set(k, { ...v });
      }
      currentPose.layers.clear();
      for (const [k, v] of snap.poseLayers) {
        currentPose.layers.set(k, { ...v });
      }
    }

    return snap.description;
  }
}
