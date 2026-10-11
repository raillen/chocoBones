package ui

import im "../../libs/odin-imgui"
import "../core"

Tool :: enum {
	Move, Rotate, Scale, Pivot, Joint, Pose, Pin, Weight, BoxSelect, LassoSelect, Eraser,
}

Workspace :: enum { Assembly, Rig, Animate, Focus }

ToolDescriptor :: struct {
	tool: Tool,
	icon, label, shortcut: cstring,
}

// Explicit IDs keep the rail order independent of the Tool enum's storage order.
TOOL_DESCRIPTORS :: [?]ToolDescriptor{
	{.Move, ICON_PH_CURSOR, "Mover", "V"},
	{.Rotate, ICON_PH_ARROW_CLOCKWISE, "Girar", "R"},
	{.Scale, ICON_PH_ARROWS_OUT_SIMPLE, "Escala", "S"},
	{.Pivot, ICON_PH_CROSSHAIR, "Pivô", "P"},
	{.Joint, ICON_PH_BONE, "Juntas", "J"},
	{.Pose, ICON_PH_PERSON_ARMS_SPREAD, "Pose", "Espaço"},
	{.BoxSelect, ICON_PH_BOUNDING_BOX, "Seleção em caixa", "B"},
	{.LassoSelect, ICON_PH_SELECTION, "Seleção em laço", "L"},
	{.Pin, ICON_PH_PUSH_PIN, "Pinos", "N"},
	{.Eraser, ICON_PH_ERASER, "Borracha", "E"},
	{.Weight, ICON_PH_PAINT_BRUSH, "Pesos", "K"},
}

tool_descriptor :: proc(tool: Tool) -> ToolDescriptor {
	for descriptor in TOOL_DESCRIPTORS {
		if descriptor.tool == tool do return descriptor
	}
	return TOOL_DESCRIPTORS[0]
}

tool_supports_gizmo :: proc(tool: Tool) -> bool {
	return tool == .Move || tool == .Rotate || tool == .Scale || tool == .Pivot
}

PanelVisibility :: struct { layers, inspector, timeline, joints: bool }

default_panel_visibility :: proc(workspace: Workspace) -> PanelVisibility {
	switch workspace {
	case .Assembly: return {layers = true, inspector = true}
	case .Rig: return {joints = true, inspector = true}
	case .Animate: return {layers = true, inspector = true, timeline = true}
	case .Focus: return {}
	}
	return {}
}

CanvasRect :: struct { pos, size: im.Vec2 }

fit_canvas :: proc(available_pos, available_size: im.Vec2, scene_size: im.Vec2 = {512, 512}) -> CanvasRect {
	if available_size.x <= 0 || available_size.y <= 0 || scene_size.x <= 0 || scene_size.y <= 0 {
		return {pos = available_pos}
	}
	scale := min(available_size.x / scene_size.x, available_size.y / scene_size.y)
	size := im.Vec2{scene_size.x * scale, scene_size.y * scale}
	return {pos = {available_pos.x + (available_size.x - size.x) * 0.5,
	               available_pos.y + (available_size.y - size.y) * 0.5}, size = size}
}

screen_to_scene :: proc(canvas: CanvasRect, point: im.Vec2, scene_size: im.Vec2 = {512, 512}) -> (core.Vec2, bool) {
	if canvas.size.x <= 0 || canvas.size.y <= 0 do return {}, false
	p := core.Vec2{(point.x - canvas.pos.x) * scene_size.x / canvas.size.x,
	               (point.y - canvas.pos.y) * scene_size.y / canvas.size.y}
	inside := point.x >= canvas.pos.x && point.y >= canvas.pos.y &&
	          point.x <= canvas.pos.x + canvas.size.x && point.y <= canvas.pos.y + canvas.size.y
	return p, inside
}
