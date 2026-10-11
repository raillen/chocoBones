package main

import "core:fmt"
import "core:math"
import "core:os"
import "core:path/filepath"
import "core:strconv"
import "core:strings"
import im "../libs/odin-imgui"
import sdl "vendor:sdl2"
import "animation"
import "core"
import "export"
import "history"
import "mesh3d"
import "rig"
import "ui"

EditorShellState :: struct {
	preferences: ui.Preferences,
	preferences_path, layouts_path: string,
	preferences_dirty, appearance_dirty: bool,
	preferences_invalid_on_load: bool,
	last_preferences_change: f64,
	reset_layout: [4]bool,
	ui_scale: f32,
	regular_font, medium_font: ^im.Font,
	accent_hex: [8]u8,
	appearance_open: bool,
	previous_panels: [4]ui.PanelVisibility,
}

editor_init :: proc(state: ^AppState) {
	ed := &state.editor
	ed.preferences = ui.default_preferences()
	ed.ui_scale = 1.0
	scale_value := os.get_env("CHOCOBONES_UI_SCALE", context.temp_allocator)
	if parsed, ok := strconv.parse_f32(scale_value); ok && parsed >= 1.0 && parsed <= 2.0 {
		ed.ui_scale = parsed
	}
	pref_dir := sdl.GetPrefPath("chocoBones", "chocoBones-std")
	if pref_dir != nil {
		ed.preferences_path, _ = filepath.join({string(pref_dir), "preferences.json"})
		ed.layouts_path, _ = filepath.join({string(pref_dir), "layouts.ini"})
		sdl.free(rawptr(pref_dir))
		if loaded, ok := ui.load_preferences(ed.preferences_path); ok {
			ed.preferences = loaded
		} else if os.exists(ed.preferences_path) {
			ed.preferences_invalid_on_load = true
			ui.toast_add(&state.toasts, "Preferências inválidas: usando a aparência padrão nesta sessão.", .Warning)
		}
	} else {
		ui.toast_add(&state.toasts, "A aparência ficará disponível nesta sessão; não foi possível acessar as preferências.", .Warning)
	}
	state.current_workspace = ed.preferences.workspace
	ed.previous_panels = ed.preferences.panels
	editor_update_accent_hex(state)
	io := im.GetIO()
	io.IniFilename = nil
	if ed.layouts_path != "" {
		if bytes, err := os.read_entire_file(ed.layouts_path, context.allocator); err == nil {
			im.LoadIniSettingsFromMemory(cstring(raw_data(bytes)), uint(len(bytes)))
			delete(bytes)
		}
	}
	ui.apply_theme(ed.preferences.appearance, ed.ui_scale)
	editor_load_fonts(state)
}

editor_load_fonts :: proc(state: ^AppState) {
	ed := &state.editor
	io := im.GetIO()
	cfg := ui.font_config_default()
	cfg.SizePixels = 14.0
	cfg.Flags = {.NoLoadError}
	// Inter uses private-use codepoints for stylistic alternates too. Let the
	// merged Phosphor source own that range so icon strings resolve correctly.
	cfg.GlyphExcludeRanges = &ui.PHOSPHOR_GLYPH_RANGES[0]
	if os.exists("assets/fonts/Inter-Regular.ttf") {
		ed.regular_font = im.FontAtlas_AddFontFromFileTTF(io.Fonts, "assets/fonts/Inter-Regular.ttf", 14.0, &cfg)
	}
	if ed.regular_font == nil {
		ed.regular_font = im.FontAtlas_AddFontDefaultVector(io.Fonts, &cfg)
	}
	ui.load_phosphor_font(io.Fonts, "assets/fonts/Phosphor.ttf", 14.0, true)
	if os.exists("assets/fonts/Inter-Medium.ttf") {
		ed.medium_font = im.FontAtlas_AddFontFromFileTTF(io.Fonts, "assets/fonts/Inter-Medium.ttf", 14.0, &cfg)
		if ed.medium_font != nil {
			ui.load_phosphor_font(io.Fonts, "assets/fonts/Phosphor.ttf", 14.0, true)
		}
	}
	if ed.medium_font == nil do ed.medium_font = ed.regular_font
	io.FontDefault = ed.regular_font
	im.GetStyle().FontSizeBase = 14.0
}

