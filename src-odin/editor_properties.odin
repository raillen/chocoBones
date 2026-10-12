package main

import "core:fmt"
import im "../libs/odin-imgui"

// Two-column property rows keep translated labels and editable values inside
// a narrow inspector at every logical UI scale.
editor_property_begin :: proc(label: cstring) -> bool {
	im.PushID(label)
	if !im.BeginTable("##property", 2, im.TableFlags_SizingStretchProp | im.TableFlags_NoSavedSettings) {
		im.PopID()
		return false
	}
	im.TableSetupColumn("label", {.WidthStretch}, 0.42)
	im.TableSetupColumn("value", {.WidthStretch}, 0.58)
	im.TableNextRow()
	im.TableNextColumn()
	im.TextWrapped("%s", label)
	im.TableNextColumn()
	im.SetNextItemWidth(-1)
	return true
}

editor_property_end :: proc() {
	im.EndTable()
	im.PopID()
}

editor_drag_float2 :: proc(label: cstring, value: rawptr, speed: f32, minimum: f32 = 0, maximum: f32 = 0) -> bool {
	if !editor_property_begin(label) do return false
	changed := im.DragFloat2("##value", cast(^[2]f32)value, speed, minimum, maximum)
	editor_property_end()
	return changed
}

editor_drag_float :: proc(label: cstring, value: ^f32, speed: f32, minimum: f32 = 0, maximum: f32 = 0) -> bool {
	if !editor_property_begin(label) do return false
	changed := im.DragFloat("##value", value, speed, minimum, maximum)
	editor_property_end()
	return changed
}

editor_slider_float :: proc(label: cstring, value: ^f32, minimum, maximum: f32, format: cstring = "%.3f") -> bool {
	if !editor_property_begin(label) do return false
	changed := editor_slider_value("##value", value, minimum, maximum, format)
	editor_property_end()
	return changed
}

// Keep the number outside the colored thumb so every accent retains readable
// values. The native slider still supports keyboard adjustment and Ctrl-click.
editor_slider_value :: proc(label: cstring, value: ^f32, minimum, maximum: f32, format: cstring = "%.3f", width: f32 = 0) -> bool {
	im.PushID(label)
	defer im.PopID()
	value_text := fmt.ctprintf(string(format), value^)
	visible_label := len(label) > 0 && string(label)[0] != '#'
	gap := im.GetStyle().ItemSpacing.x
	label_width := visible_label ? im.CalcTextSize(label).x + gap : f32(0)
	value_width := im.CalcTextSize(value_text).x + gap
	available := width > 0 ? width : im.GetContentRegionAvail().x
	im.SetNextItemWidth(max(24 * im.GetStyle().FontScaleMain, available - value_width - label_width))
	changed := im.SliderFloat("##slider", value, minimum, maximum, "")
	im.SameLine()
	im.TextUnformatted(fmt.ctprintf(string(format), value^))
	if visible_label {
		im.SameLine()
		im.TextUnformatted(label)
	}
	return changed
}
