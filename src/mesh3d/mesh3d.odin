package mesh3d

import "core:math"
import "../core"

Vertex3D :: struct {
	pos:     core.Vec3,
	normal:  core.Vec3,
	uv:      core.Vec2,
	joints:  [4]u16,
	weights: [4]f32,
}

Mesh3D :: struct {
	name:         string,
	vertices:     [dynamic]Vertex3D,
	indices:      [dynamic]u32,
	aabb_min:     core.Vec3,
	aabb_max:     core.Vec3,
	has_skinning: bool,
}

mesh3d_init :: proc(m: ^Mesh3D, name: string = "mesh3d", allocator := context.allocator) {
	m.name = name
	m.vertices = make([dynamic]Vertex3D, 0, 1024, allocator)
	m.indices = make([dynamic]u32, 0, 2048, allocator)
	m.aabb_min = {1e9, 1e9, 1e9}
	m.aabb_max = {-1e9, -1e9, -1e9}
	m.has_skinning = false
}

mesh3d_destroy :: proc(m: ^Mesh3D) {
	delete(m.vertices)
	delete(m.indices)
}

mesh3d_update_aabb :: proc(m: ^Mesh3D) {
	if len(m.vertices) == 0 {
		m.aabb_min = {0, 0, 0}
		m.aabb_max = {0, 0, 0}
		return
	}

	min_p := core.Vec3{1e9, 1e9, 1e9}
	max_p := core.Vec3{-1e9, -1e9, -1e9}

	for v in m.vertices {
		min_p.x = math.min(min_p.x, v.pos.x)
		min_p.y = math.min(min_p.y, v.pos.y)
		min_p.z = math.min(min_p.z, v.pos.z)

		max_p.x = math.max(max_p.x, v.pos.x)
		max_p.y = math.max(max_p.y, v.pos.y)
		max_p.z = math.max(max_p.z, v.pos.z)
	}

	m.aabb_min = min_p
	m.aabb_max = max_p
}

mesh3d_recalculate_normals :: proc(m: ^Mesh3D) {
	if len(m.indices) == 0 do return

	// Zera as normais existentes
	for &v in m.vertices {
		v.normal = {0, 0, 0}
	}

	// Acumula a normal de cada triângulo
	num_tris := len(m.indices) / 3
	for t in 0 ..< num_tris {
		i0 := m.indices[t * 3 + 0]
		i1 := m.indices[t * 3 + 1]
		i2 := m.indices[t * 3 + 2]

		p0 := m.vertices[i0].pos
		p1 := m.vertices[i1].pos
		p2 := m.vertices[i2].pos

		e1 := core.vec3_sub(p1, p0)
		e2 := core.vec3_sub(p2, p0)
		fn := core.vec3_cross(e1, e2)

		m.vertices[i0].normal = core.vec3_add(m.vertices[i0].normal, fn)
		m.vertices[i1].normal = core.vec3_add(m.vertices[i1].normal, fn)
		m.vertices[i2].normal = core.vec3_add(m.vertices[i2].normal, fn)
	}

	// Normaliza as normais acumuladas
	for &v in m.vertices {
		v.normal = core.vec3_normalize(v.normal)
	}
}
