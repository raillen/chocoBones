/** Alpha-boundary refinement with shared, conforming edges and image-local UVs. */
import { type SpriteImage, validateSpriteImage } from "../assets/image";
import { type Vec2 } from "../core/types";
import { type Influence, type Mesh, MeshMode, SkinningMode } from "./mesh";

export interface AdaptiveSpriteMeshOptions {
  rows: number;
  cols: number;
  alphaThreshold: number;
  /** Maximum width/height of a refined boundary cell, in source pixels (2..32). */
  edgeSize: number;
  /** Hard limit, capped at 4096. A budget below the occupied 4x4 base grid is rejected. */
  maxVertices?: number;
}

interface Cell { x0: number; y0: number; x1: number; y1: number; mixed: boolean }
interface Grid { spanX: number; spanY: number; width: number; height: number }
interface Topology { corners: Vec2[]; polygons: number[][]; centers: Vec2[]; count: number }
const clamp = (n: number, low: number, high: number, fallback: number): number =>
  Math.max(low, Math.min(high, Number.isFinite(n) ? Math.round(n) : fallback));
const key = (x: number, y: number): string => `${x},${y}`;

function lowerBound(values: readonly number[], target: number): number {
  let low = 0, high = values.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (values[mid]! < target) low = mid + 1; else high = mid;
  }
  return low;
}

