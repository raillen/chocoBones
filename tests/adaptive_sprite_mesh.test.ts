import { describe, expect, it } from "vitest";
import { type SpriteImage } from "../src/assets/png";
import { type Vec2 } from "../src/core/types";
import { buildAdaptiveSpriteMesh, insertMeshPoints, type AdaptiveSpriteMeshOptions } from "../src/mesh/adaptive_sprite_mesh";
import { type Mesh, MeshMode, SkinningMode } from "../src/mesh/mesh";
import { drawTexturedMesh } from "../src/render/sprite_raster";

function sprite(width: number, height: number, alpha: (x: number, y: number) => number): SpriteImage {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set([180, 80, 30, alpha(x, y)], (y * width + x) * 4);
  return { width, height, pixels, png: Buffer.alloc(0) };
}
const options: AdaptiveSpriteMeshOptions = { rows: 4, cols: 4, alphaThreshold: 12, edgeSize: 2 };
const area2 = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const area = (mesh: Mesh): number => mesh.triangles.reduce((sum, [a, b, c]) => sum + area2(mesh.vertices[a]!, mesh.vertices[b]!, mesh.vertices[c]!) / 2, 0);

function validTopology(mesh: Mesh, checkJunctions = true): void {
  const keys = mesh.vertices.map(([x, y]) => `${x},${y}`);
  expect(new Set(keys).size).toBe(keys.length);
  const edges = new Map<string, [number, number]>();
  for (const t of mesh.triangles) {
    expect(new Set(t).size).toBe(3);
    expect(area2(mesh.vertices[t[0]]!, mesh.vertices[t[1]]!, mesh.vertices[t[2]]!)).toBeGreaterThan(0);
    for (let i = 0; i < 3; i++) {
      const a = t[i]!, b = t[(i + 1) % 3]!;
      edges.set(`${Math.min(a, b)},${Math.max(a, b)}`, [a, b]);
    }
  }
  if (!checkJunctions) return;
  for (const [a, b] of edges.values()) {
    const p = mesh.vertices[a]!, q = mesh.vertices[b]!;
    const length2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
    for (let i = 0; i < mesh.vertices.length; i++) {
      if (i === a || i === b) continue;
      const v = mesh.vertices[i]!;
      const dot = (v[0] - p[0]) * (q[0] - p[0]) + (v[1] - p[1]) * (q[1] - p[1]);
      if (dot <= 1e-9 || dot >= length2 - 1e-9) continue;
      expect(Math.abs(area2(p, q, v)), `T-junction vertex ${i} on ${a}-${b}`).toBeGreaterThan(1e-9);
    }
  }
}
function covers(mesh: Mesh, point: Vec2): boolean {
  return mesh.triangles.some(([a, b, c]) => {
    const p = mesh.vertices[a]!, q = mesh.vertices[b]!, r = mesh.vertices[c]!;
    return area2(p, q, point) >= -1e-9 && area2(q, r, point) >= -1e-9 && area2(r, p, point) >= -1e-9;
  });
}
function quad(): { mesh: Mesh; uvs: Vec2[] } {
  return {
    mesh: { density: 4, vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], triangles: [[0, 1, 2], [0, 2, 3]],
      weights: [[{ joint: "left", weight: 1 }], [{ joint: "right", weight: 1 }], [{ joint: "right", weight: 1 }], [{ joint: "left", weight: 1 }]],
      erased: [3], mode: MeshMode.Skin, skinning: SkinningMode.DualQuaternion, strength: 0.6 },
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
  };
}

