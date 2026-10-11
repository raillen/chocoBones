package tests

import "core:testing"
import "../src/core"
import "../src/history"
import "../src/rig"

@(test)
test_undo_redo_lifecycle :: proc(t: ^testing.T) {
	h: history.History
	history.history_init(&h, 10)
	defer history.history_destroy(&h)

	joints := make([dynamic]rig.Joint, 0, 4)
	defer delete(joints)
	append(&joints, rig.Joint{id = "root", x = 100, y = 100})

	layers := make([dynamic]rig.Layer, 0, 4)
	defer delete(layers)
	append(&layers, rig.Layer{id = "torso", transform = core.Transform{pos = {100, 100}}})

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	testing.expect(t, !history.history_can_undo(&h), "Pilha de undo deve estar vazia inicialmente")
	testing.expect(t, !history.history_can_redo(&h), "Pilha de redo deve estar vazia inicialmente")

	// Empilha estado inicial
	history.history_push(&h, "Posição Inicial", joints[:], layers[:], &pose)
	testing.expect(t, history.history_can_undo(&h), "Undo deve estar disponível")

	// Modifica estado
	layers[0].transform.pos = {200, 300}
	joints[0].x = 250

	// Empilha estado modificado
	history.history_push(&h, "Mover Torso", joints[:], layers[:], &pose)

	// Altera novamente
	layers[0].transform.pos = {400, 500}

	// Executa Undo: deve voltar para a modificação "Mover Torso"
	desc, ok_undo := history.history_undo(&h, &joints, &layers, &pose)
	testing.expect(t, ok_undo, "Undo deve suceder")
	testing.expect_value(t, desc, "Mover Torso")
	testing.expect_value(t, layers[0].transform.pos.x, f32(200))
	testing.expect_value(t, layers[0].transform.pos.y, f32(300))
	testing.expect(t, history.history_can_redo(&h), "Redo deve estar disponível após Undo")

	// Executa Redo: deve avançar para {400, 500}
	desc_redo, ok_redo := history.history_redo(&h, &joints, &layers, &pose)
	testing.expect(t, ok_redo, "Redo deve suceder")
	testing.expect_value(t, layers[0].transform.pos.x, f32(400))
	testing.expect_value(t, layers[0].transform.pos.y, f32(500))

	// Executa 2 Undos seguidos
	_, _ = history.history_undo(&h, &joints, &layers, &pose)
	desc_init, _ := history.history_undo(&h, &joints, &layers, &pose)
	testing.expect_value(t, desc_init, "Posição Inicial")
	testing.expect_value(t, layers[0].transform.pos.x, f32(100))
	testing.expect_value(t, layers[0].transform.pos.y, f32(100))
	testing.expect(t, !history.history_can_undo(&h), "Undo esgotado")
}
