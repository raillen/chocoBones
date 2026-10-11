package mesh

import "core:math"
import "../core"
import "../rig"

Pin :: struct {
	id:     string,
	name:   string,
	x:      f32,
	y:      f32,
	locked: bool,
}

Influence :: struct {
	joint:  string,
	weight: f32,
}

MeshMode :: enum {
	Pins,
	Skin,
}

SkinningMode :: enum {
	Linear,
	DualQuaternion,
}

Mesh :: struct {
	density:   int,
	vertices:  [dynamic]core.Vec2,
	triangles: [dynamic][3]u32,
	weights:   [dynamic][dynamic]Influence,
	erased:    [dynamic]u32,
	mode:      MeshMode,
	skinning:  SkinningMode,
	strength:  f32,
}

build_grid_mesh :: proc(width, height: f32, density: int, allocator := context.allocator) -> Mesh {
	n := density
	if n < 2 do n = 2
	if n > 24 do n = 24

	num_vertices := (n + 1) * (n + 1)
	num_quads := n * n

	m := Mesh{
		density   = n,
		vertices  = make([dynamic]core.Vec2, 0, num_vertices, allocator),
		triangles = make([dynamic][3]u32, 0, num_quads * 2, allocator),
		weights   = make([dynamic][dynamic]Influence, 0, num_vertices, allocator),
		erased    = make([dynamic]u32, 0, 16, allocator),
		mode      = .Pins,
		skinning  = .Linear,
		strength  = 1.0,
	}

	for y in 0 ..= n {
		for x in 0 ..= n {
			vx := (f32(x) * width) / f32(n)
			vy := (f32(y) * height) / f32(n)
			append(&m.vertices, core.Vec2{vx, vy})
			append(&m.weights, make([dynamic]Influence, 0, 3, allocator))
		}
	}

	for y in 0 ..< n {
		for x in 0 ..< n {
			a := u32(y * (n + 1) + x)
			b := a + 1
			c := a + u32(n + 1)
			d := c + 1
			append(&m.triangles, [3]u32{a, b, d})
			append(&m.triangles, [3]u32{a, d, c})
		}
	}

	return m
}

mesh_destroy :: proc(m: ^Mesh) {
	for &w in m.weights {
		delete(w)
	}
	delete(m.weights)
	delete(m.vertices)
	delete(m.triangles)
	delete(m.erased)
}

Sample :: struct {
	p: core.Vec2,
	q: core.Vec2,
	w: f32,
}

warp_point :: proc(
	vertex: core.Vec2,
	pins: []Pin,
	pin_deltas: map[string]core.Vec2,
	strength: f32 = 1.0,
	allocator := context.allocator,
) -> core.Vec2 {
	if len(pins) == 0 do return vertex

	MAX_STACK_PINS :: 32
	stack_samples: [MAX_STACK_PINS]Sample
	samples: []Sample
	allocated_samples := false

	if len(pins) <= MAX_STACK_PINS {
		samples = stack_samples[:len(pins)]
	} else {
		samples = make([]Sample, len(pins), allocator)
		allocated_samples = true
	}
	defer if allocated_samples do delete(samples, allocator)

	total_weight: f32 = 0
	px: f32 = 0
	py: f32 = 0
	qx: f32 = 0
	qy: f32 = 0

	for pin, i in pins {
		delta := core.Vec2{0, 0}
		if !pin.locked {
			if d, ok := pin_deltas[pin.id]; ok {
				delta = d
			}
		}

		pin_pos := core.Vec2{pin.x, pin.y}
		dist := core.vec2_dist(vertex, pin_pos)
		dist_sq := dist * dist
		if dist_sq < 0.001 do dist_sq = 0.001
		w := 1.0 / (dist_sq * dist_sq)

		q := core.Vec2{pin.x + delta.x, pin.y + delta.y}
		samples[i] = Sample{p = pin_pos, q = q, w = w}

		total_weight += w
		px += w * pin_pos.x
		py += w * pin_pos.y
		qx += w * q.x
		qy += w * q.y
	}

	if total_weight < 1e-9 do return vertex

	px /= total_weight
	py /= total_weight
	qx /= total_weight
	qy /= total_weight

	cos_sum: f32 = 0
	sin_sum: f32 = 0

	for s in samples {
		ax := s.p.x - px
		ay := s.p.y - py
		bx := s.q.x - qx
		by := s.q.y - qy

		cos_sum += s.w * (ax * bx + ay * by)
		sin_sum += s.w * (ax * by - ay * bx)
	}

	len_rot := math.sqrt(cos_sum * cos_sum + sin_sum * sin_sum)
	if len_rot < 1e-9 {
		return {vertex.x + qx - px, vertex.y + qy - py}
	}

	cos_val := cos_sum / len_rot
	sin_val := sin_sum / len_rot

	vx := vertex.x - px
	vy := vertex.y - py

	target_x := qx + vx * cos_val - vy * sin_val
	target_y := qy + vx * sin_val + vy * cos_val

	return {
		core.lerp(vertex.x, target_x, strength),
		core.lerp(vertex.y, target_y, strength),
	}
}

