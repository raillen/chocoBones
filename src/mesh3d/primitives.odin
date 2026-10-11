package mesh3d

import "core:math"
import "../core"

create_cube_mesh :: proc(size: f32 = 1.0, allocator := context.allocator) -> Mesh3D {
	m: Mesh3D
	mesh3d_init(&m, "Cubo", allocator)

	h := size * 0.5

	// 6 faces * 4 vértices = 24 vértices com normais precisas
	FaceDef :: struct {
		normal: core.Vec3,
		p0, p1, p2, p3: core.Vec3,
	}

	faces := [6]FaceDef{
		// Front (+Z)
		FaceDef{{0, 0, 1}, {-h, -h, h}, {h, -h, h}, {h, h, h}, {-h, h, h}},
		// Back (-Z)
		FaceDef{{0, 0, -1}, {h, -h, -h}, {-h, -h, -h}, {-h, h, -h}, {h, h, -h}},
		// Top (+Y)
		FaceDef{{0, 1, 0}, {-h, h, h}, {h, h, h}, {h, h, -h}, {-h, h, -h}},
		// Bottom (-Y)
		FaceDef{{0, -1, 0}, {-h, -h, -h}, {h, -h, -h}, {h, -h, h}, {-h, -h, h}},
		// Right (+X)
		FaceDef{{1, 0, 0}, {h, -h, h}, {h, -h, -h}, {h, h, -h}, {h, h, h}},
		// Left (-X)
		FaceDef{{-1, 0, 0}, {-h, -h, -h}, {-h, -h, h}, {-h, h, h}, {-h, h, -h}},
	}

	for f in faces {
		base_idx := u32(len(m.vertices))
		append(&m.vertices, Vertex3D{pos = f.p0, normal = f.normal, uv = {0, 0}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})
		append(&m.vertices, Vertex3D{pos = f.p1, normal = f.normal, uv = {1, 0}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})
		append(&m.vertices, Vertex3D{pos = f.p2, normal = f.normal, uv = {1, 1}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})
		append(&m.vertices, Vertex3D{pos = f.p3, normal = f.normal, uv = {0, 1}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})

		append(&m.indices, base_idx + 0)
		append(&m.indices, base_idx + 1)
		append(&m.indices, base_idx + 2)

		append(&m.indices, base_idx + 0)
		append(&m.indices, base_idx + 2)
		append(&m.indices, base_idx + 3)
	}

	mesh3d_update_aabb(&m)
	return m
}

create_cylinder_mesh :: proc(radius: f32 = 0.5, height: f32 = 1.5, segments: int = 16, allocator := context.allocator) -> Mesh3D {
	m: Mesh3D
	mesh3d_init(&m, "Cilindro", allocator)

	h := height * 0.5
	seg_f := f32(segments)

	// Corpo do cilindro
	for i in 0 ..< segments {
		theta0 := (f32(i) / seg_f) * (2.0 * math.PI)
		theta1 := (f32(i + 1) / seg_f) * (2.0 * math.PI)

		c0 := math.cos(theta0)
		s0 := math.sin(theta0)
		c1 := math.cos(theta1)
		s1 := math.sin(theta1)

		p0 := core.Vec3{radius * c0, -h, radius * s0}
		p1 := core.Vec3{radius * c1, -h, radius * s1}
		p2 := core.Vec3{radius * c1,  h, radius * s1}
		p3 := core.Vec3{radius * c0,  h, radius * s0}

		n0 := core.Vec3{c0, 0, s0}
		n1 := core.Vec3{c1, 0, s1}

		base_idx := u32(len(m.vertices))
		append(&m.vertices, Vertex3D{pos = p0, normal = n0, uv = {f32(i) / seg_f, 0}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})
		append(&m.vertices, Vertex3D{pos = p1, normal = n1, uv = {f32(i + 1) / seg_f, 0}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})
		append(&m.vertices, Vertex3D{pos = p2, normal = n1, uv = {f32(i + 1) / seg_f, 1}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})
		append(&m.vertices, Vertex3D{pos = p3, normal = n0, uv = {f32(i) / seg_f, 1}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})

		append(&m.indices, base_idx + 0)
		append(&m.indices, base_idx + 1)
		append(&m.indices, base_idx + 2)

		append(&m.indices, base_idx + 0)
		append(&m.indices, base_idx + 2)
		append(&m.indices, base_idx + 3)
	}

	// Tampas (Top e Bottom)
	center_top_idx := u32(len(m.vertices))
	append(&m.vertices, Vertex3D{pos = {0, h, 0}, normal = {0, 1, 0}, uv = {0.5, 0.5}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})

	for i in 0 ..< segments {
		theta := (f32(i) / seg_f) * (2.0 * math.PI)
		append(&m.vertices, Vertex3D{
			pos    = {radius * math.cos(theta), h, radius * math.sin(theta)},
			normal = {0, 1, 0},
			uv     = {0.5 + 0.5 * math.cos(theta), 0.5 + 0.5 * math.sin(theta)},
			joints = {0, 0, 0, 0},
			weights = {1, 0, 0, 0},
		})
	}
	for i in 0 ..< segments {
		i_next := (i + 1) % segments
		append(&m.indices, center_top_idx)
		append(&m.indices, center_top_idx + 1 + u32(i))
		append(&m.indices, center_top_idx + 1 + u32(i_next))
	}

	center_bot_idx := u32(len(m.vertices))
	append(&m.vertices, Vertex3D{pos = {0, -h, 0}, normal = {0, -1, 0}, uv = {0.5, 0.5}, joints = {0, 0, 0, 0}, weights = {1, 0, 0, 0}})

	for i in 0 ..< segments {
		theta := (f32(i) / seg_f) * (2.0 * math.PI)
		append(&m.vertices, Vertex3D{
			pos    = {radius * math.cos(theta), -h, radius * math.sin(theta)},
			normal = {0, -1, 0},
			uv     = {0.5 + 0.5 * math.cos(theta), 0.5 + 0.5 * math.sin(theta)},
			joints = {0, 0, 0, 0},
			weights = {1, 0, 0, 0},
		})
	}
	for i in 0 ..< segments {
		i_next := (i + 1) % segments
		append(&m.indices, center_bot_idx)
		append(&m.indices, center_bot_idx + 1 + u32(i_next))
		append(&m.indices, center_bot_idx + 1 + u32(i))
	}

	mesh3d_update_aabb(&m)
	return m
}