describe("conforming adaptive sprite mesh", () => {
  it("leaves a fully opaque interior coarse and preserves complete area, UVs and positive winding", () => {
    const image = sprite(97, 61, () => 255);
    const built = buildAdaptiveSpriteMesh(image, { ...options, rows: 7, cols: 9 });
    expect(built.stats).toEqual({ vertices: 80, triangles: 126, refinedCells: 0, budgetLimited: false });
    expect(area(built.mesh)).toBeCloseTo(97 * 61, 8);
    built.uvs.forEach(([u, v], i) => expect([u, v]).toEqual([built.mesh.vertices[i]![0] / 97, built.mesh.vertices[i]![1] / 61]));
    validTopology(built.mesh);
  });
  it("refines only mixed cells and conforms coarse neighbors to multiple fine edge points", () => {
    const image = sprite(96, 80, (x, y) => x < 63 && y < 69 ? 255 : 0);
    const built = buildAdaptiveSpriteMesh(image, { ...options, edgeSize: 3 });
    expect(built.stats.refinedCells).toBeGreaterThan(0);
    expect(built.stats.vertices).toBeLessThan(33 * 28);
    expect(built.stats.budgetLimited).toBe(false);
    expect(built.mesh.vertices).toContainEqual([24, 20]);
    expect(covers(built.mesh, [20, 20])).toBe(true);
    expect(covers(built.mesh, [90, 75])).toBe(false);
    validTopology(built.mesh);
  });
  it("uses every pixel to retain isolated one-pixel islands, thin strips and partial border cells", () => {
    const image = sprite(81, 59, (x, y) => (x === 80 || y === 58 || (x === 3 && y === 7) || (x === 53 && y === 29)) ? 255 : 0);
    const built = buildAdaptiveSpriteMesh(image, { ...options, rows: 9, cols: 11 });
    for (const p of [[80.5, 0.5], [0.5, 58.5], [3.5, 7.5], [53.5, 29.5]] as Vec2[]) expect(covers(built.mesh, p)).toBe(true);
    expect(covers(built.mesh, [35, 20])).toBe(false);
    validTopology(built.mesh);
  });
  it("removes empty hole cells while retaining small holes exactly through alpha texture UVs", () => {
    const image = sprite(48, 48, (x, y) => (x >= 14 && x < 34 && y >= 14 && y < 34) || (x === 5 && y === 5) ? 0 : 128);
    const built = buildAdaptiveSpriteMesh(image, options);
    expect(covers(built.mesh, [24, 24])).toBe(false);
    const target = { width: 48, height: 48, pixels: new Uint8ClampedArray(48 * 48 * 4) };
    drawTexturedMesh(target, built.mesh.vertices, built.mesh.triangles, built.uvs, image, 1);
    for (let i = 3; i < image.pixels.length; i += 4) expect(target.pixels[i]).toBe(image.pixels[i]);
    validTopology(built.mesh);
  });
  it("keeps occupancy consistent with the threshold and never emits triangles for an empty cell", () => {
    const image = sprite(40, 40, (x, y) => x === 27 && y === 6 ? 11 : 0);
    expect(buildAdaptiveSpriteMesh(image, options).stats).toEqual({ vertices: 0, triangles: 0, refinedCells: 0, budgetLimited: false });
    const built = buildAdaptiveSpriteMesh(image, { ...options, alphaThreshold: 11 });
    expect(covers(built.mesh, [27.5, 6.5])).toBe(true);
    expect(covers(built.mesh, [3, 3])).toBe(false);
    validTopology(built.mesh);
  });
  it("honors the vertex budget on adversarial alpha and reports the interrupted refinement", () => {
    const image = sprite(256, 256, (x, y) => (x + y) % 2 ? 255 : 0);
    const built = buildAdaptiveSpriteMesh(image, { ...options, maxVertices: 128 });
    expect(built.stats.vertices).toBeLessThanOrEqual(128);
    expect(built.stats.refinedCells).toBeGreaterThan(0);
    expect(built.stats.budgetLimited).toBe(true);
    expect(area(built.mesh)).toBe(256 * 256);
    validTopology(built.mesh);
    expect(buildAdaptiveSpriteMesh(image, { ...options, maxVertices: 128 })).toEqual(built);
  });
  it("caps even a larger requested budget at 4096 and preserves all checkerboard islands", () => {
    const image = sprite(1024, 1024, (x, y) => (x + y) % 2 ? 255 : 0);
    const built = buildAdaptiveSpriteMesh(image, { ...options, maxVertices: 100000 });
    expect(built.stats.vertices).toBeLessThanOrEqual(4096);
    expect(built.stats.vertices).toBeGreaterThan(3000);
    expect(built.stats.budgetLimited).toBe(true);
    expect(area(built.mesh)).toBe(1024 * 1024);
    validTopology(built.mesh, false);
  });
  it("backs down the requested grid under a smaller budget without deleting opaque coverage", () => {
    const built = buildAdaptiveSpriteMesh(sprite(97, 61, () => 255), { ...options, rows: 48, cols: 48, maxVertices: 100 });
    expect(built.stats.vertices).toBeLessThanOrEqual(100);
    expect(built.mesh.density).toBeGreaterThanOrEqual(4);
    expect(built.stats.budgetLimited).toBe(true);
    expect(area(built.mesh)).toBeCloseTo(97 * 61);
    validTopology(built.mesh);
  });
  it("rejects budgets below the occupied minimum rather than returning an incomplete mesh", () => {
    const image = sprite(20, 20, () => 255);
    expect(() => buildAdaptiveSpriteMesh(image, { ...options, maxVertices: 3 })).toThrow(/quatro/);
    expect(() => buildAdaptiveSpriteMesh(image, { ...options, maxVertices: 24 })).toThrow(/grade alfa mínima/);
  });
  it("clamps source grid, threshold and edge quality, and does not alter the source image", () => {
    const image = sprite(16, 12, () => 255), before = image.pixels.slice();
    const built = buildAdaptiveSpriteMesh(image, { rows: -1, cols: 90, alphaThreshold: 0, edgeSize: -5 });
    expect(built.stats.triangles).toBe(4 * 48 * 2);
    expect(image.pixels).toEqual(before);
    validTopology(built.mesh);
  });
});

