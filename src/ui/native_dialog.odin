package ui

import "core:os"
import "core:strings"

DialogMode :: enum {
	Open,
	Save,
}

DialogFilter :: enum {
	Image,
	Project,
	Mesh,
}

// Opens the native operating system file chooser window for a single file.
// Returns the selected file path and true if a file was selected, or empty string and false if cancelled.
open_system_file_dialog :: proc(title: string, mode: DialogMode = .Open, filter: DialogFilter = .Image) -> (path: string, ok: bool) {
	mode_str := mode == .Save ? "save" : "open"
	filter_str: string
	switch filter {
	case .Image:   filter_str = "image"
	case .Project: filter_str = "project"
	case .Mesh:    filter_str = "mesh"
	}

	script_path := "scripts/native_dialog.py"
	if !os.exists(script_path) {
		script_path = "../scripts/native_dialog.py"
	}

	cmd := []string{"python3", script_path, mode_str, title, filter_str, "single"}
	desc := os.Process_Desc{
		command = cmd,
	}

	state, stdout, _, err := os.process_exec(desc, context.temp_allocator)
	if err == nil && state.success {
		out_str := strings.trim_space(string(stdout))
		if len(out_str) > 0 {
			return strings.clone(out_str), true
		}
	}

	return "", false
}

// Opens the native operating system file chooser window allowing multiple files to be selected at once.
open_system_file_dialog_multiple :: proc(title: string, filter: DialogFilter = .Image, allocator := context.allocator) -> [dynamic]string {
	filter_str: string
	switch filter {
	case .Image:   filter_str = "image"
	case .Project: filter_str = "project"
	case .Mesh:    filter_str = "mesh"
	}

	script_path := "scripts/native_dialog.py"
	if !os.exists(script_path) {
		script_path = "../scripts/native_dialog.py"
	}

	cmd := []string{"python3", script_path, "open", title, filter_str, "multiple"}
	desc := os.Process_Desc{
		command = cmd,
	}

	result := make([dynamic]string, 0, 8, allocator)
	state, stdout, _, err := os.process_exec(desc, context.temp_allocator)
	if err == nil && state.success {
		out_str := string(stdout)
		lines := strings.split(out_str, "\n", context.temp_allocator)
		for l in lines {
			trimmed := strings.trim_space(l)
			if len(trimmed) > 0 {
				append(&result, strings.clone(trimmed, allocator))
			}
		}
	}

	return result
}
