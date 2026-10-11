package main

import "core:fmt"
import "core:path/filepath"
import "core:strings"
import im "../libs/odin-imgui"
import "core"
import "mesh"
import "render"
import "rig"
import "ui"

NewProjectMode :: enum {
	SingleImage,
	ModularMultiImage,
	Showcase,
	Empty,
}

NewProjectState :: struct {
	is_open:             bool,
	project_name:        [128]u8,
	mode:                NewProjectMode,
	single_image_path:   string,
	modular_files:       [dynamic]string,
	rig_preset:          rig.RigPreset,
	showcase_selection:  int, // 0 = Sobrevivente, 1 = Lobo
}

new_project_modal_init :: proc(np: ^NewProjectState) {
	np.is_open = false
	np.mode = .SingleImage
	np.rig_preset = .Humanoid
	np.showcase_selection = 0
	np.modular_files = make([dynamic]string, 0, 16)
	default_name := "Novo Personagem"
	copy(np.project_name[:], default_name)
}

new_project_modal_destroy :: proc(np: ^NewProjectState) {
	for f in np.modular_files {
		delete(f)
	}
	delete(np.modular_files)
	if np.single_image_path != "" {
		delete(np.single_image_path)
	}
}

new_project_modal_open :: proc(np: ^NewProjectState) {
	np.is_open = true
	for f in np.modular_files {
		delete(f)
	}
	clear(&np.modular_files)
	if np.single_image_path != "" {
		delete(np.single_image_path)
		np.single_image_path = ""
	}
}

auto_guess_joint_for_layer :: rig.auto_guess_joint_for_layer


import_images_as_layers :: proc(state: ^AppState, file_paths: []string) -> int {
	if len(file_paths) == 0 do return 0

	imported_count := 0
	for path in file_paths {
		tex, ok := render.texture_load_from_file(path)
		if !ok do continue

		base_name := filepath.stem(path)
		new_id := fmt.tprintf("layer_%s_%d", base_name, len(state.character_layers) + 1)
		cloned_id := strings.clone(new_id)

		state.layer_textures[cloned_id] = tex

		m := mesh.build_grid_mesh(f32(tex.width), f32(tex.height), 4)
		state.layer_meshes[cloned_id] = m
		state.layer_pins[cloned_id] = make([dynamic]mesh.Pin, 0, 4)

		target_joint := auto_guess_joint_for_layer(state.character_joints[:], base_name)
		if target_joint == "" && state.selected_joint_id != "" {
			target_joint = state.selected_joint_id
		}

		new_layer := rig.Layer{
			id        = cloned_id,
			name      = strings.clone(base_name),
			asset     = strings.clone(path),
			transform = core.Transform{
				pos      = {256, 256},
				rotation = 0,
				scale    = {1.0, 1.0},
				pivot    = {f32(tex.width) * 0.5, f32(tex.height) * 0.5},
			},
			joint     = target_joint,
			visible   = true,
			locked    = false,
			opacity   = 1.0,
		}

		append(&state.character_layers, new_layer)
		state.selected_layer_id = cloned_id
		imported_count += 1
	}

	if imported_count > 0 {
		save_undo(state, fmt.tprintf("Importar %d Camadas", imported_count))
		ui.toast_add(&state.toasts, fmt.tprintf("%d camadas importadas com sucesso!", imported_count), .Success)
	}
	return imported_count
}

