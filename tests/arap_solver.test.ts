import { describe, expect, it } from "vitest";
import type { Vec2 } from "../src/core/types";
import { createArapSolver, solveArapMesh, type ArapHandle } from "../src/deform/arap_solver";

function grid(width: number, height: number): { vertices: Vec2[]; triangles: [number, number, number][] } {
  const vertices: Vec2[] = [];
  const triangles: [number, number, number][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) vertices.push([x, y]);
  }
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const a = y * width + x;
      triangles.push([a, a + 1, a + width], [a + 1, a + width + 1, a + width]);
    }
  }
  return { vertices, triangles };
}

function expectPositions(actual: Vec2[], expected: Vec2[], digits = 7): void {
  expect(actual.length).toBe(expected.length);
  for (let vertex = 0; vertex < actual.length; vertex++) {
    expect(actual[vertex]![0]).toBeCloseTo(expected[vertex]![0], digits);
    expect(actual[vertex]![1]).toBeCloseTo(expected[vertex]![1], digits);
  }
}

function adjacency(vertexCount: number, triangles: [number, number, number][]): number[][] {
  const graph = Array.from({ length: vertexCount }, () => new Set<number>());
  for (const [a, b, c] of triangles) {
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      graph[u!]!.add(v!);
      graph[v!]!.add(u!);
    }
  }
  return graph.map((neighbors) => [...neighbors]);
}

// A linear Laplacian reconstruction uses the same graph/Dirichlet constraints
// but never rotates rest differentials. It is a useful deformation baseline.
function linearLaplacian(rest: Vec2[], triangles: [number, number, number][], handles: ArapHandle[]): Vec2[] {
  const graph = adjacency(rest.length, triangles);
  const fixed = new Map(handles.map((handle) => [handle.vertex, handle.target]));
  let current = rest.map((position, vertex): Vec2 => fixed.get(vertex) ?? [...position]);
  const differential = rest.map((position, vertex): Vec2 => {
    const neighbors = graph[vertex]!;
    return neighbors.reduce<Vec2>((sum, neighbor) => [
      sum[0] + position[0] - rest[neighbor]![0],
      sum[1] + position[1] - rest[neighbor]![1],
    ], [0, 0]);
  });
  for (let iteration = 0; iteration < 2000; iteration++) {
    current = current.map((_, vertex): Vec2 => {
      const target = fixed.get(vertex);
      if (target) return [...target];
      const neighbors = graph[vertex]!;
      const sum = neighbors.reduce<Vec2>((value, neighbor) => [
        value[0] + current[neighbor]![0], value[1] + current[neighbor]![1],
      ], [...differential[vertex]!] as Vec2);
      return [sum[0] / neighbors.length, sum[1] / neighbors.length];
    });
  }
  return current;
}

function lengthError(rest: Vec2[], deformed: Vec2[], triangles: [number, number, number][]): number {
  const graph = adjacency(rest.length, triangles);
  let error = 0;
  for (let vertex = 0; vertex < rest.length; vertex++) {
    for (const neighbor of graph[vertex]!) {
      if (neighbor < vertex) continue;
      const oldLength = Math.hypot(rest[vertex]![0] - rest[neighbor]![0], rest[vertex]![1] - rest[neighbor]![1]);
      const newLength = Math.hypot(deformed[vertex]![0] - deformed[neighbor]![0], deformed[vertex]![1] - deformed[neighbor]![1]);
      error += (oldLength - newLength) ** 2;
    }
  }
  return error;
}

