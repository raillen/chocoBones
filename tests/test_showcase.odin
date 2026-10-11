package tests

import "core:os"
import "core:testing"
import "../src/render"

@(test)
test_showcase_assets_integrity :: proc(t: ^testing.T) {
	survivor_parts := []string{
		"assets/test-kits/frontier-survival/vector-rig/png/backpack.png",
		"assets/test-kits/frontier-survival/vector-rig/png/thigh_r.png",
		"assets/test-kits/frontier-survival/vector-rig/png/thigh_l.png",
		"assets/test-kits/frontier-survival/vector-rig/png/shin_r.png",
		"assets/test-kits/frontier-survival/vector-rig/png/shin_l.png",
		"assets/test-kits/frontier-survival/vector-rig/png/foot_r.png",
		"assets/test-kits/frontier-survival/vector-rig/png/foot_l.png",
		"assets/test-kits/frontier-survival/vector-rig/png/pelvis.png",
		"assets/test-kits/frontier-survival/vector-rig/png/forearm_r.png",
		"assets/test-kits/frontier-survival/vector-rig/png/forearm_l.png",
		"assets/test-kits/frontier-survival/vector-rig/png/upper_arm_r.png",
		"assets/test-kits/frontier-survival/vector-rig/png/upper_arm_l.png",
		"assets/test-kits/frontier-survival/vector-rig/png/torso.png",
		"assets/test-kits/frontier-survival/vector-rig/png/vest.png",
		"assets/test-kits/frontier-survival/vector-rig/png/head.png",
		"assets/test-kits/frontier-survival/vector-rig/png/hand_r.png",
		"assets/test-kits/frontier-survival/vector-rig/png/hand_l.png",
		"assets/test-kits/frontier-survival/vector-rig/png/rifle.png",
	}

	for p in survivor_parts {
		testing.expectf(t, os.exists(p), "Arquivo da vitrine deve existir: %s", p)
	}

	wolf_path := "assets/test-kits/frontier-survival/png/animals/wolf.png"
	testing.expect(t, os.exists(wolf_path), "Arquivo do lobo deve existir para vitrine de quadrúpede")
}

@(test)
test_showcase_rifle_texture_raw :: proc(t: ^testing.T) {
	rifle_path := "assets/test-kits/frontier-survival/vector-rig/png/rifle.png"
	if !os.exists(rifle_path) do return

	raw, ok := render.image_load_raw(rifle_path)
	testing.expect(t, ok, "Deve carregar o rifle como textura da vitrine")
	defer render.image_free_raw(&raw)

	testing.expect(t, raw.width == 512, "Largura do canvas compartilhado deve ser 512")
	testing.expect(t, raw.height == 768, "Altura do canvas compartilhado deve ser 768")
	testing.expect(t, raw.channels == 4, "Canais RGBA devem ser 4")
}
