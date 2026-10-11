package ui

import "core:fmt"
import "core:math"
import im "../../libs/odin-imgui"
import "../core"
import "../rig"

GizmoPart :: enum {
	None,
	Body,
	RotateHandle,
	ScaleTL,
	ScaleTR,
	ScaleBR,
	ScaleBL,
	PivotHandle,
}

GizmoState :: struct {
	active_part:         GizmoPart,
	hovered_part:        GizmoPart,
	drag_start_mouse:    core.Vec2,
	initial_rot:         f32,
	initial_scale:       core.Vec2,
	initial_pos:         core.Vec2,
	initial_pivot:       core.Vec2,
}

gizmo_init :: proc(g: ^GizmoState) {
	g.active_part = .None
	g.hovered_part = .None
}

// Retorna as 4 quinas e centro de uma camada no espaço da tela
GizmoBounds :: struct {
	p0:        core.Vec2, // Top-Left
	p1:        core.Vec2, // Top-Right
	p2:        core.Vec2, // Bottom-Right
	p3:        core.Vec2, // Bottom-Left
	center:    core.Vec2,
	rot_pos:   core.Vec2, // Posição da alça de rotação
	pivot_pos: core.Vec2, // Posição do pivô na tela
}

calculate_gizmo_bounds :: proc(
	layer: rig.Layer,
	dims: [2]f32,
	joints: []rig.Joint,
	pose: ^rig.Pose,
	bones: map[string]core.Mat2x3,
	screen_origin: core.Vec2,
	scale_factor: f32,
	view_bounds: [4]f32 = {0, 512, 0, 512},
	canvas_size: core.Vec2 = {0, 0},
) -> GizmoBounds {
	l_mat := rig.layer_matrix(layer, joints, pose, bones)

	w := dims.x
	h := dims.y

	// Quinas no espaço local transformadas para o espaço de cena
	c0 := core.mat_apply(l_mat, {0, 0})
	c1 := core.mat_apply(l_mat, {w, 0})
	c2 := core.mat_apply(l_mat, {w, h})
	c3 := core.mat_apply(l_mat, {0, h})

	piv := core.mat_apply(l_mat, layer.transform.pivot)

	c_size := canvas_size
	if c_size.x <= 0 || c_size.y <= 0 {
		c_size = {512.0 * scale_factor, 512.0 * scale_factor}
	}

	// Converte para coordenadas da tela ImGui respeitando PTZ
	to_screen :: proc(p: core.Vec2, origin, csize: core.Vec2, bounds: [4]f32) -> core.Vec2 {
		span_x := bounds[1] - bounds[0]
		span_y := bounds[3] - bounds[2]
		if span_x <= 0 do span_x = 512.0
		if span_y <= 0 do span_y = 512.0
		norm_x := (p.x - bounds[0]) / span_x
		norm_y := (p.y - bounds[2]) / span_y
		return {origin.x + norm_x * csize.x, origin.y + norm_y * csize.y}
	}

	sp0 := to_screen(c0, screen_origin, c_size, view_bounds)
	sp1 := to_screen(c1, screen_origin, c_size, view_bounds)
	sp2 := to_screen(c2, screen_origin, c_size, view_bounds)
	sp3 := to_screen(c3, screen_origin, c_size, view_bounds)
	s_piv := to_screen(piv, screen_origin, c_size, view_bounds)

	s_center := core.Vec2{(sp0.x + sp2.x) * 0.5, (sp0.y + sp2.y) * 0.5}

	// Alça de rotação fica a uma distância acima da aresta superior (sp0 -> sp1)
	top_mid := core.Vec2{(sp0.x + sp1.x) * 0.5, (sp0.y + sp1.y) * 0.5}
	dx := sp1.x - sp0.x
	dy := sp1.y - sp0.y
	top_len := math.sqrt(dx * dx + dy * dy)
	normal := core.Vec2{0, -1}
	if top_len > 1e-4 {
		// Normal apontando para fora da aresta superior
		normal = core.Vec2{dy / top_len, -dx / top_len}
	}
	HANDLE_DIST :: 28.0
	s_rot := core.Vec2{top_mid.x + normal.x * HANDLE_DIST, top_mid.y + normal.y * HANDLE_DIST}

	return GizmoBounds{
		p0        = sp0,
		p1        = sp1,
		p2        = sp2,
		p3        = sp3,
		center    = s_center,
		rot_pos   = s_rot,
		pivot_pos = s_piv,
	}
}