editor_save_layouts :: proc(state: ^AppState) -> bool {
	if state.editor.layouts_path == "" do return false
	size: uint
	data := im.SaveIniSettingsToMemory(&size)
	return ui.save_layouts_atomic(state.editor.layouts_path, (cast([^]u8)data)[:size])
}

editor_save_preferences :: proc(state: ^AppState) -> bool {
	ed := &state.editor
	if ed.preferences_path == "" do return false
	// Preserve an invalid file until the user explicitly changes a preference.
	if ed.preferences_invalid_on_load && !ed.preferences_dirty do return true
	ed.preferences.workspace = state.current_workspace
	if ui.save_preferences(ed.preferences_path, &ed.preferences) {
		ed.preferences_invalid_on_load = false
		ed.preferences_dirty = false
		return true
	}
	return false
}

editor_destroy :: proc(state: ^AppState) {
	if !editor_save_preferences(state) && state.editor.preferences_path != "" {
		fmt.eprintln("Não foi possível salvar as preferências de aparência.")
	}
	if !editor_save_layouts(state) && state.editor.layouts_path != "" {
		fmt.eprintln("Não foi possível salvar os layouts do editor.")
	}
	delete(state.editor.preferences_path)
	delete(state.editor.layouts_path)
}

editor_mark_preferences_changed :: proc(state: ^AppState, appearance: bool = false) {
	state.editor.preferences_dirty = true
	state.editor.last_preferences_change = im.GetTime()
	state.editor.appearance_dirty = state.editor.appearance_dirty || appearance
}

editor_flush_preferences :: proc(state: ^AppState) {
	ed := &state.editor
	if ed.preferences.panels != ed.previous_panels {
		ed.previous_panels = ed.preferences.panels
		editor_mark_preferences_changed(state)
	}
	if ed.preferences_dirty && im.GetTime() - ed.last_preferences_change > 0.6 {
		if !editor_save_preferences(state) {
			ed.preferences_dirty = false
			ui.toast_add(&state.toasts, "Não foi possível salvar as preferências; suas escolhas continuam ativas nesta sessão.", .Warning)
		}
	}
	if im.GetIO().WantSaveIniSettings {
		if !editor_save_layouts(state) {
			ui.toast_add(&state.toasts, "Não foi possível salvar o layout nesta sessão.", .Warning)
		}
		im.GetIO().WantSaveIniSettings = false
	}
}

editor_select_workspace :: proc(state: ^AppState, workspace: Workspace) {
	if state.current_workspace == workspace do return
	// Save the current frame's docking configuration before selecting another space.
	editor_save_layouts(state)
	state.current_workspace = workspace
	state.editor.preferences.workspace = workspace
	state.is_dragging_viewport = false
	state.selection.is_box_selecting = false
	state.selection.is_lasso_selecting = false
	clear(&state.selection.lasso_points)
	state.drag_joint_id = ""
	state.drag_pin_id = ""
	state.gizmo.active_part = .None
	state.gizmo.hovered_part = .None
	editor_mark_preferences_changed(state)
}

