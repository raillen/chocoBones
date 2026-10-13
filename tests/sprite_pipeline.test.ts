import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { decodePng, MAX_PNG_BYTES } from "../src/assets/png";
import { crc32, encodeRgbaToPng } from "../src/render/png_export";
import { buildSpriteMesh, nearestOpaquePoint } from "../src/mesh/sprite_mesh";
import { drawTexturedMesh, RasterSurface } from "../src/render/sprite_raster";
import { createPin, meshWorld } from "../src/mesh/mesh";
import { createPose, Layer } from "../src/rig/joint";
import { Vec2 } from "../src/core/types";

function chunk(name: string, data: Buffer): Buffer {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); result.write(name, 4, "ascii"); data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, data.length + 8)), data.length + 8);
  return result;
}
function png(width: number, height: number, color: number, raw: number[], extra: Buffer[] = [], depth = 8, interlace = 0): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = depth; header[9] = color; header[12] = interlace;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), ...extra,
    chunk("IDAT", deflateSync(Buffer.from(raw))), chunk("IEND", Buffer.alloc(0))]);
}
function sprite(width: number, height: number, color: number[] = [240, 100, 40, 255]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set(color, i);
  return { width, height, pixels };
}
function surface(width: number, height: number, fill: number[] = [0, 0, 0, 0]): RasterSurface {
  return sprite(width, height, fill);
}
const quad: Vec2[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
const quadTriangles: [number, number, number][] = [[0, 1, 2], [0, 2, 3]];

describe("bounded PNG import", () => {
  it("roundtrips RGBA with real alpha and preserves source bytes independently", () => {
    const pixels = new Uint8ClampedArray([255, 80, 10, 128, 0, 20, 255, 0]);
    const encoded = encodeRgbaToPng(2, 1, pixels), image = decodePng(encoded);
    expect([image.width, image.height]).toEqual([2, 1]);
    expect(image.pixels).toEqual(pixels); expect(image.png).toEqual(encoded);
    encoded[0] = 0; expect(image.png[0]).toBe(137);
  });
  it("reconstructs Sub, Up, Average and Paeth rows using channel-aware predictors", () => {
    // Five grayscale rows, including subtraction wraparound and the left/up tie in Paeth.
    const image = decodePng(png(3, 5, 0, [
      0, 10, 30, 70,
      1, 20, 30, 40,
      2, 5, 15, 235,
      3, 28, 75, 114,
      4, 20, 10, 5,
    ]));
    const grayscale = Array.from(image.pixels).filter((_, i) => i % 4 === 0);
    expect(grayscale).toEqual([10, 30, 70, 20, 50, 90, 25, 65, 69, 40, 127, 212, 60, 137, 217]);
    expect(Array.from(image.pixels).filter((_, i) => i % 4 === 3)).toEqual(new Array(15).fill(255));
    // Sub predicts from the previous pixel, not the previous component.
    const rgb = decodePng(png(2, 1, 2, [1, 10, 20, 30, 5, 10, 15]));
    expect(Array.from(rgb.pixels)).toEqual([10, 20, 30, 255, 15, 30, 45, 255]);
  });
  it("decodes palette, grayscale-alpha and transparent RGB samples", () => {
    const indexed = decodePng(png(3, 1, 3, [0, 0, 1, 2], [
      chunk("PLTE", Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255])), chunk("tRNS", Buffer.from([0, 128])),
    ]));
    expect(Array.from(indexed.pixels)).toEqual([255, 0, 0, 0, 0, 255, 0, 128, 0, 0, 255, 255]);
    expect(Array.from(decodePng(png(2, 1, 4, [0, 40, 120, 200, 0])).pixels)).toEqual([40, 40, 40, 120, 200, 200, 200, 0]);
    const transparent = Buffer.from([0, 10, 0, 20, 0, 30]);
    expect(Array.from(decodePng(png(2, 1, 2, [0, 10, 20, 30, 10, 20, 31], [chunk("tRNS", transparent)])).pixels))
      .toEqual([10, 20, 30, 0, 10, 20, 31, 255]);
    expect(Array.from(decodePng(png(2, 1, 0, [0, 5, 6], [chunk("tRNS", Buffer.from([0, 5]))])).pixels))
      .toEqual([5, 5, 5, 0, 6, 6, 6, 255]);
  });
  it("rejects corrupt CRC, truncated chunks, unsupported formats and unsafe dimensions", () => {
    const corrupt = png(1, 1, 6, [0, 255, 100, 40, 255]); corrupt[29] = corrupt[29]! ^ 1;
    expect(() => decodePng(corrupt)).toThrow(/CRC/);
    const good = png(1, 1, 6, [0, 255, 100, 40, 255]);
    expect(() => decodePng(good.subarray(0, good.length - 1))).toThrow(/chunk|Chunk|IEND/);
    expect(() => decodePng(png(1, 1, 6, [0], [], 16))).toThrow(/8 bits/);
    expect(() => decodePng(png(1, 1, 6, [0], [], 8, 1))).toThrow(/entrelaçado/);
    expect(() => decodePng(png(4097, 1, 6, [0]))).toThrow(/dimensões/);
    expect(() => decodePng(png(0, 1, 6, [0]))).toThrow(/dimensões/);
    expect(() => decodePng(Buffer.alloc(MAX_PNG_BYTES + 1))).toThrow(/10 MiB/);
    expect(() => decodePng(png(1, 1, 6, [0, 1, 2, 3, 4, ...new Array(10000).fill(0)]))).toThrow(/dimensões/);
    expect(() => decodePng(png(1, 1, 6, [9, 1, 2, 3, 4]))).toThrow(/Filtro/);
    expect(() => decodePng(png(1, 1, 3, [0, 1], [chunk("PLTE", Buffer.from([0, 0, 0]))]))).toThrow(/paleta/);
  });
  it("reads the project's actual PNG fixture with a populated transparent silhouette", () => {
    const image = decodePng(readFileSync("assets/test-kits/frontier-survival/vector-rig/base-survivor.png"));
    expect(image.width).toBeGreaterThan(32); expect(image.height).toBeGreaterThan(32);
    const alphas = Array.from(image.pixels).filter((_, i) => i % 4 === 3);
    expect(alphas.some((a) => a === 0)).toBe(true); expect(alphas.some((a) => a === 255)).toBe(true);
  });
});

