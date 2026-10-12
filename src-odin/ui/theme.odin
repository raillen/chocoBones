package ui

import "core:math"
import im "../../libs/odin-imgui"

ThemeMode :: enum { Dark, Light }
AppearanceSettings :: struct { theme: ThemeMode, accent_rgb: [3]f32 }
AccentPreset :: struct { name: cstring, rgb: [3]f32 }

ACCENT_PRESETS :: [?]AccentPreset{
	{"Ciano", {0, 184.0/255, 217.0/255}},
	{"Azul", {59.0/255, 130.0/255, 246.0/255}},
	{"Violeta", {139.0/255, 92.0/255, 246.0/255}},
	{"Rosa", {236.0/255, 72.0/255, 153.0/255}},
	{"Verde", {16.0/255, 185.0/255, 129.0/255}},
	{"Âmbar", {245.0/255, 158.0/255, 11.0/255}},
}

ThemePalette :: struct {
	background, surface, surface_alt, field, border: im.Vec4,
	text, text_muted, accent, accent_hover, accent_text: im.Vec4,
	selection, focus, success, warning, error, stage_bg: im.Vec4,
}

current_palette: ThemePalette
theme_base_style: im.Style
theme_base_style_set: bool

mix_color :: proc(a, b: im.Vec4, amount: f32) -> im.Vec4 {
	return {a.x+(b.x-a.x)*amount, a.y+(b.y-a.y)*amount, a.z+(b.z-a.z)*amount, 1}
}

linear_channel :: proc(channel: f32) -> f32 {
	return channel <= 0.04045 ? channel / 12.92 : math.pow((channel + 0.055) / 1.055, f32(2.4))
}

relative_luminance :: proc(color: im.Vec4) -> f32 {
	return 0.2126*linear_channel(color.x) + 0.7152*linear_channel(color.y) + 0.0722*linear_channel(color.z)
}

contrast_ratio :: proc(a, b: im.Vec4) -> f32 {
	x, y := relative_luminance(a), relative_luminance(b)
	return (max(x, y)+0.05)/(min(x, y)+0.05)
}

// Find the smallest mix with black or white that meets the requested contrast.
contrast_color :: proc(color, background: im.Vec4, minimum: f32) -> im.Vec4 {
	if contrast_ratio(color, background) >= minimum do return color
	black, white := im.Vec4{0,0,0,1}, im.Vec4{1,1,1,1}
	target := contrast_ratio(black, background) >= contrast_ratio(white, background) ? black : white
	low, high: f32 = 0, 1
	for _ in 0..<24 {
		mid := (low+high)*0.5
		if contrast_ratio(mix_color(color,target,mid),background) >= minimum { high = mid } else { low = mid }
	}
	return mix_color(color, target, high)
}

color_u32 :: proc(color: im.Vec4) -> u32 {
	// ABGR is the default ImGui packed color format. This helper is pure for tests.
	r := u32(clamp(color.x,0,1)*255+0.5)
	g := u32(clamp(color.y,0,1)*255+0.5)
	b := u32(clamp(color.z,0,1)*255+0.5)
	a := u32(clamp(color.w,0,1)*255+0.5)
	return r | (g<<8) | (b<<16) | (a<<24)
}

make_theme_palette :: proc(settings: AppearanceSettings) -> ThemePalette {
	p: ThemePalette
	if settings.theme == .Light {
		p.background = {0.84,0.84,0.84,1}
		p.surface = {0.9,0.9,0.9,1}
		p.surface_alt = {0.85,0.85,0.85,1}
		p.field = {0.97,0.97,0.97,1}
		p.text = {0.12,0.12,0.12,1}
		p.text_muted = contrast_color({0.4,0.4,0.4,1}, p.background, 4.5)
		p.border = contrast_color({0.55,0.55,0.55,1}, p.background, 3)
		p.stage_bg = {0.76,0.76,0.76,1}
	} else {
		p.background = {0.115,0.115,0.115,1}
		p.surface = {0.155,0.155,0.155,1}
		p.surface_alt = {0.2,0.2,0.2,1}
		p.field = {0.12,0.12,0.12,1}
		p.text = {0.92,0.92,0.92,1}
		p.text_muted = contrast_color({0.6,0.6,0.6,1}, p.surface_alt, 4.5)
		p.border = contrast_color({0.4,0.4,0.4,1}, p.surface_alt, 3)
		p.stage_bg = {0.085,0.085,0.085,1}
	}
	raw := im.Vec4{clamp(settings.accent_rgb[0],0,1),clamp(settings.accent_rgb[1],0,1),clamp(settings.accent_rgb[2],0,1),1}
	contrast_surface := settings.theme == .Light ? p.background : p.surface_alt
	p.accent = contrast_color(raw, contrast_surface, 3)
	black, white := im.Vec4{0,0,0,1}, im.Vec4{1,1,1,1}
	p.accent_text = contrast_ratio(black,p.accent) >= contrast_ratio(white,p.accent) ? black : white
	// Hover moves away from its label to retain readable text, including extreme RGBs.
	opposite := p.accent_text.x == 0 ? white : black
	p.accent_hover = contrast_color(mix_color(p.accent,opposite,0.06),contrast_surface,3)
	p.selection = mix_color(p.surface, p.accent, 0.16)
	p.focus = p.accent
	p.success = contrast_color({0.12,0.68,0.38,1},p.surface,4.5)
	p.warning = contrast_color({0.92,0.56,0.12,1},p.surface,4.5)
	p.error = contrast_color({0.9,0.25,0.25,1},p.surface,4.5)
	return p
}

