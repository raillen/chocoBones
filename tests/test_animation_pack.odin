package tests

import "core:math"
import "core:testing"
import "../src/animation"
import "../src/rig"

@(test)
test_animation_default_pack_generation :: proc(t: ^testing.T) {
	pack := animation.animation_create_default_pack()
	defer {
		for &c in pack {
			animation.clip_destroy(&c)
		}
		delete(pack)
	}

	testing.expect(t, len(pack) == 5, "Pacote padrão deve conter 5 clipes de animação")

	// Verifica IDs esperados
	expected_ids := [5]string{"walk_cycle", "idle", "run_cycle", "melee_attack", "shield_block"}
	for expected, i in expected_ids {
		testing.expect(t, pack[i].id == expected, "ID do clipe incompatível com o esperado no pacote")
		testing.expect(t, len(pack[i].frames) >= 3, "Cada clipe deve conter ao menos 3 keyframes")
	}
}

@(test)
test_animation_sampling_presets :: proc(t: ^testing.T) {
	idle := animation.animation_create_idle_clip()
	defer animation.clip_destroy(&idle)

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	// Amostra no meio da respiração (t = 0.8s)
	animation.sample_clip(&idle, 0.8, &pose)
	root_delta, has_root := pose.joints["root"]
	testing.expect(t, has_root, "Deveria ter delta na junta root")
	testing.expect(t, math.abs(root_delta.y - (-2.5)) < 1e-3, "Em t=0.8 a elevação da respiração deve ser -2.5")

	// Amostra o ataque corpo a corpo no pico (t = 0.5s)
	attack := animation.animation_create_melee_attack_clip()
	defer animation.clip_destroy(&attack)

	clear(&pose.joints)
	animation.sample_clip(&attack, 0.5, &pose)
	arm_delta, has_arm := pose.joints["upper_arm_near"]
	testing.expect(t, has_arm, "Deveria conter a junta upper_arm_near no ataque")
	testing.expect(t, arm_delta.angle > 1.0, "No impacto do ataque o braço deve estar estendido para frente (> 1.0 rad)")
}

@(test)
test_clip_clone :: proc(t: ^testing.T) {
	walk := animation.animation_create_walk_clip()
	defer animation.clip_destroy(&walk)

	cloned := animation.clip_clone(&walk, "walk_copy", "Cópia da Caminhada")
	defer animation.clip_destroy(&cloned)

	testing.expect(t, cloned.id == "walk_copy", "ID clonado deve ser walk_copy")
	testing.expect(t, cloned.name == "Cópia da Caminhada", "Nome deve ser preservado")
	testing.expect(t, len(cloned.frames) == len(walk.frames), "Quantidade de quadros deve ser idêntica")
}
