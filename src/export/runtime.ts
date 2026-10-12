/**
 * chocoBones contratos runtime/export + spritesheet/sequência (P2-14)
 * Versões explícitas; mesmo evaluate(t) p/ preview e export.
 */
import { evaluateClipInto } from "../animation/evaluator";
import { boneMatrices } from "../rig/fk";
import { renderFrame } from "../render/loop";
import type { AppState } from "../ui/store";

export const RUNTIME_CONTRACT_VERSION = 2;
export const EXPORT_CONTRACT_VERSION = 1;

export interface RuntimeManifest {
  contract: "chocobones-runtime";
  runtimeVersion: number;
  exportVersion: number;
  joints: Array<{ id: string; parent: string; x: number; y: number }>;
  meshes: Array<{ id: string; layerId: string; verts: number; tris: number }>;
  clips: Array<{ id: string; name: string; duration: number; fps: number }>;
  assets: Array<{ id: string; uri?: string; embedded: boolean }>;
}

export function exportRuntimeManifest(state: AppState): RuntimeManifest {
  return {
    contract: "chocobones-runtime",
    runtimeVersion: RUNTIME_CONTRACT_VERSION,
    exportVersion: EXPORT_CONTRACT_VERSION,
    joints: state.joints.map((j) => ({ id: j.id, parent: j.parent, x: j.x, y: j.y })),
    meshes: state.meshes.map((m, i) => ({ id: String(i), layerId: [...state.meshLayer.entries()].find(([, v]) => v === String(i))?.[0] ?? "", verts: m.vertices.length, tris: m.triangles.length })),
    clips: [{ id: state.activeClip.id, name: state.activeClip.name, duration: state.activeClip.duration, fps: state.activeClip.fps }],
    assets: state.layers.map((l, i) => ({ id: `asset_${i}`, uri: `assets/${l.asset}`, embedded: false })),
  };
}

export function checkRuntimeContract(m: RuntimeManifest): string[] {
  const errs: string[] = [];
  if (m.contract !== "chocobones-runtime") errs.push("contract mismatch");
  if (m.runtimeVersion !== RUNTIME_CONTRACT_VERSION) errs.push(`runtimeVersion ${m.runtimeVersion} != ${RUNTIME_CONTRACT_VERSION}`);
  if (m.exportVersion !== EXPORT_CONTRACT_VERSION) errs.push(`exportVersion ${m.exportVersion} != ${EXPORT_CONTRACT_VERSION}`);
  return errs;
}

/** Amostra N frames determinísticos via mesmo evaluate do preview. */
export function exportImageSequence(state: AppState, frameCount: number): Uint8ClampedArray[] {
  const out: Uint8ClampedArray[] = [];
  const savedTime = state.timelineTime;
  for (let f = 0; f < frameCount; f++) {
    const t = (f / Math.max(1, frameCount)) * state.activeClip.duration;
    evaluateClipInto(state.activeClip, t, state.currentPose);
    renderFrame(state);
    out.push(new Uint8ClampedArray(state.viewportBuffer.pixels));
  }
  state.timelineTime = savedTime;
  evaluateClipInto(state.activeClip, savedTime, state.currentPose);
  renderFrame(state);
  return out;
}

/** Compõe spritesheet em grade (columns) a partir de frames RGBA. */
export function composeSpritesheet(
  frames: Uint8ClampedArray[],
  frameW: number,
  frameH: number,
  columns: number
): { pixels: Uint8ClampedArray; width: number; height: number } {
  if (frames.length === 0 || frameW <= 0 || frameH <= 0 || columns <= 0) {
    throw new Error("spritesheet inválida: frames/dimensões/columns");
  }
  const cols = columns;
  const rows = Math.ceil(frames.length / columns);
  const width = cols * frameW;
  const height = rows * frameH;
  const pixels = new Uint8ClampedArray(width * height * 4);
  frames.forEach((fr, idx) => {
    const cx = idx % cols;
    const cy = Math.floor(idx / cols);
    for (let y = 0; y < frameH; y++) {
      for (let x = 0; x < frameW; x++) {
        const src = (y * frameW + x) * 4;
        const dst = ((cy * frameH + y) * width + cx * frameW + x) * 4;
        pixels[dst] = fr[src]!;
        pixels[dst + 1] = fr[src + 1]!;
        pixels[dst + 2] = fr[src + 2]!;
        pixels[dst + 3] = fr[src + 3]!;
      }
    }
  });
  return { pixels, width, height };
}

export { boneMatrices };
