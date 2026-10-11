package rig

import "../core"
import "core:math"

bone_matrices :: proc(joints: []Joint, pose: ^Pose, allocator := context.allocator) -> map[string]core.Mat2x3 {
	result := make(map[string]core.Mat2x3, len(joints), allocator)

	solve :: proc(j: Joint, joints: []Joint, pose: ^Pose, result: ^map[string]core.Mat2x3) -> core.Mat2x3 {
		if cached, ok := result[j.id]; ok {
			return cached
		}

		parent_mat := core.MAT_IDENTITY
		px, py: f32 = 0, 0

		if j.parent != "" {
			if p, ok := find_joint(joints, j.parent); ok {
				px = p.x
				py = p.y
				parent_mat = solve(p, joints, pose, result)
			}
		}

		d := JOINT_DELTA_ZERO
		if pose != nil {
			if delta, ok := pose.joints[j.id]; ok {
				d = delta
			}
		}

		cos_a := math.cos(d.angle)
		sin_a := math.sin(d.angle)

		local := core.Mat2x3{
			a  = cos_a,
			b  = sin_a,
			c  = -sin_a,
			d  = cos_a,
			tx = j.x - px + d.x,
			ty = j.y - py + d.y,
		}

		m := core.mat_mul(parent_mat, local)
		result[j.id] = m
		return m
	}

	for j in joints {
		solve(j, joints, pose, &result)
	}

	return result
}

layer_matrix :: proc(layer: Layer, joints: []Joint, pose: ^Pose, bones: map[string]core.Mat2x3) -> core.Mat2x3 {
	t := layer.transform
	d := LAYER_DELTA_IDENTITY

	if pose != nil {
		if delta, ok := pose.layers[layer.id]; ok {
			d = delta
		}
	}

	angle := t.rotation + d.rotation
	sx := t.scale.x * d.sx
	sy := t.scale.y * d.sy
	cos_a := math.cos(angle)
	sin_a := math.sin(angle)

	m := core.Mat2x3{
		a  = cos_a * sx,
		b  = sin_a * sx,
		c  = -sin_a * sy,
		d  = cos_a * sy,
		tx = t.pos.x + d.x,
		ty = t.pos.y + d.y,
	}

	m = core.mat_mul(m, core.translate(-t.pivot.x, -t.pivot.y))

	if layer.joint != "" {
		if j, ok := find_joint(joints, layer.joint); ok {
			if bone_mat, has_bone := bones[j.id]; has_bone {
				bone_rel := core.mat_mul(bone_mat, core.translate(-j.x, -j.y))
				return core.mat_mul(bone_rel, m)
			}
		}
	}

	return m
}