editor_begin_bar :: proc(name: cstring, pos, size: im.Vec2, extra: im.WindowFlags = {}, allow_scroll: bool = false) -> bool {
	im.SetNextWindowPos(pos, .Always)
	im.SetNextWindowSize(size, .Always)
	im.SetNextWindowViewport(im.GetMainViewport().ID_)
	im.PushStyleVar(.WindowRounding, 0)
	im.PushStyleVar(.WindowBorderSize, 0)
	im.PushStyleVarImVec2(.WindowPadding, {6 * im.GetStyle().FontScaleMain, 4 * im.GetStyle().FontScaleMain})
	im.PushStyleColorImVec4(.WindowBg, ui.current_palette.surface)
	flags := im.WindowFlags{.NoTitleBar, .NoMove, .NoResize, .NoCollapse, .NoSavedSettings, .NoDocking} + extra
	if !allow_scroll do flags += {.NoScrollbar, .NoScrollWithMouse}
	visible := im.Begin(name, nil, flags)
	im.PopStyleColor()
	im.PopStyleVar(3)
	return visible
}

editor_icon_button :: proc(label, tooltip: cstring, active: bool = false, enabled: bool = true, size: im.Vec2 = {}) -> bool {
	im.BeginDisabled(!enabled)
	im.PushStyleColorImVec4(.Button, active ? ui.current_palette.accent : ui.current_palette.surface)
	im.PushStyleColorImVec4(.Text, active ? ui.current_palette.accent_text : ui.current_palette.text)
	im.PushStyleColorImVec4(.ButtonHovered, active ? ui.current_palette.accent_hover : ui.current_palette.surface_alt)
	im.PushStyleColorImVec4(.ButtonActive, active ? ui.current_palette.accent : ui.current_palette.selection)
	pressed := im.Button(label, size)
	im.PopStyleColor(4)
	im.EndDisabled()
	if im.IsItemHovered(im.HoveredFlags_AllowWhenDisabled) do im.SetTooltip("%s", tooltip)
	return pressed
}

editor_render_workspace_tabs :: proc(state: ^AppState) {
	for workspace in EDITOR_WORKSPACES {
		im.PushIDInt(i32(workspace))
		if editor_icon_button(EDITOR_WORKSPACE_LABELS[workspace], EDITOR_WORKSPACE_LABELS[workspace], state.current_workspace == workspace) {
			editor_select_workspace(state, workspace)
		}
		im.PopID()
		im.SameLine()
	}
}

editor_render_topbar :: proc(state: ^AppState, geometry: EditorGeometry) {
	im.PushStyleVarImVec2(.FramePadding, {8 * state.editor.ui_scale, 8 * state.editor.ui_scale})
	if editor_begin_bar("###editor_topbar", geometry.top_pos, geometry.top_size, {.MenuBar}) {
		if im.BeginMenuBar() {
			im.PushFontFloat(state.editor.medium_font, 14)
			im.TextColored(ui.current_palette.accent, "cb")
			im.SameLine()
			if geometry.top_size.x > 900 * state.editor.ui_scale {
				im.Text("chocoBones")
				im.SameLine()
			}
			im.PopFont()
			render_main_menu(state)
			im.SameLine()
			if geometry.top_size.x >= 1180 * state.editor.ui_scale {
				editor_render_workspace_tabs(state)
			} else if im.BeginMenu("Espaços") {
				for workspace in EDITOR_WORKSPACES {
					if im.MenuItem(EDITOR_WORKSPACE_LABELS[workspace], nil, workspace == state.current_workspace) {
						editor_select_workspace(state, workspace)
					}
				}
				im.EndMenu()
			}
			im.SameLine()
			if geometry.top_size.x > 800 * state.editor.ui_scale {
				if editor_icon_button(ui.ICON_PH_ARROW_U_UP_LEFT + "##undo", "Desfazer (Ctrl+Z)", enabled = history.history_can_undo(&state.history)) do trigger_undo(state)
				im.SameLine()
				if editor_icon_button(ui.ICON_PH_ARROW_U_UP_RIGHT + "##redo", "Refazer (Ctrl+Y)", enabled = history.history_can_redo(&state.history)) do trigger_redo(state)
				im.SameLine()
				if im.BeginMenu("Exportar") {
					editor_render_export_menu(state)
					im.EndMenu()
				}
				im.SameLine()
			}
			if editor_icon_button(ui.ICON_PH_GEAR + "##appearance", "Aparência: tema e cor de destaque") {
				state.editor.appearance_open = true
			}
			im.EndMenuBar()
		}
	}
	im.End()
	im.PopStyleVar()
}

