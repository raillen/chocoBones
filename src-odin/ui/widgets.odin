package ui

import "core:fmt"
import "core:math"
import "core:strings"
import "core:time"
import im "../../libs/odin-imgui"
import "../core"

// =========================================================================
// 1. ÍCONES ESTILO PHOSPHOR (Mapeados para as constantes oficiais Phosphor)
// =========================================================================

ICON_FOLDER       :: ICON_PH_FOLDER
ICON_SAVE         :: ICON_PH_FLOPPY_DISK
ICON_PLAY         :: ICON_PH_PLAY
ICON_PAUSE        :: ICON_PH_PAUSE
ICON_UNDO         :: ICON_PH_ARROW_U_UP_LEFT
ICON_REDO         :: ICON_PH_ARROW_U_UP_RIGHT
ICON_MOVE         :: ICON_PH_ARROWS_OUT_CARDINAL
ICON_ROTATE       :: ICON_PH_ARROW_CLOCKWISE
ICON_SCALE        :: ICON_PH_ARROWS_OUT_SIMPLE
ICON_PIVOT        :: ICON_PH_CROSSHAIR
ICON_JOINT        :: ICON_PH_BONE
ICON_POSE         :: ICON_PH_PERSON_ARMS_SPREAD
ICON_PIN          :: ICON_PH_PUSH_PIN
ICON_BOX_SELECT   :: ICON_PH_BOUNDING_BOX
ICON_LASSO_SELECT :: ICON_PH_SELECTION
ICON_ERASER       :: ICON_PH_ERASER
ICON_WEIGHT       :: ICON_PH_PAINT_BRUSH
ICON_EYE          :: ICON_PH_EYE
ICON_TRASH        :: ICON_PH_TRASH
ICON_CHECK        :: ICON_PH_CHECK
ICON_CROSS        :: ICON_PH_X
ICON_COG          :: ICON_PH_GEAR

// =========================================================================
// 2. Toggle compacto com navegação por teclado
// =========================================================================

Toggle :: proc(label: cstring, v: ^bool) -> bool {
	p := im.GetCursorScreenPos()
	draw_list := im.GetWindowDrawList()

	height: f32 = im.GetFrameHeight() * 0.85
	width: f32 = height * 1.8
	radius: f32 = height * 0.5

	clicked := im.InvisibleButton(label, im.Vec2{width, height}, {.EnableNav})
	if clicked {
		v^ = !v^
	}

	bg_col := color_u32(v^ ? current_palette.accent : current_palette.field)
	if im.IsItemHovered() {
		bg_col = color_u32(v^ ? current_palette.accent_hover : current_palette.surface_alt)
	}

	im.DrawList_AddRectFilled(draw_list, p, {p.x + width, p.y + height}, bg_col, radius)
	im.DrawList_AddRect(draw_list, p, {p.x + width, p.y + height}, color_u32(current_palette.border), radius, 1.0)
	if im.IsItemFocused() {
		im.DrawList_AddRect(draw_list, {p.x - 2, p.y - 2}, {p.x + width + 2, p.y + height + 2}, color_u32(current_palette.focus), radius + 2, 1.5)
	}

	// Botão circular deslizante
	circle_x: f32 = v^ ? (p.x + width - radius) : (p.x + radius)
	circle_y: f32 = p.y + radius
	thumb_col := v^ ? current_palette.accent_text : current_palette.text
	im.DrawList_AddCircleFilled(draw_list, {circle_x, circle_y}, radius - 2.0, color_u32(thumb_col))

	// Texto adjacente
	if len(label) > 0 && (transmute([^]u8)label)[0] != '#' {
		im.SameLine()
		im.Text(label)
	}

	return clicked
}

// =========================================================================
// 3. imgui-knobs — Botão Rotativo Analógico
// =========================================================================

