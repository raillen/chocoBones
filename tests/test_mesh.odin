package tests

import "core:math"
import "core:testing"
import "../src/core"
import "../src/mesh"
import "../src/rig"

@(test)
test_grid_mesh_generation :: proc(t: ^testing.T) {
	density := 4
	m := mesh.build_grid_mesh(200, 200, density)
	defer mesh.mesh_destroy(&m)

	expected_vertices := (density + 1) * (density + 1)
	expected_triangles := density * density * 2

	testing.expect(t, len(m.vertices) == expected_vertices, "Contagem de vértices deve ser (N+1)^2")
	testing.expect(t, len(m.triangles) == expected_triangles, "Contagem de triângulos deve ser 2*N^2")

	// Primeiro vértice em (0,0), último em (200, 200)
	testing.expect(t, math.abs(m.vertices[0].x) < 1e-5 && math.abs(m.vertices[0].y) < 1e-5, "Vértice 0 deve ser (0,0)")
	last := len(m.vertices) - 1
	testing.expect(t, math.abs(m.vertices[last].x - 200) < 1e-5, "Último vértice X deve ser 200")
	testing.expect(t, math.abs(m.vertices[last].y - 200) < 1e-5, "Último vértice Y deve ser 200")
}

@(test)
test_mls_warp_locked_pin :: proc(t: ^testing.T) {
	pins := []mesh.Pin{
		{id = "p1", name = "Pino Fixo", x = 50, y = 50, locked = true},
		{id = "p2", name = "Pino Livre", x = 150, y = 150, locked = false},
	}

	deltas := make(map[string]core.Vec2)
	defer delete(deltas)
	deltas["p2"] = core.Vec2{20, 10}

	// Vértice coincidente com o pino fixo deve permanecer fixo
	v_fixed := core.Vec2{50, 50}
	warped_fixed := mesh.warp_point(v_fixed, pins, deltas, 1.0)
	testing.expect(t, math.abs(warped_fixed.x - 50) < 1e-4, "Pino fixo deve manter X")
	testing.expect(t, math.abs(warped_fixed.y - 50) < 1e-4, "Pino fixo deve manter Y")

	// Vértice coincidente com o pino livre deve mover-se junto com o pino
	v_free := core.Vec2{150, 150}
	warped_free := mesh.warp_point(v_free, pins, deltas, 1.0)
	testing.expect(t, math.abs(warped_free.x - 170) < 1e-3, "Pino livre deve deslocar X")
	testing.expect(t, math.abs(warped_free.y - 160) < 1e-3, "Pino livre deve deslocar Y")
}

@(test)
test_mesh_world_skinning :: proc(t: ^testing.T) {
	joints := []rig.Joint{
		{id = "root", name = "Raiz", parent = "", x = 100, y = 100, color = "#fff"},
		{id = "arm", name = "Braço", parent = "root", x = 100, y = 150, color = "#fff"},
	}

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	layer := rig.Layer{
		id        = "test_layer",
		name      = "Camada de Teste",
		asset     = "asset_1",
		transform = core.Transform{pos = {100, 100}, scale = {1, 1}, pivot = {0, 0}},
		joint     = "root",
		visible   = true,
		opacity   = 1.0,
	}

	m := mesh.build_grid_mesh(100, 100, 2)
	defer mesh.mesh_destroy(&m)
	m.mode = .Skin
	m.skinning = .DualQuaternion

	// Vincula 100% à junta root
	for &w in m.weights {
		append(&w, mesh.Influence{joint = "root", weight = 1.0})
	}

	bones := rig.bone_matrices(joints, &pose)
	defer delete(bones)

	// No repouso, todos os vértices devem coincidir com a transformação rígida
	world_pts := mesh.mesh_world(&m, nil, nil, layer, joints, &pose, bones)
	defer delete(world_pts)

	rigid_mat := rig.layer_matrix(layer, joints, &pose, bones)
	for v, i in m.vertices {
		expected := core.mat_apply(rigid_mat, v)
		testing.expect(t, math.abs(world_pts[i].x - expected.x) < 1e-4, "Rest pose deve ser idêntica à matriz rígida")
		testing.expect(t, math.abs(world_pts[i].y - expected.y) < 1e-4, "Rest pose deve ser idêntica à matriz rígida")
	}
}

@(test)
test_mesh_auto_skin_to_joints :: proc(t: ^testing.T) {
	joints := []rig.Joint{
		{id = "top_joint", name = "Topo", parent = "", x = 100, y = 50},
		{id = "bottom_joint", name = "Base", parent = "top_joint", x = 100, y = 250},
	}

	layer := rig.Layer{
		id        = "sprite",
		name      = "Sprite Completo",
		transform = core.Transform{pos = {100, 150}, scale = {1, 1}, pivot = {50, 100}},
		joint     = "top_joint",
	}

	m := mesh.build_grid_mesh(100, 200, 4)
	defer mesh.mesh_destroy(&m)

	mesh.mesh_auto_skin_to_joints(&m, layer, joints)

	testing.expect(t, m.mode == .Skin, "Modo deve ser .Skin após auto-skin")
	testing.expect(t, m.skinning == .DualQuaternion, "Skinning deve ser .DualQuaternion")
	testing.expect(t, len(m.weights) == len(m.vertices), "Cada vértice deve ter lista de pesos")

	for w_list, i in m.weights {
		testing.expect(t, len(w_list) > 0, "Cada vértice deve ter pelo menos 1 influência")
		sum: f32 = 0
		for inf in w_list {
			sum += inf.weight
		}
		testing.expect(t, math.abs(sum - 1.0) < 1e-4, "Soma dos pesos de cada vértice deve ser normalizada em 1.0")
	}

	// O vértice superior deve ter influência predominante do top_joint
	top_vertex_weights := m.weights[0]
	top_w: f32 = 0
	for inf in top_vertex_weights {
		if inf.joint == "top_joint" do top_w = inf.weight
	}
	testing.expect(t, top_w > 0.5, "Vértice no topo deve ter peso dominante de top_joint")

	// O vértice inferior deve ter influência predominante do bottom_joint
	last_idx := len(m.vertices) - 1
	bottom_vertex_weights := m.weights[last_idx]
	bottom_w: f32 = 0
	for inf in bottom_vertex_weights {
		if inf.joint == "bottom_joint" do bottom_w = inf.weight
	}
	testing.expect(t, bottom_w > 0.5, "Vértice na base deve ter peso dominante de bottom_joint")
}
