import { describe, expect, it, vi } from "vitest";
import { mapViewportPoint } from "../src/ui/viewport/geometry";
import { EditorMode } from "../src/ui/modes";

// Exercise the real input bridge without a display or an animation timer.
vi.mock("slint-ui", () => ({
  ArrayModel: class {
    constructor(public rows: unknown[]) {}
  },
}));
vi.mock("../src/render/loop", () => ({ startRenderLoop: () => () => {} }));

import { bindSlintWindow, createInitialAppState } from "../src/ui/bridge";

describe("viewport fitted-frame geometry", () => {
  it("keeps scene coordinates unchanged at native size", () => {
    expect(mapViewportPoint(720, 500, 720, 500, 100, 200)).toEqual({ x: 100, y: 200, inside: true });
  });

  it("maps a larger window with horizontal margins to the original scene", () => {
    expect(mapViewportPoint(720, 500, 1000, 500, 500, 250)).toEqual({ x: 360, y: 250, inside: true });
    expect(mapViewportPoint(720, 500, 1000, 500, 139, 250)?.inside).toBe(false);
    expect(mapViewportPoint(720, 500, 1000, 500, 861, 250)?.inside).toBe(false);
  });

  it("maps a narrow surface with vertical margins without stretching", () => {
    expect(mapViewportPoint(720, 500, 360, 500, 180, 250)).toEqual({ x: 360, y: 250, inside: true });
    expect(mapViewportPoint(720, 500, 360, 500, 180, 124)?.inside).toBe(false);
    expect(mapViewportPoint(720, 500, 360, 500, 180, 376)?.inside).toBe(false);
  });

  it("allows an active drag to retain its displacement outside the image", () => {
    expect(mapViewportPoint(720, 500, 1440, 1000, -40, 1100)).toEqual({ x: -20, y: 550, inside: false });
  });

  it.each([
    [0, 500, 720, 500, 10, 10],
    [720, 500, 0, 500, 10, 10],
    [720, 500, 720, -1, 10, 10],
    [720, 500, 720, 500, NaN, 10],
    [720, 500, Infinity, 500, 10, 10],
  ])("ignores unusable layout dimensions or pointer coordinates (%j)", (...values) => {
    const [fw, fh, aw, ah, x, y] = values;
    expect(mapViewportPoint(fw!, fh!, aw!, ah!, x!, y!)).toBeNull();
  });
});

function inputWindow(width: number, height: number) {
  const state = createInitialAppState();
  state.joints = [{ id: "root", name: "Root", parent: "", x: 100, y: 100, color: "#FFFFFF" }];
  state.pins = [];
  state.cameraPan = { x: 0, y: 0 };
  state.cameraZoom = 1;
  state.editorMode = EditorMode.Setup;
  const window: any = { viewport_width: width, viewport_height: height };
  bindSlintWindow(window, state);
  return { state, window };
}

describe("viewport input bridge", () => {
  it.each([
    [1440, 1000, 200, 200],
    [1000, 500, 240, 100],
    [720, 720, 100, 210],
  ])("selects the visible joint after fitting into %i×%i", (width, height, x, y) => {
    const { state, window } = inputWindow(width, height);
    window.viewport_mouse_down(x, y);
    expect(state.viewportDrag.mode).toBe("joint");
    expect(state.viewportDrag.jointId).toBe("root");
  });

  it("does not start a pan or edit when pressing a letterbox margin", () => {
    const { state, window } = inputWindow(1000, 500);
    window.viewport_mouse_down(25, 100);
    window.viewport_mouse_move(250, 100);
    expect(state.viewportDrag.mode).toBe("none");
    expect(state.joints[0]?.x).toBe(100);
    expect(state.cameraPan).toEqual({ x: 0, y: 0 });
  });

  it("applies document displacement at display scale and continues a drag outside", () => {
    const { state, window } = inputWindow(1080, 750);
    window.viewport_mouse_down(150, 150);
    window.viewport_mouse_move(195, 135);
    expect(state.joints[0]).toMatchObject({ x: 130, y: 90 });
    window.viewport_mouse_move(-150, 150);
    expect(state.joints[0]).toMatchObject({ x: -100, y: 100 });
    window.viewport_mouse_up();
    window.viewport_mouse_move(300, 150);
    expect(state.viewportDrag.mode).toBe("none");
    expect(state.joints[0]).toMatchObject({ x: -100, y: 100 });
  });

  it("changes workspace elements without changing the document or playback", () => {
    const { state, window } = inputWindow(720, 500);
    const joints = state.joints;
    const layers = state.layers;
    const pose = state.currentPose;
    const selectedJoint = state.selectedJointId;
    state.timelineTime = 0.5;
    state.isPlaying = true;
    state.activeTool = "Pin";
    state.viewportMode = "3D";
    for (const [workspace, tab] of [["Rig", "Juntas"], ["Montagem", "Camadas"], ["Animacao", "Camadas"]]) {
      window.change_workspace(workspace);
      expect(state.elementTab).toBe(tab);
      expect(window.element_tab).toBe(tab);
      expect(state.joints).toBe(joints);
      expect(state.layers).toBe(layers);
      expect(state.currentPose).toBe(pose);
      expect(state.selectedJointId).toBe(selectedJoint);
      expect(state.timelineTime).toBe(0.5);
      expect(state.isPlaying).toBe(true);
      expect(state.activeTool).toBe("Pin");
      expect(state.viewportMode).toBe("3D");
      expect(state.editorMode).toBe(EditorMode.Setup);
    }
  });
});
