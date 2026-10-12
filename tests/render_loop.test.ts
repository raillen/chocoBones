import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageData } from "slint-ui";
import { startRenderLoop } from "../src/render/loop";
import { createInitialAppState } from "../src/ui/store";

afterEach(() => vi.useRealTimers());

describe("desktop viewport frame delivery", () => {
  it("publishes rendered RGBA pixels and timeline time, then stops on cleanup", () => {
    vi.useFakeTimers();
    const state = createInitialAppState();
    state.viewportBuffer.resize(64, 48);
    const window: { viewport_frame?: ImageData; timeline_time: number } = { timeline_time: 0 };
    const stop = startRenderLoop(state, window, { fps: 20 });

    vi.advanceTimersByTime(50);

    const frame = window.viewport_frame!;
    expect(frame.width).toBe(64);
    expect(frame.height).toBe(48);
    expect(Buffer.from(frame.data)).toEqual(Buffer.from(state.viewportBuffer.pixels));
    expect(frame.data.length).toBe(64 * 48 * 4);
    expect(frame.data.some((channel) => channel !== 0)).toBe(true);
    expect(window.timeline_time).toBe(state.timelineTime);
    expect(window.timeline_time).toBeGreaterThan(0);

    stop();
    vi.advanceTimersByTime(100);
    expect(window.viewport_frame).toBe(frame);
  });

  it("publishes the new dimensions and pixel storage after a viewport resize", () => {
    vi.useFakeTimers();
    const state = createInitialAppState();
    state.isPlaying = false;
    state.viewportBuffer.resize(32, 24);
    const window: { viewport_frame?: ImageData } = {};
    const stop = startRenderLoop(state, window, { fps: 20 });
    vi.advanceTimersByTime(50);

    state.viewportBuffer.resize(96, 72);
    state.themeMode = "Light";
    vi.advanceTimersByTime(50);

    const frame = window.viewport_frame!;
    expect([frame.width, frame.height]).toEqual([96, 72]);
    expect(frame.data.length).toBe(96 * 72 * 4);
    expect(Buffer.from(frame.data)).toEqual(Buffer.from(state.viewportBuffer.pixels));
    expect(Array.from(frame.data.slice(4, 8))).toEqual([244, 244, 246, 255]);
    stop();
  });
});
