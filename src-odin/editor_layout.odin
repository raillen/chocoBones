package main

import "core:math"
import im "../libs/odin-imgui"
import "ui"

EditorPanel :: enum { Stage, Layers, Inspector, Timeline, Joints }

EditorGeometry :: struct {
	top_pos, top_size: im.Vec2,
	context_pos, context_size: im.Vec2,
	rail_pos, rail_size: im.Vec2,
	dock_pos, dock_size: im.Vec2,
	status_pos, status_size: im.Vec2,
}

EDITOR_WORKSPACES :: []Workspace{.Assembly, .Rig, .Animate, .Focus}
EDITOR_WORKSPACE_LABELS : [Workspace]cstring = {
	.Assembly = "Montagem", .Rig = "Rig", .Animate = "Animação", .Focus = "Foco",
}

// Stable IDs keep saved layouts independent of translated labels and icons.
EDITOR_PANEL_NAMES : [Workspace][EditorPanel]cstring = {
	.Assembly = {.Stage = "Palco###stage_assembly", .Layers = "Camadas###layers_assembly", .Inspector = "Inspetor###inspector_assembly", .Timeline = "Linha do tempo###timeline_assembly", .Joints = "Juntas###joints_assembly"},
	.Rig = {.Stage = "Palco###stage_rig", .Layers = "Camadas###layers_rig", .Inspector = "Inspetor###inspector_rig", .Timeline = "Linha do tempo###timeline_rig", .Joints = "Juntas###joints_rig"},
	.Animate = {.Stage = "Palco###stage_animate", .Layers = "Camadas###layers_animate", .Inspector = "Inspetor###inspector_animate", .Timeline = "Linha do tempo###timeline_animate", .Joints = "Juntas###joints_animate"},
	.Focus = {.Stage = "Palco###stage_focus", .Layers = "Camadas###layers_focus", .Inspector = "Inspetor###inspector_focus", .Timeline = "Linha do tempo###timeline_focus", .Joints = "Juntas###joints_focus"},
}

editor_panel_name :: proc(state: ^AppState, panel: EditorPanel) -> cstring {
	return EDITOR_PANEL_NAMES[state.current_workspace][panel]
}

editor_dock_id :: proc(workspace: Workspace) -> im.ID {
	return im.ID(0xcb000010 + u32(workspace))
}

editor_geometry :: proc(scale: f32) -> EditorGeometry {
	v := im.GetMainViewport()
	top := 42.0 * scale
	context_h := 38.0 * scale
	status := 26.0 * scale
	rail := 56.0 * scale
	area_h := math.max(0.0, v.Size.y - top - context_h - status)
	return EditorGeometry{
		top_pos = v.Pos, top_size = {v.Size.x, top},
		context_pos = {v.Pos.x, v.Pos.y + top}, context_size = {v.Size.x, context_h},
		rail_pos = {v.Pos.x, v.Pos.y + top + context_h}, rail_size = {rail, area_h},
		dock_pos = {v.Pos.x + rail, v.Pos.y + top + context_h}, dock_size = {math.max(0.0, v.Size.x - rail), area_h},
		status_pos = {v.Pos.x, v.Pos.y + v.Size.y - status}, status_size = {v.Size.x, status},
	}
}

editor_build_layout :: proc(workspace: Workspace, geometry: EditorGeometry, scale: f32 = 1) {
	id := editor_dock_id(workspace)
	im.DockBuilderRemoveNode(id)
	// Dear ImGui 1.92.8's private DockSpace flag is omitted from the generated
	// Odin enum; isolate its value here rather than spreading private API usage.
	im.DockBuilderAddNode(id, transmute(im.DockNodeFlags)i32(1 << 10))
	im.DockBuilderSetNodePos(id, geometry.dock_pos)
	im.DockBuilderSetNodeSize(id, geometry.dock_size)
	center := id
	right, upper, lower, bottom: im.ID
	if workspace != .Focus {
		right_ratio := math.min(0.40, 290.0 * scale / math.max(1.0, geometry.dock_size.x))
		im.DockBuilderSplitNode(center, .Right, right_ratio, &right, &center)
		if geometry.dock_size.x < 1100 * scale {
			upper, lower = right, right
		} else {
			im.DockBuilderSplitNode(right, .Up, 0.40, &upper, &lower)
		}
		list_panel: EditorPanel = workspace == .Rig ? .Joints : .Layers
		im.DockBuilderDockWindow(EDITOR_PANEL_NAMES[workspace][list_panel], upper)
		im.DockBuilderDockWindow(EDITOR_PANEL_NAMES[workspace][.Inspector], lower)
		im.DockBuilderDockWindow(EDITOR_PANEL_NAMES[workspace][workspace == .Rig ? .Layers : .Joints], upper)
		if workspace == .Animate {
			im.DockBuilderSplitNode(center, .Down, 0.25, &bottom, &center)
			im.DockBuilderDockWindow(EDITOR_PANEL_NAMES[workspace][.Timeline], bottom)
		} else {
			// Reserve a dock target without consuming space while this panel is closed.
			im.DockBuilderDockWindow(EDITOR_PANEL_NAMES[workspace][.Timeline], center)
		}
	} else {
		focus_panels := []EditorPanel{.Layers, .Inspector, .Timeline, .Joints}
		for panel in focus_panels {
			im.DockBuilderDockWindow(EDITOR_PANEL_NAMES[workspace][panel], center)
		}
	}
	im.DockBuilderDockWindow(EDITOR_PANEL_NAMES[workspace][.Stage], center)
	im.DockBuilderFinish(id)
}

editor_render_dockspace :: proc(state: ^AppState, geometry: EditorGeometry) {
	im.SetNextWindowPos(geometry.dock_pos, .Always)
	im.SetNextWindowSize(geometry.dock_size, .Always)
	im.SetNextWindowViewport(im.GetMainViewport().ID_)
	im.PushStyleVarImVec2(.WindowPadding, {0, 0})
	im.PushStyleVar(.WindowBorderSize, 0)
	im.PushStyleVar(.WindowRounding, 0)
	flags := im.WindowFlags{.NoTitleBar, .NoMove, .NoResize, .NoCollapse, .NoSavedSettings, .NoDocking, .NoBringToFrontOnFocus, .NoNavFocus}
	if im.Begin("###editor_dock_host", nil, flags) {
		for workspace in EDITOR_WORKSPACES {
			id := editor_dock_id(workspace)
			if workspace == state.current_workspace {
				if im.DockBuilderGetNode(id) == nil || state.editor.reset_layout[int(workspace)] {
					editor_build_layout(workspace, geometry, state.editor.ui_scale)
					state.editor.reset_layout[int(workspace)] = false
				}
				im.DockSpace(id, {0, 0})
			} else if im.DockBuilderGetNode(id) != nil {
				im.DockSpace(id, {0, 0}, {.KeepAliveOnly})
			}
		}
	}
	im.End()
	im.PopStyleVar(3)
}

editor_reset_layout :: proc(state: ^AppState) {
	state.editor.reset_layout[int(state.current_workspace)] = true
	state.editor.preferences.panels[int(state.current_workspace)] = ui.default_panel_visibility(state.current_workspace)
	state.editor.preferences_dirty = true
}