editor_render_view_menu :: proc(state: ^AppState) {
	if im.BeginMenu("Visualizar") {
		panels := &state.editor.preferences.panels[int(state.current_workspace)]
		if im.MenuItem("Camadas", nil, panels.layers) do panels.layers = !panels.layers
		if im.MenuItem("Inspetor", nil, panels.inspector) do panels.inspector = !panels.inspector
		if im.MenuItem("Juntas", nil, panels.joints) do panels.joints = !panels.joints
		if im.MenuItem("Linha do tempo", nil, panels.timeline) do panels.timeline = !panels.timeline
		im.Separator()
		if im.MenuItem("Restaurar layout deste espaço") do editor_reset_layout(state)
		if im.MenuItem("Aparência...") do state.editor.appearance_open = true
		im.EndMenu()
	}
}

editor_render_contextbar :: proc(state: ^AppState, geometry: EditorGeometry) {
	if editor_begin_bar("###editor_contextbar", geometry.context_pos, geometry.context_size) {
		if editor_icon_button("2D Puppet", "Editar personagem 2D", state.viewport_mode == .Mode2D) do state.viewport_mode = .Mode2D
		im.SameLine()
		if editor_icon_button("3D Studio", "Visualizar modelo 3D", state.viewport_mode == .Mode3D) do state.viewport_mode = .Mode3D
		im.SameLine()
		im.TextDisabled("|")
		im.SameLine()
		if state.viewport_mode == .Mode3D {
			if im.Button("Modelo " + ui.ICON_PH_CARET_DOWN) do im.OpenPopup("###editor_model_menu")
			if im.BeginPopup("###editor_model_menu") {
				if im.MenuItem("Importar .obj / .gltf / .glb...") do ui.file_dialog_open(&state.file_dialog, .OpenFile, "modelo.glb")
				if im.MenuItem("Criar cubo") do editor_create_primitive(state, false)
				if im.MenuItem("Criar cilindro") do editor_create_primitive(state, true)
				im.EndPopup()
			}
			im.SameLine()
			if editor_icon_button(ui.ICON_PH_ARROWS_COUNTER_CLOCKWISE, "Enquadrar câmera") do core.orbit_camera_init(&state.camera3d, {0, 0, 0}, 4)
			im.SameLine()
			im.Checkbox("Wireframe", &state.show_wireframe_3d)
			if geometry.context_size.x > 680 * state.editor.ui_scale {
				im.SameLine()
				im.Checkbox("Grade", &state.show_grid_3d)
				im.SameLine()
				im.Checkbox("Girar", &state.auto_rotate_3d)
			}
		} else {
			for descriptor in ui.TOOL_DESCRIPTORS {
				if descriptor.tool == state.active_tool do im.Text("%s", descriptor.label)
			}
			if geometry.context_size.x > 650 * state.editor.ui_scale {
				im.SameLine()
				im.SetNextItemWidth(135 * state.editor.ui_scale)
				#partial switch state.active_tool {
				case .Eraser: editor_slider_value("Raio", &state.eraser_radius, 5, 100, "%.0f px", 210 * state.editor.ui_scale)
				case .Weight:
					editor_slider_value("Raio", &state.weight_brush_radius, 5, 150, "%.0f px", 210 * state.editor.ui_scale)
					im.SameLine()
					im.SetNextItemWidth(100 * state.editor.ui_scale)
					editor_slider_value("Força", &state.weight_brush_strength, 0.05, 1, "%.2f", 160 * state.editor.ui_scale)
				case .Pose, .Joint: im.Checkbox("IK", &state.ik_enabled)
				case: im.TextDisabled("Camada: %s", cstring(raw_data(state.selected_layer_id)))
				}
			}
		}
	}
	im.End()
}

