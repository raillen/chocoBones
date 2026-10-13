# Sprite assets

`png.ts` imports PNG files into straight RGBA pixels and keeps the original bytes for project persistence. It verifies each chunk CRC and bounds the encoded input, dimensions and decompressed output before allocating image data.

Supported images are non-interlaced PNGs with 8-bit grayscale, RGB, indexed palette, grayscale-alpha or RGBA samples. Palette and `tRNS` transparency are preserved. Other bit depths and interlaced images produce a conversion instruction instead of partial decoding. Limits are 10 MiB encoded, 4096 pixels per axis and 16 Mi pixels total.

`SpriteImage` is the shared pixel contract. Mesh occupancy reads these pixels in `mesh/sprite_mesh.ts`; textured CPU rendering reads them in `render/sprite_raster.ts`. No GPU capability is claimed by this path.