// Renderiza o Gizmo 2D completo na DrawList do ImGui e processa hit-testing
draw_and_interact_gizmo :: proc(
	draw_list: ^im.DrawList,
	bounds: GizmoBounds,
	mouse_pos: core.Vec2,
	is_mouse_down: bool,
	is_mouse_clicked: bool,
	gizmo: ^GizmoState,
) -> (GizmoPart, bool) {
	HANDLE_RADIUS :: 6.0
	PIVOT_RADIUS  :: 7.0

	// Editorial overlays use the theme; character and rig colors stay independent.
	canvas_bg := im.Vec4{0.12, 0.13, 0.16, 1}
	col_bounds := color_u32(contrast_color(current_palette.focus, canvas_bg, 3))
	col_hover := color_u32(contrast_color(current_palette.accent_hover, canvas_bg, 3))
	col_pivot := col_bounds
	col_rot_handle := color_u32(contrast_color(current_palette.accent, canvas_bg, 3))

	top_mid := core.Vec2{(bounds.p0.x + bounds.p1.x) * 0.5, (bounds.p0.y + bounds.p1.y) * 0.5}

	// 1. Linha conectora da haste de rotação
	im.DrawList_AddLine(draw_list, {top_mid.x, top_mid.y}, {bounds.rot_pos.x, bounds.rot_pos.y}, col_bounds, 1.5)

	// 2. Retângulo delimitador (Quad)
	im.DrawList_AddQuad(
		draw_list,
		{bounds.p0.x, bounds.p0.y},
		{bounds.p1.x, bounds.p1.y},
		{bounds.p2.x, bounds.p2.y},
		{bounds.p3.x, bounds.p3.y},
		col_bounds,
		1.8,
	)

	// Hit-test das partes quando não estiver arrastando
	hovered: GizmoPart = .None

	dist_rot := core.vec2_dist(mouse_pos, bounds.rot_pos)
	if dist_rot <= HANDLE_RADIUS + 4.0 {
		hovered = .RotateHandle
	}

	dist_piv := core.vec2_dist(mouse_pos, bounds.pivot_pos)
	if hovered == .None && dist_piv <= PIVOT_RADIUS + 3.0 {
		hovered = .PivotHandle
	}

	if hovered == .None && core.vec2_dist(mouse_pos, bounds.p0) <= HANDLE_RADIUS + 3.0 {
		hovered = .ScaleTL
	}
	if hovered == .None && core.vec2_dist(mouse_pos, bounds.p1) <= HANDLE_RADIUS + 3.0 {
		hovered = .ScaleTR
	}
	if hovered == .None && core.vec2_dist(mouse_pos, bounds.p2) <= HANDLE_RADIUS + 3.0 {
		hovered = .ScaleBR
	}
	if hovered == .None && core.vec2_dist(mouse_pos, bounds.p3) <= HANDLE_RADIUS + 3.0 {
		hovered = .ScaleBL
	}

	if hovered == .None {
		poly := []core.Vec2{bounds.p0, bounds.p1, bounds.p2, bounds.p3}
		if point_in_polygon(mouse_pos, poly) {
			hovered = .Body
		}
	}

	gizmo.hovered_part = hovered

	if is_mouse_clicked && hovered != .None {
		gizmo.active_part = hovered
		gizmo.drag_start_mouse = mouse_pos
	}

	if !is_mouse_down {
		gizmo.active_part = .None
	}

	// 3. Desenho das alças nos 4 cantos para escala
	draw_corner_handle :: proc(dl: ^im.DrawList, p: core.Vec2, r: f32, is_hover: bool) {
		col := color_u32(is_hover ? current_palette.accent_hover : current_palette.accent_text)
		im.DrawList_AddRectFilled(dl, {p.x - r, p.y - r}, {p.x + r, p.y + r}, col, 1.0)
		im.DrawList_AddRect(dl, {p.x - r, p.y - r}, {p.x + r, p.y + r}, color_u32(current_palette.selection), 1.0, 1.5)
	}

	draw_corner_handle(draw_list, bounds.p0, HANDLE_RADIUS, (hovered == .ScaleTL || gizmo.active_part == .ScaleTL))
	draw_corner_handle(draw_list, bounds.p1, HANDLE_RADIUS, (hovered == .ScaleTR || gizmo.active_part == .ScaleTR))
	draw_corner_handle(draw_list, bounds.p2, HANDLE_RADIUS, (hovered == .ScaleBR || gizmo.active_part == .ScaleBR))
	draw_corner_handle(draw_list, bounds.p3, HANDLE_RADIUS, (hovered == .ScaleBL || gizmo.active_part == .ScaleBL))

	// 4. Desenho da alça de rotação
	rot_col := (hovered == .RotateHandle || gizmo.active_part == .RotateHandle) ? col_hover : col_rot_handle
	im.DrawList_AddCircleFilled(draw_list, {bounds.rot_pos.x, bounds.rot_pos.y}, HANDLE_RADIUS + 1.0, rot_col)
	im.DrawList_AddCircle(draw_list, {bounds.rot_pos.x, bounds.rot_pos.y}, HANDLE_RADIUS + 1.0, color_u32(current_palette.accent_text), 16, 1.5)

	// 5. Desenho do marcador de pivô
	piv_col := (hovered == .PivotHandle || gizmo.active_part == .PivotHandle) ? col_hover : col_pivot
	sx_piv := bounds.pivot_pos.x
	sy_piv := bounds.pivot_pos.y
	im.DrawList_AddCircle(draw_list, {sx_piv, sy_piv}, PIVOT_RADIUS, piv_col, 16, 2.0)
	im.DrawList_AddLine(draw_list, {sx_piv - 8, sy_piv}, {sx_piv + 8, sy_piv}, piv_col, 2.0)
	im.DrawList_AddLine(draw_list, {sx_piv, sy_piv - 8}, {sx_piv, sy_piv + 8}, piv_col, 2.0)

	return gizmo.active_part, (gizmo.active_part != .None)
}
