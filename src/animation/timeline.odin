package animation

import "core:math"
import "core:slice"
import "core:strings"
import "../core"
import "../rig"

Easing :: enum {
	Linear,
	Smooth,
	Hold,
	Bezier,
}

Keyframe :: struct {
	id:       string,
	time:     f32,
	joints:   map[string]rig.JointDelta,
	layers:   map[string]rig.LayerDelta,
	pins:     map[string]core.Vec2,
	easing:   Easing,
	bezier:   [4]f32,
	channels: [dynamic]string,
}

Clip :: struct {
	id:       string,
	name:     string,
	duration: f32,
	fps:      f32,
	loop:     bool,
	frames:   [dynamic]Keyframe,
}

keyframe_init :: proc(k: ^Keyframe, allocator := context.allocator) {
	k.joints = make(map[string]rig.JointDelta, 16, allocator)
	k.layers = make(map[string]rig.LayerDelta, 16, allocator)
	k.pins = make(map[string]core.Vec2, 16, allocator)
	k.channels = make([dynamic]string, 0, 16, allocator)
	k.easing = .Smooth
	k.bezier = [4]f32{0.25, 0.1, 0.25, 1.0}
}

keyframe_destroy :: proc(k: ^Keyframe) {
	delete(k.joints)
	delete(k.layers)
	delete(k.pins)
	delete(k.channels)
}

clip_init :: proc(c: ^Clip, id, name: string, duration: f32 = 2.0, fps: f32 = 60.0, loop: bool = true, allocator := context.allocator) {
	c.id = id
	c.name = name
	c.duration = duration
	c.fps = fps
	c.loop = loop
	c.frames = make([dynamic]Keyframe, 0, 16, allocator)
}

clip_destroy :: proc(c: ^Clip) {
	for &f in c.frames {
		keyframe_destroy(&f)
	}
	delete(c.frames)
}

clip_clone :: proc(src: ^Clip, new_id, new_name: string, allocator := context.allocator) -> Clip {
	dst: Clip
	clip_init(&dst, new_id, new_name, src.duration, src.fps, src.loop, allocator)
	for &src_frame in src.frames {
		k: Keyframe
		keyframe_init(&k, allocator)
		k.time = src_frame.time
		k.easing = src_frame.easing
		k.bezier = src_frame.bezier
		for j_id, j_delta in src_frame.joints {
			k.joints[j_id] = j_delta
		}
		for l_id, l_delta in src_frame.layers {
			k.layers[l_id] = l_delta
		}
		for p_id, p_pos in src_frame.pins {
			k.pins[p_id] = p_pos
		}
		append(&dst.frames, k)
	}
	return dst
}

easing_factor :: proc(k: ^Keyframe, t: f32) -> f32 {
	switch k.easing {
	case .Hold:
		return 0.0
	case .Smooth:
		return t * t * (3.0 - 2.0 * t)
	case .Bezier:
		return core.bezier_solve(t, k.bezier[0], k.bezier[1], k.bezier[2], k.bezier[3])
	case .Linear:
		return t
	}
	return t
}

matches_channel :: proc(channel, prefix, id: string) -> bool {
	if channel == "" || channel == id do return true
	if strings.has_prefix(channel, prefix) {
		return channel[len(prefix):] == id
	}
	return false
}

interpolate_poses :: proc(
	k1, k2: ^Keyframe,
	t: f32,
	channel: string,
	out_pose: ^rig.Pose,
) {
	// Interpola juntas
	for id, delta1 in k1.joints {
		if !matches_channel(channel, "joint:", id) do continue
		delta2, has2 := k2.joints[id]
		if !has2 do delta2 = delta1

		out_pose.joints[id] = rig.JointDelta{
			angle = core.lerp(delta1.angle, delta2.angle, t),
			x     = core.lerp(delta1.x, delta2.x, t),
			y     = core.lerp(delta1.y, delta2.y, t),
		}
	}

	// Interpola camadas
	for id, l1 in k1.layers {
		if !matches_channel(channel, "layer:", id) do continue
		l2, has2 := k2.layers[id]
		if !has2 do l2 = l1

		out_pose.layers[id] = rig.LayerDelta{
			x        = core.lerp(l1.x, l2.x, t),
			y        = core.lerp(l1.y, l2.y, t),
			rotation = core.lerp(l1.rotation, l2.rotation, t),
			sx       = core.lerp(l1.sx, l2.sx, t),
			sy       = core.lerp(l1.sy, l2.sy, t),
			opacity  = core.lerp(l1.opacity, l2.opacity, t),
			visible  = t < 1.0 ? l1.visible : l2.visible,
			asset    = t < 1.0 ? l1.asset : l2.asset,
		}
	}

	// Interpola pinos
	for id, p1 in k1.pins {
		if !matches_channel(channel, "pin:", id) do continue
		p2, has2 := k2.pins[id]
		if !has2 do p2 = p1

		out_pose.pins[id] = core.Vec2{
			core.lerp(p1.x, p2.x, t),
			core.lerp(p1.y, p2.y, t),
		}
	}
}

