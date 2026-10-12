/**
 * chocoBones render loop com delta_time real (Item 3 + Item 5)
 * Substitui setInterval fixo 1/60 por delta medido + evaluate(t) único.
 */
import { advanceTime } from "../animation/clock";
import { evaluateClipInto } from "../animation/evaluator";
import { boneMatrices } from "../rig/fk";
import { meshWorld } from "../mesh/mesh";
import { stepSpring } from "../physics2d/spring";
import type { AppState } from "../ui/store";
import type { ImageData } from "slint-ui";

export interface LoopOptions {
  fps?: number;
}

export function renderFrame(state: AppState): void {
  const bones = boneMatrices(state.joints, state.currentPose);
  const buf = state.viewportBuffer;

  const isLight = state.themeMode === "Light";
  const isDim = state.themeMode === "Dim";

  if (isLight) {
    buf.clear(244, 244, 246);
  } else if (isDim) {
    buf.clear(32, 32, 36);
  } else {
    buf.clear(14, 14, 16);
  }

  if (state.viewportMode === "2D") {
    if (isLight) {
      buf.drawGrid(32, state.cameraPan.x, state.cameraPan.y, state.cameraZoom, 218, 220, 226);
    } else if (isDim) {
      buf.drawGrid(32, state.cameraPan.x, state.cameraPan.y, state.cameraZoom, 48, 48, 56);
    } else {
      buf.drawGrid(32, state.cameraPan.x, state.cameraPan.y, state.cameraZoom, 28, 28, 34);
    }
    buf.renderLayers(state.layers, bones, state.selectedLayerId, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    buf.renderSkeleton(state.joints, bones, state.selectedJointId, state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
    // P0-2: puppet deformado com deslocamentos efetivos de pose.pins (mesmo p/ export)
    renderPuppetMeshes(state, bones);
  } else {
    if (isLight) {
      buf.drawGrid(40, 0, 0, 1.0, 218, 220, 226);
      buf.render3D(state.mesh3D, state.orbitCamera, 2, 132, 199);
    } else if (isDim) {
      buf.drawGrid(40, 0, 0, 1.0, 48, 48, 56);
      buf.render3D(state.mesh3D, state.orbitCamera, 56, 189, 248);
    } else {
      buf.drawGrid(40, 0, 0, 1.0, 28, 28, 34);
      buf.render3D(state.mesh3D, state.orbitCamera, 56, 189, 248);
    }
  }
}

export function tickAnimation(state: AppState, deltaSeconds: number): void {
  // P0-6: física em passo fixo (determinística sob scrub/export via bake)
  const steps = state.springAcc.stepsFor(deltaSeconds);
  const dt = 1 / Math.max(1, state.springHz);
  for (let s = 0; s < steps; s++) {
    for (const chain of state.springs) stepSpring(chain, dt);
  }
  if (!state.isPlaying) return;
  state.timelineTime = advanceTime(state.timelineTime, deltaSeconds, state.timelineDuration, true);
  evaluateClipInto(state.activeClip, state.timelineTime, state.currentPose);
  // Dinâmica secundária aditiva após sampling (não destrói keyframes)
  for (const chain of state.springs) {
    chain.jointIds.forEach((jid, i) => {
      const add = chain.angle[i] ?? 0;
      if (Math.abs(add) < 1e-9) return;
      const cur = state.currentPose.joints.get(jid) ?? { angle: 0, x: 0, y: 0 };
      state.currentPose.joints.set(jid, { ...cur, angle: cur.angle + add });
    });
  }
  if (state.viewportMode === "3D") {
    state.orbitCamera.yaw += deltaSeconds * 0.3;
  }
}

/**
 * P0-2: desenha malhas deformadas por MLS usando pose.pins.
 * Preview e export usam esta mesma função via renderFrame/renderOffscreen.
 */
export function renderPuppetMeshes(state: AppState, bones: Map<string, import("../core/types").Mat2x3>): void {
  const buf = state.viewportBuffer;
  for (const layer of state.layers) {
    if (!layer.visible) continue;
    const meshIdx = state.meshLayer.get(layer.id);
    if (meshIdx === undefined) continue;
    const mesh = state.meshes[Number(meshIdx)];
    if (!mesh || mesh.vertices.length === 0) continue;
    // Pinos da malha (filtra por meshId quando presente)
    const pins = state.pins.filter((p) => !p.meshId || p.meshId === meshIdx);
    const world = meshWorld(mesh, pins, null, layer, state.joints, state.currentPose, bones);
    // Wireframe ciano suave
    for (const [a, b, c] of mesh.triangles) {
      const pa = world[a];
      const pb = world[b];
      const pc = world[c];
      if (!pa || !pb || !pc) continue;
      const [sax, say] = buf.worldToScreen(pa[0], pa[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      const [sbx, sby] = buf.worldToScreen(pb[0], pb[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      const [scx, scy] = buf.worldToScreen(pc[0], pc[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      buf.drawLine(sax, say, sbx, sby, 56, 189, 248);
      buf.drawLine(sbx, sby, scx, scy, 56, 189, 248);
      buf.drawLine(scx, scy, sax, say, 56, 189, 248);
    }
    // Pinos: verde livre, âmbar travado, cinza desabilitado
    for (const pin of pins) {
      const d = state.currentPose.pins.get(pin.id) ?? [0, 0];
      const [sx, sy] = buf.worldToScreen(pin.x + d[0], pin.y + d[1], state.cameraPan.x, state.cameraPan.y, state.cameraZoom);
      if (pin.enabled === false) buf.drawCircle(sx, sy, 4, 113, 113, 122);
      else if (pin.locked) buf.drawCircle(sx, sy, 4, 245, 158, 11);
      else buf.drawCircle(sx, sy, 4, 16, 185, 129);
    }
  }
}

/** Render offscreen determinístico p/ export: mesmo evaluate(t) do preview. */
export function renderOffscreen(state: AppState, time: number): void {
  evaluateClipInto(state.activeClip, time, state.currentPose);
  renderFrame(state);
}

export function startRenderLoop(state: AppState, window: unknown, opts: LoopOptions = {}): () => void {
  const intervalMs = 1000 / (opts.fps ?? 60);
  let last = Date.now();

  const id = setInterval(() => {
    const now = Date.now();
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    tickAnimation(state, dt);
    renderFrame(state);
    try {
      const w = window as Record<string, unknown>;
      if (typeof w === "object" && w !== null) {
        const buf = state.viewportBuffer;
        // Slint's public ImageData setter copies RGBA pixels into its native image.
        // A type-only import keeps offscreen rendering free of the desktop runtime.
        const frame: ImageData = {
          width: buf.width,
          height: buf.height,
          data: Buffer.from(buf.pixels.buffer, buf.pixels.byteOffset, buf.pixels.byteLength),
        };
        w["viewport_frame"] = frame;
        if (typeof w["timeline_time"] !== "undefined") w["timeline_time"] = state.timelineTime;
      }
    } catch {
      // janela fechada: ignora
    }
  }, intervalMs);
  return () => clearInterval(id);
}
