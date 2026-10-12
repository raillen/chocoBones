import { describe, expect, it } from "bun:test";
import { ViewportBuffer } from "../src/render/viewport_buffer";
import { rigCreatePreset, RigPreset } from "../src/rig/presets";
import { boneMatrices } from "../src/rig/fk";
import { createCubeMesh } from "../src/mesh3d/primitives";
import { OrbitCamera } from "../src/core/math3d";

describe("Viewport Framebuffer Rasterizer", () => {
  it("creates buffer and clears to specific color", () => {
    const buf = new ViewportBuffer(100, 100);
    buf.clear(10, 20, 30, 255);
    expect(buf.pixels[0]).toBe(10);
    expect(buf.pixels[1]).toBe(20);
    expect(buf.pixels[2]).toBe(30);
    expect(buf.pixels[3]).toBe(255);
  });

  it("converts screen to world coordinates and back accurately", () => {
    const buf = new ViewportBuffer(800, 600);
    const panX = 120;
    const panY = -80;
    const zoom = 1.5;

    const [wx, wy] = buf.screenToWorld(400, 300, panX, panY, zoom);
    const [sx, sy] = buf.worldToScreen(wx, wy, panX, panY, zoom);

    expect(Math.round(sx)).toBe(400);
    expect(Math.round(sy)).toBe(300);
  });

  it("renders 2D skeleton bones and joints without out-of-bounds errors", () => {
    const buf = new ViewportBuffer(640, 480);
    buf.clear(14, 14, 18);
    const joints = rigCreatePreset(RigPreset.Humanoid);
    const bones = boneMatrices(joints);

    expect(() => {
      buf.renderSkeleton(joints, bones, "head", 0, 0, 1.0);
    }).not.toThrow();
  });

  it("renders 3D wireframe mesh with orbit camera", () => {
    const buf = new ViewportBuffer(400, 400);
    buf.clear(14, 14, 18);
    const cube = createCubeMesh(1.5);
    const camera = new OrbitCamera([0, 0, 0], 3.0, 0.5, 0.3);

    expect(() => {
      buf.render3D(cube, camera);
    }).not.toThrow();
  });
});