Knob :: proc(label: cstring, value: ^f32, v_min, v_max: f32, radius: f32 = 18.0) -> bool {
	pos := im.GetCursorScreenPos()
	draw_list := im.GetWindowDrawList()

	size := im.Vec2{radius * 2.0, radius * 2.0}
	changed := false

	im.InvisibleButton(label, size, {.EnableNav})
	is_active := im.IsItemActive()
	is_hovered := im.IsItemHovered()
	is_focused := im.IsItemFocused()

	if is_active && im.IsMouseDown(.Left) {
		io := im.GetIO()
		mouse_delta := -io.MouseDelta.y * 0.015
		range := v_max - v_min
		new_val := value^ + mouse_delta * range
		new_val = core.clamp(new_val, v_min, v_max)
		if new_val != value^ {
			value^ = new_val
			changed = true
		}
	}
	if is_focused {
		step := (v_max - v_min) * (im.GetIO().KeyShift ? 0.001 : 0.01)
		direction: f32 = 0
		if im.IsKeyPressed(.LeftArrow) || im.IsKeyPressed(.DownArrow) do direction -= 1
		if im.IsKeyPressed(.RightArrow) || im.IsKeyPressed(.UpArrow) do direction += 1
		if direction != 0 {
			// Arrow keys adjust this focused control; Tab still moves focus.
			im.NavMoveRequestCancel()
			new_val := core.clamp(value^ + step * direction, v_min, v_max)
			if new_val != value^ {
				value^ = new_val
				changed = true
			}
		}
	}

	center := im.Vec2{pos.x + radius, pos.y + radius}

	// Círculo de fundo
	base_col := color_u32(is_hovered ? current_palette.surface_alt : current_palette.field)
	im.DrawList_AddCircleFilled(draw_list, center, radius, base_col, 32)
	im.DrawList_AddCircle(draw_list, center, radius, color_u32(current_palette.border), 32, 1.0)
	if is_focused {
		im.DrawList_AddCircle(draw_list, center, radius + 2, color_u32(current_palette.focus), 32, 1.5)
	}

	// Arco de preenchimento (225° até -45° = 270° de amplitude)
	norm := (value^ - v_min) / (v_max - v_min)
	norm = core.clamp(norm, 0.0, 1.0)

	angle_start: f32 = math.PI * 0.75
	angle_end: f32 = math.PI * 2.25
	current_angle := angle_start + norm * (angle_end - angle_start)

	// Ponteiro indicador do Knob
	ptr_x := center.x + math.cos(current_angle) * (radius - 4.0)
	ptr_y := center.y + math.sin(current_angle) * (radius - 4.0)
	im.DrawList_AddLine(draw_list, center, {ptr_x, ptr_y}, color_u32(current_palette.accent), 2.0)
	im.DrawList_AddCircleFilled(draw_list, {ptr_x, ptr_y}, 2.5, color_u32(current_palette.text))
	if is_hovered || is_focused {
		im.SetTooltip("Arraste para ajustar. Setas: 1%%; Shift + setas: 0,1%%.")
	}

	// Rótulo
	if len(label) > 0 && (transmute([^]u8)label)[0] != '#' {
		im.SameLine()
		im.Text("%s: %.2f", label, value^)
	}

	return changed
}

// =========================================================================
// 4. ImSpinner — Indicador de Progresso / Carregamento
// =========================================================================

Spinner :: proc(radius: f32 = 12.0, thickness: f32 = 3.0, color: u32 = 0) {
	pos := im.GetCursorScreenPos()
	draw_list := im.GetWindowDrawList()

	center := im.Vec2{pos.x + radius, pos.y + radius}
	// Keep the rotating phase small before converting to f32.
	t := f32(math.mod(im.GetTime() * 6.0, math.PI * 2.0))

	start_angle := t
	end_angle := t + math.PI * 1.4

	resolved_color := color == 0 ? color_u32(current_palette.accent) : color
	im.DrawList_AddCircle(draw_list, center, radius, color_u32(current_palette.border), 24, thickness)

	num_segments := 24
	step := (end_angle - start_angle) / f32(num_segments)
	for i in 0 ..< num_segments {
		a1 := start_angle + f32(i) * step
		a2 := a1 + step
		p1 := im.Vec2{center.x + math.cos(a1) * radius, center.y + math.sin(a1) * radius}
		p2 := im.Vec2{center.x + math.cos(a2) * radius, center.y + math.sin(a2) * radius}
		im.DrawList_AddLine(draw_list, p1, p2, resolved_color, thickness)
	}

	im.Dummy(im.Vec2{radius * 2.0, radius * 2.0})
}

// =========================================================================
// 5. ImNotify — Notificações Toast Flutuantes
// =========================================================================

ToastType :: enum {
	Info,
	Success,
	Warning,
	Error,
}

ToastNotification :: struct {
	title:      string,
	message:    string,
	kind:       ToastType,
	spawn_time: f64,
	duration:   f64,
}

ToastManager :: struct {
	toasts: [dynamic]ToastNotification,
}

