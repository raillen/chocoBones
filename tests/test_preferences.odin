package tests

import "core:math"
import "core:os"
import "core:strings"
import "core:testing"
import "../src/ui"

@(test)
test_preferences_defaults_and_accent_hex :: proc(t: ^testing.T) {
	p := ui.default_preferences()
	testing.expect_value(t, p.version, 1)
	testing.expect_value(t, p.appearance.theme, ui.ThemeMode.Dark)
	testing.expect_value(t, p.workspace, ui.Workspace.Assembly)
	hex := ui.format_accent_hex(p.appearance.accent_rgb)
	defer delete(hex)
	testing.expect_value(t, hex, "#00B8D9")
	for workspace in ui.Workspace {
		testing.expect_value(t, p.panels[int(workspace)], ui.default_panel_visibility(workspace))
	}
	for input in ([]string{"#000000", "#FFFFFF", "#00B8D9", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B"}) {
		rgb, ok := ui.parse_accent_hex(input)
		testing.expect(t, ok, "All accent presets and extremes must parse")
		encoded := ui.format_accent_hex(rgb)
		testing.expect_value(t, encoded, input)
		delete(encoded)
	}
	rgb, ok := ui.parse_accent_hex("#aBcDeF")
	testing.expect(t, ok, "Hex is case insensitive")
	encoded := ui.format_accent_hex(rgb)
	testing.expect_value(t, encoded, "#ABCDEF")
	delete(encoded)
	for input in ([]string{"", "000000", "#FFF", "#FFFFFFFF", " #000000", "#00G000", "#-00000", "#éFFFF"}) {
		_, parse_ok := ui.parse_accent_hex(input)
		testing.expect(t, !parse_ok, "Malformed hex must be rejected")
	}
}

@(test)
test_preferences_roundtrip_every_workspace_and_theme :: proc(t: ^testing.T) {
	dir, dir_err := os.mkdir_temp("", "chocobones-preferences-*", context.allocator)
	if !testing.expect(t, dir_err == nil, "Temporary directory must be created") { return }
	defer delete(dir)
	defer os.remove_all(dir)
	path := strings.concatenate({dir, "/preferences.json"})
	defer delete(path)
	for workspace in ui.Workspace {
		for theme in ui.ThemeMode {
			for hex in ([]string{"#000000", "#FFFFFF", "#00B8D9", "#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B"}) {
				p := ui.default_preferences()
				p.workspace = workspace
				p.appearance.theme = theme
				p.appearance.accent_rgb, _ = ui.parse_accent_hex(hex)
				// A custom closed/open panel state must survive, including Focus.
				p.panels[int(workspace)] = {true, false, true, false}
				testing.expect(t, ui.save_preferences(path, &p), "Atomic preference save must succeed")
				loaded, ok := ui.load_preferences(path)
				testing.expect(t, ok, "Saved preferences must load")
				testing.expect_value(t, loaded, p)
			}
		}
	}
	bytes, read_err := os.read_entire_file(path, context.allocator)
	if testing.expect(t, read_err == nil, "Saved JSON must be readable") {
		defer delete(bytes)
		text := string(bytes)
		testing.expect(t, strings.contains(text, `"theme": "light"`), "Theme must use a stable wire string")
		testing.expect(t, strings.contains(text, `"workspace": "focus"`), "Workspace must use a stable wire string")
		testing.expect(t, !strings.contains(text, "survivor-puppet"), "Preferences are independent of puppet schema")
	}
}

@(test)
test_preferences_invalid_json_uses_defaults_without_modifying_file :: proc(t: ^testing.T) {
	dir, dir_err := os.mkdir_temp("", "chocobones-preferences-invalid-*", context.allocator)
	if !testing.expect(t, dir_err == nil, "Temporary directory must be created") { return }
	defer delete(dir)
	defer os.remove_all(dir)
	path := strings.concatenate({dir, "/preferences.json"})
	defer delete(path)
	invalid := []string{
		`{`,
		`null`,
		`[]`,
		`{}`,
		`{"version":2,"theme":"dark","accent":"#00B8D9","workspace":"assembly"}`,
		`{"version":0,"theme":"dark","accent":"#00B8D9","workspace":"assembly"}`,
		`{"version":1.5,"theme":"dark","accent":"#00B8D9","workspace":"assembly"}`,
		`{"version":1,"theme":"auto","accent":"#00B8D9","workspace":"assembly"}`,
		`{"version":1,"theme":"dark","accent":"#GG0000","workspace":"assembly"}`,
		`{"version":1,"theme":"dark","accent":"#FFF","workspace":"assembly"}`,
		`{"version":1,"theme":"dark","accent":123,"workspace":"assembly"}`,
		`{"version":1,"theme":"dark","accent":"#00B8D9","workspace":"unknown"}`,
		`{"version":1,"theme":"dark","accent":"#00B8D9"}`,
		`{"version":1,"version":1,"theme":"dark","accent":"#00B8D9","workspace":"assembly"}`,
		`{"version":1,"theme":"dark","accent":"#00B8D9","workspace":"assembly"} trailing`,
		`{"version":1,"theme":"dark","accent":"#00B8D9","workspace":"assembly",}`,
		`{"version":1,"theme":"dark","accent":"#00B8D9","workspace":"assembly","panels":null}`,
		`{"version":1,"theme":"dark","accent":"#00B8D9","workspace":"assembly","panels":[]}`,
		`{"version":1,"theme":"dark","accent":"#00B8D9","workspace":"assembly","panels":[{},{},{},{}]}`,
	}
	for text in invalid {
		testing.expect(t, os.write_entire_file(path, text) == nil, "Invalid fixture must be written")
		loaded, ok := ui.load_preferences(path)
		testing.expect(t, !ok, text)
		testing.expect_value(t, loaded, ui.default_preferences())
		bytes, read_err := os.read_entire_file(path, context.allocator)
		if testing.expect(t, read_err == nil, "Invalid file must remain readable") {
			testing.expect_value(t, string(bytes), text)
			delete(bytes)
		}
	}
}

@(test)
test_preferences_optional_panels_and_color_quantization :: proc(t: ^testing.T) {
	text := `{"version":1,"theme":"light","accent":"#abcdef","workspace":"rig"}`
	p, ok := ui.preferences_from_json(transmute([]u8)text)
	testing.expect(t, ok, "Version 1 preferences without panels remain compatible")
	testing.expect_value(t, p.workspace, ui.Workspace.Rig)
	testing.expect_value(t, p.appearance.theme, ui.ThemeMode.Light)
	for workspace in ui.Workspace {
		testing.expect_value(t, p.panels[int(workspace)], ui.default_panel_visibility(workspace))
	}
	p.appearance.accent_rgb = {0.1234, 0.5678, 0.9012}
	bytes, encoded := ui.preferences_json(&p)
	if !testing.expect(t, encoded, "Free RGB colors must encode") { return }
	defer delete(bytes)
	loaded, decoded := ui.preferences_from_json(bytes)
	testing.expect(t, decoded, "Encoded free colors must decode")
	for channel, i in p.appearance.accent_rgb {
		testing.expect(t, math.abs(channel - loaded.appearance.accent_rgb[i]) <= 0.5 / 255.0, "Hex quantization must stay within half an 8-bit step")
	}
}

@(test)
test_preferences_io_failure_and_atomic_layout_replacement :: proc(t: ^testing.T) {
	dir, dir_err := os.mkdir_temp("", "chocobones-preferences-io-*", context.allocator)
	if !testing.expect(t, dir_err == nil, "Temporary directory must be created") { return }
	defer delete(dir)
	defer os.remove_all(dir)
	missing := strings.concatenate({dir, "/missing/preferences.json"})
	defer delete(missing)
	p := ui.default_preferences()
	loaded, ok := ui.load_preferences(missing)
	testing.expect(t, !ok, "Missing file must report failure")
	testing.expect_value(t, loaded, p)
	testing.expect(t, !ui.save_preferences(missing, &p), "Unavailable directory must report a save failure")
	testing.expect(t, !ui.save_layouts_atomic("", nil), "An empty path must fail")
	path := strings.concatenate({dir, "/layouts.ini"})
	defer delete(path)
	old_text := "[Docking][Data]\nold\n"
	new_text := "[Docking][Data]\nnew\n"
	testing.expect(t, os.write_entire_file(path, old_text) == nil, "Initial layout must be written")
	testing.expect(t, ui.save_layouts_atomic(path, transmute([]u8)new_text), "Existing layouts must be atomically replaced")
	bytes, read_err := os.read_entire_file(path, context.allocator)
	if testing.expect(t, read_err == nil, "Replaced layout must be readable") {
		testing.expect_value(t, string(bytes), new_text)
		delete(bytes)
	}
	// Renaming a file over a directory fails and must clean its temporary file.
	testing.expect(t, !ui.save_layouts_atomic(dir, transmute([]u8)new_text), "Rename failure must be reported")
	tmp_path := strings.concatenate({dir, ".tmp"})
	defer delete(tmp_path)
	_, tmp_err := os.stat(tmp_path, context.allocator)
	testing.expect(t, tmp_err == .Not_Exist, "Failed atomic writes must clean their temporary file")
	// Validation failure must not overwrite an existing preferences file.
	preferences_path := strings.concatenate({dir, "/preferences.json"})
	defer delete(preferences_path)
	testing.expect(t, ui.save_preferences(preferences_path, &p), "Initial valid preferences must save")
	p.version = 99
	testing.expect(t, !ui.save_preferences(preferences_path, &p), "Unknown versions must not be saved")
	loaded, ok = ui.load_preferences(preferences_path)
	testing.expect(t, ok, "Previous preferences must remain intact")
	testing.expect_value(t, loaded, ui.default_preferences())
	p = ui.default_preferences()
	p.appearance.accent_rgb[0] = -0.1
	_, valid := ui.preferences_json(&p)
	testing.expect(t, !valid, "Out-of-range colors must not be persisted")
	p.appearance.accent_rgb[0] = 1.1
	_, valid = ui.preferences_json(&p)
	testing.expect(t, !valid, "Out-of-range colors must not be persisted")
	p.appearance.accent_rgb[0] = math.nan_f32()
	_, valid = ui.preferences_json(&p)
	testing.expect(t, !valid, "Non-finite colors must not be persisted")
}