describe("alpha occupancy mesh and pin snapping", () => {
  it("keeps isolated single pixels between old five-point samples, with image-local vertices and UVs", () => {
    const image = sprite(40, 40, [0, 0, 0, 0]);
    image.pixels[(3 * 40 + 3) * 4 + 3] = 255;
    image.pixels[(36 * 40 + 36) * 4 + 3] = 255;
    const { mesh, uvs } = buildSpriteMesh(image, 4, 4, 12);
    expect(mesh.triangles.length).toBe(4); expect(mesh.vertices.length).toBe(8);
    expect(mesh.vertices).toContainEqual([0, 0]); expect(mesh.vertices).toContainEqual([40, 40]);
    for (let i = 0; i < mesh.vertices.length; i++) expect(uvs[i]).toEqual([mesh.vertices[i]![0] / 40, mesh.vertices[i]![1] / 40]);
  });
  it("clamps subdivisions and tolerance without including fully transparent cells", () => {
    const image = sprite(16, 12);
    expect(buildSpriteMesh(image, -1, 100, 0).mesh.triangles.length).toBe(4 * 48 * 2);
    image.pixels.fill(0); expect(buildSpriteMesh(image, 4, 4, 0).mesh.triangles).toEqual([]);
    image.pixels[3] = 10;
    expect(buildSpriteMesh(image, 4, 4, 11).mesh.triangles).toEqual([]);
    expect(buildSpriteMesh(image, 4, 4, 10).mesh.triangles.length).toBe(2);
  });
  it("preserves valid pin positions and snaps transparent positions to the nearest opaque center", () => {
    const image = sprite(8, 8, [0, 0, 0, 0]);
    expect(nearestOpaquePoint(image, 2, 2, 12)).toBeNull();
    image.pixels[(3 * 8 + 2) * 4 + 3] = 255; image.pixels[(7 * 8 + 7) * 4 + 3] = 255;
    expect(nearestOpaquePoint(image, 2.2, 3.7, 12)).toEqual([2.2, 3.7]);
    expect(nearestOpaquePoint(image, 0, 0, 12)).toEqual([2.5, 3.5]);
    expect(nearestOpaquePoint(image, 7, 6, 12)).toEqual([7.5, 7.5]);
    expect(nearestOpaquePoint(image, Infinity, 2, 12)).toBeNull();
  });
});