toast_manager_init :: proc(tm: ^ToastManager, allocator := context.allocator) {
	tm.toasts = make([dynamic]ToastNotification, 0, 8, allocator)
}

toast_manager_destroy :: proc(tm: ^ToastManager) {
	delete(tm.toasts)
}

toast_push :: proc(tm: ^ToastManager, title, message: string, kind: ToastType, duration: f64 = 4.0) {
	now := time.duration_seconds(time.since(time.Time{}))
	append(&tm.toasts, ToastNotification{
		title      = title,
		message    = message,
		kind       = kind,
		spawn_time = now,
		duration   = duration,
	})
}

toast_add :: proc(tm: ^ToastManager, message: string, kind: ToastType = .Info, duration: f64 = 3.5) {
	title: string
	switch kind {
	case .Success: title = "Sucesso"
	case .Warning: title = "Aviso"
	case .Error:   title = "Erro"
	case .Info:    title = "Informação"
	}
	toast_push(tm, title, message, kind, duration)
}

toast_render :: proc(tm: ^ToastManager) {
	now := time.duration_seconds(time.since(time.Time{}))

	// Remove expirados
	#reverse for t, i in tm.toasts {
		if now - t.spawn_time > t.duration {
			unordered_remove(&tm.toasts, i)
		}
	}

	if len(tm.toasts) == 0 do return

	viewport := im.GetMainViewport()
	base_x := viewport.Pos.x + viewport.Size.x - 12.0
	base_y := viewport.Pos.y + viewport.Size.y - 34.0
	toast_width := min(f32(320), max(f32(120), viewport.Size.x - 24))
	im.PushStyleColorImVec4(.WindowBg, current_palette.surface)
	im.PushStyleColorImVec4(.Border, current_palette.border)
	im.PushStyleVarImVec2(.WindowPadding, {10, 8})
	im.PushStyleVar(.WindowRounding, 3)

	for t, i in tm.toasts {
		toast_pos := im.Vec2{base_x, base_y}

		im.SetNextWindowPos(toast_pos, .Always, {1, 1})
		im.SetNextWindowSize(im.Vec2{toast_width, 0}, .Always)
		im.SetNextWindowBgAlpha(1)

		flags := im.WindowFlags{.NoTitleBar, .NoResize, .NoMove, .NoScrollbar, .NoCollapse, .AlwaysAutoResize, .NoSavedSettings, .NoFocusOnAppearing, .NoNavInputs}
		window_id := fmt.tprintf("##toast_%d", i)
		if im.Begin(cstring(raw_data(window_id)), nil, flags) {

			border_col: im.Vec4
			icon_str := ICON_PH_INFO
			switch t.kind {
			case .Success:
				border_col = current_palette.success
				icon_str = ICON_PH_CHECK_CIRCLE
			case .Warning:
				border_col = current_palette.warning
				icon_str = ICON_PH_WARNING_CIRCLE
			case .Error:
				border_col = current_palette.error
				icon_str = ICON_PH_X_CIRCLE
			case .Info:
				border_col = contrast_color(current_palette.accent, current_palette.surface, 4.5)
				icon_str = ICON_PH_INFO
			}

			im.TextColored(border_col, "%s  %s", cstring(raw_data(icon_str)), cstring(raw_data(t.title)))
			im.TextWrapped("%s", cstring(raw_data(t.message)))
		}
		base_y -= im.GetWindowSize().y + 8
		im.End()
	}
	im.PopStyleVar(2)
	im.PopStyleColor(2)
}

// =========================================================================
// 6. Barra de ferramentas compacta
// =========================================================================

CoolBarItem :: struct {
	label:   cstring,
	icon:    cstring,
	tooltip: cstring,
}

CoolBar :: proc(items: []CoolBarItem, active_idx: int) -> int {
	selected := active_idx
	base_size: f32 = 32.0
	for item, idx in items {
		is_active := (idx == active_idx)
		im.PushStyleColorImVec4(.Button, is_active ? current_palette.accent : current_palette.surface)
		im.PushStyleColorImVec4(.Text, is_active ? current_palette.accent_text : current_palette.text)
		im.PushStyleColorImVec4(.ButtonHovered, is_active ? current_palette.accent_hover : current_palette.surface_alt)

		btn_id := fmt.tprintf("%s##cool_%d", item.icon, idx)
		if im.Button(cstring(raw_data(btn_id)), im.Vec2{base_size, base_size}) {
			selected = idx
		}

		im.PopStyleColor(3)

		if (im.IsItemHovered() || im.IsItemFocused()) && len(item.tooltip) > 0 {
			im.SetTooltip("%s (%s)", item.label, item.tooltip)
		}

		im.SameLine()
	}
	im.NewLine()

	return selected
}

