package render

import "core:c"
import "core:strings"
import stbi "vendor:stb/image"

SixPiecePiece :: struct {
	id:    string,
	name:  string,
	rx:    i32,
	ry:    i32,
	rw:    i32,
	rh:    i32,
	px:    f32,
	py:    f32,
	at_x:  f32,
	at_y:  f32,
	joint: string,
}

SIX_PIECES := [6]SixPiecePiece{
	{"arm-left", "Braço esquerdo", 1153, 320, 212, 368, 55, 62, 294, 216, "upper_arm_far"},
	{"leg-left", "Perna esquerda", 1072, 563, 211, 426, 49, 37, 278, 302, "thigh_far"},
	{"leg-right", "Perna direita", 755, 563, 161, 430, 104, 37, 239, 302, "thigh_near"},
	{"torso", "Tronco", 870, 328, 237, 293, 119, 225, 256, 293, "root"},
	{"arm-right", "Braço direito", 640, 320, 204, 368, 136, 62, 220, 216, "upper_arm_near"},
	{"head", "Região da cabeça", 881, 22, 234, 309, 115, 259, 259, 211, "head"},
}

load_six_piece_textures :: proc(
	reference_path: string,
	out_textures: ^map[string]Texture,
	allocator := context.temp_allocator,
) -> bool {
	c_path := strings.clone_to_cstring(reference_path, allocator)
	w, h, channels: c.int
	stbi.set_flip_vertically_on_load(0)
	raw_pixels := stbi.load(c_path, &w, &h, &channels, 4)
	if raw_pixels == nil do return false
	defer stbi.image_free(raw_pixels)

	pixel_bytes := transmute([^]u8)raw_pixels

	for p in SIX_PIECES {
		tex, ok := texture_create_sub_image(
			pixel_bytes,
			i32(w),
			i32(h),
			p.rx,
			p.ry,
			p.rw,
			p.rh,
			allocator,
		)
		if ok {
			out_textures[p.id] = tex
		}
	}

	return true
}