describe("Sparse local/global ARAP 2D", () => {
  it("keeps rest geometry with no handles and with identity Dirichlet handles", () => {
    const { vertices, triangles } = grid(5, 4);
    const solver = createArapSolver(vertices, triangles);
    expect(solver.solve([])).toEqual(vertices);
    expect(solver.solve([{ vertex: 0, target: [0, 0] }, { vertex: 19, target: [4, 3] }])).toEqual(vertices);
  });

  it("preserves a rigid translation exactly with one handle", () => {
    const { vertices, triangles } = grid(5, 4);
    const actual = solveArapMesh(vertices, triangles, [{ vertex: 7, target: [13, -2] }]);
    expectPositions(actual, vertices.map((point): Vec2 => [point[0] + 11, point[1] - 3]));
    expect(lengthError(vertices, actual, triangles)).toBeLessThan(1e-24);
  });

  it.each([Math.PI / 2, -2.6, Math.PI])("preserves rigid rotation %s plus translation from two handles", (angle) => {
    const { vertices, triangles } = grid(6, 5);
    const transformed = vertices.map(([x, y]): Vec2 => [
      Math.cos(angle) * x - Math.sin(angle) * y + 50,
      Math.sin(angle) * x + Math.cos(angle) * y - 17,
    ]);
    const result = solveArapMesh(vertices, triangles, [
      { vertex: 0, target: transformed[0]! }, { vertex: 29, target: transformed[29]! },
    ]);
    expectPositions(result, transformed);
    expect(lengthError(vertices, result, triangles)).toBeLessThan(1e-20);
  });

  it("keeps every handle exact while distributing a nonrigid deformation", () => {
    const { vertices, triangles } = grid(7, 5);
    const handles: ArapHandle[] = [
      { vertex: 0, target: [0, 0] }, { vertex: 28, target: [0, 4] },
      { vertex: 6, target: [5, 4] }, { vertex: 34, target: [2, 6] },
    ];
    const result = solveArapMesh(vertices, triangles, handles, { iterations: 32, tolerance: 1e-9 });
    for (const handle of handles) expect(result[handle.vertex]).toEqual(handle.target);
    expect(result.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    expect(Math.hypot(result[17]![0] - vertices[17]![0], result[17]![1] - vertices[17]![1])).toBeGreaterThan(0.5);
  });

  it("preserves edge lengths better than linear Laplacian reconstruction during a bend", () => {
    const { vertices, triangles } = grid(9, 3);
    const handles: ArapHandle[] = [
      { vertex: 0, target: [0, 0] }, { vertex: 18, target: [0, 2] },
      { vertex: 8, target: [6, 4] }, { vertex: 26, target: [4, 4] },
    ];
    const result = solveArapMesh(vertices, triangles, handles, { iterations: 64, tolerance: 1e-9 });
    const baseline = linearLaplacian(vertices, triangles, handles);
    expect(lengthError(vertices, result, triangles)).toBeLessThan(lengthError(vertices, baseline, triangles) * 0.6);
  });

  it("handles disconnected, unhandled and isolated components independently", () => {
    const vertices: Vec2[] = [[0, 0], [1, 0], [0, 1], [10, 0], [11, 0], [10, 1], [50, 50], [60, 60]];
    const triangles: [number, number, number][] = [[0, 1, 2], [3, 4, 5]];
    const result = solveArapMesh(vertices, triangles, [
      { vertex: 0, target: [2, 3] }, { vertex: 1, target: [2, 4] }, { vertex: 7, target: [70, 80] },
    ]);
    expectPositions(result.slice(0, 3), [[2, 3], [2, 4], [1, 3]]);
    expect(result.slice(3, 7)).toEqual(vertices.slice(3, 7));
    expect(result[7]).toEqual([70, 80]);
    const translated = solveArapMesh(vertices, triangles, [{ vertex: 3, target: [12, -5] }]);
    expect(translated.slice(3, 6)).toEqual([[12, -5], [13, -5], [12, -4]]);
    expect(translated.slice(0, 3)).toEqual(vertices.slice(0, 3));
  });

  it("supports a closed triangle fan and every vertex constrained", () => {
    const vertices: Vec2[] = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]];
    const triangles: [number, number, number][] = [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1]];
    const handles: ArapHandle[] = vertices.map(([x, y], vertex) => ({ vertex, target: [x * 1.5 + 3, y * 0.5 - 2] }));
    expect(solveArapMesh(vertices, triangles, handles)).toEqual(handles.map((handle) => handle.target));
    const result = solveArapMesh(vertices, triangles, [handles[1]!, handles[3]!]);
    expect(result.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it("ignores zero-area/repeated-index triangles and accepts an empty mesh without NaNs", () => {
    expect(solveArapMesh([], [], [])).toEqual([]);
    const vertices: Vec2[] = [[0, 0], [1, 0], [2, 0], [0, 1], [4, 4]];
    const triangles: [number, number, number][] = [[0, 1, 2], [0, 0, 1], [0, 1, 3], [4, 4, 4]];
    const result = solveArapMesh(vertices, triangles, [
      { vertex: 0, target: [0, 0] }, { vertex: 3, target: [-1, 0] }, { vertex: 2, target: [7, 7] },
    ]);
    expectPositions(result, [[0, 0], [0, 1], [7, 7], [-1, 0], [4, 4]]);
    expect(solveArapMesh(vertices, [[0, 1, 2]], [])).toEqual(vertices);
  });

  it("is deterministic across previous solves, handle order, and cached constraint changes", () => {
    const { vertices, triangles } = grid(7, 4);
    const handles: ArapHandle[] = [{ vertex: 0, target: [0, 0] }, { vertex: 27, target: [4, 5] }];
    const solver = createArapSolver(vertices, triangles);
    const expected = solver.solve(handles);
    solver.solve([{ vertex: 3, target: [20, 20] }, { vertex: 21, target: [22, 18] }]);
    expect(solver.solve([...handles].reverse())).toEqual(expected);
    solver.solve([{ vertex: 0, target: [2, 3] }, { vertex: 27, target: [7, 9] }]);
    expect(solver.solve(handles)).toEqual(expected);
    expect(createArapSolver(vertices, [...triangles].reverse()).solve(handles)).toEqual(expected);
  });

  it("retains a small deformation after large world translations and uniform scale changes", () => {
    const { vertices, triangles } = grid(5, 4);
    const handles: ArapHandle[] = [
      { vertex: 0, target: [0, 0] }, { vertex: 4, target: [3, 2] }, { vertex: 19, target: [1, 5] },
    ];
    const expected = solveArapMesh(vertices, triangles, handles);
    const shifted = solveArapMesh(vertices, triangles, handles.map((handle) => ({
      vertex: handle.vertex, target: [handle.target[0] + 1e9, handle.target[1] - 1e9],
    })));
    expectPositions(shifted.map(([x, y]): Vec2 => [x - 1e9, y + 1e9]), expected, 6);
    for (const scale of [1e-8, 1e8]) {
      const result = solveArapMesh(
        vertices.map(([x, y]): Vec2 => [x * scale, y * scale]), triangles,
        handles.map((handle) => ({ vertex: handle.vertex, target: [handle.target[0] * scale, handle.target[1] * scale] })),
      );
      expectPositions(result.map(([x, y]): Vec2 => [x / scale, y / scale]), expected, 6);
    }
  });

  it("keeps differently sized disconnected deformation islands accurate", () => {
    const { vertices, triangles } = grid(5, 4);
    const handles: ArapHandle[] = [{ vertex: 0, target: [0, 0] }, { vertex: 19, target: [2, 5] }];
    const expected = solveArapMesh(vertices, triangles, handles);
    const other = vertices.map(([x, y]): Vec2 => [x * 1e8, y * 1e8]);
    const combined = solveArapMesh([...vertices, ...other], [
      ...triangles, ...triangles.map((triangle): [number, number, number] => [triangle[0] + 20, triangle[1] + 20, triangle[2] + 20]),
    ], [
      ...handles, ...handles.map((handle) => ({ vertex: handle.vertex + 20, target: [handle.target[0] * 1e8, handle.target[1] * 1e8] as Vec2 })),
    ]);
    expectPositions(combined.slice(0, 20), expected, 6);
    expectPositions(combined.slice(20).map(([x, y]): Vec2 => [x / 1e8, y / 1e8]), expected, 6);
  });

  it("copies the immutable rest cache and never exposes handle/input/output references", () => {
    const { vertices, triangles } = grid(3, 3);
    const saved = vertices.map((position): Vec2 => [...position]);
    const solver = createArapSolver(vertices, triangles);
    vertices[0]![0] = 99;
    triangles[0]![0] = 999;
    const handle: ArapHandle = { vertex: 0, target: [4, 5] };
    const result = solver.solve([handle]);
    result[0]![0] = 900;
    expect(handle.target).toEqual([4, 5]);
    expect(solver.solve([])).toEqual(saved);
    expect(solver.solve([handle])[0]).toEqual([4, 5]);
  });

  it("validates coordinates, indices, conflicting constraints, options and mesh budget", () => {
    expect(() => createArapSolver([[NaN, 0]], [])).toThrow(/finite/);
    expect(() => createArapSolver([[0, Infinity]], [])).toThrow(/finite/);
    expect(() => createArapSolver([[0, 0]], [[0, 1, 0]])).toThrow(/indices/);
    expect(() => createArapSolver([[0, 0]], [[0, 0.5, 0]])).toThrow(/indices/);
    expect(() => createArapSolver(Array.from({ length: 4097 }, (): Vec2 => [0, 0]), [])).toThrow(/4096/);
    const { vertices, triangles } = grid(3, 3);
    const solver = createArapSolver(vertices, triangles);
    expect(() => solver.solve([{ vertex: 9, target: [0, 0] }])).toThrow(/existing/);
    expect(() => solver.solve([{ vertex: 0, target: [NaN, 0] }])).toThrow(/finite/);
    expect(() => solver.solve([{ vertex: 0, target: [0, 0] }, { vertex: 0, target: [1, 0] }])).toThrow(/conflicting/);
    expect(solver.solve([{ vertex: 0, target: [0, 0] }, { vertex: 0, target: [0, 0] }])).toEqual(vertices);
    expect(() => solver.solve([], { iterations: -1 })).toThrow(/positive integer/);
    expect(() => solver.solve([], { maxCgIterations: 1.5 })).toThrow(/positive integer/);
    expect(() => solver.solve([], { tolerance: 0 })).toThrow(/positive/);
  });

  it("uses sparse work for an interactive mesh and caps user-supplied iteration budgets", () => {
    const { vertices, triangles } = grid(21, 21);
    const handles: ArapHandle[] = [
      { vertex: 0, target: [0, 0] }, { vertex: 20, target: [20, 0] }, { vertex: 440, target: [15, 23] },
    ];
    const solver = createArapSolver(vertices, triangles);
    const start = performance.now();
    const result = solver.solve(handles);
    // Informational timing only: shared cloud machine load is not a correctness check.
    console.info(`ARAP sparse 441 vertices / ${triangles.length} triangles: ${(performance.now() - start).toFixed(1)}ms`);
    expect(result).toHaveLength(vertices.length);
    for (const handle of handles) expect(result[handle.vertex]).toEqual(handle.target);
    expect(result.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
    const small = grid(3, 3);
    const smallSolver = createArapSolver(small.vertices, small.triangles);
    const smallHandles: ArapHandle[] = [{ vertex: 0, target: [0, 0] }, { vertex: 8, target: [1, 3] }];
    expect(smallSolver.solve(smallHandles, { iterations: 1e6, maxCgIterations: 1e6 }))
      .toEqual(smallSolver.solve(smallHandles, { iterations: 64, maxCgIterations: 1024 }));
  });
});
