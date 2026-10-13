/** Image-local alpha occupancy mesh. Every pixel is considered, including thin islands. */
import { SpriteImage, validateSpriteImage } from "../assets/image";
import { Vec2 } from "../core/types";
import { Mesh, MeshMode, SkinningMode } from "./mesh";

type SpritePixels = Pick<SpriteImage, "width" | "height" | "pixels">;
const divisions = (n: number): number => Math.max(4, Math.min(48, Number.isFinite(n) ? Math.round(n) : 12));
const alphaLimit = (n: number): number => Math.max(1, Math.min(255, Number.isFinite(n) ? Math.round(n) : 12));

export function buildSpriteMesh(image: SpritePixels, rows = 12, cols = 12, alphaThreshold = 12): { mesh: Mesh; uvs: Vec2[] } {
  validateSpriteImage(image);
  rows = divisions(rows); cols = divisions(cols);
  const threshold = alphaLimit(alphaThreshold);
  const vertices: Vec2[] = [], uvs: Vec2[] = [], triangles: [number, number, number][] = [];
  const vertexIds = new Map<number, number>();
  const vertex = (gx: number, gy: number): number => {
    const key = gy * (cols + 1) + gx;
    const existing = vertexIds.get(key);
    if (existing !== undefined) return existing;
    const id = vertices.length;
    vertexIds.set(key, id);
    vertices.push([gx * image.width / cols, gy * image.height / rows]);
    uvs.push([gx / cols, gy / rows]);
    return id;
  };
  for (let gy = 0; gy < rows; gy++) {
    const y0 = Math.floor(gy * image.height / rows), y1 = Math.min(image.height, Math.ceil((gy + 1) * image.height / rows));
    for (let gx = 0; gx < cols; gx++) {
      const x0 = Math.floor(gx * image.width / cols), x1 = Math.min(image.width, Math.ceil((gx + 1) * image.width / cols));
      let occupied = false;
      for (let y = y0; y < y1 && !occupied; y++) {
        for (let x = x0; x < x1; x++) {
          if (image.pixels[(y * image.width + x) * 4 + 3]! >= threshold) { occupied = true; break; }
        }
      }
      if (!occupied) continue;
      const a = vertex(gx, gy), b = vertex(gx + 1, gy), c = vertex(gx, gy + 1), d = vertex(gx + 1, gy + 1);
      triangles.push([a, b, d], [a, d, c]);
    }
  }
  const mesh: Mesh = {
    density: Math.max(rows, cols), vertices, triangles, weights: vertices.map(() => []), erased: [],
    mode: MeshMode.Pins, skinning: SkinningMode.Linear, strength: 1,
  };
  return { mesh, uvs };
}

/** Keep a valid point, or snap to the nearest opaque pixel center. Null means empty alpha. */
export function nearestOpaquePoint(image: SpritePixels, x: number, y: number, alphaThreshold = 12): Vec2 | null {
  validateSpriteImage(image);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const threshold = alphaLimit(alphaThreshold);
  if (x >= 0 && y >= 0 && x < image.width && y < image.height &&
      image.pixels[(Math.floor(y) * image.width + Math.floor(x)) * 4 + 3]! >= threshold) return [x, y];
  let result: Vec2 | null = null, bestDistance = Infinity;
  for (let py = 0; py < image.height; py++) {
    for (let px = 0; px < image.width; px++) {
      if (image.pixels[(py * image.width + px) * 4 + 3]! < threshold) continue;
      const distance = Math.hypot(px + 0.5 - x, py + 0.5 - y);
      if (distance < bestDistance) { bestDistance = distance; result = [px + 0.5, py + 0.5]; }
    }
  }
  return result;
}
