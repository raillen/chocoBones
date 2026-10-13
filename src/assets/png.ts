/** Bounded, checksum-verified PNG decoding for the desktop's RGBA sprite path. */
import { inflateSync } from "node:zlib";
import { crc32 } from "../render/png_export";

import { MAX_PNG_BYTES, MAX_SPRITE_DIMENSION, MAX_SPRITE_PIXELS, type SpriteImage } from "./image";
export { MAX_PNG_BYTES, MAX_SPRITE_DIMENSION, MAX_SPRITE_PIXELS, validateSpriteImage, type SpriteImage } from "./image";
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}

/** Supports non-interlaced 8-bit gray, RGB, indexed, gray-alpha and RGBA PNGs. */
export function decodePng(buffer: Buffer): SpriteImage & { png: Buffer } {
  if (buffer.length > MAX_PNG_BYTES) throw new Error("PNG excede o limite de 10 MiB.");
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("Assinatura PNG inválida.");
  let width = 0, height = 0, colorType = -1, channels = 0;
  let palette: Buffer | null = null, transparency: Buffer | null = null;
  let sawHeader = false, sawData = false, endedData = false, sawEnd = false;
  const dataChunks: Buffer[] = [];
  let offset = 8, chunkCount = 0;
  while (offset < buffer.length) {
    if (++chunkCount > 10000 || buffer.length - offset < 12) throw new Error("Estrutura de chunks PNG inválida.");
    const length = buffer.readUInt32BE(offset);
    if (length > buffer.length - offset - 12) throw new Error("Chunk PNG truncado.");
    const typeBytes = buffer.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("latin1");
    if (!/^[A-Za-z]{4}$/.test(type) || (typeBytes[2]! & 32) !== 0) throw new Error("Tipo de chunk PNG inválido.");
    const payload = buffer.subarray(offset + 8, offset + 8 + length);
    if (crc32(buffer.subarray(offset + 4, offset + 8 + length)) !== buffer.readUInt32BE(offset + 8 + length)) {
      throw new Error(`CRC inválido no chunk PNG ${type}.`);
    }
    if (!sawHeader && type !== "IHDR") throw new Error("IHDR deve ser o primeiro chunk PNG.");
    if (sawData && type !== "IDAT") endedData = true;
    if (type === "IHDR") {
      if (sawHeader || length !== 13) throw new Error("IHDR PNG inválido ou duplicado.");
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      if (width < 1 || height < 1 || width > MAX_SPRITE_DIMENSION || height > MAX_SPRITE_DIMENSION || width * height > MAX_SPRITE_PIXELS) {
        throw new Error("PNG excede as dimensões permitidas: 4096 por eixo e 16 milhões de pixels.");
      }
      if (payload[8] !== 8) throw new Error("PNG requer 8 bits por canal; converta imagens de 1, 2, 4 ou 16 bits para PNG de 8 bits.");
      colorType = payload[9]!;
      channels = CHANNELS[colorType] ?? 0;
      if (!channels) throw new Error("Tipo de cor PNG não suportado.");
      if (payload[10] !== 0 || payload[11] !== 0) throw new Error("Compressão ou método de filtro PNG não suportado.");
      if (payload[12] !== 0) throw new Error("PNG entrelaçado não suportado; salve uma versão sem entrelaçamento.");
      sawHeader = true;
    } else if (type === "PLTE") {
      if (palette || sawData || transparency || colorType === 0 || colorType === 4 || length === 0 || length > 768 || length % 3 !== 0) {
        throw new Error("Paleta PNG inválida.");
      }
      palette = payload;
    } else if (type === "tRNS") {
      if (transparency || sawData) throw new Error("Transparência PNG fora de ordem ou duplicada.");
      if ((colorType === 0 && (length !== 2 || payload.readUInt16BE(0) > 255)) ||
          (colorType === 2 && (length !== 6 || [0, 2, 4].some((i) => payload.readUInt16BE(i) > 255))) ||
          (colorType === 3 && (!palette || length < 1 || length > palette.length / 3)) ||
          colorType === 4 || colorType === 6) throw new Error("Chunk tRNS PNG inválido.");
      transparency = payload;
    } else if (type === "IDAT") {
      if (endedData || (colorType === 3 && !palette)) throw new Error("Chunks IDAT PNG fora de ordem ou paleta ausente.");
      sawData = true;
      dataChunks.push(payload);
    } else if (type === "IEND") {
      if (length !== 0 || !sawData || offset + 12 !== buffer.length) throw new Error("IEND PNG inválido ou dados adicionais após o fim.");
      sawEnd = true;
      break;
    } else if ((typeBytes[0]! & 32) === 0) {
      throw new Error(`Chunk crítico PNG ${type} não suportado.`);
    }
    offset += length + 12;
  }
  if (!sawEnd) throw new Error("PNG incompleto: chunk IEND ausente.");
  const rowBytes = width * channels;
  const expectedBytes = height * (rowBytes + 1);
  let filtered: Buffer;
  try {
    filtered = inflateSync(Buffer.concat(dataChunks), { maxOutputLength: expectedBytes + 1 });
  } catch {
    throw new Error("Dados PNG comprimidos inválidos ou maiores que as dimensões declaradas.");
  }
  if (filtered.length !== expectedBytes) throw new Error("Dados PNG descomprimidos não correspondem às dimensões declaradas.");
  const pixels = new Uint8ClampedArray(width * height * 4);
  let previous = new Uint8Array(rowBytes), current = new Uint8Array(rowBytes);
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (rowBytes + 1)]!;
    if (filter > 4) throw new Error("Filtro de linha PNG inválido.");
    for (let i = 0; i < rowBytes; i++) {
      const a = i >= channels ? current[i - channels]! : 0;
      const b = previous[i]!, c = i >= channels ? previous[i - channels]! : 0;
      const predictor = filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0;
      current[i] = (filtered[y * (rowBytes + 1) + 1 + i]! + predictor) & 255;
    }
    for (let x = 0; x < width; x++) {
      const src = x * channels, dst = (y * width + x) * 4;
      let r: number, g: number, b: number, a = 255;
      if (colorType === 3) {
        const index = current[src]!;
        if (index * 3 + 2 >= palette!.length) throw new Error("Índice de paleta PNG inexistente.");
        r = palette![index * 3]!; g = palette![index * 3 + 1]!; b = palette![index * 3 + 2]!;
        a = transparency?.[index] ?? 255;
      } else if (colorType === 0 || colorType === 4) {
        r = g = b = current[src]!;
        if (colorType === 4) a = current[src + 1]!;
        else if (transparency && r === transparency.readUInt16BE(0)) a = 0;
      } else {
        r = current[src]!; g = current[src + 1]!; b = current[src + 2]!;
        if (colorType === 6) a = current[src + 3]!;
        else if (transparency && r === transparency.readUInt16BE(0) && g === transparency.readUInt16BE(2) && b === transparency.readUInt16BE(4)) a = 0;
      }
      pixels[dst] = r; pixels[dst + 1] = g; pixels[dst + 2] = b; pixels[dst + 3] = a;
    }
    [previous, current] = [current, previous];
  }
  return { width, height, pixels, png: Buffer.from(buffer) };
}
