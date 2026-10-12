/**
 * chocoBones TypeScript Pure PNG Encoder
 * Codifica buffers RGBA em arquivos PNG padronizados sem dependências externas.
 */

import * as zlib from "zlib";

function crc32(buf: Buffer): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }

  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]!) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

export function encodeRgbaToPng(
  width: number,
  height: number,
  rgbaPixels: Uint8ClampedArray | Buffer
): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Chunk IHDR: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA com canal alfa
  ihdr[10] = 0; // Compressão Deflate
  ihdr[11] = 0; // Filtro padrão
  ihdr[12] = 0; // Sem entrelaçamento

  // Prepara linhas brutas com byte de filtro 0x00 no início de cada linha
  const rawRowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rawRowSize * height);
  const rgbaBuffer = Buffer.isBuffer(rgbaPixels)
    ? rgbaPixels
    : Buffer.from(rgbaPixels.buffer, rgbaPixels.byteOffset, rgbaPixels.byteLength);

  for (let y = 0; y < height; y++) {
    rawData[y * rawRowSize] = 0; // Filtro None
    rgbaBuffer.copy(
      rawData,
      y * rawRowSize + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const compressedData = zlib.deflateSync(rawData);

  return Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressedData),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}