new_project_modal_render :: proc(state: ^AppState) {
	np := &state.new_project
	if !np.is_open do return

	im.OpenPopup("Criar Novo Personagem / Projeto##modal")
	im.SetNextWindowSize({620 * state.editor.ui_scale, 0}, .Appearing)

	if im.BeginPopupModal("Criar Novo Personagem / Projeto##modal", &np.is_open, {.AlwaysAutoResize}) {
		im.Text(ui.ICON_PH_FOLDER_OPEN + " Configuração do Novo Personagem")
		im.TextDisabled("Escolha como deseja iniciar a montagem do seu modelo:")
		im.Separator()

		// Nome
		im.Text("Nome do Personagem:")
		im.SameLine()
		im.InputText("##proj_name_input", cstring(&np.project_name[0]), 128)
		im.Spacing()

		// Modos
		if im.RadioButton("Imagem Única (Sprite)", np.mode == .SingleImage) {
			np.mode = .SingleImage
		}
		im.SameLine()
		if im.RadioButton("Modular (Várias Peças)", np.mode == .ModularMultiImage) {
			np.mode = .ModularMultiImage
		}
		im.SameLine()
		if im.RadioButton("Vitrine Pronta", np.mode == .Showcase) {
			np.mode = .Showcase
		}
		im.SameLine()
		if im.RadioButton("Em Branco", np.mode == .Empty) {
			np.mode = .Empty
		}

		im.Separator()

		switch np.mode {
		case .SingleImage:
			im.TextColored(ui.current_palette.accent, "Modo: Imagem Única")
			im.TextWrapped("Importe uma imagem individual (ex: sprite completo, monstro ou objeto). O esqueleto será posicionado sobre a imagem.")
			im.Spacing()

			if im.Button(ui.ICON_PH_IMAGE + " Selecionar Imagem do Sistema...") {
				if path, ok := ui.open_system_file_dialog("Selecionar Imagem do Personagem", .Open, .Image); ok {
					if np.single_image_path != "" do delete(np.single_image_path)
					np.single_image_path = path
				}
			}

			if np.single_image_path != "" {
				im.SameLine()
				im.TextColored(ui.current_palette.success, "Selecionado: %s", cstring(raw_data(filepath.base(np.single_image_path))))
			} else {
				im.TextDisabled("Nenhuma imagem selecionada ainda (você pode selecionar acima ou importar depois).")
			}

			im.Spacing()
			im.Text("Esqueleto Inicial:")
			im.SameLine()
			preset_name := np.rig_preset == .Humanoid ? "Humanoide (14 juntas)" : (np.rig_preset == .BipedSimple ? "Bípede (8 juntas)" : "Vazio / Sem juntas")
			if im.BeginCombo("##single_preset_combo", cstring(raw_data(preset_name))) {
				if im.Selectable("Humanoide Completo (14 juntas)", np.rig_preset == .Humanoid) do np.rig_preset = .Humanoid
				if im.Selectable("Bípede Simplificado (8 juntas)", np.rig_preset == .BipedSimple) do np.rig_preset = .BipedSimple
				if im.Selectable("Vazio / Sem juntas", np.rig_preset == .Empty) do np.rig_preset = .Empty
				im.EndCombo()
			}

		case .ModularMultiImage:
			im.TextColored(ui.current_palette.accent, "Modo: Personagem Modular")
			im.TextWrapped("Importe várias partes (cabeça, tronco, braços, pernas, etc.) que constituem o personagem. Cada uma vira uma camada.")
			im.Spacing()

			if im.Button(ui.ICON_PH_PLUS + " Selecionar Múltiplas Imagens do Sistema...") {
				paths := ui.open_system_file_dialog_multiple("Selecionar Peças do Personagem", .Image)
				defer delete(paths)
				for p in paths {
					append(&np.modular_files, p)
				}
			}
			im.SameLine()
			if im.Button(ui.ICON_PH_TRASH + " Limpar Lista") {
				for f in np.modular_files do delete(f)
				clear(&np.modular_files)
			}

			im.Spacing()
			im.Text("Peças Selecionadas (%d):", len(np.modular_files))
			if len(np.modular_files) > 0 {
				im.BeginChild("##modular_files_list", {0, 130 * state.editor.ui_scale}, {.Borders})
				to_remove := -1
				for f, idx in np.modular_files {
					im.PushIDInt(i32(idx))
					if im.Button("X") {
						to_remove = idx
					}
					im.SameLine()
					im.Text("%d. %s", idx + 1, cstring(raw_data(filepath.base(f))))
					im.PopID()
				}
				if to_remove >= 0 {
					delete(np.modular_files[to_remove])
					ordered_remove(&np.modular_files, to_remove)
				}
				im.EndChild()
			} else {
				im.TextDisabled("Nenhuma imagem adicionada. Clique acima para selecionar vários arquivos PNG de uma vez.")
			}

			im.Spacing()
			im.Text("Esqueleto Inicial:")
			im.SameLine()
			preset_name := np.rig_preset == .Humanoid ? "Humanoide (14 juntas)" : (np.rig_preset == .BipedSimple ? "Bípede (8 juntas)" : "Vazio")
			if im.BeginCombo("##mod_preset_combo", cstring(raw_data(preset_name))) {
				if im.Selectable("Humanoide Completo (14 juntas)", np.rig_preset == .Humanoid) do np.rig_preset = .Humanoid
				if im.Selectable("Bípede Simplificado (8 juntas)", np.rig_preset == .BipedSimple) do np.rig_preset = .BipedSimple
				if im.Selectable("Vazio / Sem juntas", np.rig_preset == .Empty) do np.rig_preset = .Empty
				im.EndCombo()
			}

		case .Showcase:
			im.TextColored(ui.current_palette.accent, "Modo: Vitrine Pronta de Demonstração")
			im.TextWrapped("Inicie com os conjuntos originais de alta fidelidade do projeto:")
			im.Spacing()
			if im.RadioButton("Sobrevivente da Fronteira (18 camadas com textura real + rifle)", np.showcase_selection == 0) {
				np.showcase_selection = 0
			}
			if im.RadioButton("Lobo Selvagem (Quadrúpede com rig de 14 juntas)", np.showcase_selection == 1) {
				np.showcase_selection = 1
			}

		case .Empty:
			im.TextColored(ui.current_palette.text_muted, "Modo: Projeto em Branco")
			im.TextWrapped("Inicia um projeto vazio sem camadas e sem juntas para criação personalizada do zero.")
		}

		im.Spacing()
		im.Separator()
		im.Spacing()

		if im.Button("Cancelar", {110 * state.editor.ui_scale, 0}) {
			np.is_open = false
		}
		im.SameLine()

		if im.Button(ui.ICON_PH_CHECK + " Criar Projeto", {160 * state.editor.ui_scale, 0}) {
			save_undo(state, "Criar Novo Projeto")
			execute_create_new_project(state, np)
			np.is_open = false
		}

		im.EndPopup()
	}
}

