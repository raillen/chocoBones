import { matApply } from "../../../core/math";
import type { Vec2 } from "../../../core/types";
import type { SpriteImage } from "../../../assets/image";
import type { AppState } from "../../../ui/store";
import { ViewportBuffer } from "../../../render/viewport_buffer";
import { drawTexturedMesh } from "../../../render/sprite_raster";
import type { GeometryPacket, StageFrame } from "./protocol";

const vertexShader = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform mat3 u_matrix;
uniform vec2 u_pan;
uniform float u_zoom;
uniform vec2 u_viewport;
out vec2 v_uv;
void main() {
  vec2 world = (u_matrix * vec3(a_position, 1.0)).xy;
  vec2 screen = world * u_zoom + u_pan;
  gl_Position = vec4(screen.x / u_viewport.x * 2.0 - 1.0, 1.0 - screen.y / u_viewport.y * 2.0, 0.0, 1.0);
  v_uv = a_uv;
}`;
const fragmentShader = `#version 300 es
precision highp float;
uniform sampler2D u_texture;
uniform float u_opacity;
in vec2 v_uv;
out vec4 color;
void main() { color = texture(u_texture, v_uv) * u_opacity; }`;

interface GpuGeometry {
  vao: WebGLVertexArrayObject;
  position: WebGLBuffer;
  uv: WebGLBuffer;
  index: WebGLBuffer;
  document: string;
  packet: GeometryPacket | null;
  count: number;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Shader inválido.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

/** GPU draws cached textures and topology; only deformed positions change on each pose. */
export class GpuStageRenderer {
  readonly mode = "WebGL2";
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private locations: Record<string, WebGLUniformLocation | null>;
  private textures = new Map<string, { image: SpriteImage; texture: WebGLTexture }>();
  private geometries = new Map<string, GpuGeometry>();

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error("WebGL2 indisponível.");
    this.gl = gl;
    const vs = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Falha no renderizador.");
    this.program = program;
    this.locations = Object.fromEntries(["matrix", "pan", "zoom", "viewport", "texture", "opacity"]
      .map((name) => [name, gl.getUniformLocation(program, `u_${name}`)]));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  private texture(asset: string, image: SpriteImage): WebGLTexture {
    const gl = this.gl;
    const current = this.textures.get(asset);
    if (current?.image === image) return current.texture;
    if (current) gl.deleteTexture(current.texture);
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Typed-array uploads do not premultiply automatically. Premultiplying before filtering
    // matches the CPU rasterizer and prevents a dark fringe at transparent sprite edges.
    const pixels = new Uint8Array(image.pixels.length);
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = image.pixels[i + 3]!;
      pixels[i] = Math.round(image.pixels[i]! * alpha / 255);
      pixels[i + 1] = Math.round(image.pixels[i + 1]! * alpha / 255);
      pixels[i + 2] = Math.round(image.pixels[i + 2]! * alpha / 255);
      pixels[i + 3] = alpha;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, image.width, image.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    this.textures.set(asset, { image, texture });
    return texture;
  }

  private geometry(key: string, document: string, packet: GeometryPacket): GpuGeometry {
    const gl = this.gl;
    let item = this.geometries.get(key);
    if (!item) {
      item = { vao: gl.createVertexArray()!, position: gl.createBuffer()!, uv: gl.createBuffer()!,
        index: gl.createBuffer()!, document: "", packet: null, count: 0 };
      this.geometries.set(key, item);
      gl.bindVertexArray(item.vao);
      for (const [name, buffer] of [["position", item.position], ["uv", item.uv]] as const) {
        const location = gl.getAttribLocation(this.program, `a_${name}`);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
      }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, item.index);
    }
    gl.bindVertexArray(item.vao);
    if (item.document !== document) {
      gl.bindBuffer(gl.ARRAY_BUFFER, item.uv);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(packet.uvs), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, item.index);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, packet.triangles, gl.STATIC_DRAW);
      item.document = document;
      item.count = packet.triangles.length;
    }
    if (item.packet !== packet) {
      gl.bindBuffer(gl.ARRAY_BUFFER, item.position);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(packet.vertices), gl.DYNAMIC_DRAW);
      item.packet = packet;
    }
    return item;
  }

  render(state: AppState, frame: StageFrame | null, width: number, height: number): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!frame || state.viewportMode === "3D") return;
    gl.useProgram(this.program);
    gl.uniform2f(this.locations.viewport!, width, height);
    gl.uniform2f(this.locations.pan!, state.cameraPan.x, state.cameraPan.y);
    gl.uniform1f(this.locations.zoom!, state.cameraZoom);
    gl.uniform1i(this.locations.texture!, 0);
    const keep = new Set<string>();
    for (const draw of frame.draws) {
      const layer = state.layers.find((item) => item.id === draw.layer);
      const image = state.spriteAssets.get(draw.asset);
      const packet = frame.packets.get(draw.key);
      if (!layer?.visible || !image || !packet || (draw.ghost && !state.onionSkin)) continue;
      keep.add(draw.key);
      const geometry = this.geometry(draw.key, frame.document, packet);
      const m = draw.matrix;
      gl.uniformMatrix3fv(this.locations.matrix!, false, new Float32Array([m.a, m.b, 0, m.c, m.d, 0, m.tx, m.ty, 1]));
      gl.uniform1f(this.locations.opacity!, draw.opacity);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture(draw.asset, image));
      gl.bindVertexArray(geometry.vao);
      gl.drawElements(gl.TRIANGLES, geometry.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    for (const [key, item] of this.geometries) {
      if (keep.has(key)) continue;
      gl.deleteVertexArray(item.vao);
      gl.deleteBuffer(item.position);
      gl.deleteBuffer(item.uv);
      gl.deleteBuffer(item.index);
      this.geometries.delete(key);
    }
    for (const [key, item] of this.textures) if (!state.spriteAssets.has(key)) {
      gl.deleteTexture(item.texture);
      this.textures.delete(key);
    }
  }

  dispose(): void {
    const gl = this.gl;
    for (const item of this.geometries.values()) {
      gl.deleteVertexArray(item.vao);
      gl.deleteBuffer(item.position);
      gl.deleteBuffer(item.uv);
      gl.deleteBuffer(item.index);
    }
    for (const item of this.textures.values()) gl.deleteTexture(item.texture);
    gl.deleteProgram(this.program);
  }
}

/** Fallback keeps the same worker-computed vertices and transparent texture sampling. */
export class CpuStageRenderer {
  readonly mode = "Canvas2D";
  private context: CanvasRenderingContext2D;
  private buffer = new ViewportBuffer(1, 1);
  private scratch = document.createElement("canvas");

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível.");
    this.context = context;
  }

  render(state: AppState, frame: StageFrame | null, width: number, height: number): void {
    this.buffer.resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
    this.buffer.clear(0, 0, 0, 0);
    if (frame && state.viewportMode !== "3D") for (const draw of frame.draws) {
      const image = state.spriteAssets.get(draw.asset);
      const packet = frame.packets.get(draw.key);
      const layer = state.layers.find((item) => item.id === draw.layer);
      if (!layer?.visible || !image || !packet || (draw.ghost && !state.onionSkin)) continue;
      const vertices: Vec2[] = [];
      const uvs: Vec2[] = [];
      const triangles: [number, number, number][] = [];
      for (let i = 0; i < packet.vertices.length; i += 2) {
        const world = matApply(draw.matrix, [packet.vertices[i]!, packet.vertices[i + 1]!]);
        vertices.push(this.buffer.worldToScreen(...world, state.cameraPan.x, state.cameraPan.y, state.cameraZoom));
        uvs.push([packet.uvs[i]!, packet.uvs[i + 1]!]);
      }
      for (let i = 0; i < packet.triangles.length; i += 3) triangles.push([packet.triangles[i]!, packet.triangles[i + 1]!, packet.triangles[i + 2]!]);
      drawTexturedMesh(this.buffer, vertices, triangles, uvs, image, draw.opacity);
    }
    this.scratch.width = this.buffer.width;
    this.scratch.height = this.buffer.height;
    this.scratch.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(this.buffer.pixels), this.buffer.width, this.buffer.height), 0, 0);
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.scratch, 0, 0, this.canvas.width, this.canvas.height);
  }

  dispose(): void { this.scratch.width = this.scratch.height = 1; }
}
