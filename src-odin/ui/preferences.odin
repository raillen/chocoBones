package ui

import "core:encoding/json"
import "core:os"
import "core:strings"

// Editor preferences are independent of the character document. Keep the wire
// representation explicit so enum ordinals and UI internals never leak into it.
Preferences :: struct {
	version:    int,
	appearance: AppearanceSettings,
	workspace:  Workspace,
	panels:     [4]PanelVisibility,
}

@(private="file")
PreferencesWire :: struct {
	version:   int,
	theme:     string,
	accent:    string,
	workspace: string,
	panels:    [4]PanelVisibility,
}

default_preferences :: proc() -> Preferences {
	p := Preferences{
		version = 1,
		appearance = {theme = .Dark, accent_rgb = {0, 184.0 / 255.0, 217.0 / 255.0}},
		workspace = .Assembly,
	}
	for workspace in Workspace {
		p.panels[int(workspace)] = default_panel_visibility(workspace)
	}
	return p
}

@(private="file")
hex_digit :: proc(value: u8) -> (u8, bool) {
	if value >= '0' && value <= '9' { return value - '0', true }
	if value >= 'A' && value <= 'F' { return value - 'A' + 10, true }
	if value >= 'a' && value <= 'f' { return value - 'a' + 10, true }
	return 0, false
}

parse_accent_hex :: proc(value: string) -> ([3]f32, bool) {
	if len(value) != 7 || value[0] != '#' { return {}, false }
	rgb: [3]f32
	for i in 0 ..< 3 {
		hi, hi_ok := hex_digit(value[1 + 2 * i])
		lo, lo_ok := hex_digit(value[2 + 2 * i])
		if !hi_ok || !lo_ok { return {}, false }
		rgb[i] = f32(hi * 16 + lo) / 255.0
	}
	return rgb, true
}

// The returned string belongs to allocator. Rounding preserves colors selected
// from 8-bit hex presets exactly through repeated saves.
format_accent_hex :: proc(rgb: [3]f32, allocator := context.allocator) -> string {
	hex := "0123456789ABCDEF"
	text: [7]u8
	text[0] = '#'
	for channel, i in rgb {
		v := u8(clamp(channel, 0, 1) * 255.0 + 0.5)
		text[1 + 2 * i] = hex[v >> 4]
		text[2 + 2 * i] = hex[v & 15]
	}
	return strings.clone(string(text[:]), allocator)
}

@(private="file")
valid_preferences_json_tokens :: proc(bytes: []u8) -> bool {
	// Odin's JSON parser currently accepts trailing commas even with .JSON.
	// Check tokens (rather than text) so commas inside strings remain valid.
	tokenizer := json.make_tokenizer(string(bytes), .JSON, true)
	previous: json.Token_Kind = .Invalid
	for {
		token, err := json.get_token(&tokenizer)
		if token.kind == .EOF { return err == .EOF }
		if err != .None { return false }
		if previous == .Comma && (token.kind == .Close_Brace || token.kind == .Close_Bracket) {
			return false
		}
		previous = token.kind
	}
}

