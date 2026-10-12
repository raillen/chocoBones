/**
 * chocoBones geometria Fase 1-fechamento: contorno Moore + Douglas-Peucker +
 * triangulação intra-contorno + edição + validação topológica.
 */
import { Vec2 } from "../core/types";

export interface Contour {
  points: Vec2[];
  isHole: boolean;
}

/** Binariza alfa em máscara. */
export function alphaMask(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, threshold = 12): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      mask[y * w + x] = (rgba[(y * w + x) * 4 + 3] ?? 0) >= threshold ? 1 : 0;
    }
  }
  return mask;
}

/** Bounding box útil da máscara. */
export function maskBoundingBox(mask: Uint8Array, w: number, h: number): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Traçado de contorno Moore-Neighbor na borda externa da máscara.
 * Retorna polígono ordenado (último ≠ primeiro). Determinístico.
 */
export function traceContourMoore(mask: Uint8Array, w: number, h: number): Vec2[] {
  // Encontra pixel de borda inicial (varredura top-left)
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) {
        // é borda se vizinho 4-conectado vazio/fora
        const empty = (nx: number, ny: number): boolean => nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[ny * w + nx];
        if (empty(x - 1, y) || empty(x + 1, y) || empty(x, y - 1) || empty(x, y + 1)) {
          sx = x; sy = y; break outer;
        }
      }
    }
  }
  if (sx < 0) return [];
  // Moore com backtracking (8-vizinhança, ordem horária)
  const dirs: Array<[number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const contour: Vec2[] = [[sx, sy]];
  let cx = sx, cy = sy;
  let backDir = 4; // veio do oeste
  const maxSteps = w * h * 2;
  for (let step = 0; step < maxSteps; step++) {
    let found = false;
    for (let k = 0; k < 8; k++) {
      const di = (backDir + 1 + k) % 8;
      const nx = cx + dirs[di]![0];
      const ny = cy + dirs[di]![1];
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && mask[ny * w + nx]) {
        cx = nx; cy = ny;
        backDir = (di + 4) % 8;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break; // fechou
    contour.push([cx, cy]);
    if (contour.length > maxSteps) break;
  }
  return contour;
}

/** Distância ponto-segmento (p/ Douglas-Peucker). */
function perpDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs((p[0] - a[0]) * dy - (p[1] - a[1]) * dx) / len;
}

/** Simplificação Douglas-Peucker com tolerância (preserva cantos). */
export function simplifyDouglasPeucker(points: Vec2[], tolerance = 1.5): Vec2[] {
  if (points.length <= 2) return [...points];
  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [s, e] = stack.pop()!;
    let dmax = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(points[i]!, points[s]!, points[e]!);
      if (d > dmax) {
        dmax = d;
        idx = i;
      }
    }
    if (idx >= 0 && dmax > tolerance) {
      keep[idx] = true;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Área sinalizada (winding: >0 CCW). */
export function polygonArea(poly: Vec2[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

/** Point-in-polygon (ray casting). */
export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

export interface HullTriangulation {
  vertices: Vec2[];
  triangles: Array<[number, number, number]>;
}

/**
 * Triangulação intra-contorno: grade + ponto-em-polígono + rejeita degenerados.
 * Distribui vértices interiores; preserva borda; área mínima configurável.
 */
export function triangulateInsideContour(contour: Vec2[], cellSize = 12, minArea = 1e-6): HullTriangulation {
  if (contour.length < 3) return { vertices: [], triangles: [] };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of contour) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const vertices: Vec2[] = [];
  const index = new Map<string, number>();
  const vid = (gx: number, gy: number, x: number, y: number): number => {
    const key = `${gx}:${gy}`;
    const hit = index.get(key);
    if (hit !== undefined) return hit;
    const id = vertices.length;
    vertices.push([x, y]);
    index.set(key, id);
    return id;
  };
  const inside = (x: number, y: number): boolean => pointInPolygon([x, y], contour);
  const triangles: Array<[number, number, number]> = [];
  const cols = Math.ceil((maxX - minX) / cellSize);
  const rows = Math.ceil((maxY - minY) / cellSize);
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x0 = minX + gx * cellSize;
      const y0 = minY + gy * cellSize;
      const x1 = x0 + cellSize;
      const y1 = y0 + cellSize;
      // só quads com centro dentro (evita áreas transparentes)
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      if (!inside(cx, cy)) continue;
      const a = vid(gx, gy, x0, y0);
      const b = vid(gx + 1, gy, x1, y0);
      const c = vid(gx, gy + 1, x0, y1);
      const d = vid(gx + 1, gy + 1, x1, y1);
      const tris: Array<[number, number, number]> = [[a, b, d], [a, d, c]];
      for (const t of tris) {
        const p0 = vertices[t[0]]!;
        const p1 = vertices[t[1]]!;
        const p2 = vertices[t[2]]!;
        const area = Math.abs((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])) / 2;
        if (area < minArea) continue;
        // exige ao menos 2 vértices dentro (borda parcial ok)
        const insideCount = [p0, p1, p2].filter((p) => inside(p[0], p[1])).length;
        if (insideCount >= 2) triangles.push(t);
      }
    }
  }
  return { vertices, triangles };
}

export interface MeshTopologyIssue {
  kind: "degenerate" | "winding" | "isolated";
  tri?: number;
  vert?: number;
}

/** Valida winding consistente, área e vértices isolados. */
export function validateMeshTopology(vertices: Vec2[], triangles: Array<[number, number, number]>): MeshTopologyIssue[] {
  const issues: MeshTopologyIssue[] = [];
  let posWinding = 0;
  let negWinding = 0;
  triangles.forEach((t, i) => {
    const [a, b, c] = t;
    const p0 = vertices[a];
    const p1 = vertices[b];
    const p2 = vertices[c];
    if (!p0 || !p1 || !p2) {
      issues.push({ kind: "degenerate", tri: i });
      return;
    }
    const area2 = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
    if (Math.abs(area2) < 1e-9) issues.push({ kind: "degenerate", tri: i });
    else if (area2 > 0) posWinding++;
    else negWinding++;
  });
  if (posWinding > 0 && negWinding > 0) issues.push({ kind: "winding" });
  const used = new Set<number>();
  for (const t of triangles) for (const v of t) used.add(v);
  vertices.forEach((_, i) => {
    if (!used.has(i)) issues.push({ kind: "isolated", vert: i });
  });
  return issues;
}
