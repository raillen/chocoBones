package ui

import "core:math"
import "../core"
import "../rig"

SelectionState :: struct {
	selected_layers:    map[string]bool,
	selected_joints:    map[string]bool,
	primary_layer_id:   string,
	primary_joint_id:   string,
	is_box_selecting:   bool,
	box_start:          core.Vec2,
	box_end:            core.Vec2,
	is_lasso_selecting: bool,
	lasso_points:       [dynamic]core.Vec2,
}

selection_state_init :: proc(s: ^SelectionState, allocator := context.allocator) {
	s.selected_layers = make(map[string]bool, 16, allocator)
	s.selected_joints = make(map[string]bool, 16, allocator)
	s.lasso_points = make([dynamic]core.Vec2, 0, 128, allocator)
	s.primary_layer_id = ""
	s.primary_joint_id = ""
}

selection_state_destroy :: proc(s: ^SelectionState) {
	delete(s.selected_layers)
	delete(s.selected_joints)
	delete(s.lasso_points)
}

selection_clear :: proc(s: ^SelectionState) {
	clear(&s.selected_layers)
	clear(&s.selected_joints)
	s.primary_layer_id = ""
	s.primary_joint_id = ""
}

selection_select_layer :: proc(s: ^SelectionState, id: string, additive, toggle: bool) {
	if toggle {
		if id in s.selected_layers {
			delete_key(&s.selected_layers, id)
			if s.primary_layer_id == id {
				s.primary_layer_id = ""
				for k in s.selected_layers {
					s.primary_layer_id = k
					break
				}
			}
		} else {
			s.selected_layers[id] = true
			s.primary_layer_id = id
		}
		return
	}

	if !additive {
		clear(&s.selected_layers)
	}

	s.selected_layers[id] = true
	s.primary_layer_id = id
}

selection_select_joint :: proc(s: ^SelectionState, id: string, additive, toggle: bool) {
	if toggle {
		if id in s.selected_joints {
			delete_key(&s.selected_joints, id)
			if s.primary_joint_id == id {
				s.primary_joint_id = ""
				for k in s.selected_joints {
					s.primary_joint_id = k
					break
				}
			}
		} else {
			s.selected_joints[id] = true
			s.primary_joint_id = id
		}
		return
	}

	if !additive {
		clear(&s.selected_joints)
	}

	s.selected_joints[id] = true
	s.primary_joint_id = id
}

selection_is_layer_selected :: proc(s: ^SelectionState, id: string) -> bool {
	return (id in s.selected_layers)
}

selection_is_joint_selected :: proc(s: ^SelectionState, id: string) -> bool {
	return (id in s.selected_joints)
}

// Algoritmo Ray-Casting para teste de ponto em polígono arbitrário (Lasso Selection)
point_in_polygon :: proc(pt: core.Vec2, poly: []core.Vec2) -> bool {
	n := len(poly)
	if n < 3 do return false

	inside := false
	j := n - 1
	for i in 0 ..< n {
		pi := poly[i]
		pj := poly[j]

		intersect := ((pi.y > pt.y) != (pj.y > pt.y)) &&
		             (pt.x < (pj.x - pi.x) * (pt.y - pi.y) / (pj.y - pi.y + 1e-9) + pi.x)
		if intersect {
			inside = !inside
		}
		j = i
	}
	return inside
}

// Teste de ponto em retângulo ordenado
point_in_box :: proc(pt: core.Vec2, p0, p1: core.Vec2) -> bool {
	min_x := math.min(p0.x, p1.x)
	max_x := math.max(p0.x, p1.x)
	min_y := math.min(p0.y, p1.y)
	max_y := math.max(p0.y, p1.y)

	return pt.x >= min_x && pt.x <= max_x && pt.y >= min_y && pt.y <= max_y
}
