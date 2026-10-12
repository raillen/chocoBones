package tests

import "core:testing"
import "core:math"
import im "../libs/odin-imgui"
import "../src/ui"

@(test)
test_theme_contrast_presets_and_extreme_accents :: proc(t: ^testing.T) {
	accents := [12][3]f32{
		ui.ACCENT_PRESETS[0].rgb, ui.ACCENT_PRESETS[1].rgb,
		ui.ACCENT_PRESETS[2].rgb, ui.ACCENT_PRESETS[3].rgb,
		ui.ACCENT_PRESETS[4].rgb, ui.ACCENT_PRESETS[5].rgb,
		{0,0,0}, {1,1,1}, {0.5,0.5,0.5}, {1,0,0}, {0,1,0}, {0,0,1},
	}
	for mode in ([2]ui.ThemeMode{.Dark,.Light}) {
		for accent in accents {
			appearance := ui.AppearanceSettings{mode,accent}
			p := ui.make_theme_palette(appearance)
			for surface in ([4]im.Vec4{p.surface,p.surface_alt,p.field,p.background}) {
				testing.expect(t, ui.contrast_ratio(p.text,surface) >= 4.5, "Readable normal text on all editor surfaces")
				testing.expect(t, ui.contrast_ratio(p.text_muted,surface) >= 4.5, "Readable secondary text")
			}
			testing.expect(t, ui.contrast_ratio(p.accent,p.surface_alt) >= 3, "Active control contrast")
			testing.expect(t, ui.contrast_ratio(p.accent_text,p.accent) >= 4.5, "Selected button label")
			testing.expect(t, ui.contrast_ratio(p.accent_text,p.accent_hover) >= 4.5, "Hovered selected label")
			testing.expect(t, ui.contrast_ratio(p.text,p.selection) >= 4.5, "Selected row label")
			testing.expect(t, appearance.accent_rgb == accent, "Derived colors must not rewrite user RGB")
		}
	}
}

@(test)
test_theme_scale_is_not_cumulative :: proc(t: ^testing.T) {
	im.CreateContext()
	defer im.DestroyContext()
	appearance := ui.AppearanceSettings{.Dark,ui.ACCENT_PRESETS[0].rgb}
	ui.apply_theme(appearance,1.5)
	first := im.GetStyle()^
	ui.apply_theme(appearance,1.5)
	testing.expect_value(t, im.GetStyle().FramePadding, first.FramePadding)
	testing.expect_value(t, im.GetStyle().FontScaleMain, f32(1.5))
	ui.apply_theme({.Light,{1,1,1}},2)
	testing.expect_value(t, im.GetStyle().FramePadding, im.Vec2{12,8})
	ui.apply_theme(appearance,1)
	testing.expect_value(t, im.GetStyle().FramePadding, im.Vec2{6,4})
}

@(test)
test_tool_rail_ids_are_independent_of_visual_order :: proc(t: ^testing.T) {
	seen: [len(ui.Tool)]bool
	for descriptor in ui.TOOL_DESCRIPTORS {
		id := int(descriptor.tool)
		testing.expect(t, !seen[id], "Each tool appears once")
		seen[id] = true
		testing.expect_value(t, ui.tool_descriptor(descriptor.tool).tool, descriptor.tool)
	}
	for exists in seen do testing.expect(t, exists)
	testing.expect_value(t, ui.TOOL_DESCRIPTORS[5].tool, ui.Tool.CreateBone)
	testing.expect_value(t, ui.TOOL_DESCRIPTORS[7].tool, ui.Tool.BoxSelect)
	testing.expect_value(t, ui.TOOL_DESCRIPTORS[9].tool, ui.Tool.Pin)
}

@(test)
test_canvas_centering_and_hit_coordinates :: proc(t: ^testing.T) {
	canvas := ui.fit_canvas({10,20},{1000,600})
	testing.expect_value(t,canvas.pos,im.Vec2{210,20})
	testing.expect_value(t,canvas.size,im.Vec2{600,600})
	point, inside := ui.screen_to_scene(canvas,{510,320})
	testing.expect(t,inside)
	testing.expect_value(t,point.x,f32(256))
	testing.expect_value(t,point.y,f32(256))
	_, outside := ui.screen_to_scene(canvas,{209,320})
	testing.expect(t,!outside,"Surroundings must not select scene objects")
	tiny := ui.fit_canvas({0,0},{25,10})
	testing.expect(t,tiny.size.x <= 25 && tiny.size.y <= 10,"Never overflow a small viewport")
	zero := ui.fit_canvas({0,0},{0,0})
	p, valid := ui.screen_to_scene(zero,{0,0})
	testing.expect(t,!valid && !math.is_nan(p.x) && !math.is_nan(p.y),"Collapsed viewport must not divide by zero")
}