editor_create_primitive :: proc(state: ^AppState, cylinder: bool) {
	if state.has_mesh3d do mesh3d.mesh3d_destroy(&state.active_mesh3d)
	state.active_mesh3d = cylinder ? mesh3d.create_cylinder_mesh(0.8, 1.8, 20) : mesh3d.create_cube_mesh(1.5)
	state.has_mesh3d = true
	core.orbit_camera_init(&state.camera3d, {0, 0, 0}, 4)
	ui.toast_add(&state.toasts, cylinder ? "Cilindro 3D criado" : "Cubo 3D criado", .Success)
}

editor_render_toolrail :: proc(state: ^AppState, geometry: EditorGeometry) {
	if editor_begin_bar("###editor_toolrail", geometry.rail_pos, geometry.rail_size, allow_scroll = true) {
		im.BeginDisabled(state.viewport_mode == .Mode3D)
		for descriptor in ui.TOOL_DESCRIPTORS {
			label := fmt.ctprintf("%s##tool_%d", descriptor.icon, int(descriptor.tool))
			tooltip := fmt.ctprintf("%s (%s)", descriptor.label, descriptor.shortcut)
			if editor_icon_button(label, tooltip, state.active_tool == descriptor.tool, size = {32 * state.editor.ui_scale, 32 * state.editor.ui_scale}) {
				state.active_tool = descriptor.tool
			}
		}
		im.EndDisabled()
	}
	im.End()
}

editor_handle_tool_shortcuts :: proc(state: ^AppState) {
	io := im.GetIO()
	if state.viewport_mode != .Mode2D || editor_keyboard_blocked(state) || io.KeyCtrl || io.KeyAlt || io.KeySuper do return
	if im.IsKeyPressed(.V) do state.active_tool = .Move
	if im.IsKeyPressed(.R) do state.active_tool = .Rotate
	if im.IsKeyPressed(.S) do state.active_tool = .Scale
	if im.IsKeyPressed(.P) do state.active_tool = .Pivot
	if im.IsKeyPressed(.J) do state.active_tool = .Joint
	if im.IsKeyPressed(.Space) do state.active_tool = .Pose
	if im.IsKeyPressed(.N) do state.active_tool = .Pin
	if im.IsKeyPressed(.K) do state.active_tool = .Weight
	if im.IsKeyPressed(.B) do state.active_tool = .BoxSelect
	if im.IsKeyPressed(.L) do state.active_tool = .LassoSelect
	if im.IsKeyPressed(.E) do state.active_tool = .Eraser
}

editor_keyboard_blocked :: proc(state: ^AppState) -> bool {
	return im.GetIO().WantTextInput || im.IsAnyItemActive() ||
	       state.file_dialog.is_open || state.text_editor.is_open ||
	       im.IsPopupOpen(nil, im.PopupFlags_AnyPopup)
}

editor_update_accent_hex :: proc(state: ^AppState) {
	value := ui.format_accent_hex(state.editor.preferences.appearance.accent_rgb, context.temp_allocator)
	state.editor.accent_hex = {}
	copy(state.editor.accent_hex[:], value)
}

