/**
 * chocoBones TypeScript Viewport Framebuffer Generator
 * Renderiza a cena 2D/3D em um buffer contínuo de pixels RGBA para exibição no Slint.
 */

import { matApply } from "../core/math";
import { Mat2x3 } from "../core/types";
import { Joint } from "../rig/joint";

export class ViewportBuffer {
  public width: number;
  public height: number;
  public pixels: Uint8ClampedArray;

  constructor(width = 640, height = 480) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  public clear(r = 18, g = 18, b = 20, a = 255): void {
    const total = this.width * this.height * 4;
    for (let i = 0; i < total; i += 4) {
      this.pixels[i] = r;
      this.pixels[i + 1] = g;
      this.pixels[i + 2] = b;
      this.pixels[i + 3] = a;
    }
  }

  public drawGrid(gridSize = 32, r = 32, g = 32, b = 38): void {
    // Linhas verticais
    for (let x = 0; x < this.width; x += gridSize) {
      for (let y = 0; y < this.height; y++) {
        const idx = (y * this.width + x) * 4;
        this.pixels[idx] = r;
        this.pixels[idx + 1] = g;
        this.pixels[idx + 2] = b;
      }
    }
    // Linhas horizontais
    for (let y = 0; y < this.height; y += gridSize) {
      for (let x = 0; x < this.width; x++) {
        const idx = (y * this.width + x) * 4;
        this.pixels[idx] = r;
        this.pixels[idx + 1] = g;
        this.pixels[idx + 2] = b;
      }
    }
  }

  public setPixel(x: number, y: number, r: number, g: number, b: number, a = 255): void {
    const px = Math.floor(x);
    const py = Math.floor(y);
    if (px < 0 || px >= this.width || py < 0 || py >= this.height) return;
    const idx = (py * this.width + px) * 4;
    this.pixels[idx] = r;
    this.pixels[idx + 1] = g;
    this.pixels[idx + 2] = b;
    this.pixels[idx + 3] = a;
  }

  public drawLine(x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number): void {
    let x = Math.floor(x0);
    let y = Math.floor(y0);
    const targetX = Math.floor(x1);
    const targetY = Math.floor(y1);

    const dx = Math.abs(targetX - x);
    const dy = Math.abs(targetY - y);
    const sx = x < targetX ? 1 : -1;
    const sy = y < targetY ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.setPixel(x, y, r, g, b);
      if (x === targetX && y === targetY) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  public drawCircle(cx: number, cy: number, radius: number, r: number, g: number, b: number): void {
    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius));
    const radSq = radius * radius;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radSq) {
          this.setPixel(x, y, r, g, b);
        }
      }
    }
  }

  /**
   * Renderiza as juntas articuladas e os ossos conectores em tempo real
   */
  public renderSkeleton(joints: readonly Joint[], bones: Map<string, Mat2x3>): void {
    for (const j of joints) {
      const bMat = bones.get(j.id);
      if (!bMat) continue;

      const jPos = matApply(bMat, [0, 0]);

      if (j.parent !== "") {
        const pMat = bones.get(j.parent);
        if (pMat) {
          const pPos = matApply(pMat, [0, 0]);
          this.drawLine(pPos[0], pPos[1], jPos[0], jPos[1], 234, 179, 8); // Osso amarelo/âmbar
        }
      }

      // Desenha cabeça/nó da junta
      this.drawCircle(jPos[0], jPos[1], 4, 59, 130, 246); // Azul
    }
  }
}
