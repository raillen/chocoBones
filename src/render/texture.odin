package render

import "core:c"
import "core:strings"
import gl "vendor:OpenGL"
import stbi "vendor:stb/image"

Texture :: struct {
	id:     u32,
	width:  i32,
	height: i32,
}

ImageRaw :: struct {
	width:    int,
	height:   int,
	channels: int,
	pixels:   rawptr,
}

image_load_raw :: proc(path: string) -> (ImageRaw, bool) {
	c_path := strings.clone_to_cstring(path, context.temp_allocator)
	w, h, channels: c.int
	stbi.set_flip_vertically_on_load(0)
	pixels := stbi.load(c_path, &w, &h, &channels, 4)
	if pixels == nil {
		return {}, false
	}
	return ImageRaw{width = int(w), height = int(h), channels = 4, pixels = pixels}, true
}

image_free_raw :: proc(raw: ^ImageRaw) {
	if raw.pixels != nil {
		stbi.image_free(raw.pixels)
		raw.pixels = nil
	}
}

texture_load_from_file :: proc(path: string) -> (Texture, bool) {
	raw, ok := image_load_raw(path)
	if !ok do return {}, false
	defer image_free_raw(&raw)

	return texture_create_from_pixels(raw.pixels, i32(raw.width), i32(raw.height))
}

texture_load_from_memory :: proc(data: []byte) -> (Texture, bool) {
	if len(data) == 0 do return {}, false

	w, h, channels: c.int
	stbi.set_flip_vertically_on_load(0)
	pixels := stbi.load_from_memory(raw_data(data), c.int(len(data)), &w, &h, &channels, 4)
	if pixels == nil {
		return {}, false
	}
	defer stbi.image_free(pixels)

	return texture_create_from_pixels(pixels, i32(w), i32(h))
}

texture_create_from_pixels :: proc(pixels: rawptr, width, height: i32) -> (Texture, bool) {
	tex_id: u32
	gl.GenTextures(1, &tex_id)
	gl.BindTexture(gl.TEXTURE_2D, tex_id)

	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
	gl.TexParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

	gl.TexImage2D(
		gl.TEXTURE_2D,
		0,
		gl.RGBA8,
		width,
		height,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		pixels,
	)

	return Texture{id = tex_id, width = width, height = height}, true
}

texture_create_sub_image :: proc(
	parent_pixels: [^]u8,
	parent_w, parent_h: i32,
	rx, ry, rw, rh: i32,
	allocator := context.temp_allocator,
) -> (Texture, bool) {
	if parent_pixels == nil || rw <= 0 || rh <= 0 do return {}, false
	if rx < 0 || ry < 0 || rx + rw > parent_w || ry + rh > parent_h do return {}, false

	sub_bytes := int(rw * rh * 4)
	sub_buf := make([]u8, sub_bytes, allocator)

	for y in 0 ..< rh {
		src_offset := int(((ry + y) * parent_w + rx) * 4)
		dst_offset := int((y * rw) * 4)
		copy(sub_buf[dst_offset:dst_offset + int(rw * 4)], parent_pixels[src_offset:src_offset + int(rw * 4)])
	}

	return texture_create_from_pixels(raw_data(sub_buf), rw, rh)
}

texture_create_solid :: proc(width, height: i32, color: [4]u8) -> Texture {
	total_pixels := int(width * height)
	buffer := make([]u8, total_pixels * 4, context.temp_allocator)
	for i in 0 ..< total_pixels {
		buffer[i * 4 + 0] = color[0]
		buffer[i * 4 + 1] = color[1]
		buffer[i * 4 + 2] = color[2]
		buffer[i * 4 + 3] = color[3]
	}

	tex, _ := texture_create_from_pixels(raw_data(buffer), width, height)
	return tex
}

texture_destroy :: proc(tex: ^Texture) {
	if tex != nil && tex.id != 0 {
		gl.DeleteTextures(1, &tex.id)
		tex.id = 0
	}
}