editor_render_appearance :: proc(state: ^AppState) {
	ed := &state.editor
	if ed.appearance_open {
		im.OpenPopup("Aparência###editor_appearance")
		ed.appearance_open = false
	}
	im.SetNextWindowSize({300 * ed.ui_scale, 0}, .Always)
	if im.BeginPopup("Aparência###editor_appearance") {
		im.Text("Aparência")
		im.Separator()
		if im.RadioButton("Claro", ed.preferences.appearance.theme == .Light) {
			ed.preferences.appearance.theme = .Light
			editor_mark_preferences_changed(state, true)
		}
		im.SameLine()
		if im.RadioButton("Escuro", ed.preferences.appearance.theme == .Dark) {
			ed.preferences.appearance.theme = .Dark
			editor_mark_preferences_changed(state, true)
		}
		im.Spacing()
		im.Text("Cor de destaque")
		for preset, idx in ui.ACCENT_PRESETS {
			im.PushIDInt(i32(idx))
			if im.ColorButton(preset.name, {preset.rgb[0], preset.rgb[1], preset.rgb[2], 1}, {.NoTooltip}, {28 * ed.ui_scale, 24 * ed.ui_scale}) {
				ed.preferences.appearance.accent_rgb = preset.rgb
				editor_update_accent_hex(state)
				editor_mark_preferences_changed(state, true)
			}
			if im.IsItemHovered() do im.SetTooltip("%s", preset.name)
			im.PopID()
			if idx < len(ui.ACCENT_PRESETS) - 1 do im.SameLine()
		}
		im.SetNextItemWidth(-1)
		if im.ColorEdit3("##accent_picker", &ed.preferences.appearance.accent_rgb, {.NoLabel, .DisplayRGB}) {
			editor_update_accent_hex(state)
			editor_mark_preferences_changed(state, true)
		}
		im.SetNextItemWidth(120 * ed.ui_scale)
		if im.InputText("Hex", cstring(&ed.accent_hex[0]), len(ed.accent_hex), {.EnterReturnsTrue}) {
			if rgb, ok := ui.parse_accent_hex(strings.string_from_null_terminated_ptr(&ed.accent_hex[0], len(ed.accent_hex))); ok {
				ed.preferences.appearance.accent_rgb = rgb
				editor_mark_preferences_changed(state, true)
			} else {
				ui.toast_add(&state.toasts, "Use uma cor hexadecimal como #00B9D6.", .Warning)
			}
			editor_update_accent_hex(state)
		}
		im.Spacing()
		if im.Button("Restaurar aparência") {
			ed.preferences.appearance = ui.default_preferences().appearance
			editor_update_accent_hex(state)
			editor_mark_preferences_changed(state, true)
		}
		im.EndPopup()
	}
}

editor_render_statusbar :: proc(state: ^AppState, geometry: EditorGeometry) {
	if editor_begin_bar("###editor_statusbar", geometry.status_pos, geometry.status_size) {
		im.TextDisabled("%s", EDITOR_WORKSPACE_LABELS[state.current_workspace])
		im.SameLine()
		im.TextDisabled("|")
		im.SameLine()
		if state.status_message != "" {
			im.Text("%s", cstring(raw_data(state.status_message)))
		} else if state.viewport_mode == .Mode3D {
			im.TextDisabled("Arraste para orbitar  ·  Roda para aproximar")
		} else {
			im.TextDisabled("%d camadas  ·  %d juntas  ·  512 × 512", len(state.character_layers), len(state.character_joints))
		}
	}
	im.End()
}

editor_export_pose :: proc(state: ^AppState) {
	if export.export_fbo_to_png("personagem_pose.png", &state.viewport_fbo) {
		state.status_message = "Pose exportada: personagem_pose.png"
		ui.toast_add(&state.toasts, state.status_message, .Success)
	} else {
		state.status_message = "Erro ao exportar PNG do palco."
		ui.toast_add(&state.toasts, state.status_message, .Error)
	}
}

