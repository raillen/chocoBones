/**
 * chocoBones Editor Modes — separação estrita Setup vs Animate
 * Setup muta repouso (Joint.x/y, Pin.x/y). Animate muta apenas Pose deltas.
 */

export enum EditorMode {
  Setup = "Setup",
  Animate = "Animate",
}

export function isSetupMode(mode: EditorMode | string): boolean {
  return mode === EditorMode.Setup;
}

export function isAnimateMode(mode: EditorMode | string): boolean {
  return mode === EditorMode.Animate;
}

/** Restaura bind pose canônica: limpa deltas de pose sem tocar repouso. */
export function restoreBindPose(pose: { joints: Map<unknown, unknown>; layers: Map<unknown, unknown>; pins: Map<unknown, unknown>; params?: Map<unknown, unknown> }): void {
  pose.joints.clear();
  pose.layers.clear();
  pose.pins.clear();
  pose.params?.clear();
}