/** Only corners enter edge maps. Fan centers cannot create unrelated edge junctions. */
function topology(cells: readonly Cell[]): Topology {
  const corners: Vec2[] = [], polygons: number[][] = [], centers: Vec2[] = [];
  const ids = new Map<string, number>();
  const horizontal = new Map<number, Set<number>>(), vertical = new Map<number, Set<number>>();
  const corner = (x: number, y: number): void => {
    const coordinate = key(x, y);
    if (ids.has(coordinate)) return;
    ids.set(coordinate, corners.length); corners.push([x, y]);
    if (!horizontal.has(y)) horizontal.set(y, new Set());
    if (!vertical.has(x)) vertical.set(x, new Set());
    horizontal.get(y)!.add(x); vertical.get(x)!.add(y);
  };
  for (const c of cells) {
    corner(c.x0, c.y0); corner(c.x1, c.y0); corner(c.x1, c.y1); corner(c.x0, c.y1);
  }
  const hs = new Map(Array.from(horizontal, ([line, values]) => [line, [...values].sort((a, b) => a - b)]));
  const vs = new Map(Array.from(vertical, ([line, values]) => [line, [...values].sort((a, b) => a - b)]));
  for (const c of cells) {
    const polygon: number[] = [];
    const side = (values: number[], lo: number, hi: number, fixed: number, alongX: boolean, reverse: boolean): void => {
      const points: number[] = [];
      for (let i = lowerBound(values, lo); i < values.length && values[i]! <= hi; i++) {
        const value = values[i]!;
        points.push(ids.get(alongX ? key(value, fixed) : key(fixed, value))!);
      }
      if (reverse) points.reverse();
      // Every edge starts at the previous edge's endpoint. Include it once.
      if (polygon.length) points.shift();
      polygon.push(...points);
    };
    side(hs.get(c.y0)!, c.x0, c.x1, c.y0, true, false);
    side(vs.get(c.x1)!, c.y0, c.y1, c.x1, false, false);
    side(hs.get(c.y1)!, c.x0, c.x1, c.y1, true, true);
    side(vs.get(c.x0)!, c.y0, c.y1, c.x0, false, true);
    polygon.pop(); // closing copy of the first corner
    polygons.push(polygon);
    if (polygon.length > 4) centers.push([(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2]);
  }
  return { corners, polygons, centers, count: corners.length + centers.length };
}

/**
 * Counts all alpha pixels using an integral image: a one-pixel island is never
 * mistaken for an empty cell. Geometry approximates the silhouette to edgeSize;
 * normalized UVs retain the original alpha, including sub-cell transparent holes.
 * Mixed cells alone are split. Coarse edges incorporate every fine neighbor corner
 * before triangulation, preventing T-junction cracks without refining the interior.
 */
export function buildAdaptiveSpriteMesh(image: SpriteImage, options: AdaptiveSpriteMeshOptions): {
  mesh: Mesh; uvs: Vec2[];
  stats: { vertices: number; triangles: number; refinedCells: number; budgetLimited: boolean };
} {
  validateSpriteImage(image);
  let rows = clamp(options.rows, 4, 48, 12), cols = clamp(options.cols, 4, 48, 12);
  const threshold = clamp(options.alphaThreshold, 1, 255, 12);
  const edgeSize = Math.max(2, Math.min(32, Number.isFinite(options.edgeSize) ? options.edgeSize : 8));
  const requestedBudget = options.maxVertices ?? 4096;
  const budget = Number.isFinite(requestedBudget) ? Math.min(4096, Math.floor(requestedBudget)) : 4096;
  if (budget < 4) throw new RangeError("O orçamento de malha deve permitir pelo menos quatro vértices.");
  const stride = image.width + 1;
  const integral = new Uint32Array(stride * (image.height + 1));
  for (let y = 0; y < image.height; y++) {
    let total = 0;
    for (let x = 0; x < image.width; x++) {
      total += image.pixels[(y * image.width + x) * 4 + 3]! >= threshold ? 1 : 0;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + total;
    }
  }
  let grid: Grid, cells: Cell[], summary: Topology;
  let budgetLimited = false, refinedCells = 0;
  const classify = (x0: number, y0: number, x1: number, y1: number): Cell | null => {
    const left = Math.floor(x0 * image.width / grid.spanX), right = Math.ceil(x1 * image.width / grid.spanX);
    const top = Math.floor(y0 * image.height / grid.spanY), bottom = Math.ceil(y1 * image.height / grid.spanY);
    const occupied = integral[bottom * stride + right]! - integral[top * stride + right]! -
      integral[bottom * stride + left]! + integral[top * stride + left]!;
    if (occupied === 0) return null;
    return { x0, y0, x1, y1, mixed: occupied < (right - left) * (bottom - top) };
  };
  // If a custom budget cannot fit the requested base grid, reduce its density;
  // keep every occupied cell rather than silently dropping source pixels.
  while (true) {
    const sx = 2 ** Math.max(0, Math.ceil(Math.log2(image.width / cols / edgeSize)));
    const sy = 2 ** Math.max(0, Math.ceil(Math.log2(image.height / rows / edgeSize)));
    grid = { spanX: cols * sx, spanY: rows * sy, width: image.width, height: image.height };
    cells = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const cell = classify(x * sx, y * sy, (x + 1) * sx, (y + 1) * sy);
      if (cell) cells.push(cell);
    }
    summary = topology(cells);
    if (summary.count <= budget) break;
    budgetLimited = true;
    if (rows === 4 && cols === 4) {
      throw new RangeError(`O orçamento de ${budget} vértices não comporta a grade alfa mínima (${summary.count}).`);
    }
    if (cols >= rows && cols > 4) cols--; else rows--;
  }
  while (true) {
    const refinements = new Map<Cell, { order: number; children: Cell[] }>();
    for (const c of cells) {
      const splitX = (c.x1 - c.x0) * grid.width / grid.spanX > edgeSize;
      const splitY = (c.y1 - c.y0) * grid.height / grid.spanY > edgeSize;
      if (!c.mixed || (!splitX && !splitY)) continue;
      const xs = splitX ? [c.x0, (c.x0 + c.x1) / 2, c.x1] : [c.x0, c.x1];
      const ys = splitY ? [c.y0, (c.y0 + c.y1) / 2, c.y1] : [c.y0, c.y1];
      const children: Cell[] = [];
      for (let y = 0; y < ys.length - 1; y++) for (let x = 0; x < xs.length - 1; x++) {
        const child = classify(xs[x]!, ys[y]!, xs[x + 1]!, ys[y + 1]!);
        if (child) children.push(child);
      }
      refinements.set(c, { order: refinements.size, children });
    }
    if (!refinements.size) break;
    const apply = (count: number): Cell[] => cells.flatMap((c) => {
      const refinement = refinements.get(c);
      return refinement && refinement.order < count ? refinement.children : [c];
    });
    const candidate = apply(refinements.size), candidateSummary = topology(candidate);
    if (candidateSummary.count <= budget) {
      cells = candidate; summary = candidateSummary; refinedCells += refinements.size;
      continue;
    }
    // Fit a deterministic prefix of this refinement round. Counts are evaluated
    // on the conforming topology, including fan vertices on neighboring cells.
    budgetLimited = true;
    let low = 0, high = refinements.size;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (topology(apply(mid)).count <= budget) low = mid; else high = mid;
    }
    if (low > 0) { cells = apply(low); summary = topology(cells); refinedCells += low; }
    break;
  }
  const vertices: Vec2[] = summary.corners.map(([x, y]) => [x * image.width / grid.spanX, y * image.height / grid.spanY]);
  const triangles: [number, number, number][] = [];
  let centerIndex = 0;
  for (const polygon of summary.polygons) {
    if (polygon.length === 4) {
      triangles.push([polygon[0]!, polygon[1]!, polygon[2]!], [polygon[0]!, polygon[2]!, polygon[3]!]);
    } else {
      const [x, y] = summary.centers[centerIndex++]!;
      const center = vertices.length;
      vertices.push([x * image.width / grid.spanX, y * image.height / grid.spanY]);
      for (let i = 0; i < polygon.length; i++) triangles.push([polygon[i]!, polygon[(i + 1) % polygon.length]!, center]);
    }
  }
  const mesh: Mesh = {
    density: Math.max(rows, cols), vertices, triangles, weights: vertices.map(() => []), erased: [],
    mode: MeshMode.Pins, skinning: SkinningMode.Linear, strength: 1,
  };
  const uvs: Vec2[] = vertices.map(([x, y]) => [x / image.width, y / image.height]);
  return { mesh, uvs, stats: { vertices: vertices.length, triangles: triangles.length, refinedCells, budgetLimited } };
}

