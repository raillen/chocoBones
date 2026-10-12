/**
 * chocoBones animation actions (Item 5)
 */
import { createIdleClip, createWalkClip } from "../../animation/presets";
import { restoreBindPose } from "../modes";
import type { AppState } from "../store";

export function togglePlay(state: AppState): void {
  state.isPlaying = !state.isPlaying;
}

export function seekTimeline(state: AppState, time: number): void {
  state.timelineTime = Math.max(0, Math.min(state.timelineDuration, time));
}

export function selectClip(state: AppState, clipName: string): void {
  state.activeClipName = clipName;
  state.activeClip = clipName === "walk" ? createWalkClip() : createIdleClip();
  state.timelineDuration = state.activeClip.duration;
  state.timelineTime = 0;
}

export function resetToRest(state: AppState): void {
  state.isPlaying = false;
  state.timelineTime = 0;
  restoreBindPose(state.currentPose);
}
