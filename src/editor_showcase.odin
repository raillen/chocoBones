package main

import "core:fmt"
import "core:strings"
import "animation"
import "core"
import "mesh"
import "render"
import "rig"
import "ui"

// Carrega o personagem modular Sobrevivente (Frontier Survival) como vitrine principal
editor_load_showcase_survivor :: proc(state: ^AppState) -> bool {
	save_undo(state, "Carregar Vitrine: Sobrevivente")

	// Limpa camadas e texturas anteriores
	for _, &tex in state.layer_textures {
		render.texture_destroy(&tex)
	}
	clear(&state.layer_textures)

	for _, &m in state.layer_meshes {
		mesh.mesh_destroy(&m)
	}
	clear(&state.layer_meshes)

	for _, &pins in state.layer_pins {
		delete(pins)
	}
	clear(&state.layer_pins)
	clear(&state.character_layers)
	clear(&state.character_joints)
	clear(&state.character_pose.joints)
	clear(&state.character_pose.layers)

	SCALE: f32 : 0.58
	OFFSET_X: f32 : 256.0 - 256.0 * SCALE // 107.52
	OFFSET_Y: f32 : 270.0 - 376.0 * SCALE // 51.92

	// Função auxiliar para mapear pivôs do canvas 512x768 para as coordenadas da viewport
	c2v :: proc(cx, cy, scale, ox, oy: f32) -> (f32, f32) {
		return cx * scale + ox, cy * scale + oy
	}

	// Juntas anatômicas alinhadas ao esqueleto do Sobrevivente
	root_x, root_y := c2v(256, 376, SCALE, OFFSET_X, OFFSET_Y)
	head_x, head_y := c2v(256, 190, SCALE, OFFSET_X, OFFSET_Y)
	uar_x, uar_y   := c2v(210, 224, SCALE, OFFSET_X, OFFSET_Y)
	far_x, far_y   := c2v(180, 299, SCALE, OFFSET_X, OFFSET_Y)
	har_x, har_y   := c2v(162, 380, SCALE, OFFSET_X, OFFSET_Y)
	ual_x, ual_y   := c2v(302, 224, SCALE, OFFSET_X, OFFSET_Y)
	fal_x, fal_y   := c2v(332, 299, SCALE, OFFSET_X, OFFSET_Y)
	hal_x, hal_y   := c2v(350, 380, SCALE, OFFSET_X, OFFSET_Y)
	thr_x, thr_y   := c2v(220, 396, SCALE, OFFSET_X, OFFSET_Y)
	shr_x, shr_y   := c2v(218, 524, SCALE, OFFSET_X, OFFSET_Y)
	ftr_x, ftr_y   := c2v(213, 644, SCALE, OFFSET_X, OFFSET_Y)
	thl_x, thl_y   := c2v(292, 396, SCALE, OFFSET_X, OFFSET_Y)
	shl_x, shl_y   := c2v(294, 524, SCALE, OFFSET_X, OFFSET_Y)
	ftl_x, ftl_y   := c2v(299, 644, SCALE, OFFSET_X, OFFSET_Y)

	append(&state.character_joints, rig.Joint{id = "root", name = "Pélvis / Tronco", parent = "", x = root_x, y = root_y, color = "#eab308"})
	append(&state.character_joints, rig.Joint{id = "head", name = "Cabeça", parent = "root", x = head_x, y = head_y, color = "#3b82f6"})
	append(&state.character_joints, rig.Joint{id = "upper_arm_near", name = "Ombro direito", parent = "root", x = uar_x, y = uar_y, color = "#10b981"})
	append(&state.character_joints, rig.Joint{id = "forearm_near", name = "Cotovelo direito", parent = "upper_arm_near", x = far_x, y = far_y, color = "#10b981"})
	append(&state.character_joints, rig.Joint{id = "hand_near", name = "Punho direito", parent = "forearm_near", x = har_x, y = har_y, color = "#10b981"})
	append(&state.character_joints, rig.Joint{id = "upper_arm_far", name = "Ombro esquerdo", parent = "root", x = ual_x, y = ual_y, color = "#6366f1"})
	append(&state.character_joints, rig.Joint{id = "forearm_far", name = "Cotovelo esquerdo", parent = "upper_arm_far", x = fal_x, y = fal_y, color = "#6366f1"})
	append(&state.character_joints, rig.Joint{id = "hand_far", name = "Punho esquerdo", parent = "forearm_far", x = hal_x, y = hal_y, color = "#6366f1"})
	append(&state.character_joints, rig.Joint{id = "thigh_near", name = "Coxa direita", parent = "root", x = thr_x, y = thr_y, color = "#f97316"})
	append(&state.character_joints, rig.Joint{id = "shin_near", name = "Joelho direito", parent = "thigh_near", x = shr_x, y = shr_y, color = "#f97316"})
	append(&state.character_joints, rig.Joint{id = "foot_near", name = "Tornozelo direito", parent = "shin_near", x = ftr_x, y = ftr_y, color = "#f97316"})
	append(&state.character_joints, rig.Joint{id = "thigh_far", name = "Coxa esquerda", parent = "root", x = thl_x, y = thl_y, color = "#ec4899"})
	append(&state.character_joints, rig.Joint{id = "shin_far", name = "Joelho esquerdo", parent = "thigh_far", x = shl_x, y = shl_y, color = "#ec4899"})
	append(&state.character_joints, rig.Joint{id = "foot_far", name = "Tornozelo esquerdo", parent = "shin_far", x = ftl_x, y = ftl_y, color = "#ec4899"})

	// Configuração das partes em ordem Z (de trás para a frente)
	PartSpec :: struct {
		id:         string,
		name:       string,
		file:       string,
		joint:      string,
		pivot_cx:   f32,
		pivot_cy:   f32,
	}

	parts := []PartSpec{
		{id = "backpack",   name = "Mochila",         file = "backpack.png",   joint = "root",           pivot_cx = 256, pivot_cy = 262},
		{id = "thigh_r",    name = "Coxa direita",    file = "thigh_r.png",    joint = "thigh_near",     pivot_cx = 220, pivot_cy = 396},
		{id = "thigh_l",    name = "Coxa esquerda",   file = "thigh_l.png",    joint = "thigh_far",      pivot_cx = 292, pivot_cy = 396},
		{id = "shin_r",     name = "Canela direita",  file = "shin_r.png",     joint = "shin_near",      pivot_cx = 218, pivot_cy = 524},
		{id = "shin_l",     name = "Canela esquerda", file = "shin_l.png",     joint = "shin_far",       pivot_cx = 294, pivot_cy = 524},
		{id = "foot_r",     name = "Bota direita",    file = "foot_r.png",     joint = "foot_near",      pivot_cx = 213, pivot_cy = 644},
		{id = "foot_l",     name = "Bota esquerda",   file = "foot_l.png",     joint = "foot_far",       pivot_cx = 299, pivot_cy = 644},
		{id = "pelvis",     name = "Pélvis / Cinto",  file = "pelvis.png",     joint = "root",           pivot_cx = 256, pivot_cy = 376},
		{id = "forearm_r",  name = "Antebraço dir.",  file = "forearm_r.png",  joint = "forearm_near",   pivot_cx = 180, pivot_cy = 299},
		{id = "forearm_l",  name = "Antebraço esq.",  file = "forearm_l.png",  joint = "forearm_far",    pivot_cx = 332, pivot_cy = 299},
		{id = "upper_arm_r",name = "Braço direito",   file = "upper_arm_r.png",joint = "upper_arm_near", pivot_cx = 210, pivot_cy = 224},
		{id = "upper_arm_l",name = "Braço esquerdo",  file = "upper_arm_l.png",joint = "upper_arm_far",  pivot_cx = 302, pivot_cy = 224},
		{id = "torso",      name = "Tronco / Camisa", file = "torso.png",      joint = "root",           pivot_cx = 256, pivot_cy = 276},
		{id = "vest",       name = "Colete tático",   file = "vest.png",       joint = "root",           pivot_cx = 256, pivot_cy = 276},
		{id = "head",       name = "Cabeça",          file = "head.png",       joint = "head",           pivot_cx = 256, pivot_cy = 190},
		{id = "hand_r",     name = "Mão direita",     file = "hand_r.png",     joint = "hand_near",      pivot_cx = 162, pivot_cy = 380},
		{id = "hand_l",     name = "Mão esquerda",    file = "hand_l.png",     joint = "hand_far",       pivot_cx = 350, pivot_cy = 380},
		{id = "rifle",      name = "Carabina de caça",file = "rifle.png",      joint = "hand_near",      pivot_cx = 350, pivot_cy = 388},
	}

	asset_base_path := "assets/test-kits/frontier-survival/vector-rig/png/"

	for p in parts {
		file_path := fmt.tprintf("%s%s", asset_base_path, p.file)
		tex, ok_tex := render.texture_load_from_file(file_path)
		if !ok_tex {
			// Se falhar o carregamento do arquivo local, cria textura sólida de fallback
			tex = render.texture_create_solid(512, 768, {160, 140, 120, 255})
		}
		state.layer_textures[p.id] = tex

		// Constrói malha deformável de 4x4 vértices para cada peça
		state.layer_meshes[p.id] = mesh.build_grid_mesh(512, 768, 4)
		state.layer_pins[p.id] = make([dynamic]mesh.Pin, 0, 4)

		vx, vy := c2v(p.pivot_cx, p.pivot_cy, SCALE, OFFSET_X, OFFSET_Y)

		layer := rig.Layer{
			id        = p.id,
			name      = p.name,
			asset     = p.file,
			transform = core.Transform{
				pos      = {vx, vy},
				rotation = 0,
				scale    = {SCALE, SCALE},
				pivot    = {p.pivot_cx, p.pivot_cy},
			},
			joint     = p.joint,
			visible   = true,
			locked    = false,
			opacity   = 1.0,
		}
		append(&state.character_layers, layer)
	}

	state.selected_layer_id = "torso"
	state.selected_joint_id = "root"

	// Recarrega o pacote padrão de animações ajustado para o Sobrevivente
	editor_load_default_animation_pack(state)
	state.is_playing = true

	msg := "Vitrine Sobrevivente (Frontier Survival) carregada com 18 camadas!"
	state.status_message = msg
	ui.toast_add(&state.toasts, msg, .Success)
	return true
}