mesh_world :: proc(
	m: ^Mesh,
	pins: []Pin,
	pin_deltas: map[string]core.Vec2,
	layer: rig.Layer,
	joints: []rig.Joint,
	pose: ^rig.Pose,
	bones: map[string]core.Mat2x3,
	allocator := context.allocator,
) -> []core.Vec2 {
	if m == nil || len(m.vertices) == 0 do return nil

	rigid_mat := rig.layer_matrix(layer, joints, pose, bones)

	layer_no_joint := layer
	layer_no_joint.joint = ""
	rest_mat := rig.layer_matrix(layer_no_joint, joints, pose, bones)

	result := make([]core.Vec2, len(m.vertices), allocator)

	MAX_STACK_JOINTS :: 64
	stack_transforms: [MAX_STACK_JOINTS]core.Mat2x3
	joint_transforms: []core.Mat2x3
	allocated_transforms := false

	if len(joints) <= MAX_STACK_JOINTS {
		joint_transforms = stack_transforms[:len(joints)]
	} else {
		joint_transforms = make([]core.Mat2x3, len(joints), allocator)
		allocated_transforms = true
	}
	defer if allocated_transforms do delete(joint_transforms, allocator)

	for j, idx in joints {
		if bone_mat, ok := bones[j.id]; ok {
			joint_transforms[idx] = core.mat_mul(bone_mat, core.translate(-j.x, -j.y))
		} else {
			joint_transforms[idx] = core.MAT_IDENTITY
		}
	}

	find_joint_idx :: proc(joints: []rig.Joint, id: string) -> int {
		for j, idx in joints {
			if j.id == id do return idx
		}
		return -1
	}

	for v, i in m.vertices {
		warped := warp_point(v, pins, pin_deltas, m.strength, allocator)
		weights := (i < len(m.weights)) ? m.weights[i][:] : nil

		if m.mode != .Skin || len(weights) == 0 {
			result[i] = core.mat_apply(rigid_mat, warped)
			continue
		}

		world_pos := core.mat_apply(rest_mat, warped)

		total_weight: f32 = 0
		accum_x: f32 = 0
		accum_y: f32 = 0

		qw: f32 = 0
		qz: f32 = 0
		dx: f32 = 0
		dy: f32 = 0
		has_reference := false
		ref_w, ref_z: f32

		for w in weights {
			j_idx := find_joint_idx(joints, w.joint)
			if j_idx < 0 do continue

			mat := joint_transforms[j_idx]

			moved := core.mat_apply(mat, world_pos)
			accum_x += moved.x * w.weight
			accum_y += moved.y * w.weight
			total_weight += w.weight

			if m.skinning == .DualQuaternion {
				half_angle := math.atan2(mat.b, mat.a) * 0.5
				cur_w := math.cos(half_angle)
				cur_z := math.sin(half_angle)

				if !has_reference {
					has_reference = true
					ref_w = cur_w
					ref_z = cur_z
				} else if (cur_w * ref_w + cur_z * ref_z) < 0 {
					cur_w = -cur_w
					cur_z = -cur_z
				}

				qw += cur_w * w.weight
				qz += cur_z * w.weight
				dx += (mat.tx * cur_w + mat.ty * cur_z) * 0.5 * w.weight
				dy += (mat.ty * cur_w - mat.tx * cur_z) * 0.5 * w.weight
			}
		}

		if total_weight > 1e-9 && m.skinning == .DualQuaternion {
			norm := math.sqrt(qw * qw + qz * qz)
			if norm > 1e-8 {
				qw /= norm
				qz /= norm
				dx /= norm
				dy /= norm

				c := qw * qw - qz * qz
				s := 2.0 * qw * qz

				accum_x = (c * world_pos.x - s * world_pos.y + 2.0 * (dx * qw - dy * qz)) * total_weight
				accum_y = (s * world_pos.x + c * world_pos.y + 2.0 * (dy * qw + dx * qz)) * total_weight
			}
		}

		base_point := core.mat_apply(rigid_mat, warped)
		if total_weight > 1e-9 {
			result[i] = core.Vec2{
				core.lerp(base_point.x, accum_x / total_weight, m.strength),
				core.lerp(base_point.y, accum_y / total_weight, m.strength),
			}
		} else {
			result[i] = base_point
		}
	}

	return result
}

// Vincula automaticamente os vértices da malha às juntas esqueléticas através de pesos por distância inversa
mesh_auto_skin_to_joints :: proc(m: ^Mesh, layer: rig.Layer, joints: []rig.Joint) {
	if m == nil || len(m.vertices) == 0 || len(joints) == 0 do return

	m.mode = .Skin
	m.skinning = .DualQuaternion

	for v, i in m.vertices {
		clear(&m.weights[i])

		// Coordenadas mundiais de repouso do vértice
		vx := (v.x - layer.transform.pivot.x) * layer.transform.scale.x + layer.transform.pos.x
		vy := (v.y - layer.transform.pivot.y) * layer.transform.scale.y + layer.transform.pos.y

		MAX_INF :: 4
		best_joints: [MAX_INF]string
		best_weights: [MAX_INF]f32

		for j in joints {
			dx := vx - j.x
			dy := vy - j.y
			dist := math.sqrt(dx * dx + dy * dy)

			// Peso inversamente proporcional com suavização
			inv_d := 1.0 / (dist * dist + 100.0)

			for k in 0..<MAX_INF {
				if inv_d > best_weights[k] {
					for shift := MAX_INF - 1; shift > k; shift -= 1 {
						best_weights[shift] = best_weights[shift - 1]
						best_joints[shift] = best_joints[shift - 1]
					}
					best_weights[k] = inv_d
					best_joints[k] = j.id
					break
				}
			}
		}

		sum_w: f32 = 0
		for k in 0..<MAX_INF {
			if best_weights[k] > 0 && best_joints[k] != "" {
				sum_w += best_weights[k]
			}
		}

		if sum_w > 1e-6 {
			for k in 0..<MAX_INF {
				if best_weights[k] > 0 && best_joints[k] != "" {
					append(&m.weights[i], Influence{
						joint = best_joints[k],
						weight = best_weights[k] / sum_w,
					})
				}
			}
		} else {
			append(&m.weights[i], Influence{
				joint = len(joints) > 0 ? joints[0].id : "root",
				weight = 1.0,
			})
		}
	}
}

