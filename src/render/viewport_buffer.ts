/**
 * chocoBones TypeScript Viewport Framebuffer Generator
 * Renderiza a cena 2D/3D em um buffer contínuo de pixels RGBA para exibição no Slint.
 */

import { matApply } from "../core/math";
import { Mat2x3 } from "../core/types";
import { mat4Apply, mat4Mul, mat4Perspective, OrbitCamera } from "../core/math3d";
import { Mesh3D } from "../mesh3d/mesh3d";
import { Joint, Layer } from "../rig/joint";

export class ViewportBuffer {
  public width: number;
  public height: number;
  public pixels: Uint8ClampedArray;

  constructor(width = 720, height = 500) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
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

  public drawGrid(
    gridSize = 32,
    panX = 0,
    panY = 0,
    zoom = 1.0,
    r = 28,
    g = 28,
    b = 34
  ): void {
    const step = Math.max(8, gridSize * zoom);
    const startX = ((panX * zoom) % step + step) % step;
    const startY = ((panY * zoom) % step + step) % step;

    // Linhas verticais
    for (let x = startX; x < this.width; x += step) {
      const px = Math.floor(x);
      for (let y = 0; y < this.height; y++) {
        const idx = (y * this.width + px) * 4;
        this.pixels[idx] = r;
        this.pixels[idx + 1] = g;
        this.pixels[idx + 2] = b;
      }
    }

    // Linhas horizontais
    for (let y = startY; y < this.height; y += step) {
      const py = Math.floor(y);
      for (let x = 0; x < this.width; x++) {
        const idx = (py * this.width + x) * 4;
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

  public drawLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    r: number,
    g: number,
    b: number
  ): void {
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

  public drawThickLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    thickness: number,
    r: number,
    g: number,
    b: number
  ): void {
    const half = Math.floor(thickness / 2);
    for (let ox = -half; ox <= half; ox++) {
      for (let oy = -half; oy <= half; oy++) {
        if (ox * ox + oy * oy <= half * half + 1) {
          this.drawLine(x0 + ox, y0 + oy, x1 + ox, y1 + oy, r, g, b);
        }
      }
    }
  }

  public drawCircle(
    cx: number,
    cy: number,
    radius: number,
    r: number,
    g: number,
    b: number
  ): void {
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

  public drawCircleOutline(
    cx: number,
    cy: number,
    radius: number,
    thickness: number,
    r: number,
    g: number,
    b: number
  ): void {
    const rOuter = radius + thickness;
    const rInner = Math.max(0, radius - thickness);
    const minX = Math.max(0, Math.floor(cx - rOuter));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + rOuter));
    const minY = Math.max(0, Math.floor(cy - rOuter));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + rOuter));
    const outSq = rOuter * rOuter;
    const inSq = rInner * rInner;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dSq = dx * dx + dy * dy;
        if (dSq <= outSq && dSq >= inSq) {
          this.setPixel(x, y, r, g, b);
        }
      }
    }
  }

  public drawRectOutline(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    g: number,
    b: number
  ): void {
    const rx = Math.floor(x);
    const ry = Math.floor(y);
    const rw = Math.floor(w);
    const rh = Math.floor(h);

    this.drawLine(rx, ry, rx + rw, ry, r, g, b);
    this.drawLine(rx + rw, ry, rx + rw, ry + rh, r, g, b);
    this.drawLine(rx + rw, ry + rh, rx, ry + rh, r, g, b);
    this.drawLine(rx, ry + rh, rx, ry, r, g, b);
  }

  public screenToWorld(
    sx: number,
    sy: number,
    panX = 0,
    panY = 0,
    zoom = 1.0
  ): [number, number] {
    const wx = (sx - panX) / zoom;
    const wy = (sy - panY) / zoom;
    return [wx, wy];
  }

  public worldToScreen(
    wx: number,
    wy: number,
    panX = 0,
    panY = 0,
    zoom = 1.0
  ): [number, number] {
    const sx = wx * zoom + panX;
    const sy = wy * zoom + panY;
    return [sx, sy];
  }

  /**
   * Renderiza as juntas articuladas e os ossos conectores em tempo real com pan/zoom
   */
  public renderSkeleton(
    joints: readonly Joint[],
    bones: Map<string, Mat2x3>,
    selectedJointId = "",
    panX = 0,
    panY = 0,
    zoom = 1.0
  ): void {
    // 1. Conexões de ossos (linhas espessas)
    for (const j of joints) {
      if (j.parent === "") continue;

      const jMat = bones.get(j.id);
      const pMat = bones.get(j.parent);
      if (!jMat || !pMat) continue;

      const [jWorldX, jWorldY] = matApply(jMat, [0, 0]);
      const [pWorldX, pWorldY] = matApply(pMat, [0, 0]);

      const [sx0, sy0] = this.worldToScreen(pWorldX, pWorldY, panX, panY, zoom);
      const [sx1, sy1] = this.worldToScreen(jWorldX, jWorldY, panX, panY, zoom);

      // Osso âmbar (#f59e0b)
      this.drawThickLine(sx0, sy0, sx1, sy1, Math.max(2, Math.floor(3 * zoom)), 245, 158, 11);
    }

    // 2. Nós das juntas
    for (const j of joints) {
      const bMat = bones.get(j.id);
      if (!bMat) continue;

      const [jWorldX, jWorldY] = matApply(bMat, [0, 0]);
      const [sx, sy] = this.worldToScreen(jWorldX, jWorldY, panX, panY, zoom);

      const isRoot = j.id === "root" || j.parent === "";
      const isSelected = j.id === selectedJointId;

      const radius = Math.max(4, Math.floor(5 * zoom));

      if (isRoot) {
        // Raiz: Dourado (#eab308)
        this.drawCircle(sx, sy, radius + 1, 234, 179, 8);
      } else if (j.parent === "root") {
        // Primárias: Azul (#3b82f6)
        this.drawCircle(sx, sy, radius, 59, 130, 246);
      } else {
        // Secundárias / Extremidades: Esmeralda (#10b981)
        this.drawCircle(sx, sy, radius, 16, 185, 129);
      }

      // Halo / Anel de Seleção para a junta ativa
      if (isSelected) {
        this.drawCircleOutline(sx, sy, radius + 3, 2, 255, 255, 255);
      }
    }
  }

  /**
   * Renderiza os envelopes das camadas vinculadas às juntas
   */
  public renderLayers(
    layers: readonly Layer[],
    bones: Map<string, Mat2x3>,
    selectedLayerId = "",
    panX = 0,
    panY = 0,
    zoom = 1.0
  ): void {
    for (const lyr of layers) {
      if (!lyr.visible) continue;
      if (!lyr.joint) continue;

      const bMat = bones.get(lyr.joint);
      if (!bMat) continue;

      const [jWorldX, jWorldY] = matApply(bMat, [0, 0]);
      const [sx, sy] = this.worldToScreen(jWorldX, jWorldY, panX, panY, zoom);

      const isSelected = lyr.id === selectedLayerId;
      const boxW = Math.max(24, Math.floor(40 * zoom));
      const boxH = Math.max(18, Math.floor(30 * zoom));

      const r = isSelected ? 250 : 113;
      const g = isSelected ? 204 : 113;
      const b = isSelected ? 21 : 122;

      this.drawRectOutline(sx - boxW / 2, sy - boxH / 2, boxW, boxH, r, g, b);
    }
  }

  /**
   * Renderiza malha 3D com câmera orbital em projeção perspectiva
   */
  public render3D(mesh: Mesh3D, camera: OrbitCamera): void {
    const aspect = this.width / this.height;
    const proj = mat4Perspective((45 * Math.PI) / 180, aspect, 0.1, 100.0);
    const view = camera.getViewMatrix();
    const vp = mat4Mul(view, proj);

    const projected: Array<[number, number] | null> = [];

    for (const v of mesh.vertices) {
      const p = mat4Apply(vp, v.pos);
      // Normalized Device Coordinates (-1 a +1)
      if (p[2] < -1.0 || p[2] > 1.0) {
        projected.push(null);
      } else {
        const sx = ((p[0] * 0.5 + 0.5) * this.width);
        const sy = ((-p[1] * 0.5 + 0.5) * this.height);
        projected.push([sx, sy]);
      }
    }

    // Desenha arestas em wireframe ciano/azul néon (#38bdf8)
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const i0 = mesh.indices[i]!;
      const i1 = mesh.indices[i + 1]!;
      const i2 = mesh.indices[i + 2]!;

      const p0 = projected[i0];
      const p1 = projected[i1];
      const p2 = projected[i2];

      if (p0 && p1) this.drawLine(p0[0], p0[1], p1[0], p1[1], 56, 189, 248);
      if (p1 && p2) this.drawLine(p1[0], p1[1], p2[0], p2[1], 56, 189, 248);
      if (p2 && p0) this.drawLine(p2[0], p2[1], p0[0], p0[1], 56, 189, 248);
    }
  }
}
