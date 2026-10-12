package tests

import "core:math"
import "core:testing"
import "../src/core"
import "../src/render"

@(test)
test_apply_seam_mask :: proc(t: ^testing.T) {
	w := 32
	h := 32
	total_bytes := w * h * 4

	art := make([]u8, total_bytes, context.temp_allocator)
	cover := make([]u8, total_bytes, context.temp_allocator)

	// Inicializa ambas com opacidade total (alfa = 255)
	for i in 0 ..< w * h {
		art[i * 4 + 3] = 255
		cover[i * 4 + 3] = 255
	}

	center := core.Vec2{16, 16}
	radius: f32 = 10.0
	feather: f32 = 4.0 // raio interno = 6.0

	render.apply_seam_mask_pixels(art, cover, w, h, center, radius, feather)

	// No centro exato (16, 16), corte deve ser total (alfa = 0)
	center_idx := (16 * w + 16) * 4
	testing.expect(t, art[center_idx + 3] == 0, "No centro da máscara, o alfa do membro inferior deve ser cortado para 0")

	// Bem longe do centro (0, 0), distância ~22.6 > radius (10.0), corte nulo (alfa = 255)
	corner_idx := (0 * w + 0) * 4
	testing.expect(t, art[corner_idx + 3] == 255, "Fora do raio de influência, o alfa deve permanecer 255")

	// Na zona de feather (distância ~8px, entre 6 e 10), alfa deve ser intermediário
	feather_x := 16 + 8
	feather_y := 16
	feather_idx := (feather_y * w + feather_x) * 4
	alpha_val := art[feather_idx + 3]
	testing.expect(t, alpha_val > 0 && alpha_val < 255, "Na zona de feather deve haver transição suave de alfa")
}
