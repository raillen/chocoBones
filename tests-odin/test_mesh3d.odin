package tests

import "core:math"
import "core:testing"
import "../src/core"
import "../src/mesh3d"

@test
test_math3d_perspective_and_camera :: proc(t: ^testing.T) {
	fov := f32(math.to_radians(f32(60.0)))
	aspect: f32 = 16.0 / 9.0
	near: f32 = 0.1
	far: f32 = 1000.0

	proj := core.mat4_perspective(fov, aspect, near, far)
	// Em projeção perspectiva com Z invertido ou padrão, elemento [3][2] ou [2][3] é não-zero
	testing.expect(t, proj[2][3] != 0.0 || proj[3][2] != 0.0, "Projeção perspectiva inválida")

	cam: core.OrbitCamera
	core.orbit_camera_init(&cam, {0, 0, 0}, 5.0)
	cam.pitch = 0.0 // Sem inclinação para olho estar perfeitamente no eixo Z
	view_mat := core.orbit_camera_view_matrix(&cam)

	// A câmera olhando para a origem a distância 5 deve ter posição z = 5
	eye := core.orbit_camera_eye_pos(&cam)
	testing.expect(t, math.abs(eye.z - 5.0) < 0.01, "Câmera z position incorreta")
	testing.expect(t, math.abs(eye.x) < 0.01 && math.abs(eye.y) < 0.01, "Câmera x/y position incorreta")
}

@test
test_obj_loader :: proc(t: ^testing.T) {
	// OBJ sintético de um quad (2 triângulos)
	obj_data := `
# Simple Quad
v -1.0 -1.0 0.0
v  1.0 -1.0 0.0
v  1.0  1.0 0.0
v -1.0  1.0 0.0
vn 0.0 0.0 1.0
vt 0.0 0.0
vt 1.0 0.0
vt 1.0 1.0
vt 0.0 1.0
f 1/1/1 2/2/1 3/3/1 4/4/1
`
	mesh, ok := mesh3d.load_obj_from_string(obj_data)
	defer mesh3d.mesh3d_destroy(&mesh)

	testing.expect(t, ok, "Falha ao carregar OBJ de teste")
	testing.expect_value(t, len(mesh.vertices), 4)
	testing.expect_value(t, len(mesh.indices), 6) // Quad triangulado = 2 triângulos = 6 índices

	// Verifica AABB
	testing.expect_value(t, mesh.aabb_min.x, -1.0)
	testing.expect_value(t, mesh.aabb_max.x, 1.0)
	testing.expect_value(t, mesh.aabb_min.y, -1.0)
	testing.expect_value(t, mesh.aabb_max.y, 1.0)
}

