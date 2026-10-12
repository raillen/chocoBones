package mesh3d

import "core:encoding/base64"
import "core:encoding/json"
import "core:fmt"
import "core:mem"
import "core:os"
import "core:path/filepath"
import "core:strings"
import "../core"

// Constantes glTF
GLTF_MAGIC_GLB :: 0x46546C67 // "glTF"
CHUNK_TYPE_JSON :: 0x4E4F534A // "JSON"
CHUNK_TYPE_BIN  :: 0x004E4942 // "BIN\0"

COMPONENT_BYTE           :: 5120
COMPONENT_UNSIGNED_BYTE  :: 5121
COMPONENT_SHORT          :: 5122
COMPONENT_UNSIGNED_SHORT :: 5123
COMPONENT_UNSIGNED_INT   :: 5125
COMPONENT_FLOAT          :: 5126

// Helpers para navegação na AST JSON do Odin
@(private="file")
json_get_obj :: proc(val: json.Value, key: string) -> (json.Object, bool) {
	obj, is_obj := val.(json.Object)
	if !is_obj do return nil, false
	target, exists := obj[key]
	if !exists do return nil, false
	res, ok := target.(json.Object)
	return res, ok
}

@(private="file")
json_get_arr :: proc(val: json.Value, key: string) -> (json.Array, bool) {
	obj, is_obj := val.(json.Object)
	if !is_obj do return nil, false
	target, exists := obj[key]
	if !exists do return nil, false
	res, ok := target.(json.Array)
	return res, ok
}

@(private="file")
json_get_str :: proc(val: json.Value, key: string) -> (string, bool) {
	obj, is_obj := val.(json.Object)
	if !is_obj do return "", false
	target, exists := obj[key]
	if !exists do return "", false
	res, ok := target.(json.String)
	return string(res), ok
}

@(private="file")
json_get_int :: proc(val: json.Value, key: string) -> (int, bool) {
	obj, is_obj := val.(json.Object)
	if !is_obj do return 0, false
	target, exists := obj[key]
	if !exists do return 0, false
	#partial switch v in target {
	case json.Integer:
		return int(v), true
	case json.Float:
		return int(v), true
	}
	return 0, false
}

// Estruturas internas para referências glTF
@(private="file")
BufferView :: struct {
	buffer:      int,
	byte_offset: int,
	byte_length: int,
	byte_stride: int,
}

@(private="file")
Accessor :: struct {
	buffer_view:    int,
	byte_offset:    int,
	component_type: int,
	count:          int,
	type_str:       string,
	normalized:     bool,
}

load_glb_from_bytes :: proc(data: []u8, allocator := context.allocator) -> (Mesh3D, bool) {
	if len(data) < 12 do return {}, false

	magic := (^u32)(&data[0])^
	version := (^u32)(&data[4])^
	total_len := (^u32)(&data[8])^

	if magic != GLTF_MAGIC_GLB || version != 2 || int(total_len) > len(data) {
		return {}, false
	}

	offset := 12
	json_str: string = ""
	bin_data: []u8 = nil

	for offset + 8 <= len(data) {
		chunk_len := int(((^u32)(&data[offset]))^)
		chunk_type := ((^u32)(&data[offset + 4]))^
		offset += 8

		if offset + chunk_len > len(data) do break

		chunk_slice := data[offset : offset + chunk_len]

		if chunk_type == CHUNK_TYPE_JSON {
			json_str = string(chunk_slice)
		} else if chunk_type == CHUNK_TYPE_BIN {
			bin_data = chunk_slice
		}

		offset += chunk_len
		// Padding de alinhamento a 4 bytes
		if (chunk_len % 4) != 0 {
			offset += 4 - (chunk_len % 4)
		}
	}

	if len(json_str) == 0 do return {}, false

	return load_gltf_from_string(json_str, bin_data, allocator)
}