sample_clip :: proc(clip: ^Clip, time: f32, out_pose: ^rig.Pose) {
	if clip == nil || len(clip.frames) == 0 do return

	t := time
	if clip.loop && clip.duration > 0.0001 {
		t = math.mod(t, clip.duration)
		if t < 0 do t += clip.duration
	} else {
		t = core.clamp(t, 0.0, clip.duration)
	}

	// Caso com apenas 1 frame
	if len(clip.frames) == 1 {
		f := &clip.frames[0]
		interpolate_poses(f, f, 0.0, "", out_pose)
		return
	}

	// Antes do primeiro frame
	if t <= clip.frames[0].time {
		f := &clip.frames[0]
		interpolate_poses(f, f, 0.0, "", out_pose)
		return
	}

	// Após o último frame
	last_idx := len(clip.frames) - 1
	if t >= clip.frames[last_idx].time {
		f := &clip.frames[last_idx]
		interpolate_poses(f, f, 1.0, "", out_pose)
		return
	}

	// Localiza o intervalo de frames [i, i+1]
	for i in 0 ..< last_idx {
		f1 := &clip.frames[i]
		f2 := &clip.frames[i + 1]

		if t >= f1.time && t <= f2.time {
			dt := f2.time - f1.time
			u := (dt > 1e-5) ? ((t - f1.time) / dt) : 0.0
			eased_u := easing_factor(f1, u)
			interpolate_poses(f1, f2, eased_u, "", out_pose)
			return
		}
	}
}

clip_add_or_update_keyframe :: proc(clip: ^Clip, time: f32, pose: ^rig.Pose, easing: Easing = .Smooth) {
	if clip == nil || pose == nil do return

	for &f in clip.frames {
		if math.abs(f.time - time) < 0.04 {
			clear(&f.joints)
			for j_id, j_delta in pose.joints {
				f.joints[j_id] = j_delta
			}
			f.easing = easing
			return
		}
	}

	k: Keyframe
	keyframe_init(&k)
	k.time = time
	k.easing = easing
	for j_id, j_delta in pose.joints {
		k.joints[j_id] = j_delta
	}

	insert_idx := len(clip.frames)
	for f, idx in clip.frames {
		if f.time > time {
			insert_idx = idx
			break
		}
	}

	inject_at(&clip.frames, insert_idx, k)
}

clip_find_nearest_keyframe_index :: proc(clip: ^Clip, time: f32) -> int {
	if clip == nil || len(clip.frames) == 0 do return -1

	nearest_idx := -1
	min_dist: f32 = 999999.0

	for f, idx in clip.frames {
		dist := math.abs(f.time - time)
		if dist < min_dist {
			min_dist = dist
			nearest_idx = idx
		}
	}
	return nearest_idx
}

clip_remove_nearest_keyframe :: proc(clip: ^Clip, time: f32) -> bool {
	if clip == nil || len(clip.frames) <= 1 do return false

	nearest_idx := -1
	min_dist: f32 = 999999.0

	for f, idx in clip.frames {
		dist := math.abs(f.time - time)
		if dist < min_dist {
			min_dist = dist
			nearest_idx = idx
		}
	}

	if nearest_idx >= 0 && min_dist < 0.15 {
		keyframe_destroy(&clip.frames[nearest_idx])
		ordered_remove(&clip.frames, nearest_idx)
		return true
	}

	return false
}