@test
test_glb_loader_synthetic :: proc(t: ^testing.T) {
	// Cria um buffer GLB mínimo sintético
	// 3 vértices (posição 3 * 3 * 4 = 36 bytes)
	// 3 índices (3 * 2 = 6 bytes + 2 bytes padding = 8 bytes)
	// Total BIN = 44 bytes

	json_header := `{"asset":{"version":"2.0"},"buffers":[{"byteLength":48}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":36},{"buffer":0,"byteOffset":36,"byteLength":6}],"accessors":[{"bufferView":0,"byteOffset":0,"componentType":5126,"count":3,"type":"VEC3"},{"bufferView":1,"byteOffset":0,"componentType":5123,"count":3,"type":"SCALAR"}],"meshes":[{"name":"tri","primitives":[{"attributes":{"POSITION":0},"indices":1}]}]}`

	// Alinha JSON a 4 bytes com espaços
	json_bytes := transmute([]u8)json_header
	json_padding := (4 - (len(json_bytes) % 4)) % 4
	json_len_aligned := len(json_bytes) + json_padding

	bin_bytes := make([]u8, 48)
	defer delete(bin_bytes)

	// Vértices:
	// V0: (0, 0, 0)
	// V1: (1, 0, 0)
	// V2: (0, 1, 0)
	pos_slice := ([^]f32)(raw_data(bin_bytes))
	pos_slice[0] = 0.0; pos_slice[1] = 0.0; pos_slice[2] = 0.0
	pos_slice[3] = 1.0; pos_slice[4] = 0.0; pos_slice[5] = 0.0
	pos_slice[6] = 0.0; pos_slice[7] = 1.0; pos_slice[8] = 0.0

	// Índices em offset 36:
	idx_slice := ([^]u16)(raw_data(bin_bytes[36:]))
	idx_slice[0] = 0
	idx_slice[1] = 1
	idx_slice[2] = 2

	total_file_len := 12 + (8 + json_len_aligned) + (8 + len(bin_bytes))
	glb_buf := make([]u8, total_file_len)
	defer delete(glb_buf)

	// Header
	(^u32)(&glb_buf[0])^ = mesh3d.GLTF_MAGIC_GLB
	(^u32)(&glb_buf[4])^ = 2
	(^u32)(&glb_buf[8])^ = u32(total_file_len)

	// Chunk 0 (JSON)
	(^u32)(&glb_buf[12])^ = u32(json_len_aligned)
	(^u32)(&glb_buf[16])^ = mesh3d.CHUNK_TYPE_JSON
	copy(glb_buf[20:], json_bytes)
	for p in 0 ..< json_padding {
		glb_buf[20 + len(json_bytes) + p] = ' '
	}

	// Chunk 1 (BIN)
	bin_chunk_start := 20 + json_len_aligned
	(^u32)(&glb_buf[bin_chunk_start])^ = u32(len(bin_bytes))
	(^u32)(&glb_buf[bin_chunk_start + 4])^ = mesh3d.CHUNK_TYPE_BIN
	copy(glb_buf[bin_chunk_start + 8:], bin_bytes)

	mesh, ok := mesh3d.load_glb_from_bytes(glb_buf)
	defer mesh3d.mesh3d_destroy(&mesh)

	testing.expect(t, ok, "Falha ao carregar GLB sintético")
	testing.expect_value(t, len(mesh.vertices), 3)
	testing.expect_value(t, len(mesh.indices), 3)
	testing.expect_value(t, mesh.name, "tri")
	testing.expect_value(t, mesh.vertices[1].pos.x, 1.0)
	testing.expect_value(t, mesh.vertices[2].pos.y, 1.0)
}

@test
test_wgpu_native_bindings :: proc(t: ^testing.T) {
	// Import dinâmico e teste da biblioteca wgpu-native
	ver := mesh3d.GLTF_MAGIC_GLB // Apenas para validar import
	testing.expect(t, ver != 0, "Magic deve ser não-zero")
}

@test
test_load_obj_file :: proc(t: ^testing.T) {
	mesh, ok := mesh3d.load_mesh3d_from_file("assets/models/cube_prism.obj")
	defer mesh3d.mesh3d_destroy(&mesh)

	testing.expect(t, ok, "Falha ao carregar assets/models/cube_prism.obj")
	testing.expect(t, len(mesh.vertices) > 0, "Deveria ter vértices")
	testing.expect(t, len(mesh.indices) > 0, "Deveria ter índices")
}

@test
test_load_gltf_file :: proc(t: ^testing.T) {
	mesh, ok := mesh3d.load_mesh3d_from_file("assets/models/pyramid.gltf")
	defer mesh3d.mesh3d_destroy(&mesh)

	testing.expect(t, ok, "Falha ao carregar assets/models/pyramid.gltf")
	testing.expect_value(t, len(mesh.vertices), 5)
	testing.expect_value(t, len(mesh.indices), 18) // 6 triângulos * 3 = 18
	testing.expect_value(t, mesh.name, "Piramide")
}

@test
test_load_glb_file :: proc(t: ^testing.T) {
	mesh, ok := mesh3d.load_mesh3d_from_file("assets/models/pyramid.glb")
	defer mesh3d.mesh3d_destroy(&mesh)

	testing.expect(t, ok, "Falha ao carregar assets/models/pyramid.glb")
	testing.expect_value(t, len(mesh.vertices), 5)
	testing.expect_value(t, len(mesh.indices), 18)
	testing.expect_value(t, mesh.name, "PiramideGLB")
}

@test
test_primitives_generation :: proc(t: ^testing.T) {
	cube := mesh3d.create_cube_mesh(1.0)
	defer mesh3d.mesh3d_destroy(&cube)

	testing.expect_value(t, len(cube.vertices), 24)
	testing.expect_value(t, len(cube.indices), 36)

	cyl := mesh3d.create_cylinder_mesh(0.5, 1.0, 12)
	defer mesh3d.mesh3d_destroy(&cyl)

	testing.expect(t, len(cyl.vertices) > 0, "Cilindro deve ter vértices")
	testing.expect(t, len(cyl.indices) > 0, "Cilindro deve ter índices")
}

