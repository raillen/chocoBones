package rig

import "../core"

Joint :: struct {
	id:     string,
	name:   string,
	parent: string, // ID do pai ou "" se for raiz
	x:      f32,    // Posição de repouso absoluta X
	y:      f32,    // Posição de repouso absoluta Y
	color:  string,
}

JointDelta :: struct {
	angle: f32, // Rotação em radianos
	x:     f32, // Deslocamento relativo X
	y:     f32, // Deslocamento relativo Y
}

JOINT_DELTA_ZERO :: JointDelta{
	angle = 0,
	x     = 0,
	y     = 0,
}

LayerDelta :: struct {
	x:        f32,
	y:        f32,
	rotation: f32,
	sx:       f32,
	sy:       f32,
	opacity:  f32,
	visible:  bool,
	asset:    string,
}

LAYER_DELTA_IDENTITY :: LayerDelta{
	x        = 0,
	y        = 0,
	rotation = 0,
	sx       = 1,
	sy       = 1,
	opacity  = 1,
	visible  = true,
	asset    = "",
}

Layer :: struct {
	id:            string,
	name:          string,
	asset:         string,
	transform:     core.Transform,
	joint:         string, // ID da junta vinculada ou ""
	visible:       bool,
	locked:        bool,
	opacity:       f32,
	has_seam_mask: bool,
	seam_mask:     core.SeamMask,
}

Pose :: struct {
	joints: map[string]JointDelta,
	layers: map[string]LayerDelta,
	pins:   map[string]core.Vec2,
}

pose_init :: proc(p: ^Pose, allocator := context.allocator) {
	p.joints = make(map[string]JointDelta, 16, allocator)
	p.layers = make(map[string]LayerDelta, 16, allocator)
	p.pins = make(map[string]core.Vec2, 16, allocator)
}

pose_destroy :: proc(p: ^Pose) {
	delete(p.joints)
	delete(p.layers)
	delete(p.pins)
}

find_joint :: proc(joints: []Joint, id: string) -> (Joint, bool) {
	for j in joints {
		if j.id == id do return j, true
	}
	return {}, false
}