describe("exact mesh constraint points", () => {
  it("splits an interior triangle at the exact position and interpolates UVs and joint weights", () => {
    const source = quad(), before = structuredClone(source);
    const inserted = insertMeshPoints(source.mesh, source.uvs, [[7, 2]]);
    expect(inserted.indices).toEqual([4]);
    expect(inserted.mesh.vertices[4]).toEqual([7, 2]);
    expect(inserted.uvs[4]![0]).toBeCloseTo(0.7);
    expect(inserted.uvs[4]![1]).toBeCloseTo(0.2);
    expect(inserted.mesh.weights[4]).toEqual([{ joint: "left", weight: 0.3 }, { joint: "right", weight: 0.7 }]);
    expect([inserted.mesh.mode, inserted.mesh.skinning, inserted.mesh.strength, inserted.mesh.erased]).toEqual([MeshMode.Skin, SkinningMode.DualQuaternion, 0.6, [3]]);
    expect(source).toEqual(before);
    expect(area(inserted.mesh)).toBe(100);
    validTopology(inserted.mesh);
  });
  it("splits both incident triangles of a shared edge and can split the new edge again", () => {
    const source = quad();
    const inserted = insertMeshPoints(source.mesh, source.uvs, [[2.5, 2.5], [1.25, 1.25]]);
    expect(inserted.indices).toEqual([4, 5]);
    expect(inserted.mesh.triangles.length).toBe(6);
    expect(inserted.mesh.triangles.filter((t) => t.includes(5)).length).toBe(4);
    expect(inserted.mesh.triangles.some((t) => t.includes(0) && t.includes(4))).toBe(false);
    expect(area(inserted.mesh)).toBe(100);
    validTopology(inserted.mesh);
  });
  it("handles exterior boundary edges, deduplicates exact points and returns null outside", () => {
    const source = quad();
    const points: Vec2[] = [[0, 0], [5, 0], [5, 0], [15, 0], [5, -1], [NaN, 1], [Infinity, 2]];
    const inserted = insertMeshPoints(source.mesh, source.uvs, points);
    expect(inserted.indices).toEqual([0, 4, 4, null, null, null, null]);
    expect(inserted.mesh.vertices[4]).toEqual([5, 0]);
    expect(inserted.mesh.triangles.length).toBe(3);
    expect(area(inserted.mesh)).toBe(100);
    validTopology(inserted.mesh);
    expect(insertMeshPoints(source.mesh, source.uvs, points)).toEqual(inserted);
  });
  it("leaves an empty mesh unchanged and rejects mismatched UV arrays", () => {
    const source = quad();
    expect(() => insertMeshPoints(source.mesh, [], [[1, 1]])).toThrow(/coordenada UV/);
    const empty = { ...source.mesh, vertices: [], triangles: [], weights: [], erased: [] };
    expect(insertMeshPoints(empty, [], [[1, 1]])).toEqual({ mesh: empty, uvs: [], indices: [null] });
  });
  it("selects the genuinely collinear edge when a boundary point is very close to a corner", () => {
    const source = quad();
    const inserted = insertMeshPoints(source.mesh, source.uvs, [[1e-12, 0]]);
    expect(inserted.indices).toEqual([4]);
    expect(inserted.mesh.vertices[4]).toEqual([1e-12, 0]);
    expect(area(inserted.mesh)).toBeCloseTo(100);
    validTopology(inserted.mesh, false);
  });
  it("inserts constraints on adaptive coarse/fine junctions without new T-junctions or lost area", () => {
    const built = buildAdaptiveSpriteMesh(sprite(72, 56, (x, y) => x < 53 && y < 45 ? 255 : 0), options);
    const inserted = insertMeshPoints(built.mesh, built.uvs, [[18, 7], [17.3, 12.7], [17.3, 12.7], [71, 55]]);
    expect(inserted.indices[0]).not.toBeNull(); expect(inserted.indices[1]).not.toBeNull();
    expect(inserted.indices[1]).toBe(inserted.indices[2]); expect(inserted.indices[3]).toBeNull();
    expect(inserted.mesh.vertices[inserted.indices[1]!]!).toEqual([17.3, 12.7]);
    expect(area(inserted.mesh)).toBeCloseTo(area(built.mesh));
    validTopology(inserted.mesh);
  });
});
