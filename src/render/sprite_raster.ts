/** Deterministic CPU textured triangle rasterizer; straight RGBA surface, premultiplied sampling. */
import { SpriteImage, validateSpriteImage, MAX_SPRITE_PIXELS } from "../assets/image";
import { Vec2 } from "../core/types";

export interface RasterSurface { width: number; height: number; pixels: Uint8ClampedArray; }
type SpritePixels = Pick<SpriteImage, "width" | "height" | "pixels">;
const cross = (a: Vec2, b: Vec2, c: Vec2): number => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const topLeft = (a: Vec2, b: Vec2): boolean => b[1] < a[1] || (b[1] === a[1] && b[0] > a[0]);
const validPoint = (p: Vec2 | undefined): p is Vec2 => !!p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 1e6 && Math.abs(p[1]) <= 1e6;

export function drawTexturedMesh(
  surface: RasterSurface, screenVerts: readonly Vec2[], triangles: readonly [number, number, number][],
  uvs: readonly Vec2[], asset: SpritePixels, opacity = 1,
): void {
  if (!Number.isInteger(surface.width) || !Number.isInteger(surface.height) || surface.width < 1 || surface.height < 1 ||
      surface.width * surface.height > MAX_SPRITE_PIXELS || surface.pixels.length !== surface.width * surface.height * 4) {
    throw new Error("Superfície RGBA inválida ou acima do limite de pixels.");
  }
  validateSpriteImage(asset);
  if (!Number.isFinite(opacity) || opacity <= 0) return;
  opacity = Math.min(1, opacity);
  const srcPixels = asset.pixels, srcWidth = asset.width, srcHeight = asset.height;
  for (const indices of triangles) {
    if (indices.some((i) => !Number.isInteger(i) || i < 0)) continue;
    const [ia, ib, ic] = indices;
    let a = screenVerts[ia], b = screenVerts[ib], c = screenVerts[ic];
    let ua = uvs[ia], ub = uvs[ib], uc = uvs[ic];
    if (!validPoint(a) || !validPoint(b) || !validPoint(c) || !validPoint(ua) || !validPoint(ub) || !validPoint(uc)) continue;
    let area = cross(a, b, c);
    if (Math.abs(area) < 1e-8) continue;
    if (area < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; area = -area; }
    const minX = Math.max(0, Math.ceil(Math.min(a[0], b[0], c[0]) - 0.5));
    const maxX = Math.min(surface.width - 1, Math.floor(Math.max(a[0], b[0], c[0]) - 0.5));
    const minY = Math.max(0, Math.ceil(Math.min(a[1], b[1], c[1]) - 0.5));
    const maxY = Math.min(surface.height - 1, Math.floor(Math.max(a[1], b[1], c[1]) - 0.5));
    if (minX > maxX || minY > maxY) continue;
    const ownA = topLeft(b, c), ownB = topLeft(c, a), ownC = topLeft(a, b);
    const inverseArea = 1 / area;
    const abX = b[0] - a[0], abY = b[1] - a[1];
    const bcX = c[0] - b[0], bcY = c[1] - b[1];
    const caX = a[0] - c[0], caY = a[1] - c[1];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const ea = bcX * (py - b[1]) - bcY * (px - b[0]);
        const eb = caX * (py - c[1]) - caY * (px - c[0]);
        const ec = abX * (py - a[1]) - abY * (px - a[0]);
        if (ea < 0 || (ea === 0 && !ownA) || eb < 0 || (eb === 0 && !ownB) || ec < 0 || (ec === 0 && !ownC)) continue;
        const wa = ea * inverseArea, wb = eb * inverseArea, wc = ec * inverseArea;
        const u = ua[0] * wa + ub[0] * wb + uc[0] * wc, v = ua[1] * wa + ub[1] * wb + uc[1] * wc;
        const tx = Math.max(0, Math.min(srcWidth - 1, u * srcWidth - 0.5));
        const ty = Math.max(0, Math.min(srcHeight - 1, v * srcHeight - 0.5));
        const x0 = Math.floor(tx), y0 = Math.floor(ty), x1 = Math.min(srcWidth - 1, x0 + 1), y1 = Math.min(srcHeight - 1, y0 + 1);
        const fx = tx - x0, fy = ty - y0;
        const i00 = (y0 * srcWidth + x0) * 4, i10 = (y0 * srcWidth + x1) * 4;
        const i01 = (y1 * srcWidth + x0) * 4, i11 = (y1 * srcWidth + x1) * 4;
        const w00 = srcPixels[i00 + 3]! / 255 * (1 - fx) * (1 - fy);
        const w10 = srcPixels[i10 + 3]! / 255 * fx * (1 - fy);
        const w01 = srcPixels[i01 + 3]! / 255 * (1 - fx) * fy;
        const w11 = srcPixels[i11 + 3]! / 255 * fx * fy;
        const sa = w00 + w10 + w01 + w11;
        const sr = srcPixels[i00]! * w00 + srcPixels[i10]! * w10 + srcPixels[i01]! * w01 + srcPixels[i11]! * w11;
        const sg = srcPixels[i00 + 1]! * w00 + srcPixels[i10 + 1]! * w10 + srcPixels[i01 + 1]! * w01 + srcPixels[i11 + 1]! * w11;
        const sb = srcPixels[i00 + 2]! * w00 + srcPixels[i10 + 2]! * w10 + srcPixels[i01 + 2]! * w01 + srcPixels[i11 + 2]! * w11;
        const alpha = sa * opacity;
        if (alpha <= 0) continue;
        const dst = (y * surface.width + x) * 4, dstAlpha = surface.pixels[dst + 3]! / 255;
        const remainder = dstAlpha * (1 - alpha), outAlpha = alpha + remainder;
        // Numerical UV noise at a transparent edge must not create hidden RGB.
        if (Math.round(outAlpha * 255) === 0) continue;
        surface.pixels[dst] = Math.round((sr * opacity + surface.pixels[dst]! * remainder) / outAlpha);
        surface.pixels[dst + 1] = Math.round((sg * opacity + surface.pixels[dst + 1]! * remainder) / outAlpha);
        surface.pixels[dst + 2] = Math.round((sb * opacity + surface.pixels[dst + 2]! * remainder) / outAlpha);
        surface.pixels[dst + 3] = Math.round(outAlpha * 255);
      }
    }
  }
}
