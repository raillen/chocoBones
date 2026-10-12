import { describe, expect, it } from "vitest";
import { buildGridMesh, Pin, warpPoint } from "../src/mesh/mesh";

describe("2D Grid Mesh Triangulation", () => {
  it("generates correct number of vertices and triangles for density 4", () => {
    const mesh = buildGridMesh(100, 100, 4);
    // (4 + 1) * (4 + 1) = 25 vértices
    expect(mesh.vertices.length).toBe(25);
    // 4 * 4 * 2 = 32 triângulos
    expect(mesh.triangles.length).toBe(32);
  });
});

describe("Moving Least Squares (MLS) Deformation", () => {
  it("keeps vertex static when pins have zero delta", () => {
    const pins: Pin[] = [
      { id: "p1", name: "P1", x: 0, y: 0, locked: false },
      { id: "p2", name: "P2", x: 100, y: 0, locked: false },
    ];
    const deltas = new Map<string, [number, number]>();
    deltas.set("p1", [0, 0]);
    deltas.set("p2", [0, 0]);

    const warped = warpPoint([50, 0], pins, deltas, 1.0);
    expect(warped[0]).toBeCloseTo(50);
    expect(warped[1]).toBeCloseTo(0);
  });

  it("translates vertex when all pins translate equally", () => {
    const pins: Pin[] = [
      { id: "p1", name: "P1", x: 0, y: 0, locked: false },
      { id: "p2", name: "P2", x: 100, y: 0, locked: false },
    ];
    const deltas = new Map<string, [number, number]>();
    deltas.set("p1", [10, 20]);
    deltas.set("p2", [10, 20]);

    const warped = warpPoint([50, 0], pins, deltas, 1.0);
    expect(warped[0]).toBeCloseTo(60);
    expect(warped[1]).toBeCloseTo(20);
  });

  it("rotates vertex when pins execute a rotation", () => {
    const pins: Pin[] = [
      { id: "center", name: "Center", x: 0, y: 0, locked: true },
      { id: "tip", name: "Tip", x: 0, y: 10, locked: false },
    ];
    // Rotaciona a ponta em 90 graus: (0, 10) -> (10, 0) => delta [10, -10]
    const deltas = new Map<string, [number, number]>();
    deltas.set("tip", [10, -10]);

    const warped = warpPoint([0, 10], pins, deltas, 1.0);
    expect(warped[0]).toBeCloseTo(10, 0);
    expect(warped[1]).toBeCloseTo(0, 0);
  });
});
