package mesh3d

import "core:fmt"
import "core:os"
import "core:strconv"
import "core:strings"
import "../core"

load_obj_from_string :: proc(content: string, allocator := context.allocator) -> (Mesh3D, bool) {
	mesh: Mesh3D
	mesh3d_init(&mesh, "obj_model", allocator)

	positions := make([dynamic]core.Vec3, 0, 1024, allocator)
	defer delete(positions)

	normals := make([dynamic]core.Vec3, 0, 1024, allocator)
	defer delete(normals)

	uvs := make([dynamic]core.Vec2, 0, 1024, allocator)
	defer delete(uvs)

	VertexKey :: struct {
		pos_idx: int,
		uv_idx:  int,
		norm_idx: int,
	}

	vertex_map := make(map[VertexKey]u32, 1024, allocator)
	defer delete(vertex_map)

	lines := strings.split_lines(content, allocator)
	defer delete(lines)

	for raw_line in lines {
		line := strings.trim_space(raw_line)
		if len(line) == 0 || line[0] == '#' do continue

		parts := strings.fields(line, allocator)
		defer delete(parts)
		if len(parts) == 0 do continue

		switch parts[0] {
		case "v":
			if len(parts) >= 4 {
				x, _ := strconv.parse_f64(parts[1])
				y, _ := strconv.parse_f64(parts[2])
				z, _ := strconv.parse_f64(parts[3])
				append(&positions, core.Vec3{f32(x), f32(y), f32(z)})
			}

		case "vn":
			if len(parts) >= 4 {
				x, _ := strconv.parse_f64(parts[1])
				y, _ := strconv.parse_f64(parts[2])
				z, _ := strconv.parse_f64(parts[3])
				append(&normals, core.Vec3{f32(x), f32(y), f32(z)})
			}

		case "vt":
			if len(parts) >= 3 {
				u, _ := strconv.parse_f64(parts[1])
				v, _ := strconv.parse_f64(parts[2])
				append(&uvs, core.Vec2{f32(u), f32(v)})
			}

		case "f":
			if len(parts) >= 4 {
				face_indices := make([dynamic]u32, 0, len(parts) - 1, allocator)
				defer delete(face_indices)

				for i in 1 ..< len(parts) {
					v_str := parts[i]
					slash1 := strings.index_byte(v_str, '/')
					p_idx := 0
					u_idx := 0
					n_idx := 0

					if slash1 == -1 {
						p_idx, _ = strconv.parse_int(v_str)
					} else {
						p_idx, _ = strconv.parse_int(v_str[:slash1])
						rem := v_str[slash1 + 1:]
						slash2 := strings.index_byte(rem, '/')
						if slash2 == -1 {
							if len(rem) > 0 do u_idx, _ = strconv.parse_int(rem)
						} else {
							u_part := rem[:slash2]
							n_part := rem[slash2 + 1:]
							if len(u_part) > 0 do u_idx, _ = strconv.parse_int(u_part)
							if len(n_part) > 0 do n_idx, _ = strconv.parse_int(n_part)
						}
					}

					// Converte 1-based para 0-based (e trata índices negativos se houver)
					if p_idx > 0 do p_idx -= 1
					else if p_idx < 0 do p_idx = len(positions) + p_idx

					if u_idx > 0 do u_idx -= 1
					else if u_idx < 0 do u_idx = len(uvs) + u_idx

					if n_idx > 0 do n_idx -= 1
					else if n_idx < 0 do n_idx = len(normals) + n_idx

					key := VertexKey{p_idx, u_idx, n_idx}
					if idx, exists := vertex_map[key]; exists {
						append(&face_indices, idx)
					} else {
						pos: core.Vec3 = (p_idx >= 0 && p_idx < len(positions)) ? positions[p_idx] : {0, 0, 0}
						norm: core.Vec3 = (n_idx >= 0 && n_idx < len(normals)) ? normals[n_idx] : {0, 1, 0}
						uv: core.Vec2 = (u_idx >= 0 && u_idx < len(uvs)) ? uvs[u_idx] : {0, 0}

						new_idx := u32(len(mesh.vertices))
						append(&mesh.vertices, Vertex3D{
							pos     = pos,
							normal  = norm,
							uv      = uv,
							joints  = {0, 0, 0, 0},
							weights = {1.0, 0, 0, 0},
						})
						vertex_map[key] = new_idx
						append(&face_indices, new_idx)
					}
				}

				// Triangulação Fan para faces com 3 ou mais vértices (ex: quads ou n-gons)
				for i in 1 ..< len(face_indices) - 1 {
					append(&mesh.indices, face_indices[0])
					append(&mesh.indices, face_indices[i])
					append(&mesh.indices, face_indices[i + 1])
				}
			}
		}
	}

	mesh3d_update_aabb(&mesh)
	if len(normals) == 0 {
		mesh3d_recalculate_normals(&mesh)
	}

	return mesh, true
}

load_obj_from_file :: proc(path: string, allocator := context.allocator) -> (Mesh3D, bool) {
	data, err := os.read_entire_file(path, allocator)
	if err != nil do return {}, false
	defer delete(data, allocator)
	return load_obj_from_string(string(data), allocator)
}
