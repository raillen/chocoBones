/**
 * chocoBones animation actions (Item 5)
 */
import { createIdleClip, createWalkClip } from "../../animation/presets";
import { evaluateClipInto } from "../../animation/evaluator";
import { restoreBindPose } from "../modes";
import type { AppState } from "../store";

export function togglePlay(state: AppState): void {
  if (!state.isPlaying && !state.activeClip.loop && state.timelineTime >= state.timelineDuration) seekTimeline(state, 0);
  state.isPlaying = !state.isPlaying;
}

export function seekTimeline(state: AppState, time: number): void {
  state.timelineTime = Math.max(0, Math.min(state.timelineDuration, Number.isFinite(time) ? time : 0));
  evaluateClipInto(state.activeClip, state.timelineTime, state.currentPose);
}

export function selectClip(state: AppState, clipName: string): void {
  state.activeClipName = clipName;
  state.activeClip = clipName === "walk" ? createWalkClip() : createIdleClip();
  state.timelineDuration = state.activeClip.duration;
  seekTimeline(state, 0);
}

export function resetToRest(state: AppState): void {
  state.isPlaying = false;
  state.timelineTime = 0;
  restoreBindPose(state.currentPose);
}
