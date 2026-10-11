package rig

import "../core"
import "core:math"

solve_ik :: proc(
	joints: []Joint,
	pose: ^Pose,
	tip_id: string,
	target: core.Vec2,
	bend: f32 = 1.0,
	allocator := context.allocator,
) -> bool {
	tip, ok_tip := find_joint(joints, tip_id)
	if !ok_tip || tip.parent == "" do return false

	mid, ok_mid := find_joint(joints, tip.parent)
	if !ok_mid || mid.parent == "" do return false

	base, ok_base := find_joint(joints, mid.parent)
	if !ok_base || base.id == "root" do return false

	bones := bone_matrices(joints, pose, allocator)
	defer delete(bones)

	base_mat, has_base := bones[base.id]
	if !has_base do return false

	origin := core.mat_apply(base_mat, {0, 0})

	l1 := core.vec2_dist({base.x, base.y}, {mid.x, mid.y})
	l2 := core.vec2_dist({mid.x, mid.y}, {tip.x, tip.y})
	if l1 < 1.0 || l2 < 1.0 do return false

	raw_dist := core.vec2_dist(origin, target)
	dist := core.clamp(raw_dist, 0.01, l1 + l2 - 0.001)

	direction := math.atan2(target.y - origin.y, target.x - origin.x)

	cos_rule := (l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist)
	cos_rule = core.clamp(cos_rule, -1.0, 1.0)

	a := direction - bend * math.acos(cos_rule)

	elbow := core.Vec2{
		origin.x + math.cos(a) * l1,
		origin.y + math.sin(a) * l1,
	}

	b := math.atan2(target.y - elbow.y, target.x - elbow.x)

	parent_angle: f32 = 0.0
	if base.parent != "" {
		if parent_mat, has_parent := bones[base.parent]; has_parent {
			parent_angle = math.atan2(parent_mat.b, parent_mat.a)
		}
	}

	base_rest_angle := math.atan2(mid.y - base.y, mid.x - base.x)
	mid_rest_angle := math.atan2(tip.y - mid.y, tip.x - mid.x)

	pose.joints[base.id] = JointDelta{
		angle = a - parent_angle - base_rest_angle,
		x     = 0,
		y     = 0,
	}

	pose.joints[mid.id] = JointDelta{
		angle = b - a + base_rest_angle - mid_rest_angle,
		x     = 0,
		y     = 0,
	}

	return true
}
