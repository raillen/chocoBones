package tests

import "core:fmt"
import "core:math"
import "core:testing"
import "../src/core"
import "../src/rig"

@(test)
test_mat2x3_identity :: proc(t: ^testing.T) {
	p := core.Vec2{10, 25}
	p_prime := core.mat_apply(core.MAT_IDENTITY, p)
	testing.expect(t, math.abs(p_prime.x - p.x) < 1e-6, "Identity deve preservar X")
	testing.expect(t, math.abs(p_prime.y - p.y) < 1e-6, "Identity deve preservar Y")
}

@(test)
test_mat2x3_inverse :: proc(t: ^testing.T) {
	// Cria uma matriz com translação, rotação e escala
	m := core.translate(100, 200)
	m = core.mat_mul(m, core.rotate(math.PI / 4.0))
	m = core.mat_mul(m, core.scale(2.0, 1.5))

	inv := core.mat_inverse(m)
	prod := core.mat_mul(m, inv)

	testing.expect(t, math.abs(prod.a - 1.0) < 1e-4, "Diagonal A deve ser 1.0")
	testing.expect(t, math.abs(prod.d - 1.0) < 1e-4, "Diagonal D deve ser 1.0")
	testing.expect(t, math.abs(prod.b) < 1e-4, "Off-diagonal B deve ser 0.0")
	testing.expect(t, math.abs(prod.c) < 1e-4, "Off-diagonal C deve ser 0.0")
	testing.expect(t, math.abs(prod.tx) < 1e-4, "Translação TX deve ser 0.0")
	testing.expect(t, math.abs(prod.ty) < 1e-4, "Translação TY deve ser 0.0")
}

@(test)
test_bezier_solve :: proc(t: ^testing.T) {
	// Curva linear: (0,0) a (1,1)
	y_half := core.bezier_solve(0.5, 0.0, 0.0, 1.0, 1.0)
	testing.expect(t, math.abs(y_half - 0.5) < 1e-4, "Bézier linear em t=0.5 deve ser ~0.5")

	// Curva padrão ease (0.25, 0.1, 0.25, 1.0) nos extremos
	y_zero := core.bezier_solve(0.0, 0.25, 0.1, 0.25, 1.0)
	testing.expect(t, math.abs(y_zero - 0.0) < 1e-4, "Bézier em t=0 deve ser 0")

	y_one := core.bezier_solve(1.0, 0.25, 0.1, 0.25, 1.0)
	testing.expect(t, math.abs(y_one - 1.0) < 1e-4, "Bézier em t=1 deve ser 1")
}

@(test)
test_point_in_triangle :: proc(t: ^testing.T) {
	a := core.Vec2{0, 0}
	b := core.Vec2{100, 0}
	c := core.Vec2{0, 100}

	p_inside := core.Vec2{20, 20}
	p_outside := core.Vec2{80, 80}

	testing.expect(t, core.point_in_triangle(p_inside, a, b, c), "Ponto dentro do triângulo deve retornar true")
	testing.expect(t, !core.point_in_triangle(p_outside, a, b, c), "Ponto fora do triângulo deve retornar false")
}

@(test)
test_bone_matrices_fk :: proc(t: ^testing.T) {
	joints := []rig.Joint{
		{id = "root", name = "Quadril", parent = "", x = 200, y = 200, color = "#fff"},
		{id = "upper_arm", name = "Ombro", parent = "root", x = 200, y = 100, color = "#fff"},
		{id = "forearm", name = "Cotovelo", parent = "upper_arm", x = 200, y = 50, color = "#fff"},
	}

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	// Sem deltas (repouso)
	bones := rig.bone_matrices(joints, &pose)
	defer delete(bones)

	origin_forearm := core.mat_apply(bones["forearm"], {0, 0})
	testing.expect(t, math.abs(origin_forearm.x - 200) < 1e-5, "Posição X no repouso deve ser 200")
	testing.expect(t, math.abs(origin_forearm.y - 50) < 1e-5, "Posição Y no repouso deve ser 50")
}

@(test)
test_solve_ik :: proc(t: ^testing.T) {
	// Braço com ombro em (100, 100), cotovelo em (100, 150) e punho em (100, 200)
	joints := []rig.Joint{
		{id = "torso", name = "Tronco", parent = "", x = 100, y = 50, color = "#fff"},
		{id = "shoulder", name = "Ombro", parent = "torso", x = 100, y = 100, color = "#fff"},
		{id = "elbow", name = "Cotovelo", parent = "shoulder", x = 100, y = 150, color = "#fff"},
		{id = "wrist", name = "Punho", parent = "elbow", x = 100, y = 200, color = "#fff"},
	}

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	// Alvo alcançável à direita: (150, 150)
	target := core.Vec2{150, 150}
	ok := rig.solve_ik(joints, &pose, "wrist", target, 1.0)
	testing.expect(t, ok, "IK deve resolver com sucesso para alvo dentro do raio")

	// Recalcula matrizes pós-IK
	bones := rig.bone_matrices(joints, &pose)
	defer delete(bones)

	solved_wrist := core.mat_apply(bones["wrist"], {0, 0})
	testing.expect(t, math.abs(solved_wrist.x - target.x) < 1e-2, "Punho X deve coincidir com o alvo")
	testing.expect(t, math.abs(solved_wrist.y - target.y) < 1e-2, "Punho Y deve coincidir com o alvo")
}

@(test)
test_arena_allocator :: proc(t: ^testing.T) {
	ctx: core.ArenaContext
	ok := core.arena_context_init(&ctx, 1024 * 64)
	testing.expect(t, ok, "Arena deve inicializar com sucesso")
	defer core.arena_context_destroy(&ctx)

	slice := make([]core.Vec2, 100, ctx.allocator)
	testing.expect(t, len(slice) == 100, "Slice na arena deve ter tamanho 100")

	core.arena_context_reset(&ctx)
	// Após reset, arena pode ser reutilizada
	slice2 := make([]core.Vec2, 50, ctx.allocator)
	testing.expect(t, len(slice2) == 50, "Slice após reset deve alocar normalmente")
}