preferences_from_json :: proc(bytes: []u8, allocator := context.allocator) -> (Preferences, bool) {
	defaults := default_preferences()
	if !valid_preferences_json_tokens(bytes) { return defaults, false }
	parser := json.make_parser(bytes, .JSON, true, allocator)
	value, err := json.parse_value(&parser)
	defer json.destroy_value(value, allocator)
	if err != .None || parser.curr_token.kind != .EOF { return defaults, false }
	object, object_ok := value.(json.Object)
	if !object_ok { return defaults, false }
	version, version_ok := object["version"].(json.Integer)
	theme, theme_ok := object["theme"].(json.String)
	accent, accent_ok := object["accent"].(json.String)
	workspace, workspace_ok := object["workspace"].(json.String)
	if !version_ok || version != 1 || !theme_ok || !accent_ok || !workspace_ok {
		return defaults, false
	}
	p := defaults
	switch theme {
	case "dark": p.appearance.theme = .Dark
	case "light": p.appearance.theme = .Light
	case: return defaults, false
	}
	switch workspace {
	case "assembly": p.workspace = .Assembly
	case "rig": p.workspace = .Rig
	case "animate": p.workspace = .Animate
	case "focus": p.workspace = .Focus
	case: return defaults, false
	}
	rgb, rgb_ok := parse_accent_hex(accent)
	if !rgb_ok { return defaults, false }
	p.appearance.accent_rgb = rgb
	if panel_value, present := object["panels"]; present {
		panels, panels_ok := panel_value.(json.Array)
		if !panels_ok || len(panels) != len(p.panels) { return defaults, false }
		for panel_value, i in panels {
			panel, panel_ok := panel_value.(json.Object)
			if !panel_ok { return defaults, false }
			layers, layers_ok := panel["layers"].(json.Boolean)
			inspector, inspector_ok := panel["inspector"].(json.Boolean)
			timeline, timeline_ok := panel["timeline"].(json.Boolean)
			joints, joints_ok := panel["joints"].(json.Boolean)
			if !layers_ok || !inspector_ok || !timeline_ok || !joints_ok { return defaults, false }
			p.panels[i] = {bool(layers), bool(inspector), bool(timeline), bool(joints)}
		}
	}
	return p, true
}

load_preferences :: proc(path: string, allocator := context.allocator) -> (Preferences, bool) {
	bytes, err := os.read_entire_file(path, allocator)
	if err != nil { return default_preferences(), false }
	defer delete(bytes, allocator)
	return preferences_from_json(bytes, allocator)
}

preferences_json :: proc(p: ^Preferences, allocator := context.allocator) -> ([]u8, bool) {
	if p == nil || p.version != 1 { return nil, false }
	for channel in p.appearance.accent_rgb {
		// This also rejects NaN and infinities, without silently changing saved RGB.
		if !(channel >= 0 && channel <= 1) { return nil, false }
	}
	theme: string
	switch p.appearance.theme {
	case .Dark: theme = "dark"
	case .Light: theme = "light"
	case: return nil, false
	}
	workspace: string
	switch p.workspace {
	case .Assembly: workspace = "assembly"
	case .Rig: workspace = "rig"
	case .Animate: workspace = "animate"
	case .Focus: workspace = "focus"
	case: return nil, false
	}
	hex := format_accent_hex(p.appearance.accent_rgb, allocator)
	defer delete(hex, allocator)
	wire := PreferencesWire{p.version, theme, hex, workspace, p.panels}
	bytes, err := json.marshal(wire, {pretty = true, use_spaces = true, spaces = 2}, allocator)
	if err != nil { return nil, false }
	return bytes, true
}

save_preferences :: proc(path: string, p: ^Preferences) -> bool {
	bytes, ok := preferences_json(p)
	if !ok { return false }
	defer delete(bytes)
	return save_layouts_atomic(path, bytes)
}

// The temporary file lives beside its destination, so rename stays on the same
// filesystem. A failed write or rename never truncates the existing destination.
save_layouts_atomic :: proc(path: string, bytes: []u8) -> bool {
	if path == "" { return false }
	tmp_path := strings.concatenate({path, ".tmp"})
	defer delete(tmp_path)
	file, open_err := os.open(tmp_path, {.Write, .Create, .Trunc}, {.Read_User, .Write_User})
	if open_err != nil { return false }
	offset := 0
	write_ok := true
	for offset < len(bytes) {
		n, err := os.write(file, bytes[offset:])
		if err != nil || n <= 0 {
			write_ok = false
			break
		}
		offset += n
	}
	close_err := os.close(file)
	if !write_ok || close_err != nil {
		os.remove(tmp_path)
		return false
	}
	if os.rename(tmp_path, path) != nil {
		os.remove(tmp_path)
		return false
	}
	return true
}