// =========================================================================
// 7. ImFileDialog — Diálogo Modal de Arquivos
// =========================================================================

FileDialogMode :: enum {
	OpenFile,
	SaveFile,
}

FileDialog :: struct {
	is_open:       bool,
	mode:          FileDialogMode,
	current_path:  string,
	filename_buf:  [256]u8,
	selected_file: string,
	confirmed:     bool,
}

file_dialog_init :: proc(fd: ^FileDialog) {
	fd.is_open = false
	fd.current_path = "."
	fd.confirmed = false
}

file_dialog_open :: proc(fd: ^FileDialog, mode: FileDialogMode, default_name: string = "") {
	fd.is_open = true
	fd.mode = mode
	fd.confirmed = false
	for &b in fd.filename_buf do b = 0
	copy(fd.filename_buf[:], default_name)
}

file_dialog_render :: proc(fd: ^FileDialog) -> bool {
	if !fd.is_open do return false

	im.OpenPopup("Diálogo de Arquivo")
	title := (fd.mode == .OpenFile) ? "Abrir Arquivo##dlg" : "Salvar Arquivo##dlg"

	if im.BeginPopupModal("Diálogo de Arquivo", &fd.is_open, {.AlwaysAutoResize}) {
		im.TextColored(current_palette.text_muted, "Caminho atual: %s", cstring(raw_data(fd.current_path)))
		im.Separator()

		// Campo de nome do arquivo
		im.InputText("Nome do Arquivo", cstring(&fd.filename_buf[0]), len(fd.filename_buf))

		im.Separator()
		im.PushStyleColorImVec4(.Button, current_palette.accent)
		im.PushStyleColorImVec4(.ButtonHovered, current_palette.accent_hover)
		im.PushStyleColorImVec4(.Text, current_palette.accent_text)
		if im.Button(ICON_PH_CHECK + " Confirmar", im.Vec2{120, 0}) {
			name := strings.string_from_null_terminated_ptr(&fd.filename_buf[0], len(fd.filename_buf))
			if len(name) > 0 {
				fd.selected_file = name
				fd.confirmed = true
				fd.is_open = false
				im.CloseCurrentPopup()
			}
		}
		im.PopStyleColor(3)
		im.SameLine()
		if im.Button(ICON_PH_X + " Cancelar", im.Vec2{120, 0}) {
			fd.is_open = false
			im.CloseCurrentPopup()
		}

		im.EndPopup()
	}

	return fd.confirmed
}

// =========================================================================
// 8. ImGuiColorTextEdit — Editor de Texto / Código Modal
// =========================================================================

TextEditorModal :: struct {
	is_open: bool,
	title:   string,
	buffer:  [dynamic]u8,
}

text_editor_modal_init :: proc(ed: ^TextEditorModal, allocator := context.allocator) {
	ed.is_open = false
	ed.buffer = make([dynamic]u8, 0, 1024 * 16, allocator)
}

text_editor_modal_destroy :: proc(ed: ^TextEditorModal) {
	delete(ed.buffer)
}

text_editor_modal_open :: proc(ed: ^TextEditorModal, title, initial_text: string) {
	ed.is_open = true
	ed.title = title
	clear(&ed.buffer)
	for b in transmute([]u8)initial_text {
		append(&ed.buffer, b)
	}
	append(&ed.buffer, 0)
}

text_editor_modal_render :: proc(ed: ^TextEditorModal) {
	if !ed.is_open do return

	im.SetNextWindowSize(im.Vec2{640, 480}, .FirstUseEver)
	if im.Begin(cstring(raw_data(ed.title)), &ed.is_open) {
		im.TextColored(current_palette.text_muted, "Inspetor de Documento JSON / Shader GLSL:")
		im.Separator()

		if len(ed.buffer) > 0 {
			flags := im.InputTextFlags{.ReadOnly}
			im.InputTextMultiline(
				"##code_viewer",
				cstring(&ed.buffer[0]),
				len(ed.buffer),
				im.Vec2{-1, -35},
				flags,
			)
		}

		if im.Button(ICON_PH_X + " Fechar", im.Vec2{100, 0}) {
			ed.is_open = false
		}
	}
	im.End()
}