const area2 = (a: Vec2, b: Vec2, c: Vec2): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Insert exact hard-constraint positions while preserving incident-edge topology. */
export function insertMeshPoints(source: Mesh, sourceUvs: readonly Vec2[], points: readonly Vec2[]): {
  mesh: Mesh; uvs: Vec2[]; indices: (number | null)[];
} {
  if (sourceUvs.length !== source.vertices.length) throw new Error("Cada vértice da malha precisa de uma coordenada UV.");
  const mesh: Mesh = {
    ...source, vertices: source.vertices.map((p) => [...p]), triangles: source.triangles.map((t) => [...t]),
    weights: source.vertices.map((_, i) => (source.weights[i] ?? []).map((w) => ({ ...w }))), erased: [...source.erased],
  };
  const uvs: Vec2[] = sourceUvs.map((p) => [...p]);
  const indices: (number | null)[] = [];
  const ids = new Map(mesh.vertices.map(([x, y], i) => [key(x, y), i]));
  for (const point of points) {
    if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) { indices.push(null); continue; }
    const existing = ids.get(key(point[0], point[1]));
    if (existing !== undefined) { indices.push(existing); continue; }
    let containing = -1, barycentric: [number, number, number] | null = null;
    let edge: [number, number] | null = null;
    for (let i = 0; i < mesh.triangles.length; i++) {
      const t = mesh.triangles[i]!, a = mesh.vertices[t[0]]!, b = mesh.vertices[t[1]]!, c = mesh.vertices[t[2]]!;
      const area = area2(a, b, c);
      if (area === 0) continue;
      const bary: [number, number, number] = [area2(b, c, point) / area, area2(c, a, point) / area, area2(a, b, point) / area];
      const tolerance = Number.EPSILON * 32;
      if (bary.some((weight) => weight < -tolerance || weight > 1 + tolerance)) continue;
      containing = i; barycentric = bary;
      // Prefer exact collinearity: close to a corner two barycentric values can
      // be tiny, but splitting the wrong incident edge would create a flat face.
      let onEdge = bary.findIndex((weight) => weight === 0);
      if (onEdge < 0) {
        let closest = -1, distance = Infinity;
        for (let j = 0; j < bary.length; j++) {
          if (Math.abs(bary[j]!) < distance) { closest = j; distance = Math.abs(bary[j]!); }
        }
        if (distance <= tolerance) onEdge = closest;
      }
      if (onEdge >= 0) edge = [t[(onEdge + 1) % 3]!, t[(onEdge + 2) % 3]!];
      break;
    }
    if (containing < 0 || !barycentric) { indices.push(null); continue; }
    const triangle = mesh.triangles[containing]!;
    // Clamp only rounding noise in the interpolation; the inserted position stays exact.
    const bary = barycentric.map((weight) => Math.max(0, Math.min(1, weight)));
    const sum = bary.reduce((total, weight) => total + weight, 0);
    const uv: Vec2 = [0, 0], influences = new Map<string, number>();
    for (let i = 0; i < 3; i++) {
      const id = triangle[i]!, weight = bary[i]! / sum;
      uv[0] += uvs[id]![0] * weight; uv[1] += uvs[id]![1] * weight;
      for (const influence of mesh.weights[id]!) {
        influences.set(influence.joint, (influences.get(influence.joint) ?? 0) + influence.weight * weight);
      }
    }
    const id = mesh.vertices.length;
    mesh.vertices.push([...point]); uvs.push(uv);
    const weights: Influence[] = [...influences].filter(([, weight]) => weight !== 0).map(([joint, weight]) => ({ joint, weight }));
    mesh.weights.push(weights); ids.set(key(point[0], point[1]), id); indices.push(id);
    if (edge) {
      const [start, end] = edge;
      mesh.triangles = mesh.triangles.flatMap((t): [number, number, number][] => {
        for (let i = 0; i < 3; i++) {
          const a = t[i]!, b = t[(i + 1) % 3]!, c = t[(i + 2) % 3]!;
          if ((a === start && b === end) || (a === end && b === start)) return [[a, id, c], [id, b, c]];
        }
        return [t];
      });
    } else {
      const [a, b, c] = triangle;
      mesh.triangles.splice(containing, 1, [a, b, id], [b, c, id], [c, a, id]);
    }
  }
  return { mesh, uvs, indices };
}