editor_export_spritesheet :: proc(state: ^AppState) {
	frames := make([][]u8, 8, state.scratch_arena.allocator)
	original_time := state.timeline_time
	for i in 0 ..< 8 {
		animation.sample_clip(&state.current_clip, f32(i) * state.timeline_duration / 8, &state.character_pose)
		render_character_to_fbo(state)
		buf := make([]u8, 512 * 512 * 4, state.scratch_arena.allocator)
		export.read_fbo_pixels(&state.viewport_fbo, buf)
		frames[i] = buf
	}
	animation.sample_clip(&state.current_clip, original_time, &state.character_pose)
	render_viewport_scene(state)
	if export.export_spritesheet_grid("personagem_walk_sheet.png", frames, 512, 512, 4) {
		state.status_message = "Spritesheet exportada: personagem_walk_sheet.png"
		ui.toast_add(&state.toasts, state.status_message, .Success)
	} else {
		state.status_message = "Erro ao exportar spritesheet."
		ui.toast_add(&state.toasts, state.status_message, .Error)
	}
}

editor_render_export_menu :: proc(state: ^AppState) {
	if im.MenuItem("Pose atual · PNG") do editor_export_pose(state)
	if im.MenuItem("Spritesheet de caminhada · PNG") do editor_export_spritesheet(state)
}

editor_render_joints_panel :: proc(state: ^AppState) {
	visible := &state.editor.preferences.panels[int(state.current_workspace)].joints
	if !visible^ do return
	if im.Begin(editor_panel_name(state, .Joints), visible) {
		if im.Button(ui.ICON_PH_PLUS + " Nova Junta") {
			new_idx := len(state.character_joints) + 1
			new_id := fmt.tprintf("junta_%d", new_idx)
			parent_id := state.selected_joint_id
			new_name := fmt.tprintf("Junta %d", new_idx)
			px, py: f32 = 256, 256
			if parent_id != "" {
				if pj, ok := rig.find_joint(state.character_joints[:], parent_id); ok {
					px = pj.x + 20
					py = pj.y + 30
				}
			}
			new_j := rig.Joint{
				id     = strings.clone(new_id),
				name   = strings.clone(new_name),
				parent = strings.clone(parent_id),
				x      = px,
				y      = py,
				color  = "#3b82f6",
			}
			if rig.joint_add(&state.character_joints, new_j) {
				state.selected_joint_id = new_id
				save_undo(state, "Adicionar Junta")
				ui.toast_add(&state.toasts, fmt.tprintf("Junta criada: %s", new_name), .Success)
			}
		}

		im.SameLine()
		if im.Button(ui.ICON_PH_TREE_STRUCTURE + " Predefinições...") {
			im.OpenPopup("##popup_rig_presets")
		}

		if im.BeginPopup("##popup_rig_presets") {
			im.TextDisabled("Predefinições de Esqueleto")
			im.Separator()
			if im.MenuItem("Humanoide Completo (14 juntas)") {
				editor_apply_rig_preset(state, .Humanoid)
			}
			if im.MenuItem("Bípede Simplificado (8 juntas)") {
				editor_apply_rig_preset(state, .BipedSimple)
			}
			if im.MenuItem("Quadrúpede (14 juntas)") {
				editor_apply_rig_preset(state, .Quadruped)
			}
			if im.MenuItem("Prop / Acessório (2 juntas)") {
				editor_apply_rig_preset(state, .Prop)
			}
			im.Separator()
			if im.MenuItem("Limpar / Esqueleto Vazio") {
				editor_apply_rig_preset(state, .Empty)
			}
			im.EndPopup()
		}

		im.Separator()
		im.TextDisabled("Esqueleto · %d juntas", len(state.character_joints))
		im.Separator()

		joint_to_delete := ""
		for joint in state.character_joints {
			im.PushID(cstring(raw_data(joint.id)))
			prefix := joint.parent == "" ? "● " : "  ↳ "
			label := fmt.tprintf("%s%s (%s)", prefix, joint.name, joint.id)
			is_sel := (joint.id == state.selected_joint_id || ui.selection_is_joint_selected(&state.selection, joint.id))
			if im.Selectable(cstring(raw_data(label)), is_sel) {
				state.selected_joint_id = joint.id
				io := im.GetIO()
				ui.selection_select_joint(&state.selection, joint.id, io.KeyShift, io.KeyCtrl)
			}

			if im.BeginPopupContextItem("##joint_item_ctx") {
				im.TextDisabled("Junta: %s", cstring(raw_data(joint.name)))
				im.Separator()
				if im.MenuItem(ui.ICON_PH_TRASH + " Excluir Junta") {
					joint_to_delete = joint.id
				}
				im.EndPopup()
			}
			im.PopID()
		}

		if joint_to_delete != "" {
			if rig.joint_remove(&state.character_joints, joint_to_delete) {
				if state.selected_joint_id == joint_to_delete {
					state.selected_joint_id = len(state.character_joints) > 0 ? state.character_joints[0].id : ""
				}
				save_undo(state, "Excluir Junta")
				ui.toast_add(&state.toasts, "Junta removida", .Info)
			}
		}
	}
	im.End()
}