apply_theme :: proc(settings: AppearanceSettings, scale: f32 = 1) {
	style := im.GetStyle()
	if !theme_base_style_set {
		theme_base_style = style^
		theme_base_style_set = true
	}
	style^ = theme_base_style
	p := make_theme_palette(settings)
	current_palette = p
	im.StyleColorsDark(style)
	style.FontSizeBase = 14
	style.FontScaleMain = max(scale,0.5)
	style.FontScaleDpi = 1
	style.WindowPadding = {8,8}
	style.FramePadding = {6,4}
	style.ItemSpacing = {4,4}
	style.ItemInnerSpacing = {4,4}
	style.CellPadding = {4,4}
	style.WindowRounding = 3
	style.FrameRounding = 3
	style.PopupRounding = 3
	style.ChildRounding = 3
	style.ScrollbarRounding = 3
	style.GrabRounding = 3
	style.TabRounding = 3
	style.WindowBorderSize = 1
	style.PopupBorderSize = 1
	style.FrameBorderSize = 0
	style.ScrollbarSize = 11
	style.DockingSeparatorSize = 2
	style.TabBarOverlineSize = 2
	style.WindowMenuButtonPosition = .None
	style.Colors[im.Col.Text] = p.text
	style.Colors[im.Col.TextDisabled] = p.text_muted
	style.Colors[im.Col.WindowBg] = p.surface
	style.Colors[im.Col.ChildBg] = p.surface
	style.Colors[im.Col.PopupBg] = p.surface
	style.Colors[im.Col.Border] = p.border
	style.Colors[im.Col.BorderShadow] = {0,0,0,0}
	style.Colors[im.Col.FrameBg] = p.field
	style.Colors[im.Col.FrameBgHovered] = p.surface_alt
	style.Colors[im.Col.FrameBgActive] = p.selection
	style.Colors[im.Col.TitleBg] = p.background
	style.Colors[im.Col.TitleBgActive] = p.background
	style.Colors[im.Col.TitleBgCollapsed] = p.background
	style.Colors[im.Col.MenuBarBg] = p.background
	style.Colors[im.Col.ScrollbarBg] = p.surface
	style.Colors[im.Col.ScrollbarGrab] = p.border
	style.Colors[im.Col.ScrollbarGrabHovered] = p.text_muted
	style.Colors[im.Col.ScrollbarGrabActive] = p.accent
	style.Colors[im.Col.CheckMark] = p.accent
	style.Colors[im.Col.SliderGrab] = p.accent
	style.Colors[im.Col.SliderGrabActive] = p.accent_hover
	style.Colors[im.Col.Button] = p.surface_alt
	style.Colors[im.Col.ButtonHovered] = p.selection
	style.Colors[im.Col.ButtonActive] = p.selection
	style.Colors[im.Col.Header] = p.selection
	style.Colors[im.Col.HeaderHovered] = mix_color(p.surface,p.accent,0.22)
	style.Colors[im.Col.HeaderActive] = p.selection
	style.Colors[im.Col.Separator] = p.border
	style.Colors[im.Col.SeparatorHovered] = p.accent
	style.Colors[im.Col.SeparatorActive] = p.accent
	style.Colors[im.Col.ResizeGrip] = p.border
	style.Colors[im.Col.ResizeGripHovered] = p.accent
	style.Colors[im.Col.ResizeGripActive] = p.accent
	style.Colors[im.Col.Tab] = p.background
	style.Colors[im.Col.TabHovered] = p.selection
	style.Colors[im.Col.TabSelected] = p.surface
	style.Colors[im.Col.TabSelectedOverline] = p.accent
	style.Colors[im.Col.TabDimmed] = p.background
	style.Colors[im.Col.TabDimmedSelected] = p.surface
	style.Colors[im.Col.TabDimmedSelectedOverline] = p.border
	style.Colors[im.Col.DockingPreview] = {p.accent.x,p.accent.y,p.accent.z,0.35}
	style.Colors[im.Col.DockingEmptyBg] = p.stage_bg
	style.Colors[im.Col.TextSelectedBg] = p.selection
	style.Colors[im.Col.NavCursor] = p.focus
	style.Colors[im.Col.DragDropTarget] = p.focus
	style.Colors[im.Col.PlotLines] = p.accent
	style.Colors[im.Col.PlotHistogram] = p.accent
	style.Colors[im.Col.PlotLinesHovered] = p.accent_hover
	style.Colors[im.Col.PlotHistogramHovered] = p.accent_hover
	style.Colors[im.Col.TextLink] = contrast_color(p.accent,p.surface,4.5)
	style.Colors[im.Col.TreeLines] = p.border
	style.Colors[im.Col.UnsavedMarker] = p.accent
	style.Colors[im.Col.DragDropTargetBg] = p.selection
	style.Colors[im.Col.NavWindowingHighlight] = p.focus
	style.Colors[im.Col.NavWindowingDimBg] = {0,0,0,0.2}
	style.Colors[im.Col.TableHeaderBg] = p.background
	style.Colors[im.Col.TableBorderStrong] = p.border
	style.Colors[im.Col.TableBorderLight] = mix_color(p.surface,p.border,0.4)
	style.Colors[im.Col.TableRowBg] = {0,0,0,0}
	style.Colors[im.Col.TableRowBgAlt] = p.surface_alt
	style.Colors[im.Col.ModalWindowDimBg] = {0,0,0,0.45}
	if scale != 1 do im.Style_ScaleAllSizes(style,max(scale,0.5))
}