execute_create_new_project :: proc(state: ^AppState, np: ^NewProjectState) {
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

	switch np.mode {
	case .SingleImage:
		state.character_joints = rig.rig_create_preset(np.rig_preset)
		if np.single_image_path != "" {
			import_image_as_layer(state, np.single_image_path)
			if len(state.character_layers) > 0 {
				last_idx := len(state.character_layers) - 1
				layer := &state.character_layers[last_idx]
				if layer.id in state.layer_meshes {
					m := &state.layer_meshes[layer.id]
					mesh.mesh_auto_skin_to_joints(m, layer^, state.character_joints[:])
				}
			}
		}
		editor_load_default_animation_pack(state)
		ui.toast_add(&state.toasts, "Projeto de sprite única criado com deformação esquelética ativa!", .Success)

	case .ModularMultiImage:
		state.character_joints = rig.rig_create_preset(np.rig_preset)
		if len(np.modular_files) > 0 {
			count := import_images_as_layers(state, np.modular_files[:])
			ui.toast_add(&state.toasts, fmt.tprintf("Projeto modular criado com %d partes!", count), .Success)
		} else {
			ui.toast_add(&state.toasts, "Projeto modular criado! Use o painel de camadas para importar peças.", .Info)
		}
		editor_load_default_animation_pack(state)

	case .Showcase:
		if np.showcase_selection == 0 {
			editor_load_showcase_survivor(state)
		} else {
			editor_load_showcase_wolf(state)
		}

	case .Empty:
		editor_load_default_animation_pack(state)
		ui.toast_add(&state.toasts, "Novo projeto em branco inicializado.", .Info)
	}

	state.is_playing = true
}