load_gltf_from_string :: proc(json_content: string, bin_data: []u8, allocator := context.allocator) -> (Mesh3D, bool) {
	parsed_json, err := json.parse_string(json_content, parse_integers = true, allocator = allocator)
	if err != .None do return {}, false
	defer json.destroy_value(parsed_json, allocator)

	root, is_obj := parsed_json.(json.Object)
	if !is_obj do return {}, false

	// Coleta Buffers
	buffers := make([dynamic][]u8, 0, 4, allocator)
	defer {
		for b, idx in buffers {
			// Se o buffer não for o bin_data passado externamente, desaloca
			if len(b) > 0 && (len(bin_data) == 0 || &b[0] != &bin_data[0]) {
				delete(b, allocator)
			}
		}
		delete(buffers)
	}

	if json_bufs, ok := json_get_arr(root, "buffers"); ok {
		for b_val in json_bufs {
			if b_obj, b_ok := b_val.(json.Object); b_ok {
				uri, has_uri := json_get_str(b_obj, "uri")
				if has_uri && strings.has_prefix(uri, "data:") {
					// Base64 embedded
					comma_idx := strings.index_byte(uri, ',')
					if comma_idx != -1 {
						b64_str := uri[comma_idx + 1:]
						decoded, dec_err := base64.decode(b64_str, allocator = allocator)
						if dec_err == nil {
							append(&buffers, decoded)
							continue
						}
					}
				}
				// Default ou GLB binary chunk
				append(&buffers, bin_data)
			}
		}
	} else if len(bin_data) > 0 {
		append(&buffers, bin_data)
	}

	// Coleta BufferViews
	buffer_views := make([dynamic]BufferView, 0, 16, allocator)
	defer delete(buffer_views)

	if json_views, ok := json_get_arr(root, "bufferViews"); ok {
		for v_val in json_views {
			if v_obj, v_ok := v_val.(json.Object); v_ok {
				buf_idx, _ := json_get_int(v_obj, "buffer")
				b_offset, _ := json_get_int(v_obj, "byteOffset")
				b_len, _ := json_get_int(v_obj, "byteLength")
				b_stride, _ := json_get_int(v_obj, "byteStride")

				append(&buffer_views, BufferView{
					buffer      = buf_idx,
					byte_offset = b_offset,
					byte_length = b_len,
					byte_stride = b_stride,
				})
			}
		}
	}

	// Coleta Accessors
	accessors := make([dynamic]Accessor, 0, 16, allocator)
	defer delete(accessors)

	if json_accs, ok := json_get_arr(root, "accessors"); ok {
		for a_val in json_accs {
			if a_obj, a_ok := a_val.(json.Object); a_ok {
				bv_idx, _ := json_get_int(a_obj, "bufferView")
				b_offset, _ := json_get_int(a_obj, "byteOffset")
				c_type, _ := json_get_int(a_obj, "componentType")
				count, _ := json_get_int(a_obj, "count")
				type_str, _ := json_get_str(a_obj, "type")

				append(&accessors, Accessor{
					buffer_view    = bv_idx,
					byte_offset    = b_offset,
					component_type = c_type,
					count          = count,
					type_str       = type_str,
					normalized     = false,
				})
			}
		}
	}

	// Carrega Meshes / Primitives
	mesh_name := "gltf_mesh"
	json_meshes, has_meshes := json_get_arr(root, "meshes")
	if !has_meshes || len(json_meshes) == 0 do return {}, false

	first_mesh_obj, _ := json_meshes[0].(json.Object)
	if n, ok := json_get_str(first_mesh_obj, "name"); ok && len(n) > 0 {
		mesh_name = n
	}

	json_primitives, has_prims := json_get_arr(first_mesh_obj, "primitives")
	if !has_prims || len(json_primitives) == 0 do return {}, false

	mesh: Mesh3D
	mesh3d_init(&mesh, mesh_name, allocator)

	for prim_val in json_primitives {
		prim_obj, p_ok := prim_val.(json.Object)
		if !p_ok do continue

		attribs_obj, has_attribs := json_get_obj(prim_obj, "attributes")
		if !has_attribs do continue

		// POSITION
		pos_acc_idx, has_pos := json_get_int(attribs_obj, "POSITION")
		if !has_pos || pos_acc_idx < 0 || pos_acc_idx >= len(accessors) do continue

		pos_acc := accessors[pos_acc_idx]
		vertex_start_idx := u32(len(mesh.vertices))
		num_verts := pos_acc.count

		// Expande os vértices
		for _ in 0 ..< num_verts {
			append(&mesh.vertices, Vertex3D{
				pos     = {0, 0, 0},
				normal  = {0, 1, 0},
				uv      = {0, 0},
				joints  = {0, 0, 0, 0},
				weights = {1, 0, 0, 0},
			})
		}

		// Preenche POSITIONS
		if pos_acc.buffer_view >= 0 && pos_acc.buffer_view < len(buffer_views) {
			bv := buffer_views[pos_acc.buffer_view]
			if bv.buffer >= 0 && bv.buffer < len(buffers) {
				buf := buffers[bv.buffer]
				stride := bv.byte_stride > 0 ? bv.byte_stride : 12 // 3 * sizeof(f32)
				offset := bv.byte_offset + pos_acc.byte_offset

				for v in 0 ..< num_verts {
					read_off := offset + v * stride
					if read_off + 12 <= len(buf) {
						x := (^f32)(&buf[read_off + 0])^
						y := (^f32)(&buf[read_off + 4])^
						z := (^f32)(&buf[read_off + 8])^
						mesh.vertices[vertex_start_idx + u32(v)].pos = {x, y, z}
					}
				}
			}
		}

		// NORMALS (se houver)
		if norm_acc_idx, has_norm := json_get_int(attribs_obj, "NORMAL"); has_norm && norm_acc_idx < len(accessors) {
			norm_acc := accessors[norm_acc_idx]
			if norm_acc.buffer_view >= 0 && norm_acc.buffer_view < len(buffer_views) {
				bv := buffer_views[norm_acc.buffer_view]
				if bv.buffer >= 0 && bv.buffer < len(buffers) {
					buf := buffers[bv.buffer]
					stride := bv.byte_stride > 0 ? bv.byte_stride : 12
					offset := bv.byte_offset + norm_acc.byte_offset

					for v in 0 ..< math_min(num_verts, norm_acc.count) {
						read_off := offset + v * stride
						if read_off + 12 <= len(buf) {
							x := (^f32)(&buf[read_off + 0])^
							y := (^f32)(&buf[read_off + 4])^
							z := (^f32)(&buf[read_off + 8])^
							mesh.vertices[vertex_start_idx + u32(v)].normal = {x, y, z}
						}
					}
				}
			}
		}

		// TEXCOORD_0 (se houver)
		if uv_acc_idx, has_uv := json_get_int(attribs_obj, "TEXCOORD_0"); has_uv && uv_acc_idx < len(accessors) {
			uv_acc := accessors[uv_acc_idx]
			if uv_acc.buffer_view >= 0 && uv_acc.buffer_view < len(buffer_views) {
				bv := buffer_views[uv_acc.buffer_view]
				if bv.buffer >= 0 && bv.buffer < len(buffers) {
					buf := buffers[bv.buffer]
					stride := bv.byte_stride > 0 ? bv.byte_stride : 8
					offset := bv.byte_offset + uv_acc.byte_offset

					for v in 0 ..< math_min(num_verts, uv_acc.count) {
						read_off := offset + v * stride
						if read_off + 8 <= len(buf) {
							u := (^f32)(&buf[read_off + 0])^
							vt := (^f32)(&buf[read_off + 4])^
							mesh.vertices[vertex_start_idx + u32(v)].uv = {u, vt}
						}
					}
				}
			}
		}

		// JOINTS_0 & WEIGHTS_0 (se houver skinning)
		if joints_acc_idx, has_j := json_get_int(attribs_obj, "JOINTS_0"); has_j && joints_acc_idx < len(accessors) {
			j_acc := accessors[joints_acc_idx]
			if j_acc.buffer_view >= 0 && j_acc.buffer_view < len(buffer_views) {
				bv := buffer_views[j_acc.buffer_view]
				if bv.buffer >= 0 && bv.buffer < len(buffers) {
					buf := buffers[bv.buffer]
					offset := bv.byte_offset + j_acc.byte_offset
					mesh.has_skinning = true

					for v in 0 ..< math_min(num_verts, j_acc.count) {
						j: [4]u16
						if j_acc.component_type == COMPONENT_UNSIGNED_BYTE {
							stride := bv.byte_stride > 0 ? bv.byte_stride : 4
							read_off := offset + v * stride
							if read_off + 4 <= len(buf) {
								j[0] = u16(buf[read_off + 0])
								j[1] = u16(buf[read_off + 1])
								j[2] = u16(buf[read_off + 2])
								j[3] = u16(buf[read_off + 3])
							}
						} else if j_acc.component_type == COMPONENT_UNSIGNED_SHORT {
							stride := bv.byte_stride > 0 ? bv.byte_stride : 8
							read_off := offset + v * stride
							if read_off + 8 <= len(buf) {
								j[0] = (^u16)(&buf[read_off + 0])^
								j[1] = (^u16)(&buf[read_off + 2])^
								j[2] = (^u16)(&buf[read_off + 4])^
								j[3] = (^u16)(&buf[read_off + 6])^
							}
						}
						mesh.vertices[vertex_start_idx + u32(v)].joints = j
					}
				}
			}
		}

		if weights_acc_idx, has_w := json_get_int(attribs_obj, "WEIGHTS_0"); has_w && weights_acc_idx < len(accessors) {
			w_acc := accessors[weights_acc_idx]
			if w_acc.buffer_view >= 0 && w_acc.buffer_view < len(buffer_views) {
				bv := buffer_views[w_acc.buffer_view]
				if bv.buffer >= 0 && bv.buffer < len(buffers) {
					buf := buffers[bv.buffer]
					offset := bv.byte_offset + w_acc.byte_offset

					for v in 0 ..< math_min(num_verts, w_acc.count) {
						w: [4]f32
						if w_acc.component_type == COMPONENT_FLOAT {
							stride := bv.byte_stride > 0 ? bv.byte_stride : 16
							read_off := offset + v * stride
							if read_off + 16 <= len(buf) {
								w[0] = (^f32)(&buf[read_off + 0])^
								w[1] = (^f32)(&buf[read_off + 4])^
								w[2] = (^f32)(&buf[read_off + 8])^
								w[3] = (^f32)(&buf[read_off + 12])^
							}
						} else if w_acc.component_type == COMPONENT_UNSIGNED_SHORT {
							stride := bv.byte_stride > 0 ? bv.byte_stride : 8
							read_off := offset + v * stride
							if read_off + 8 <= len(buf) {
								w[0] = f32((^u16)(&buf[read_off + 0])^) / 65535.0
								w[1] = f32((^u16)(&buf[read_off + 2])^) / 65535.0
								w[2] = f32((^u16)(&buf[read_off + 4])^) / 65535.0
								w[3] = f32((^u16)(&buf[read_off + 6])^) / 65535.0
							}
						}
						mesh.vertices[vertex_start_idx + u32(v)].weights = w
					}
				}
			}
		}

		// INDICES
		if idx_acc_idx, has_indices := json_get_int(prim_obj, "indices"); has_indices && idx_acc_idx < len(accessors) {
			idx_acc := accessors[idx_acc_idx]
			if idx_acc.buffer_view >= 0 && idx_acc.buffer_view < len(buffer_views) {
				bv := buffer_views[idx_acc.buffer_view]
				if bv.buffer >= 0 && bv.buffer < len(buffers) {
					buf := buffers[bv.buffer]
					offset := bv.byte_offset + idx_acc.byte_offset

					for i in 0 ..< idx_acc.count {
						idx_val: u32 = 0
						switch idx_acc.component_type {
						case COMPONENT_UNSIGNED_BYTE:
							if offset + i < len(buf) {
								idx_val = u32(buf[offset + i])
							}
						case COMPONENT_UNSIGNED_SHORT:
							if offset + i * 2 + 2 <= len(buf) {
								idx_val = u32((^u16)(&buf[offset + i * 2])^)
							}
						case COMPONENT_UNSIGNED_INT:
							if offset + i * 4 + 4 <= len(buf) {
								idx_val = (^u32)(&buf[offset + i * 4])^
							}
						}
						append(&mesh.indices, vertex_start_idx + idx_val)
					}
				}
			}
		} else {
			// Sem buffer de índices: triângulos sequenciais
			for i in 0 ..< num_verts {
				append(&mesh.indices, vertex_start_idx + u32(i))
			}
		}
	}

	mesh3d_update_aabb(&mesh)
	return mesh, true
}

