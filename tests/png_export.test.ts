import { describe, expect, it } from "bun:test";
import { encodeRgbaToPng } from "../src/render/png_export";

describe("PNG Encoder", () => {
  it("encodes RGBA buffer to valid PNG format with magic signature", () => {
    const width = 16;
    const height = 16;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 255;
      pixels[i + 1] = 128;
      pixels[i + 2] = 0;
      pixels[i + 3] = 255;
    }

    const png = encodeRgbaToPng(width, height, pixels);
    expect(png.length).toBeGreaterThan(50);
    // Assinatura mágica do PNG: 89 50 4E 47 0D 0A 1A 0A
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50); // P
    expect(png[2]).toBe(0x4e); // N
    expect(png[3]).toBe(0x47); // G
    expect(png[4]).toBe(0x0d);
    expect(png[5]).toBe(0x0a);
    expect(png[6]).toBe(0x1a);
    expect(png[7]).toBe(0x0a);
  });
});
