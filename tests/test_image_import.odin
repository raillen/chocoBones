package tests

import "core:os"
import "core:testing"
import "../src/core"
import "../src/render"
import "../src/rig"

@(test)
test_image_raw_loading :: proc(t: ^testing.T) {
	test_img_path := "assets/test-kits/frontier-survival/vector-rig/png/head.png"
	if !os.exists(test_img_path) {
		// Se o caminho relativo não for encontrado no diretório de execução dos testes, ignora
		return
	}

	raw, ok := render.image_load_raw(test_img_path)
	testing.expect(t, ok, "Deveria decodificar o arquivo PNG do kit de teste")
	defer render.image_free_raw(&raw)

	testing.expect(t, raw.width > 0, "Largura da imagem deve ser positiva")
	testing.expect(t, raw.height > 0, "Altura da imagem deve ser positiva")
	testing.expect(t, raw.channels == 4, "Imagem RGBA deve conter 4 canais")
	testing.expect(t, raw.pixels != nil, "Ponteiro de pixels não deve ser nulo")
}

@(test)
test_layer_creation_from_image_metadata :: proc(t: ^testing.T) {
	// Simula a criação de uma Layer a partir de metadados de uma imagem importada
	img_w: f32 = 128
	img_h: f32 = 256
	layer_id := "layer_imported_sword"
	joint_target := "hand_near"

	layer := rig.Layer{
		id        = layer_id,
		name      = "Espada Curta",
		asset     = "assets/weapons/sword.png",
		transform = core.Transform{
			pos      = {256, 256},
			rotation = 0,
			scale    = {1, 1},
			pivot    = {img_w * 0.5, img_h * 0.5},
		},
		joint     = joint_target,
		visible   = true,
		locked    = false,
		opacity   = 1.0,
	}

	testing.expect(t, layer.id == layer_id, "ID da camada deve ser preservado")
	testing.expect(t, layer.joint == "hand_near", "Camada deve ser vinculada à junta alvo")
	testing.expect(t, layer.transform.pivot.x == 64, "Pivô X deve ser o centro da imagem")
	testing.expect(t, layer.transform.pivot.y == 128, "Pivô Y deve ser o centro da imagem")
}
