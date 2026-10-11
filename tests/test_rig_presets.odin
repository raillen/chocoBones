package tests

import "core:testing"
import "../src/rig"

@(test)
test_rig_presets_generation :: proc(t: ^testing.T) {
	human := rig.rig_create_preset(.Humanoid)
	defer delete(human)
	testing.expect(t, len(human) == 14, "Humanoid deve conter 14 juntas")
	testing.expect(t, !rig.joint_has_cycle(human[:]), "Humanoid não deve conter ciclos")

	biped := rig.rig_create_preset(.BipedSimple)
	defer delete(biped)
	testing.expect(t, len(biped) == 8, "BipedSimple deve conter 8 juntas")
	testing.expect(t, !rig.joint_has_cycle(biped[:]), "BipedSimple não deve conter ciclos")

	quad := rig.rig_create_preset(.Quadruped)
	defer delete(quad)
	testing.expect(t, len(quad) == 14, "Quadruped deve conter 14 juntas")
	testing.expect(t, !rig.joint_has_cycle(quad[:]), "Quadruped não deve conter ciclos")

	prop := rig.rig_create_preset(.Prop)
	defer delete(prop)
	testing.expect(t, len(prop) == 2, "Prop deve conter 2 juntas")

	empty := rig.rig_create_preset(.Empty)
	defer delete(empty)
	testing.expect(t, len(empty) == 0, "Empty deve conter 0 juntas")
}

@(test)
test_rig_dynamic_operations :: proc(t: ^testing.T) {
	joints := rig.rig_create_preset(.Empty)
	defer delete(joints)

	// Adicionar raiz
	ok := rig.joint_add(&joints, rig.Joint{id = "root", name = "Raiz", parent = "", x = 100, y = 100})
	testing.expect(t, ok, "Deveria adicionar a raiz com sucesso")

	// Tentar adicionar duplicado
	ok_dup := rig.joint_add(&joints, rig.Joint{id = "root", name = "Outra Raiz", parent = ""})
	testing.expect(t, !ok_dup, "Não deve permitir ID duplicado")

	// Adicionar filho
	ok_child := rig.joint_add(&joints, rig.Joint{id = "spine", name = "Coluna", parent = "root", x = 100, y = 150})
	testing.expect(t, ok_child, "Deveria adicionar coluna como filha da raiz")

	// Adicionar neto
	ok_grandchild := rig.joint_add(&joints, rig.Joint{id = "head", name = "Cabeça", parent = "spine", x = 100, y = 200})
	testing.expect(t, ok_grandchild, "Deveria adicionar cabeça como filha da coluna")

	// Testar detecção de descendente
	testing.expect(t, rig.joint_is_descendant(joints[:], "head", "root"), "Cabeça deve ser descendente de root")
	testing.expect(t, rig.joint_is_descendant(joints[:], "head", "spine"), "Cabeça deve ser descendente de spine")
	testing.expect(t, !rig.joint_is_descendant(joints[:], "root", "head"), "Root não é descendente de head")

	// Tentar criar ciclo: reparentar root para head
	cycle_ok := rig.joint_set_parent(&joints, "root", "head")
	testing.expect(t, !cycle_ok, "Não deve permitir criar ciclo reparentando root para seu próprio descendente")

	// Renomear junta
	layers := make([dynamic]rig.Layer, 0)
	defer delete(layers)
	append(&layers, rig.Layer{id = "layer_head", name = "Cabeça Sprite", joint = "head"})

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)
	pose.joints["head"] = rig.JointDelta{angle = 0.5, x = 0, y = 0}

	rename_ok := rig.joint_rename(&joints, "head", "head_renamed", "Cabeça Nova", &layers, &pose)
	testing.expect(t, rename_ok, "Deveria renomear com sucesso")
	testing.expect(t, layers[0].joint == "head_renamed", "Camada deveria ter o ID da junta atualizado")
	_, has_old := pose.joints["head"]
	delta_new, has_new := pose.joints["head_renamed"]
	testing.expect(t, !has_old, "Pose não deve mais conter o ID antigo")
	testing.expect(t, has_new && delta_new.angle == 0.5, "Pose deve conter o novo ID com o mesmo delta")

	// Remover nó intermediário (spine) com reparentamento para a raiz
	remove_ok := rig.joint_remove(&joints, "spine")
	testing.expect(t, remove_ok, "Deveria remover spine com sucesso")
	idx_head := rig.joint_find_index(joints[:], "head_renamed")
	testing.expect(t, idx_head >= 0, "head_renamed ainda deve existir")
	testing.expect(t, joints[idx_head].parent == "root", "head_renamed deve ter sido reparentada para a raiz")
}
