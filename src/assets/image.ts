/** Browser-safe immutable RGBA assets and common decoding limits. */
export interface SpriteImage {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  /** Original PNG bytes, retained for portable project files. */
  png: Uint8Array;
}

export const MAX_PNG_BYTES = 10 * 1024 * 1024;
export const MAX_SPRITE_DIMENSION = 4096;
export const MAX_SPRITE_PIXELS = 16 * 1024 * 1024;
export function validateSpriteImage(image: Pick<SpriteImage, "width" | "height" | "pixels">): void {
  if (!Number.isInteger(image.width) || !Number.isInteger(image.height) ||
      image.width < 1 || image.height < 1 || image.width > MAX_SPRITE_DIMENSION ||
      image.height > MAX_SPRITE_DIMENSION || image.width * image.height > MAX_SPRITE_PIXELS) {
    throw new Error("A imagem deve ter dimensões entre 1 e 4096 e até 16 milhões de pixels.");
  }
  if (image.pixels.length !== image.width * image.height * 4) {
    throw new Error("O buffer RGBA não corresponde às dimensões da imagem.");
  }
}
