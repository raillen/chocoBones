package export

import "core:c"
import "core:strings"
import gl "vendor:OpenGL"
import stbi "vendor:stb/image"
import "../render"

export_image_rgba_to_png :: proc(filename: string, pixels: []u8, width, height: i32) -> bool {
	if len(pixels) == 0 || width <= 0 || height <= 0 do return false

	c_path := strings.clone_to_cstring(filename, context.temp_allocator)
	stride := width * 4
	res := stbi.write_png(c_path, c.int(width), c.int(height), 4, raw_data(pixels), c.int(stride))
	return res != 0
}

read_fbo_pixels :: proc(fbo: ^render.Framebuffer, out_flipped: []u8) -> bool {
	if fbo == nil || fbo.fbo == 0 do return false
	w := fbo.width
	h := fbo.height
	total_bytes := int(w * h * 4)
	if len(out_flipped) < total_bytes do return false

	raw_pixels := make([]u8, total_bytes, context.temp_allocator)
	gl.BindFramebuffer(gl.FRAMEBUFFER, fbo.fbo)
	gl.ReadPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, raw_data(raw_pixels))
	gl.BindFramebuffer(gl.FRAMEBUFFER, 0)

	stride := int(w * 4)
	for y in 0 ..< int(h) {
		src_row := (int(h) - 1 - y) * stride
		dst_row := y * stride
		copy(out_flipped[dst_row:dst_row + stride], raw_pixels[src_row:src_row + stride])
	}
	return true
}

export_fbo_to_png :: proc(filename: string, fbo: ^render.Framebuffer) -> bool {
	if fbo == nil || fbo.fbo == 0 do return false
	flipped := make([]u8, int(fbo.width * fbo.height * 4), context.temp_allocator)
	if !read_fbo_pixels(fbo, flipped) do return false
	return export_image_rgba_to_png(filename, flipped, fbo.width, fbo.height)
}

export_spritesheet_grid :: proc(
	filename: string,
	frame_pixels: [][]u8,
	frame_w, frame_h: i32,
	columns: int,
) -> bool {
	num_frames := len(frame_pixels)
	if num_frames == 0 || frame_w <= 0 || frame_h <= 0 || columns <= 0 do return false

	cols := i32(columns)
	rows := i32((num_frames + columns - 1) / columns)
	sheet_w := cols * frame_w
	sheet_h := rows * frame_h
	sheet_bytes_total := int(sheet_w * sheet_h * 4)

	sheet := make([]u8, sheet_bytes_total, context.temp_allocator)
	frame_stride := int(frame_w * 4)
	sheet_stride := int(sheet_w * 4)

	for frame, idx in frame_pixels {
		if len(frame) < int(frame_w * frame_h * 4) do continue
		c := i32(idx % columns)
		r := i32(idx / columns)

		for y in 0 ..< int(frame_h) {
			src_offset := y * frame_stride
			dst_offset := (int(r * frame_h + i32(y)) * sheet_stride) + int(c * frame_w * 4)
			copy(sheet[dst_offset:dst_offset + frame_stride], frame[src_offset:src_offset + frame_stride])
		}
	}

	return export_image_rgba_to_png(filename, sheet, sheet_w, sheet_h)
}

