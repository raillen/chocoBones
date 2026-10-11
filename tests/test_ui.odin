package tests

import "core:testing"
import "../src/core"
import "../src/rig"
import "../src/ui"

@(test)
test_selection_single_and_multi :: proc(t: ^testing.T) {
	s: ui.SelectionState
	ui.selection_state_init(&s)
	defer ui.selection_state_destroy(&s)

	testing.expect(t, len(s.selected_layers) == 0, "Camadas selecionadas vazias inicialmente")
	testing.expect(t, len(s.selected_joints) == 0, "Juntas selecionadas vazias inicialmente")

	// Seleção única
	ui.selection_select_layer(&s, "torso", false, false)
	testing.expect(t, ui.selection_is_layer_selected(&s, "torso"), "Torso deve estar selecionado")
	testing.expect_value(t, s.primary_layer_id, "torso")

	// Seleção de outra peça sem modificador substitui a seleção anterior
	ui.selection_select_layer(&s, "head", false, false)
	testing.expect(t, !ui.selection_is_layer_selected(&s, "torso"), "Torso não deve mais estar selecionado")
	testing.expect(t, ui.selection_is_layer_selected(&s, "head"), "Head deve estar selecionada")
	testing.expect_value(t, s.primary_layer_id, "head")

	// Seleção aditiva (Shift)
	ui.selection_select_layer(&s, "torso", true, false)
	testing.expect(t, ui.selection_is_layer_selected(&s, "torso"), "Torso deve estar selecionado aditivamente")
	testing.expect(t, ui.selection_is_layer_selected(&s, "head"), "Head continua selecionada")

	// Toggle (Ctrl)
	ui.selection_select_layer(&s, "head", false, true)
	testing.expect(t, !ui.selection_is_layer_selected(&s, "head"), "Head deve ser desmarcada no toggle")
	testing.expect(t, ui.selection_is_layer_selected(&s, "torso"), "Torso continua selecionado")

	// Limpar seleção
	ui.selection_clear(&s)
	testing.expect(t, len(s.selected_layers) == 0, "Seleção limpa com sucesso")
}

@(test)
test_geometry_box_and_lasso :: proc(t: ^testing.T) {
	p0 := core.Vec2{100, 100}
	p1 := core.Vec2{300, 300}

	// Teste Box/Marquee
	testing.expect(t, ui.point_in_box({200, 200}, p0, p1), "Ponto central deve estar dentro da caixa")
	testing.expect(t, ui.point_in_box({100, 100}, p0, p1), "Vértice inicial deve estar dentro da caixa")
	testing.expect(t, !ui.point_in_box({50, 200}, p0, p1), "Ponto fora à esquerda deve retornar falso")
	testing.expect(t, !ui.point_in_box({200, 350}, p0, p1), "Ponto fora abaixo deve retornar falso")

	// Teste Lasso (Polígono pentagonal)
	poly := []core.Vec2{
		{200, 100},
		{300, 200},
		{250, 350},
		{150, 350},
		{100, 200},
	}

	testing.expect(t, ui.point_in_polygon({200, 220}, poly), "Centro do polígono deve estar contido")
	testing.expect(t, !ui.point_in_polygon({50, 50}, poly), "Ponto exterior longe deve retornar falso")
	testing.expect(t, !ui.point_in_polygon({200, 50}, poly), "Ponto acima do topo deve retornar falso")
}
