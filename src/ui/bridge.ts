/**
 * chocoBones TypeScript Slint Desktop Bridge
 * Liga o motor reativo da aplicação à janela nativa do Slint.
 */

import slint from "slint-ui";
import { createIdleClip } from "../animation/presets";
import { sampleClip } from "../animation/timeline";
import { boneMatrices } from "../rig/fk";
import { createPose, Joint } from "../rig/joint";
import { rigCreatePreset, RigPreset } from "../rig/presets";
import { ViewportBuffer } from "../render/viewport_buffer";

export interface AppState {
  activeWorkspace: string;
  isPlaying: boolean;
  timelineTime: number;
  timelineDuration: number;
  joints: Joint[];
  viewportBuffer: ViewportBuffer;
}

export function createInitialAppState(): AppState {
  return {
    activeWorkspace: "Animacao",
    isPlaying: true,
    timelineTime: 0.0,
    timelineDuration: 1.6,
    joints: rigCreatePreset(RigPreset.Humanoid),
    viewportBuffer: new ViewportBuffer(720, 500),
  };
}

export function bindSlintWindow(window: any, state: AppState): () => void {
  const idleClip = createIdleClip();
  const currentPose = createPose();

  // Inicializa propriedades da UI
  window.active_workspace = state.activeWorkspace;
  window.timeline_duration = state.timelineDuration;
  window.timeline_time = state.timelineTime;
  window.is_playing = state.isPlaying;
  window.status_text = "🦴 chocoBones Desktop — Pronto (Bun + Slint + WebGPU)";

  window.toggle_play = () => {
    state.isPlaying = !state.isPlaying;
    window.is_playing = state.isPlaying;
  };

  window.change_workspace = (ws: string) => {
    state.activeWorkspace = ws;
    window.active_workspace = ws;
  };

  window.timeline_seek = (val: number) => {
    state.timelineTime = val;
    window.timeline_time = val;
  };

  // Loop de renderização e amostragem do frame
  const intervalId = setInterval(() => {
    if (state.isPlaying) {
      state.timelineTime += 1 / 60;
      if (state.timelineTime >= state.timelineDuration) {
        state.timelineTime = 0;
      }
      window.timeline_time = state.timelineTime;
    }

    // Amostra clipe ativo e calcula FK
    sampleClip(idleClip, state.timelineTime, currentPose);
    const bones = boneMatrices(state.joints, currentPose);

    // Renderiza frame
    const buf = state.viewportBuffer;
    buf.clear(14, 14, 18);
    buf.drawGrid(32);
    buf.renderSkeleton(state.joints, bones);

    // Atualiza imagem na viewport do Slint
    try {
      const SlintImageData = (slint as any).private_api?.SlintImageData;
      if (SlintImageData) {
        window.viewport_frame = new SlintImageData(
          buf.width,
          buf.height,
          Buffer.from(buf.pixels.buffer)
        );
      }
    } catch {
      // Ignora erro se a janela já tiver sido fechada
    }
  }, 1000 / 60);

  return () => clearInterval(intervalId);
}