editor_render_timeline_ruler :: proc(state: ^AppState) {
	pos := im.GetCursorScreenPos()
	width := math.max(1.0, im.GetContentRegionAvail().x)
	height := math.max(1, im.GetContentRegionAvail().y - im.GetStyle().ItemSpacing.y)
	im.InvisibleButton("##timeline_ruler", {width, height}, {.EnableNav})
	if im.IsItemActive() && im.IsMouseDown(.Left) {
		state.timeline_time = core.clamp((im.GetIO().MousePos.x - pos.x) / width, 0, 1) * state.timeline_duration
		animation.sample_clip(&state.current_clip, state.timeline_time, &state.character_pose)
	}
	if im.IsItemFocused() {
		step: f32 = im.GetIO().KeyShift ? 0.1 : 1.0 / 60.0
		direction: f32
		if im.IsKeyPressed(.LeftArrow) do direction -= 1
		if im.IsKeyPressed(.RightArrow) do direction += 1
		if direction != 0 {
			state.timeline_time = core.clamp(state.timeline_time + direction * step, 0, state.timeline_duration)
			animation.sample_clip(&state.current_clip, state.timeline_time, &state.character_pose)
		}
	}
	draw := im.GetWindowDrawList()
	p := ui.current_palette
	im.DrawList_AddRectFilled(draw, pos, {pos.x + width, pos.y + height}, ui.color_u32(p.field), 2)
	for tick in 0 ..= 10 {
		x := pos.x + f32(tick) * width / 10
		im.DrawList_AddLine(draw, {x, pos.y}, {x, pos.y + height}, ui.color_u32(p.border))
		if tick < 10 && height >= 32 * state.editor.ui_scale {
			label := fmt.ctprintf("%.1f", f32(tick) * state.timeline_duration / 10)
			im.DrawList_AddText(draw, {x + 4, pos.y + 4}, ui.color_u32(p.text_muted), label)
		}
	}
	for frame in state.current_clip.frames {
		x := pos.x + core.clamp(frame.time / math.max(0.001, state.timeline_duration), 0, 1) * width
		y := pos.y + math.min(40 * state.editor.ui_scale, height * 0.5)
		r := math.min(5 * state.editor.ui_scale, height * 0.35)
		im.DrawList_AddQuadFilled(draw, {x, y - r}, {x + r, y}, {x, y + r}, {x - r, y}, ui.color_u32(p.accent))
	}
	playhead := pos.x + core.clamp(state.timeline_time / math.max(0.001, state.timeline_duration), 0, 1) * width
	im.DrawList_AddLine(draw, {playhead, pos.y}, {playhead, pos.y + height}, ui.color_u32(p.accent), 2)
	im.DrawList_AddTriangleFilled(draw, {playhead - 5, pos.y}, {playhead + 5, pos.y}, {playhead, pos.y + 7}, ui.color_u32(p.accent))
	if im.IsItemFocused() {
		im.DrawList_AddRect(draw, pos, {pos.x + width, pos.y + height}, ui.color_u32(p.focus), 2, thickness = 2)
	}
}