// Carrega o Lobo Selvagem (Quadrúpede) como vitrine
editor_load_showcase_wolf :: proc(state: ^AppState) -> bool {
	save_undo(state, "Carregar Vitrine: Lobo")

	for _, &tex in state.layer_textures do render.texture_destroy(&tex)
	clear(&state.layer_textures)
	for _, &m in state.layer_meshes do mesh.mesh_destroy(&m)
	clear(&state.layer_meshes)
	for _, &pins in state.layer_pins do delete(pins)
	clear(&state.layer_pins)
	clear(&state.character_layers)
	clear(&state.character_joints)
	clear(&state.character_pose.joints)
	clear(&state.character_pose.layers)

	// Aplica preset quadrúpede
	state.character_joints = rig.rig_create_preset(.Quadruped)

	wolf_path := "assets/test-kits/frontier-survival/png/animals/wolf.png"
	tex, ok_tex := render.texture_load_from_file(wolf_path)
	if !ok_tex {
		tex = render.texture_create_solid(256, 180, {110, 115, 125, 255})
	}
	state.layer_textures["wolf"] = tex
	state.layer_meshes["wolf"] = mesh.build_grid_mesh(f32(tex.width), f32(tex.height), 6)
	state.layer_pins["wolf"] = make([dynamic]mesh.Pin, 0, 8)

	append(&state.character_layers, rig.Layer{
		id        = "wolf",
		name      = "Lobo Selvagem",
		asset     = "wolf.png",
		transform = core.Transform{
			pos      = {256, 280},
			rotation = 0,
			scale    = {1.0, 1.0},
			pivot    = {f32(tex.width) * 0.5, f32(tex.height) * 0.5},
		},
		joint     = "root",
		visible   = true,
		locked    = false,
		opacity   = 1.0,
	})

	state.selected_layer_id = "wolf"
	state.selected_joint_id = "root"

	editor_load_default_animation_pack(state)
	state.is_playing = true

	msg := "Vitrine Lobo Selvagem (Quadrúpede) carregada!"
	state.status_message = msg
	ui.toast_add(&state.toasts, msg, .Success)
	return true
}
