package tests

import "core:fmt"
import "core:math"
import "core:mem"
import "core:testing"
import "core:time"
import "../src/core"
import "../src/mesh"
import "../src/rig"

@(test)
test_benchmark_mls_and_dual_quat :: proc(t: ^testing.T) {
	// Cria uma malha densa (40x40 = 1681 vértices, 3200 triângulos)
	density := 24 // máx 24: (25*25 = 625 vértices)
	m := mesh.build_grid_mesh(300, 300, density)
	defer mesh.mesh_destroy(&m)
	m.mode = .Skin
	m.skinning = .DualQuaternion

	for &w in m.weights {
		append(&w, mesh.Influence{joint = "upper_arm", weight = 0.5})
		append(&w, mesh.Influence{joint = "forearm", weight = 0.5})
	}

	pins := []mesh.Pin{
		{id = "p1", name = "Pino 1", x = 50, y = 50, locked = false},
		{id = "p2", name = "Pino 2", x = 250, y = 250, locked = false},
	}
	deltas := make(map[string]core.Vec2)
	defer delete(deltas)
	deltas["p1"] = core.Vec2{10, 5}
	deltas["p2"] = core.Vec2{-10, -5}

	joints := []rig.Joint{
		{id = "root", name = "Raiz", parent = "", x = 150, y = 150},
		{id = "upper_arm", name = "Braço", parent = "root", x = 150, y = 100},
		{id = "forearm", name = "Antebraço", parent = "upper_arm", x = 150, y = 50},
	}

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)
	pose.joints["upper_arm"] = rig.JointDelta{angle = 0.5, x = 0, y = 0}

	bones := rig.bone_matrices(joints, &pose)
	defer delete(bones)

	layer := rig.Layer{
		id        = "test",
		transform = core.Transform{scale = {1, 1}},
		visible   = true,
		opacity   = 1.0,
	}

	// Executa 100 iterações com alocador temporário medindo tempo
	iterations := 100
	start := time.now()

	for _ in 0 ..< iterations {
		pts := mesh.mesh_world(&m, pins, deltas, layer, joints, &pose, bones, context.temp_allocator)
		testing.expect(t, len(pts) == len(m.vertices), "Quantidade de vértices deve bater")
		free_all(context.temp_allocator)
	}

	elapsed := time.since(start)
	ms_total := f64(time.duration_milliseconds(elapsed))
	ms_per_iter := ms_total / f64(iterations)

	fmt.printf("\n[BENCHMARK] Deformação MLS + Dual Quat (%d vértices): %.4f ms por quadro (Total 100 iterações: %.2f ms)\n", len(m.vertices), ms_per_iter, ms_total)

	// Orçamento de performance: deve ser muito menor que 1.0 ms
	testing.expect(t, ms_per_iter < 1.0, "Tempo médio por iteração deve cumprir o orçamento de performance (< 1.0 ms)")
}

@(test)
test_memory_leak_free_pipeline :: proc(t: ^testing.T) {
	// Validação de alocação e liberação com tracking allocator
	track: mem.Tracking_Allocator
	mem.tracking_allocator_init(&track, context.allocator)
	defer mem.tracking_allocator_destroy(&track)

	context.allocator = mem.tracking_allocator(&track)

	{
		m := mesh.build_grid_mesh(100, 100, 4)
		mesh.mesh_destroy(&m)
	}

	testing.expect(t, len(track.allocation_map) == 0, "Zero vazamentos após mesh_destroy")
}
