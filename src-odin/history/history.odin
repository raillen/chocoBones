package history

import "core:fmt"
import "core:mem"
import "../core"
import "../rig"

Snapshot :: struct {
	description: string,
	joints:      [dynamic]rig.Joint,
	layers:      [dynamic]rig.Layer,
	pose_joints: map[string]rig.JointDelta,
	pose_layers: map[string]rig.LayerDelta,
}

History :: struct {
	undo_stack:    [dynamic]Snapshot,
	redo_stack:    [dynamic]Snapshot,
	max_snapshots: int,
	allocator:     mem.Allocator,
}

history_init :: proc(h: ^History, max_snapshots: int = 50, allocator := context.allocator) {
	h.undo_stack = make([dynamic]Snapshot, 0, max_snapshots, allocator)
	h.redo_stack = make([dynamic]Snapshot, 0, max_snapshots, allocator)
	h.max_snapshots = max_snapshots
	h.allocator = allocator
}

history_destroy :: proc(h: ^History) {
	for &s in h.undo_stack {
		snapshot_destroy(&s)
	}
	delete(h.undo_stack)

	for &s in h.redo_stack {
		snapshot_destroy(&s)
	}
	delete(h.redo_stack)
}

snapshot_create :: proc(
	description: string,
	joints: []rig.Joint,
	layers: []rig.Layer,
	pose: ^rig.Pose,
	allocator := context.allocator,
) -> Snapshot {
	s: Snapshot
	s.description = description
	s.joints = make([dynamic]rig.Joint, len(joints), allocator)
	copy(s.joints[:], joints)

	s.layers = make([dynamic]rig.Layer, len(layers), allocator)
	copy(s.layers[:], layers)

	s.pose_joints = make(map[string]rig.JointDelta, len(pose.joints), allocator)
	if pose != nil {
		for k, v in pose.joints {
			s.pose_joints[k] = v
		}
	}

	s.pose_layers = make(map[string]rig.LayerDelta, len(pose.layers), allocator)
	if pose != nil {
		for k, v in pose.layers {
			s.pose_layers[k] = v
		}
	}

	return s
}

snapshot_destroy :: proc(s: ^Snapshot) {
	delete(s.joints)
	delete(s.layers)
	delete(s.pose_joints)
	delete(s.pose_layers)
}

history_push :: proc(
	h: ^History,
	description: string,
	joints: []rig.Joint,
	layers: []rig.Layer,
	pose: ^rig.Pose,
) {
	// Limpa pilha de redo quando uma nova ação é iniciada
	for &s in h.redo_stack {
		snapshot_destroy(&s)
	}
	clear(&h.redo_stack)

	// Se atingiu o limite máximo, remove o mais antigo
	if len(h.undo_stack) >= h.max_snapshots {
		oldest := h.undo_stack[0]
		snapshot_destroy(&oldest)
		ordered_remove(&h.undo_stack, 0)
	}

	snap := snapshot_create(description, joints, layers, pose, h.allocator)
	append(&h.undo_stack, snap)
}

history_can_undo :: proc(h: ^History) -> bool {
	return len(h.undo_stack) > 0
}

history_can_redo :: proc(h: ^History) -> bool {
	return len(h.redo_stack) > 0
}

history_undo :: proc(
	h: ^History,
	current_joints: ^[dynamic]rig.Joint,
	current_layers: ^[dynamic]rig.Layer,
	current_pose: ^rig.Pose,
) -> (string, bool) {
	if len(h.undo_stack) == 0 do return "", false

	// Salva estado atual na pilha de redo antes de reverter
	current_snap := snapshot_create("Redo State", current_joints[:], current_layers[:], current_pose, h.allocator)
	append(&h.redo_stack, current_snap)

	// Desempilha snapshot do topo do undo
	snap := pop(&h.undo_stack)
	desc := snap.description

	// Restaura juntas
	clear(current_joints)
	for j in snap.joints {
		append(current_joints, j)
	}

	// Restaura camadas
	clear(current_layers)
	for l in snap.layers {
		append(current_layers, l)
	}

	// Restaura pose
	if current_pose != nil {
		clear(&current_pose.joints)
		for k, v in snap.pose_joints {
			current_pose.joints[k] = v
		}
		clear(&current_pose.layers)
		for k, v in snap.pose_layers {
			current_pose.layers[k] = v
		}
	}

	snapshot_destroy(&snap)
	return desc, true
}

history_redo :: proc(
	h: ^History,
	current_joints: ^[dynamic]rig.Joint,
	current_layers: ^[dynamic]rig.Layer,
	current_pose: ^rig.Pose,
) -> (string, bool) {
	if len(h.redo_stack) == 0 do return "", false

	// Salva estado atual no topo do undo antes de avançar
	current_snap := snapshot_create("Undo State", current_joints[:], current_layers[:], current_pose, h.allocator)
	append(&h.undo_stack, current_snap)

	// Desempilha snapshot do topo do redo
	snap := pop(&h.redo_stack)
	desc := snap.description

	// Restaura juntas
	clear(current_joints)
	for j in snap.joints {
		append(current_joints, j)
	}

	// Restaura camadas
	clear(current_layers)
	for l in snap.layers {
		append(current_layers, l)
	}

	// Restaura pose
	if current_pose != nil {
		clear(&current_pose.joints)
		for k, v in snap.pose_joints {
			current_pose.joints[k] = v
		}
		clear(&current_pose.layers)
		for k, v in snap.pose_layers {
			current_pose.layers[k] = v
		}
	}

	snapshot_destroy(&snap)
	return desc, true
}
