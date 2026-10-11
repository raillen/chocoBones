package render

import "core:math"
import "../core"

SeamMask :: core.SeamMask

apply_seam_mask_pixels :: proc(
	art_pixels: []u8,
	cover_pixels: []u8,
	width, height: int,
	center: core.Vec2,
	radius: f32,
	feather: f32,
) {
	if len(art_pixels) != width * height * 4 || len(cover_pixels) != width * height * 4 do return
	if radius <= 0.0 do return

	inner_radius := radius - feather
	if inner_radius < 0.0 do inner_radius = 0.0

	for y in 0 ..< height {
		for x in 0 ..< width {
			idx := (y * width + x) * 4

			dx := f32(x) - center.x
			dy := f32(y) - center.y
			dist := math.sqrt(dx * dx + dy * dy)

			if dist >= radius do continue

			factor: f32 = 1.0
			if feather > 0.001 && dist > inner_radius {
				factor = 1.0 - (dist - inner_radius) / feather
				factor = core.clamp(factor, 0.0, 1.0)
			}

			cover_alpha := f32(cover_pixels[idx + 3]) / 255.0
			mask_cut := cover_alpha * factor

			// destination-out: art_alpha *= (1.0 - mask_cut)
			cur_art_alpha := f32(art_pixels[idx + 3]) / 255.0
			new_art_alpha := cur_art_alpha * (1.0 - mask_cut)
			art_pixels[idx + 3] = u8(core.clamp(new_art_alpha * 255.0, 0.0, 255.0))
		}
	}
}