@(private="file")
math_min :: proc(a, b: int) -> int {
	return a < b ? a : b
}

load_gltf_or_glb_from_file :: proc(path: string, allocator := context.allocator) -> (Mesh3D, bool) {
	data, err := os.read_entire_file(path, allocator)
	if err != nil do return {}, false
	defer delete(data, allocator)

	// Verifica se é GLB binário
	if len(data) >= 4 {
		magic := ((^u32)(&data[0]))^
		if magic == GLTF_MAGIC_GLB {
			return load_glb_from_bytes(data, allocator)
		}
	}

	// É arquivo glTF em formato texto JSON
	// Verifica se há buffers externos relativos ao arquivo
	dir := filepath.dir(path)

	// Lemos o JSON
	json_content := string(data)
	parsed_json, json_err := json.parse_string(json_content, parse_integers = true, allocator = allocator)
	if json_err != .None do return {}, false
	defer json.destroy_value(parsed_json, allocator)

	bin_data: []u8 = nil
	defer if len(bin_data) > 0 do delete(bin_data, allocator)

	if root, r_ok := parsed_json.(json.Object); r_ok {
		if json_bufs, b_ok := json_get_arr(root, "buffers"); b_ok && len(json_bufs) > 0 {
			if first_buf, fb_ok := json_bufs[0].(json.Object); fb_ok {
				if uri, u_ok := json_get_str(first_buf, "uri"); u_ok && !strings.has_prefix(uri, "data:") {
					// Caminho para o arquivo .bin
					bin_path, join_err := filepath.join({dir, uri}, allocator)
					if join_err == nil {
						defer delete(bin_path, allocator)
						if loaded_bin, read_err := os.read_entire_file(bin_path, allocator); read_err == nil {
							bin_data = loaded_bin
						}
					}
				}
			}
		}
	}

	return load_gltf_from_string(json_content, bin_data, allocator)
}

// Carregador unificado inteligente por extensão
load_mesh3d_from_file :: proc(path: string, allocator := context.allocator) -> (Mesh3D, bool) {
	ext := strings.to_lower(filepath.ext(path), allocator)
	defer delete(ext, allocator)

	switch ext {
	case ".obj":
		return load_obj_from_file(path, allocator)
	case ".gltf", ".glb":
		return load_gltf_or_glb_from_file(path, allocator)
	case:
		// Tenta detecção por assinatura mágica
		return load_gltf_or_glb_from_file(path, allocator)
	}
}