describe("textured CPU triangle rendering", () => {
  it("renders identity UVs and alpha exactly, without blending shared diagonal twice", () => {
    const image = sprite(4, 4, [200, 50, 20, 128]);
    const target = surface(4, 4);
    drawTexturedMesh(target, quad.map(([x, y]) => [x * 4, y * 4]), quadTriangles, quad, image, 0.5);
    for (let i = 0; i < target.pixels.length; i += 4) expect(Array.from(target.pixels.slice(i, i + 4))).toEqual([200, 50, 20, 64]);
  });
  it("covers a subdivided mesh at fractional cell boundaries without holes or repeated alpha", () => {
    const image = sprite(31, 23, [200, 50, 20, 128]), target = surface(31, 23);
    const { mesh, uvs } = buildSpriteMesh(image, 9, 11, 12);
    drawTexturedMesh(target, mesh.vertices, mesh.triangles, uvs, image, 0.5);
    for (let i = 0; i < target.pixels.length; i += 4) expect(Array.from(target.pixels.slice(i, i + 4))).toEqual([200, 50, 20, 64]);
  });
  it("composites straight RGBA onto transparent and opaque backgrounds and accepts reversed winding", () => {
    const image = sprite(1, 1, [255, 0, 0, 128]);
    const target = surface(2, 2, [0, 0, 255, 255]);
    drawTexturedMesh(target, quad.map(([x, y]) => [x * 2, y * 2]), [[2, 1, 0], [3, 2, 0]], quad, image, 1);
    for (let i = 0; i < target.pixels.length; i += 4) expect(Array.from(target.pixels.slice(i, i + 4))).toEqual([128, 0, 127, 255]);
  });
  it("samples transparent edges without introducing their hidden color", () => {
    const image = sprite(2, 1, [255, 0, 0, 255]); image.pixels.set([0, 0, 255, 0], 4);
    const target = surface(4, 1);
    drawTexturedMesh(target, quad.map(([x, y]) => [x * 4, y]), quadTriangles, quad, image, 1);
    expect(Array.from(target.pixels.slice(4, 8))).toEqual([255, 0, 0, 191]);
    expect(Array.from(target.pixels.slice(8, 12))).toEqual([255, 0, 0, 64]);
    expect(Array.from(target.pixels.slice(12, 16))).toEqual([0, 0, 0, 0]);
  });
  it("clips offscreen triangles, skips invalid positions and keeps zero opacity unchanged", () => {
    const target = surface(4, 4), before = new Uint8ClampedArray(target.pixels), image = sprite(2, 2);
    drawTexturedMesh(target, [[Infinity, 0], [4, 0], [4, 4]], [[0, 1, 2]], quad, image, 1);
    drawTexturedMesh(target, quad, [[0, 1, 99]], quad, image, 1);
    drawTexturedMesh(target, quad, quadTriangles, quad, image, 0);
    expect(target.pixels).toEqual(before);
    drawTexturedMesh(target, [[-4, -4], [4, -4], [4, 4], [-4, 4]], quadTriangles, quad, image, 1);
    expect(target.pixels[3]).toBe(255); expect(target.pixels.at(-1)).toBe(255);
  });
  it("changes actual textured pixels under pin deformation while preserving pin rest", () => {
    const image = sprite(8, 8), { mesh, uvs } = buildSpriteMesh(image, 4, 4, 12);
    const pin = createPin("handle", "0", 4, 4), pose = createPose();
    const layer: Layer = {
      id: "sprite", name: "sprite", asset: "sprite", joint: "", visible: true, locked: false, opacity: 1,
      transform: { pos: [0, 0], scale: [1, 1], rotation: 0, pivot: [0, 0] }, hasSeamMask: false,
      seamMask: { layer: "", enabled: false, center: [0, 0], radius: 0, feather: 0 },
    };
    const a = surface(16, 8), b = surface(16, 8);
    drawTexturedMesh(a, meshWorld(mesh, [pin], null, layer, [], pose, new Map()), mesh.triangles, uvs, image, 1);
    pose.pins.set(pin.id, [4, 0]);
    drawTexturedMesh(b, meshWorld(mesh, [pin], null, layer, [], pose, new Map()), mesh.triangles, uvs, image, 1);
    expect(Array.from(a.pixels.slice(0, 4))).toEqual([240, 100, 40, 255]);
    expect(Array.from(b.pixels.slice(0, 4))).toEqual([0, 0, 0, 0]);
    expect(b.pixels).not.toEqual(a.pixels); expect([pin.x, pin.y]).toEqual([4, 4]);
  });
});
