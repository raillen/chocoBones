package main

import "core:fmt"
import "core:math"
import "core:mem"
import "core:path/filepath"
import "core:strings"
import gl "vendor:OpenGL"
import sdl "vendor:sdl2"

import im "../libs/odin-imgui"
import "../libs/odin-imgui/imgui_impl_opengl3"
import "../libs/odin-imgui/imgui_impl_sdl2"

import "core"
import "animation"
import "history"
import "mesh"
import "mesh3d"
import "project"
import "render"
import "render/wgpu"
import "rig"
import "ui"

Tool :: ui.Tool
Workspace :: ui.Workspace

ViewportMode :: enum {
	Mode2D,
	Mode3D,
}

AppState :: struct {
	running:                bool,
	active_tool:            Tool,
	current_workspace:      Workspace,
	viewport_mode:          ViewportMode,
	selected_layer_id:      string,
	selected_joint_id:      string,
	timeline_time:          f32,
	timeline_duration:      f32,
	is_playing:             bool,
	ik_enabled:             bool,
	show_demo_window:       bool,
	is_dragging_viewport:   bool,
	drag_joint_id:          string,
	drag_start_pos:         core.Vec2,
	character_joints:       [dynamic]rig.Joint,
	character_layers:       [dynamic]rig.Layer,
	character_pose:         rig.Pose,
	scratch_arena:          core.ArenaContext,
	viewport_fbo:           render.Framebuffer,
	render_batch:           render.RenderBatch,
	seam_mask_renderer:     render.SeamMaskRenderer,
	shader_program:         u32,
	layer_textures:         map[string]render.Texture,
	layer_meshes:           map[string]mesh.Mesh,
	layer_pins:             map[string][dynamic]mesh.Pin,
	pin_deltas:             map[string]core.Vec2,
	selected_pin_id:        string,
	drag_pin_id:            string,
	eraser_radius:          f32,
	weight_brush_radius:    f32,
	weight_brush_strength:  f32,
	current_clip:           animation.Clip,
	animation_clips:        [dynamic]animation.Clip,
	current_clip_index:     int,
	status_message:         string,
	history:                history.History,
	selection:              ui.SelectionState,
	gizmo:                  ui.GizmoState,
	toasts:                 ui.ToastManager,
	editor:                 EditorShellState,
	text_editor:            ui.TextEditorModal,
	file_dialog:            ui.FileDialog,

	// Recursos 3D & WGPU
	active_mesh3d:          mesh3d.Mesh3D,
	has_mesh3d:             bool,
	camera3d:               core.OrbitCamera,
	render3d:               render.Renderer3D,
	wgpu_ctx:               wgpu.WGPUContext,
	show_wireframe_3d:      bool,
	show_grid_3d:           bool,
	model_rotation_y:       f32,
	auto_rotate_3d:         bool,
}

init_app_state :: proc(state: ^AppState) {
	state.running = true
	state.active_tool = .Move
	state.current_workspace = .Assembly
	state.selected_layer_id = "torso"
	state.selected_joint_id = "root"
	state.timeline_time = 0.0
	state.timeline_duration = 2.0
	state.is_playing = false
	state.ik_enabled = true
	state.show_demo_window = false
	state.is_dragging_viewport = false
	state.drag_joint_id = ""

	core.arena_context_init(&state.scratch_arena, 1024 * 1024 * 8) // 8MB scratch
	rig.pose_init(&state.character_pose)

	// Montagem inicial das 14 juntas padrão via predefinição
	state.character_joints = rig.rig_create_preset(.Humanoid)

	// Camadas padrão (Demo autêntica de 6 peças com máscaras de emenda suaves)
	SCALE :: 0.42
	state.character_layers = make([dynamic]rig.Layer, 0, 8)
	append(&state.character_layers, rig.Layer{
		id            = "arm-left",
		name          = "Braço esquerdo",
		asset         = "arm-left",
		transform     = core.Transform{pos = {294, 216}, rotation = 0, scale = {SCALE, SCALE}, pivot = {55, 62}},
		joint         = "upper_arm_far",
		visible       = true,
		opacity       = 1.0,
		has_seam_mask = true,
		seam_mask     = core.SeamMask{layer = "torso", enabled = true, center = {55, 62}, radius = 76, feather = 0.6},
	})
	append(&state.character_layers, rig.Layer{
		id            = "leg-left",
		name          = "Perna esquerda",
		asset         = "leg-left",
		transform     = core.Transform{pos = {278, 302}, rotation = 0, scale = {SCALE, SCALE}, pivot = {49, 37}},
		joint         = "thigh_far",
		visible       = true,
		opacity       = 1.0,
		has_seam_mask = true,
		seam_mask     = core.SeamMask{layer = "torso", enabled = true, center = {49, 37}, radius = 88, feather = 0.6},
	})
	append(&state.character_layers, rig.Layer{
		id            = "leg-right",
		name          = "Perna direita",
		asset         = "leg-right",
		transform     = core.Transform{pos = {239, 302}, rotation = 0, scale = {SCALE, SCALE}, pivot = {104, 37}},
		joint         = "thigh_near",
		visible       = true,
		opacity       = 1.0,
		has_seam_mask = true,
		seam_mask     = core.SeamMask{layer = "torso", enabled = true, center = {104, 37}, radius = 88, feather = 0.6},
	})
	append(&state.character_layers, rig.Layer{
		id            = "torso",
		name          = "Tronco",
		asset         = "torso",
		transform     = core.Transform{pos = {256, 293}, rotation = 0, scale = {SCALE, SCALE}, pivot = {119, 225}},
		joint         = "root",
		visible       = true,
		opacity       = 1.0,
		has_seam_mask = false,
	})
	append(&state.character_layers, rig.Layer{
		id            = "arm-right",
		name          = "Braço direito",
		asset         = "arm-right",
		transform     = core.Transform{pos = {220, 216}, rotation = 0, scale = {SCALE, SCALE}, pivot = {136, 62}},
		joint         = "upper_arm_near",
		visible       = true,
		opacity       = 1.0,
		has_seam_mask = true,
		seam_mask     = core.SeamMask{layer = "torso", enabled = true, center = {136, 62}, radius = 76, feather = 0.6},
	})
	append(&state.character_layers, rig.Layer{
		id            = "head",
		name          = "Região da cabeça",
		asset         = "head",
		transform     = core.Transform{pos = {259, 211}, rotation = 0, scale = {SCALE, SCALE}, pivot = {115, 259}},
		joint         = "head",
		visible       = true,
		opacity       = 1.0,
		has_seam_mask = true,
		seam_mask     = core.SeamMask{layer = "torso", enabled = true, center = {115, 259}, radius = 77, feather = 0.6},
	})

	state.layer_textures = make(map[string]render.Texture, 8)
	state.layer_meshes = make(map[string]mesh.Mesh, 8)
	state.layer_pins = make(map[string][dynamic]mesh.Pin, 8)
	state.pin_deltas = make(map[string]core.Vec2, 16)
	state.selected_pin_id = ""
	state.drag_pin_id = ""
	state.eraser_radius = 24.0
	state.weight_brush_radius = 32.0
	state.weight_brush_strength = 0.25

	// Inicializa subsistemas de UI e Histórico
	history.history_init(&state.history, 50)
	ui.selection_state_init(&state.selection)
	ui.selection_select_layer(&state.selection, "torso", false, false)
	ui.selection_select_joint(&state.selection, "root", false, false)
	ui.gizmo_init(&state.gizmo)
	ui.toast_manager_init(&state.toasts)
	ui.text_editor_modal_init(&state.text_editor)
	ui.file_dialog_init(&state.file_dialog)

	// Grava estado inicial no histórico de Undo
	history.history_push(&state.history, "Criação do Projeto", state.character_joints[:], state.character_layers[:], &state.character_pose)

	// Inicializa biblioteca com pacote de animações padrão e ativa a caminhada
	state.animation_clips = animation.animation_create_default_pack()
	state.current_clip_index = 0
	state.current_clip = animation.clip_clone(&state.animation_clips[0], state.animation_clips[0].id, state.animation_clips[0].name)
	state.timeline_duration = state.current_clip.duration
	state.timeline_time = 0.0
	animation.sample_clip(&state.current_clip, 0.0, &state.character_pose)

	// Inicialização do estado 3D
	state.viewport_mode = .Mode2D
	state.active_mesh3d = mesh3d.create_cube_mesh(1.5)
	state.has_mesh3d = true
	core.orbit_camera_init(&state.camera3d, {0, 0, 0}, 4.0)
	state.show_wireframe_3d = false
	state.show_grid_3d = true
	state.auto_rotate_3d = false
	state.model_rotation_y = 0.0
}


build_limb_mesh :: proc(w, h: f32, j0, j1, j2: string) -> mesh.Mesh {
	m := mesh.build_grid_mesh(w, h, 6)
	m.mode = .Skin
	m.skinning = .DualQuaternion
	for v, i in m.vertices {
		t := v.y / h
		if t < 0.5 {
			w1 := 1.0 - (t / 0.5)
			w2 := t / 0.5
			append(&m.weights[i], mesh.Influence{joint = j0, weight = w1})
			append(&m.weights[i], mesh.Influence{joint = j1, weight = w2})
		} else {
			w1 := 1.0 - ((t - 0.5) / 0.5)
			w2 := (t - 0.5) / 0.5
			append(&m.weights[i], mesh.Influence{joint = j1, weight = w1})
			append(&m.weights[i], mesh.Influence{joint = j2, weight = w2})
		}
	}
	return m
}

init_gpu_resources :: proc(state: ^AppState) {
	// Framebuffer da Viewport (512x512)
	fbo, ok_fbo := render.fbo_create(512, 512)
	if !ok_fbo {
		fmt.eprintln("Falha ao criar Framebuffer da Viewport")
	}
	state.viewport_fbo = fbo

	// Shader program padrão 2D
	program, ok_shader := render.create_shader_program(render.DEFAULT_VERTEX_SHADER, render.DEFAULT_FRAGMENT_SHADER)
	if !ok_shader {
		fmt.eprintln("Falha ao compilar Shader Program 2D")
	}
	state.shader_program = program

	// RenderBatch dinâmico
	render.batch_init(&state.render_batch, program)

	// Carrega as texturas reais de alta fidelidade da demonstração de 6 peças
	ref_path := "custom-char-creator/public/assets/demos/six-piece-rig-v2/reference.png"
	loaded_real := render.load_six_piece_textures(ref_path, &state.layer_textures)
	if !loaded_real {
		// Fallback para texturas sólidas estilizadas
		state.layer_textures["torso"] = render.texture_create_solid(237, 293, {185, 55, 65, 255})
		state.layer_textures["head"] = render.texture_create_solid(234, 309, {240, 200, 165, 255})
		state.layer_textures["arm-right"] = render.texture_create_solid(204, 368, {40, 160, 95, 255})
		state.layer_textures["arm-left"] = render.texture_create_solid(212, 368, {35, 140, 85, 255})
		state.layer_textures["leg-right"] = render.texture_create_solid(161, 430, {45, 100, 175, 255})
		state.layer_textures["leg-left"] = render.texture_create_solid(211, 426, {40, 90, 155, 255})
	}

	// Malhas deformáveis com Dual Quaternion para os 4 membros da demo de 6 peças
	state.layer_meshes["arm-right"] = build_limb_mesh(204, 368, "upper_arm_near", "forearm_near", "hand_near")
	state.layer_meshes["arm-left"]  = build_limb_mesh(212, 368, "upper_arm_far", "forearm_far", "hand_far")
	state.layer_meshes["leg-right"] = build_limb_mesh(161, 430, "thigh_near", "shin_near", "foot_near")
	state.layer_meshes["leg-left"]  = build_limb_mesh(211, 426, "thigh_far", "shin_far", "foot_far")

	// Renderizador de máscaras de emenda em GPU
	ok_seam := render.seam_mask_renderer_init(&state.seam_mask_renderer, 512, 512)
	if !ok_seam {
		fmt.eprintln("Falha ao inicializar SeamMaskRenderer")
	}

	// Renderizador 3D OpenGL
	render.render3d_init(&state.render3d)

	// Inicialização de wgpu-native (WebGPU runtime nativo)
	ctx, wgpu_ok := wgpu.wgpu_context_init()
	if wgpu_ok {
		state.wgpu_ctx = ctx
	}
}

destroy_app_state :: proc(state: ^AppState) {
	animation.clip_destroy(&state.current_clip)
	for &c in state.animation_clips {
		animation.clip_destroy(&c)
	}
	delete(state.animation_clips)

	for _, &m in state.layer_meshes {
		mesh.mesh_destroy(&m)
	}
	delete(state.layer_meshes)

	for _, &tex in state.layer_textures {
		render.texture_destroy(&tex)
	}
	delete(state.layer_textures)

	for _, &pins in state.layer_pins {
		delete(pins)
	}
	delete(state.layer_pins)
	delete(state.pin_deltas)

	ui.toast_manager_destroy(&state.toasts)
	ui.text_editor_modal_destroy(&state.text_editor)
	ui.selection_state_destroy(&state.selection)
	history.history_destroy(&state.history)

	// Limpeza dos recursos 3D & WGPU
	if state.has_mesh3d {
		mesh3d.mesh3d_destroy(&state.active_mesh3d)
	}
	render.render3d_destroy(&state.render3d)
	wgpu.wgpu_context_destroy(&state.wgpu_ctx)

	render.seam_mask_renderer_destroy(&state.seam_mask_renderer)
	render.batch_destroy(&state.render_batch)
	if state.shader_program != 0 do gl.DeleteProgram(state.shader_program)
	render.fbo_destroy(&state.viewport_fbo)

	delete(state.character_joints)
	delete(state.character_layers)
	rig.pose_destroy(&state.character_pose)
	core.arena_context_destroy(&state.scratch_arena)
}

trigger_undo :: proc(state: ^AppState) {
	desc, ok := history.history_undo(&state.history, &state.character_joints, &state.character_layers, &state.character_pose)
	if ok {
		msg := fmt.tprintf("Desfeito: %s", desc)
		state.status_message = msg
		ui.toast_add(&state.toasts, msg, .Info)
	} else {
		ui.toast_add(&state.toasts, "Nada para desfazer", .Warning)
	}
}

trigger_redo :: proc(state: ^AppState) {
	desc, ok := history.history_redo(&state.history, &state.character_joints, &state.character_layers, &state.character_pose)
	if ok {
		msg := fmt.tprintf("Refeito: %s", desc)
		state.status_message = msg
		ui.toast_add(&state.toasts, msg, .Info)
	} else {
		ui.toast_add(&state.toasts, "Nada para refazer", .Warning)
	}
}

save_undo :: proc(state: ^AppState, description: string) {
	history.history_push(&state.history, description, state.character_joints[:], state.character_layers[:], &state.character_pose)
}

editor_apply_rig_preset :: proc(state: ^AppState, preset: rig.RigPreset) {
	save_undo(state, "Carregar Predefinição de Esqueleto")
	clear(&state.character_joints)
	new_joints := rig.rig_create_preset(preset)
	defer delete(new_joints)
	for j in new_joints {
		append(&state.character_joints, rig.Joint{
			id     = strings.clone(j.id),
			name   = strings.clone(j.name),
			parent = strings.clone(j.parent),
			x      = j.x,
			y      = j.y,
			color  = strings.clone(j.color),
		})
	}
	clear(&state.character_pose.joints)
	state.selected_joint_id = len(state.character_joints) > 0 ? state.character_joints[0].id : ""
	state.status_message = "Predefinição de esqueleto aplicada."
	ui.toast_add(&state.toasts, "Esqueleto atualizado", .Success)
}

editor_switch_clip :: proc(state: ^AppState, index: int) {
	if index < 0 || index >= len(state.animation_clips) do return

	if state.current_clip_index >= 0 && state.current_clip_index < len(state.animation_clips) {
		animation.clip_destroy(&state.animation_clips[state.current_clip_index])
		state.animation_clips[state.current_clip_index] = animation.clip_clone(&state.current_clip, state.current_clip.id, state.current_clip.name)
	}

	animation.clip_destroy(&state.current_clip)
	state.current_clip_index = index
	target := &state.animation_clips[index]
	state.current_clip = animation.clip_clone(target, target.id, target.name)
	state.timeline_duration = state.current_clip.duration
	state.timeline_time = 0.0
	animation.sample_clip(&state.current_clip, 0.0, &state.character_pose)
	state.status_message = fmt.tprintf("Clipe ativo: %s (%.1fs)", state.current_clip.name, state.current_clip.duration)
}

editor_add_new_clip :: proc(state: ^AppState, name: string = "") {
	new_name := name != "" ? name : fmt.tprintf("Clipe %d", len(state.animation_clips) + 1)
	new_id := fmt.tprintf("clip_%d", len(state.animation_clips) + 1)
	new_c: animation.Clip
	animation.clip_init(&new_c, strings.clone(new_id), strings.clone(new_name), 2.0, 60.0, true)

	k0: animation.Keyframe
	animation.keyframe_init(&k0)
	k0.time = 0.0
	k0.easing = .Smooth
	for j_id, j_delta in state.character_pose.joints {
		k0.joints[j_id] = j_delta
	}
	append(&new_c.frames, k0)

	append(&state.animation_clips, new_c)
	editor_switch_clip(state, len(state.animation_clips) - 1)
	ui.toast_add(&state.toasts, fmt.tprintf("Novo clipe criado: %s", new_name), .Success)
}

editor_load_default_animation_pack :: proc(state: ^AppState) {
	for &c in state.animation_clips {
		animation.clip_destroy(&c)
	}
	clear(&state.animation_clips)
	state.animation_clips = animation.animation_create_default_pack()
	state.current_clip_index = 0
	animation.clip_destroy(&state.current_clip)
	state.current_clip = animation.clip_clone(&state.animation_clips[0], state.animation_clips[0].id, state.animation_clips[0].name)
	state.timeline_duration = state.current_clip.duration
	state.timeline_time = 0.0
	animation.sample_clip(&state.current_clip, 0.0, &state.character_pose)
	ui.toast_add(&state.toasts, "Pacote padrão (5 clipes) carregado!", .Success)
}

import_image_as_layer :: proc(state: ^AppState, file_path: string) -> bool {
	tex, ok := render.texture_load_from_file(file_path)
	if !ok {
		ui.toast_add(&state.toasts, fmt.tprintf("Falha ao carregar imagem: %s", file_path), .Error)
		return false
	}

	base_name := filepath.stem(file_path)
	new_id := fmt.tprintf("layer_%s_%d", base_name, len(state.character_layers) + 1)
	cloned_id := strings.clone(new_id)

	state.layer_textures[cloned_id] = tex

	m := mesh.build_grid_mesh(f32(tex.width), f32(tex.height), 6)
	state.layer_meshes[cloned_id] = m
	state.layer_pins[cloned_id] = make([dynamic]mesh.Pin, 0, 8)

	joint_target := state.selected_joint_id

	new_layer := rig.Layer{
		id        = cloned_id,
		name      = strings.clone(base_name),
		asset     = strings.clone(file_path),
		transform = core.Transform{
			pos      = {256, 256},
			rotation = 0,
			scale    = {1.0, 1.0},
			pivot    = {f32(tex.width) * 0.5, f32(tex.height) * 0.5},
		},
		joint     = joint_target,
		visible   = true,
		locked    = false,
		opacity   = 1.0,
	}

	append(&state.character_layers, new_layer)
	state.selected_layer_id = cloned_id

	save_undo(state, fmt.tprintf("Importar Imagem %s", base_name))
	ui.toast_add(&state.toasts, fmt.tprintf("Imagem importada: %s (%dx%d)", base_name, tex.width, tex.height), .Success)
	state.status_message = fmt.tprintf("Camada %s importada.", base_name)
	return true
}

init_window_and_gl :: proc() -> (window: ^sdl.Window, gl_ctx: sdl.GLContext, ok: bool) {
	if sdl.Init(sdl.INIT_VIDEO | sdl.INIT_EVENTS) != 0 {
		fmt.eprintln("Falha ao inicializar SDL2:", sdl.GetError())
		return nil, nil, false
	}

	sdl.GL_SetAttribute(.CONTEXT_FLAGS, i32(sdl.GLcontextFlag.FORWARD_COMPATIBLE_FLAG))
	sdl.GL_SetAttribute(.CONTEXT_PROFILE_MASK, i32(sdl.GLprofile.CORE))
	sdl.GL_SetAttribute(.CONTEXT_MAJOR_VERSION, 3)
	sdl.GL_SetAttribute(.CONTEXT_MINOR_VERSION, 3)
	sdl.GL_SetAttribute(.DOUBLEBUFFER, 1)
	sdl.GL_SetAttribute(.DEPTH_SIZE, 24)
	sdl.GL_SetAttribute(.STENCIL_SIZE, 8)

	window = sdl.CreateWindow(
		"ChocoBones — 2D Puppet Studio & Engine",
		sdl.WINDOWPOS_CENTERED,
		sdl.WINDOWPOS_CENTERED,
		1440,
		900,
		{.OPENGL, .RESIZABLE, .ALLOW_HIGHDPI},
	)
	if window == nil {
		fmt.eprintln("Falha ao criar janela SDL2:", sdl.GetError())
		sdl.Quit()
		return nil, nil, false
	}

	gl_ctx = sdl.GL_CreateContext(window)
	if gl_ctx == nil {
		fmt.eprintln("Falha ao criar contexto OpenGL:", sdl.GetError())
		sdl.DestroyWindow(window)
		sdl.Quit()
		return nil, nil, false
	}

	sdl.GL_MakeCurrent(window, gl_ctx)
	sdl.GL_SetSwapInterval(1) // VSync

	gl.load_up_to(3, 3, proc(p: rawptr, name: cstring) {
		(cast(^rawptr)p)^ = sdl.GL_GetProcAddress(name)
	})

	return window, gl_ctx, true
}

shutdown_window_and_gl :: proc(window: ^sdl.Window, gl_ctx: sdl.GLContext) {
	sdl.GL_DeleteContext(gl_ctx)
	sdl.DestroyWindow(window)
	sdl.Quit()
}

save_current_project :: proc(state: ^AppState, filename: string) -> bool {
	p := project.Project{
		schema  = "survivor-puppet",
		version = 1,
		name    = "ChocoBones Native Project",
		width   = 512,
		height  = 512,
		assets  = make([dynamic]project.ProjectAsset, state.scratch_arena.allocator),
		joints  = make([dynamic]project.ProjectJoint, state.scratch_arena.allocator),
		layers  = make([dynamic]project.ProjectLayer, state.scratch_arena.allocator),
	}
	for j in state.character_joints {
		append(&p.joints, project.ProjectJoint{
			id     = j.id,
			name   = j.name,
			parent = j.parent,
			x      = j.x,
			y      = j.y,
			color  = j.color,
		})
	}
	for l in state.character_layers {
		pl := project.ProjectLayer{
			id        = l.id,
			name      = l.name,
			asset     = l.asset,
			transform = project.ProjectTransform{
				x        = l.transform.pos.x,
				y        = l.transform.pos.y,
				rotation = l.transform.rotation,
				sx       = l.transform.scale.x,
				sy       = l.transform.scale.y,
				px       = l.transform.pivot.x,
				py       = l.transform.pivot.y,
			},
			joint     = l.joint,
			visible   = l.visible,
			locked    = l.locked,
			opacity   = l.opacity,
			blend     = "source-over",
		}
		if l.has_seam_mask && l.seam_mask.enabled {
			pl.seamMask = project.ProjectSeamMask{
				layer   = l.seam_mask.layer,
				enabled = l.seam_mask.enabled,
				center  = project.ProjectVec2{l.seam_mask.center.x, l.seam_mask.center.y},
				radius  = l.seam_mask.radius,
				feather = l.seam_mask.feather,
			}
		}
		append(&p.layers, pl)
	}
	return project.save_project_to_file(filename, &p)
}

load_project_file :: proc(state: ^AppState, filename: string) -> bool {
	loaded, ok := project.load_project_from_file(filename, state.scratch_arena.allocator)
	if !ok do return false

	clear(&state.character_joints)
	for j in loaded.joints {
		append(&state.character_joints, rig.Joint{
			id     = j.id,
			name   = j.name,
			parent = j.parent,
			x      = j.x,
			y      = j.y,
			color  = j.color,
		})
	}
	clear(&state.character_layers)
	for l in loaded.layers {
		rl := rig.Layer{
			id        = l.id,
			name      = l.name,
			asset     = l.asset,
			transform = core.Transform{
				pos      = {l.transform.x, l.transform.y},
				rotation = l.transform.rotation,
				scale    = {l.transform.sx, l.transform.sy},
				pivot    = {l.transform.px, l.transform.py},
			},
			joint     = l.joint,
			visible   = l.visible,
			locked    = l.locked,
			opacity   = l.opacity,
		}
		if l.seamMask.enabled {
			rl.has_seam_mask = true
			rl.seam_mask = core.SeamMask{
				layer   = l.seamMask.layer,
				enabled = l.seamMask.enabled,
				center  = {l.seamMask.center.x, l.seamMask.center.y},
				radius  = l.seamMask.radius,
				feather = l.seamMask.feather,
			}
		}
		append(&state.character_layers, rl)
	}
	return true
}

render_main_menu :: proc(state: ^AppState) {
	if im.BeginMenu(ui.ICON_PH_FOLDER + " Arquivo") {
		if im.MenuItem(ui.ICON_PH_FILE_PLUS + " Novo Projeto Vazio") {
			save_undo(state, "Novo Projeto Vazio")
			clear(&state.character_joints)
			clear(&state.character_layers)
			clear(&state.character_pose.joints)
			clear(&state.character_pose.layers)
			state.status_message = "Novo projeto vazio inicializado."
			ui.toast_add(&state.toasts, "Novo projeto vazio criado", .Info)
		}

		if im.MenuItem(ui.ICON_PH_FOLDER_OPEN + " Abrir Projeto (Diálogo)...", "Ctrl+O") {
			ui.file_dialog_open(&state.file_dialog, .OpenFile, "chocobones_project.puppet.json")
		}

		if im.MenuItem(ui.ICON_PH_IMAGE + " Importar Imagem 2D (.png, .jpg)...", "Ctrl+I") {
			ui.file_dialog_open(&state.file_dialog, .OpenFile, "imagem.png")
		}

		if im.MenuItem(ui.ICON_PH_CUBE + " Importar Modelo 3D (.obj, .gltf, .glb)...") {
			ui.file_dialog_open(&state.file_dialog, .OpenFile, "modelo.glb")
		}

		if im.MenuItem(ui.ICON_PH_FLOPPY_DISK + " Salvar Projeto", "Ctrl+S") {
			if save_current_project(state, "chocobones_project.puppet.json") {
				state.status_message = "Projeto salvo com sucesso (gravação atômica)!"
				ui.toast_add(&state.toasts, "Projeto salvo com sucesso!", .Success)
			} else {
				state.status_message = "Erro ao salvar arquivo de projeto."
				ui.toast_add(&state.toasts, "Falha ao salvar projeto", .Error)
			}
		}

		if im.MenuItem(ui.ICON_PH_FLOPPY_DISK_BACK + " Salvar Como...") {
			ui.file_dialog_open(&state.file_dialog, .SaveFile, "chocobones_project.puppet.json")
		}

		im.Separator()
		if im.MenuItem(ui.ICON_PH_IMAGE + " Exportar Pose Atual · PNG") do editor_export_pose(state)
		if im.MenuItem(ui.ICON_PH_FILM_STRIP + " Exportar Spritesheet · PNG") do editor_export_spritesheet(state)

		im.Separator()
		if im.MenuItem(ui.ICON_PH_X + " Sair") {
			state.running = false
		}
		im.EndMenu()
	}

	if im.BeginMenu(ui.ICON_PH_CURSOR + " Editar") {
		can_undo := history.history_can_undo(&state.history)
		can_redo := history.history_can_redo(&state.history)
		if im.MenuItem(ui.ICON_PH_ARROW_U_UP_LEFT + " Desfazer", "Ctrl+Z", false, can_undo) {
			trigger_undo(state)
		}
		if im.MenuItem(ui.ICON_PH_ARROW_U_UP_RIGHT + " Refazer", "Ctrl+Y", false, can_redo) {
			trigger_redo(state)
		}
		im.Separator()
		if im.MenuItem(ui.ICON_PH_BOUNDING_BOX + " Selecionar Tudo", "Ctrl+A") {
			for l in state.character_layers {
				ui.selection_select_layer(&state.selection, l.id, true, false)
			}
			for j in state.character_joints {
				ui.selection_select_joint(&state.selection, j.id, true, false)
			}
			ui.toast_add(&state.toasts, "Todos os elementos selecionados", .Info)
		}
		if im.MenuItem(ui.ICON_PH_X + " Limpar Seleção", "Esc") {
			ui.selection_clear(&state.selection)
			ui.toast_add(&state.toasts, "Seleção limpa", .Info)
		}
		im.Separator()
		if im.BeginMenu(ui.ICON_PH_TREE_STRUCTURE + " Predefinições de Esqueleto") {
			if im.MenuItem("Humanoide Completo (14 juntas)") do editor_apply_rig_preset(state, .Humanoid)
			if im.MenuItem("Bípede Simplificado (8 juntas)") do editor_apply_rig_preset(state, .BipedSimple)
			if im.MenuItem("Quadrúpede (14 juntas)") do editor_apply_rig_preset(state, .Quadruped)
			if im.MenuItem("Prop / Acessório (2 juntas)") do editor_apply_rig_preset(state, .Prop)
			im.Separator()
			if im.MenuItem("Limpar / Esqueleto Vazio") do editor_apply_rig_preset(state, .Empty)
			im.EndMenu()
		}
		im.EndMenu()
	}

	editor_render_view_menu(state)

	if im.BeginMenu(ui.ICON_PH_QUESTION + " Ajuda") {
		if im.MenuItem(ui.ICON_PH_CODE + " Inspecionar JSON do Projeto...") {
			json_str := `{\n  "schema": "survivor-puppet",\n  "version": 1,\n  "name": "ChocoBones Native Project"\n}`
			ui.text_editor_modal_open(&state.text_editor, "Código JSON do Projeto", json_str)
		}
		if im.MenuItem(ui.ICON_PH_SLIDERS_HORIZONTAL + " Demonstração ImGui", nil, state.show_demo_window) {
			state.show_demo_window = !state.show_demo_window
		}
		im.Separator()
		im.EndMenu()
	}

}

render_viewport_panel :: proc(state: ^AppState) {
	im.PushStyleColorImVec4(.WindowBg, ui.current_palette.stage_bg)
	defer im.PopStyleColor()
	if im.Begin(editor_panel_name(state, .Stage), nil, {.NoScrollbar, .NoScrollWithMouse}) {
		io := im.GetIO()

		// Área de visualização do personagem
		available_pos := im.GetCursorScreenPos()
		avail := im.GetContentRegionAvail()
		canvas := ui.fit_canvas(available_pos, avail)
		if canvas.size.x <= 0 || canvas.size.y <= 0 {
			im.End()
			return
		}
		display_w, display_h := canvas.size.x, canvas.size.y
		scale_factor := display_w / 512.0
		cursor_pos := canvas.pos
		im.SetCursorScreenPos(cursor_pos)

		// Renderiza a textura da viewport gerada pelo Framebuffer OpenGL
		// ATENÇÃO: uv0 = {0, 1} e uv1 = {1, 0} para desinverter a orientação vertical do OpenGL FBO
		tex_ref := im.TextureRef{_TexID = cast(im.TextureID)uintptr(state.viewport_fbo.texture)}
		im.Image(tex_ref, im.Vec2{display_w, display_h}, {0, 1}, {1, 0})

		draw_list := im.GetWindowDrawList()
		// The rendered scene stays dark in both editor themes. Derive overlay
		// contrast for that scene while keeping the user's accent as its source.
		scene_background := im.Vec4{0.12, 0.13, 0.16, 1}
		canvas_accent := ui.color_u32(ui.contrast_color(ui.current_palette.accent, scene_background, 3))
		canvas_focus := ui.color_u32(ui.contrast_color(ui.current_palette.focus, scene_background, 3))
		canvas_text := ui.color_u32(ui.contrast_color(ui.current_palette.text, scene_background, 4.5))
		bones := rig.bone_matrices(state.character_joints[:], &state.character_pose, state.scratch_arena.allocator)

		mouse_pos := io.MousePos

		// Input and overlays share the exact fitted image rectangle.
		scene_point, point_inside := ui.screen_to_scene(canvas, mouse_pos)
		scene_mx, scene_my := scene_point.x, scene_point.y
		mouse_in_canvas := point_inside && im.IsItemHovered()

		if state.viewport_mode == .Mode3D {
			if mouse_in_canvas {
				// Zoom da câmera com a roda do mouse
				if io.MouseWheel != 0 {
					state.camera3d.distance -= io.MouseWheel * 0.5
					if state.camera3d.distance < 0.5 do state.camera3d.distance = 0.5
					if state.camera3d.distance > 50.0 do state.camera3d.distance = 50.0
				}

				// Rotação orbital com botão direito ou esquerdo
				if im.IsMouseDragging(.Right) || im.IsMouseDragging(.Left) {
					delta := io.MouseDelta
					state.camera3d.yaw += delta.x * 0.01
					state.camera3d.pitch += delta.y * 0.01
					state.camera3d.pitch = clamp(state.camera3d.pitch, -math.PI * 0.48, math.PI * 0.48)
				}

				// Pan com botão do meio ou Shift + arrastar
				if im.IsMouseDragging(.Middle) || (io.KeyShift && (im.IsMouseDragging(.Right) || im.IsMouseDragging(.Left))) {
					delta := io.MouseDelta
					pan_speed: f32 = state.camera3d.distance * 0.002
					state.camera3d.target.x -= delta.x * pan_speed
					state.camera3d.target.y += delta.y * pan_speed
				}
			}

			// Overlay informativo de status 3D sobre o canvas
			overlay_txt := fmt.tprintf("Modelo 3D: %s | %d Vértices | %d Faces | %s",
				state.active_mesh3d.name,
				len(state.active_mesh3d.vertices),
				len(state.active_mesh3d.indices) / 3,
				state.active_mesh3d.has_skinning ? "Rig glTF Ativo" : "Malha Estática")
			im.DrawList_AddText(draw_list, {cursor_pos.x + 12, cursor_pos.y + display_h - 28}, canvas_text, cstring(raw_data(overlay_txt)))

			hint_txt := "Arrastar Mouse: Orbitar | Roda: Zoom | Botão Meio / Shift+Drag: Pan"
			im.DrawList_AddText(draw_list, {cursor_pos.x + 12, cursor_pos.y + 12}, canvas_text, cstring(raw_data(hint_txt)))

			im.End()
			return
		}

		mouse_vec := core.Vec2{mouse_pos.x, mouse_pos.y}

		// Hit-test das juntas (clique direto na junta com suporte a multi-seleção via Ctrl)
		hovered_joint_id := ""
		for j in state.character_joints {
			mat_j := bones[j.id]
			j_pos := core.mat_apply(mat_j, {0, 0})
			sx := cursor_pos.x + (j_pos.x / 512.0) * display_w
			sy := cursor_pos.y + (j_pos.y / 512.0) * display_h
			dist_to_mouse := math.sqrt((mouse_pos.x - sx) * (mouse_pos.x - sx) + (mouse_pos.y - sy) * (mouse_pos.y - sy))
			if dist_to_mouse <= 8.0 {
				hovered_joint_id = j.id
				break
			}
		}

		if im.IsMouseClicked(.Left) && mouse_in_canvas {
			save_undo(state, fmt.tprintf("Ação na Viewport: %v", state.active_tool))
			state.is_dragging_viewport = true
			state.drag_start_pos = {scene_mx, scene_my}

			if hovered_joint_id != "" {
				state.selected_joint_id = hovered_joint_id
				state.drag_joint_id = hovered_joint_id
				ui.selection_select_joint(&state.selection, hovered_joint_id, io.KeyShift, io.KeyCtrl)
			} else if state.active_tool == .BoxSelect {
				state.selection.is_box_selecting = true
				state.selection.box_start = {scene_mx, scene_my}
				state.selection.box_end = {scene_mx, scene_my}
			} else if state.active_tool == .LassoSelect {
				state.selection.is_lasso_selecting = true
				clear(&state.selection.lasso_points)
				append(&state.selection.lasso_points, core.Vec2{scene_mx, scene_my})
			} else if state.active_tool == .Pin {
				// Criação ou seleção de pino MLS
				if state.selected_layer_id != "" {
					if layer, ok_l := find_layer_by_id(state.character_layers[:], state.selected_layer_id); ok_l {
						dims := get_layer_dimensions(layer.id)
						if layer.id not_in state.layer_meshes {
							state.layer_meshes[layer.id] = mesh.build_grid_mesh(dims.x, dims.y, 6)
						}
						l_mat := rig.layer_matrix(layer, state.character_joints[:], &state.character_pose, bones)
						inv_mat := core.mat_inverse(l_mat)
						local_pt := core.mat_apply(inv_mat, {scene_mx, scene_my})
						// Checa se clicou em pino existente
						clicked_pin := false
						if layer.id in state.layer_pins {
							for &p in state.layer_pins[layer.id] {
								if core.vec2_dist(local_pt, {p.x, p.y}) < 15.0 {
									state.selected_pin_id = p.id
									state.drag_pin_id = p.id
									clicked_pin = true
									break
								}
							}
						}
						if !clicked_pin && local_pt.x >= 0 && local_pt.x <= dims.x && local_pt.y >= 0 && local_pt.y <= dims.y {
							if layer.id not_in state.layer_pins {
								state.layer_pins[layer.id] = make([dynamic]mesh.Pin, 0, 8)
							}
							new_pin_id := fmt.tprintf("pin_%d", len(state.layer_pins[layer.id]) + 1)
							new_pin := mesh.Pin{
								id     = new_pin_id,
								name   = new_pin_id,
								x      = local_pt.x,
								y      = local_pt.y,
								locked = false,
							}
							append(&state.layer_pins[layer.id], new_pin)
							state.selected_pin_id = new_pin_id
							state.drag_pin_id = new_pin_id
							ui.toast_add(&state.toasts, fmt.tprintf("Novo Pino MLS adicionado em %s", layer.name), .Success)
						}
					}
				}
			}
		}

		// Manipulação do mouse na Viewport
		if state.is_dragging_viewport && (state.gizmo.active_part == .None || state.gizmo.active_part == .Body) {
			delta := core.Vec2{scene_mx - state.drag_start_pos.x, scene_my - state.drag_start_pos.y}

			#partial switch state.active_tool {
			case .BoxSelect:
				state.selection.box_end = {scene_mx, scene_my}

			case .LassoSelect:
				append(&state.selection.lasso_points, core.Vec2{scene_mx, scene_my})

			case .Pin:
				if state.drag_pin_id != "" && state.selected_layer_id in state.layer_pins {
					for &p in state.layer_pins[state.selected_layer_id] {
						if p.id == state.drag_pin_id {
							if layer, ok_l := find_layer_by_id(state.character_layers[:], state.selected_layer_id); ok_l {
								l_mat := rig.layer_matrix(layer, state.character_joints[:], &state.character_pose, bones)
								inv_mat := core.mat_inverse(l_mat)
								local_pt := core.mat_apply(inv_mat, {scene_mx, scene_my})
								p.x = local_pt.x
								p.y = local_pt.y
							}
							break
						}
					}
				}

			case .Eraser:
				// Apaga triângulos sob o pincel da borracha
				if state.selected_layer_id != "" && state.selected_layer_id in state.layer_meshes {
					m_ptr := &state.layer_meshes[state.selected_layer_id]
					if layer, ok_l := find_layer_by_id(state.character_layers[:], state.selected_layer_id); ok_l {
						l_mat := rig.layer_matrix(layer, state.character_joints[:], &state.character_pose, bones)
						inv_mat := core.mat_inverse(l_mat)
						local_pt := core.mat_apply(inv_mat, {scene_mx, scene_my})
						r_local := state.eraser_radius / math.max(layer.transform.scale.x, 0.01)
						for tri, idx in m_ptr.triangles {
							v0 := m_ptr.vertices[tri[0]]
							v1 := m_ptr.vertices[tri[1]]
							v2 := m_ptr.vertices[tri[2]]
							center_tri := core.Vec2{(v0.x + v1.x + v2.x) / 3.0, (v0.y + v1.y + v2.y) / 3.0}
							if core.vec2_dist(local_pt, center_tri) <= r_local {
								already := false
								for er in m_ptr.erased {
									if er == u32(idx) {
										already = true
										break
									}
								}
								if !already {
									append(&m_ptr.erased, u32(idx))
								}
							}
						}
					}
				}

			case .Weight:
				// Pinta pesos na junta selecionada
				if state.selected_layer_id != "" && state.selected_layer_id in state.layer_meshes && state.selected_joint_id != "" {
					m_ptr := &state.layer_meshes[state.selected_layer_id]
					if layer, ok_l := find_layer_by_id(state.character_layers[:], state.selected_layer_id); ok_l {
						l_mat := rig.layer_matrix(layer, state.character_joints[:], &state.character_pose, bones)
						inv_mat := core.mat_inverse(l_mat)
						local_pt := core.mat_apply(inv_mat, {scene_mx, scene_my})
						r_local := state.weight_brush_radius / math.max(layer.transform.scale.x, 0.01)
							for v, i in m_ptr.vertices {
								if core.vec2_dist(local_pt, v) <= r_local {
									found := false
									for &inf in m_ptr.weights[i] {
										if inf.joint == state.selected_joint_id {
											inf.weight = core.clamp(inf.weight + state.weight_brush_strength, 0.0, 1.0)
											found = true
											break
										}
									}
									if !found {
										append(&m_ptr.weights[i], mesh.Influence{joint = state.selected_joint_id, weight = state.weight_brush_strength})
									}
									sum: f32 = 0
									for inf in m_ptr.weights[i] do sum += inf.weight
									if sum > 1e-5 {
										for &inf in m_ptr.weights[i] do inf.weight /= sum
									}
								}
							}
						}
					}

			case .Pose:
				if state.drag_joint_id != "" {
					is_ik_tip := (state.drag_joint_id == "hand_near" || state.drag_joint_id == "hand_far" ||
					              state.drag_joint_id == "foot_near" || state.drag_joint_id == "foot_far")
					if is_ik_tip && state.ik_enabled {
						rig.solve_ik(state.character_joints[:], &state.character_pose, state.drag_joint_id, {scene_mx, scene_my}, 1.0)
					} else {
						if j_drag, ok_jd := rig.find_joint(state.character_joints[:], state.drag_joint_id); ok_jd {
							mat_jd := bones[j_drag.id]
							origin_jd := core.mat_apply(mat_jd, {0, 0})
							ang := math.atan2(scene_my - origin_jd.y, scene_mx - origin_jd.x)
							state.character_pose.joints[j_drag.id] = rig.JointDelta{angle = ang, x = 0, y = 0}
						}
					}
				}

			case .Move:
				for &l in state.character_layers {
					if l.id == state.selected_layer_id || ui.selection_is_layer_selected(&state.selection, l.id) {
						l.transform.pos.x += delta.x
						l.transform.pos.y += delta.y
					}
				}
				state.drag_start_pos = {scene_mx, scene_my}

			case .Rotate:
				for &l in state.character_layers {
					if l.id == state.selected_layer_id || ui.selection_is_layer_selected(&state.selection, l.id) {
						l.transform.rotation += delta.x * 0.02
					}
				}
				state.drag_start_pos = {scene_mx, scene_my}

			case .Scale:
				for &l in state.character_layers {
					if l.id == state.selected_layer_id || ui.selection_is_layer_selected(&state.selection, l.id) {
						s_delta := delta.x * 0.005
						l.transform.scale.x = core.clamp(l.transform.scale.x + s_delta, 0.05, 5.0)
						l.transform.scale.y = core.clamp(l.transform.scale.y + s_delta, 0.05, 5.0)
					}
				}
				state.drag_start_pos = {scene_mx, scene_my}

			case .Pivot:
				for &l in state.character_layers {
					if l.id == state.selected_layer_id {
						l.transform.pivot.x += delta.x
						l.transform.pivot.y += delta.y
					}
				}
				state.drag_start_pos = {scene_mx, scene_my}

			case .Joint:
				for &j in state.character_joints {
					if j.id == state.selected_joint_id || ui.selection_is_joint_selected(&state.selection, j.id) {
						j.x += delta.x
						j.y += delta.y
					}
				}
				state.drag_start_pos = {scene_mx, scene_my}
			}
		}

		// Conclusão de seleção ao soltar o mouse
		if !im.IsMouseDown(.Left) && state.is_dragging_viewport {
			state.is_dragging_viewport = false
			state.drag_joint_id = ""
			state.drag_pin_id = ""

			if state.selection.is_box_selecting {
				state.selection.is_box_selecting = false
				count := 0
				for j in state.character_joints {
					mat_j := bones[j.id]
					j_pos := core.mat_apply(mat_j, {0, 0})
					if ui.point_in_box(j_pos, state.selection.box_start, state.selection.box_end) {
						ui.selection_select_joint(&state.selection, j.id, true, false)
						count += 1
					}
				}
				for l in state.character_layers {
					if ui.point_in_box(l.transform.pos, state.selection.box_start, state.selection.box_end) {
						ui.selection_select_layer(&state.selection, l.id, true, false)
						count += 1
					}
				}
				ui.toast_add(&state.toasts, fmt.tprintf("Seleção em caixa: %d itens selecionados", count), .Info)
			}

			if state.selection.is_lasso_selecting {
				state.selection.is_lasso_selecting = false
				count := 0
				if len(state.selection.lasso_points) >= 3 {
					for j in state.character_joints {
						mat_j := bones[j.id]
						j_pos := core.mat_apply(mat_j, {0, 0})
						if ui.point_in_polygon(j_pos, state.selection.lasso_points[:]) {
							ui.selection_select_joint(&state.selection, j.id, true, false)
							count += 1
						}
					}
					for l in state.character_layers {
						if ui.point_in_polygon(l.transform.pos, state.selection.lasso_points[:]) {
							ui.selection_select_layer(&state.selection, l.id, true, false)
							count += 1
						}
					}
				}
				clear(&state.selection.lasso_points)
				ui.toast_add(&state.toasts, fmt.tprintf("Seleção em laço: %d itens selecionados", count), .Info)
			}
		}

		// 1. Linhas dos ossos conectando juntas pai aos filhos
		for j in state.character_joints {
			if j.parent != "" {
				pj, ok_p := rig.find_joint(state.character_joints[:], j.parent)
				if ok_p {
					mat_c := bones[j.id]
					mat_p := bones[pj.id]
					c_pos := core.mat_apply(mat_c, {0, 0})
					p_pos := core.mat_apply(mat_p, {0, 0})

					sx1 := cursor_pos.x + (p_pos.x / 512.0) * display_w
					sy1 := cursor_pos.y + (p_pos.y / 512.0) * display_h
					sx2 := cursor_pos.x + (c_pos.x / 512.0) * display_w
					sy2 := cursor_pos.y + (c_pos.y / 512.0) * display_h

					im.DrawList_AddLine(draw_list, {sx1, sy1}, {sx2, sy2}, 0xaa_ff_d7_00, 2.5)
				}
			}
		}

		// 2. Gizmo 2D interativo profissional para a camada selecionada
		if state.selected_layer_id != "" {
			if sel_layer, ok_l := find_layer_by_id(state.character_layers[:], state.selected_layer_id); ok_l {
				dims := get_layer_dimensions(sel_layer.id)
				bounds := ui.calculate_gizmo_bounds(
					sel_layer,
					dims,
					state.character_joints[:],
					&state.character_pose,
					bones,
					{cursor_pos.x, cursor_pos.y},
					scale_factor,
				)

				part, is_active_gizmo := ui.draw_and_interact_gizmo(
					draw_list,
					bounds,
					mouse_vec,
					im.IsMouseDown(.Left) && ui.tool_supports_gizmo(state.active_tool),
					im.IsMouseClicked(.Left) && mouse_in_canvas && ui.tool_supports_gizmo(state.active_tool),
					&state.gizmo,
				)

				if is_active_gizmo {
					#partial switch part {
					case .RotateHandle:
						piv_screen := bounds.pivot_pos
						cur_ang := math.atan2(mouse_pos.y - piv_screen.y, mouse_pos.x - piv_screen.x)
						start_ang := math.atan2(state.gizmo.drag_start_mouse.y - piv_screen.y, state.gizmo.drag_start_mouse.x - piv_screen.x)
						delta_rot := cur_ang - start_ang
						for &l in state.character_layers {
							if l.id == state.selected_layer_id || ui.selection_is_layer_selected(&state.selection, l.id) {
								l.transform.rotation += delta_rot
							}
						}
						state.gizmo.drag_start_mouse = mouse_vec

					case .ScaleTL, .ScaleTR, .ScaleBR, .ScaleBL:
						d_mouse := core.vec2_dist(mouse_vec, bounds.center)
						d_start := core.vec2_dist(state.gizmo.drag_start_mouse, bounds.center)
						if d_start > 1e-4 {
							factor := d_mouse / d_start
							for &l in state.character_layers {
								if l.id == state.selected_layer_id || ui.selection_is_layer_selected(&state.selection, l.id) {
									l.transform.scale.x = core.clamp(l.transform.scale.x * factor, 0.05, 5.0)
									l.transform.scale.y = core.clamp(l.transform.scale.y * factor, 0.05, 5.0)
								}
							}
						}
						state.gizmo.drag_start_mouse = mouse_vec

					case .PivotHandle:
						l_mat := rig.layer_matrix(sel_layer, state.character_joints[:], &state.character_pose, bones)
						inv_mat := core.mat_inverse(l_mat)
						local_piv := core.mat_apply(inv_mat, {scene_mx, scene_my})
						for &l in state.character_layers {
							if l.id == state.selected_layer_id {
								l.transform.pivot = local_piv
							}
						}

					case .Body:
						// The active tool already handles body drags above; applying
						// this delta again would move the layer twice per pointer step.
						state.gizmo.drag_start_mouse = mouse_vec
					}
				}
			}
		}

		// 3. Renderização visual dos Pinos MLS na camada selecionada
		if state.selected_layer_id != "" && state.selected_layer_id in state.layer_pins {
			if layer, ok_l := find_layer_by_id(state.character_layers[:], state.selected_layer_id); ok_l {
				l_mat := rig.layer_matrix(layer, state.character_joints[:], &state.character_pose, bones)
				for p in state.layer_pins[state.selected_layer_id] {
					world_p := core.mat_apply(l_mat, {p.x, p.y})
					sp := im.Vec2{cursor_pos.x + (world_p.x / 512.0) * display_w, cursor_pos.y + (world_p.y / 512.0) * display_h}
					pin_col := p.id == state.selected_pin_id ? canvas_focus : canvas_accent
					im.DrawList_AddCircleFilled(draw_list, sp, 6.0 * state.editor.ui_scale, pin_col)
					im.DrawList_AddCircle(draw_list, sp, 6.0 * state.editor.ui_scale, canvas_text, 16, 1.5)
					im.DrawList_AddText(draw_list, {sp.x + 8, sp.y - 6}, canvas_text, cstring(raw_data(p.id)))
				}
			}
		}

		// 4. Desenho de seleção em caixa (Marquee)
		if state.selection.is_box_selecting {
			bx0 := cursor_pos.x + (state.selection.box_start.x / 512.0) * display_w
			by0 := cursor_pos.y + (state.selection.box_start.y / 512.0) * display_h
			bx1 := cursor_pos.x + (state.selection.box_end.x / 512.0) * display_w
			by1 := cursor_pos.y + (state.selection.box_end.y / 512.0) * display_h
			min_p := im.Vec2{math.min(bx0, bx1), math.min(by0, by1)}
			max_p := im.Vec2{math.max(bx0, bx1), math.max(by0, by1)}
			marquee_fill := ui.current_palette.accent
			marquee_fill.w = 0.16
			im.DrawList_AddRectFilled(draw_list, min_p, max_p, ui.color_u32(marquee_fill))
			im.DrawList_AddRect(draw_list, min_p, max_p, canvas_accent, 0.0, 1.5)
		}

		// 5. Desenho de seleção em laço (Lasso)
		if state.selection.is_lasso_selecting && len(state.selection.lasso_points) > 1 {
			for i in 0 ..< len(state.selection.lasso_points) - 1 {
				pt0 := state.selection.lasso_points[i]
				pt1 := state.selection.lasso_points[i + 1]
				p0 := im.Vec2{cursor_pos.x + (pt0.x / 512.0) * display_w, cursor_pos.y + (pt0.y / 512.0) * display_h}
				p1 := im.Vec2{cursor_pos.x + (pt1.x / 512.0) * display_w, cursor_pos.y + (pt1.y / 512.0) * display_h}
				im.DrawList_AddLine(draw_list, p0, p1, canvas_accent, 2.0)
			}
		}

		// 6. Círculo do pincel da borracha e pintura de pesos
		if mouse_in_canvas {
			if state.active_tool == .Eraser {
				r_screen := (state.eraser_radius / 512.0) * display_w
				im.DrawList_AddCircle(draw_list, mouse_pos, r_screen, canvas_accent, 24, 1.5)
			} else if state.active_tool == .Weight {
				r_screen := (state.weight_brush_radius / 512.0) * display_w
				im.DrawList_AddCircle(draw_list, mouse_pos, r_screen, canvas_accent, 24, 1.5)
			}
		}

		// 7. Círculos de juntas com interação de clique e seleção múltipla
		for j in state.character_joints {
			mat_j := bones[j.id]
			j_pos := core.mat_apply(mat_j, {0, 0})
			sx := cursor_pos.x + (j_pos.x / 512.0) * display_w
			sy := cursor_pos.y + (j_pos.y / 512.0) * display_h

			is_selected := (j.id == state.selected_joint_id || ui.selection_is_joint_selected(&state.selection, j.id))
			radius: f32 = (is_selected ? 7.0 : 5.0) * state.editor.ui_scale
			color := is_selected ? canvas_focus : canvas_accent

			dist_to_mouse := math.sqrt((mouse_pos.x - sx) * (mouse_pos.x - sx) + (mouse_pos.y - sy) * (mouse_pos.y - sy))
			if dist_to_mouse <= radius + 3.0 {
				color = canvas_text
			}

			im.DrawList_AddCircleFilled(draw_list, {sx, sy}, radius, color)
			if is_selected {
				im.DrawList_AddCircle(draw_list, {sx, sy}, radius + 3.0, canvas_focus, 16, 1.5)
			}
		}

	}
	im.End()
}

render_inspector_panel :: proc(state: ^AppState) {
	visible := &state.editor.preferences.panels[int(state.current_workspace)].inspector
	if !visible^ do return
	if im.Begin(editor_panel_name(state, .Inspector), visible) {
		if state.viewport_mode == .Mode3D {
			if im.CollapsingHeader(ui.ICON_PH_CUBE + " Modelo 3D", {.DefaultOpen}) {
				name_cstr := fmt.ctprintf("%s", state.active_mesh3d.name)
				im.Text("Modelo: %s", name_cstr)
				im.Text("Vértices: %d | Faces: %d", len(state.active_mesh3d.vertices), len(state.active_mesh3d.indices) / 3)

				dim_x := state.active_mesh3d.aabb_max.x - state.active_mesh3d.aabb_min.x
				dim_y := state.active_mesh3d.aabb_max.y - state.active_mesh3d.aabb_min.y
				dim_z := state.active_mesh3d.aabb_max.z - state.active_mesh3d.aabb_min.z
				im.Text("Dimensões: %.2f x %.2f x %.2f", dim_x, dim_y, dim_z)
				im.Text("Esqueleto: %s", state.active_mesh3d.has_skinning ? "Sim" : "Não")

				im.Separator()
				im.Text("Câmera Orbital:")
				editor_slider_float("Distância", &state.camera3d.distance, 1.0, 20.0)
				editor_slider_float("Yaw (Azimute)", &state.camera3d.yaw, -math.PI, math.PI)
				editor_slider_float("Pitch (Elevação)", &state.camera3d.pitch, -math.PI * 0.48, math.PI * 0.48)
				if im.Button(ui.ICON_PH_ARROWS_COUNTER_CLOCKWISE + " Resetar Câmera") {
					core.orbit_camera_init(&state.camera3d, {0, 0, 0}, 4.0)
				}

				im.Separator()
				im.Text("Transformação do Modelo:")
				editor_slider_float("Rotação Y", &state.model_rotation_y, 0.0, math.PI * 2.0)
				ui.Toggle("##auto_rot", &state.auto_rotate_3d)
				im.SameLine()
				im.Text("Auto-Girar Modelo")

				im.Separator()
				ui.Toggle("##wireframe_toggle", &state.show_wireframe_3d)
				im.SameLine()
				im.Text("Exibir Wireframe")

				ui.Toggle("##grid_toggle", &state.show_grid_3d)
				im.SameLine()
				im.Text("Exibir Grid de Chão")
			}
		} else {
			if im.CollapsingHeader(ui.ICON_PH_CURSOR + " Elemento selecionado", state.current_workspace == .Assembly ? im.TreeNodeFlags{.DefaultOpen} : im.TreeNodeFlags{}) {
				im.Text("Camada Ativa: %s", cstring(raw_data(state.selected_layer_id)))
				im.Text("Junta Vinculada: %s", cstring(raw_data(state.selected_joint_id)))
				im.Separator()

			for &layer in state.character_layers {
				if layer.id == state.selected_layer_id {
					editor_drag_float2("Posição (X, Y)", &layer.transform.pos, 1.0)

					im.Text("Rotação")
					ui.Knob("##layer_rot_knob", &layer.transform.rotation, -math.PI, math.PI, 20.0 * state.editor.ui_scale)
					im.SameLine()
					editor_slider_value("##rot_slider", &layer.transform.rotation, -math.PI, math.PI)

					editor_drag_float2("Escala (X, Y)", &layer.transform.scale, 0.01, 0.1, 10.0)
					editor_slider_float("Opacidade", &layer.opacity, 0.0, 1.0)
					editor_drag_float2("Pivô Local (PX, PY)", &layer.transform.pivot, 1.0)

					if layer.has_seam_mask {
						im.Separator()
						im.TextColored(ui.current_palette.text_muted, "Emenda suave")
						ui.Toggle("##seam_toggle", &layer.seam_mask.enabled)
						im.SameLine()
						im.Text("Ativar Emenda Suave")

						im.Text("Peça de cobertura: %s", cstring(raw_data(layer.seam_mask.layer)))
						editor_drag_float2("Centro Local (X, Y)", &layer.seam_mask.center, 1.0)
						editor_drag_float("Raio de Influência", &layer.seam_mask.radius, 1.0, 1.0, 300.0)
						editor_slider_float("Suavidade", &layer.seam_mask.feather, 0.0, 20.0)
					}
				}
			}
		}

		if im.CollapsingHeader(ui.ICON_PH_SELECTION + " Malha e deformação", state.current_workspace == .Rig ? im.TreeNodeFlags{.DefaultOpen} : im.TreeNodeFlags{}) {
			im.TextColored(ui.current_palette.text_muted, "Deformação da malha")

			// Controles de Pinos MLS
			pin_count := 0
			if state.selected_layer_id in state.layer_pins {
				pin_count = len(state.layer_pins[state.selected_layer_id])
			}
			im.Text("Pinos na camada: %d", pin_count)
			if im.Button(ui.ICON_PH_PUSH_PIN + " Adicionar Pino Central") {
				if state.selected_layer_id != "" {
					dims := get_layer_dimensions(state.selected_layer_id)
					if state.selected_layer_id not_in state.layer_pins {
						state.layer_pins[state.selected_layer_id] = make([dynamic]mesh.Pin, 0, 8)
					}
					new_id := fmt.tprintf("pin_%d", pin_count + 1)
					append(&state.layer_pins[state.selected_layer_id], mesh.Pin{
						id     = new_id,
						name   = new_id,
						x      = dims.x * 0.5,
						y      = dims.y * 0.5,
						locked = false,
					})
					state.selected_pin_id = new_id
					ui.toast_add(&state.toasts, "Pino central criado", .Success)
				}
			}
			if im.GetContentRegionAvail().x > 320 * state.editor.ui_scale do im.SameLine()
			if im.Button(ui.ICON_PH_TRASH + " Limpar Pinos") {
				if state.selected_layer_id in state.layer_pins {
					clear(&state.layer_pins[state.selected_layer_id])
					ui.toast_add(&state.toasts, "Pinos da camada limpos", .Info)
				}
			}

			im.Separator()
			// Controles de Borracha e Corte
			im.Text("Borracha")
			editor_slider_float("Raio da Borracha", &state.eraser_radius, 5.0, 100.0, "%.1f px")
			if im.Button(ui.ICON_PH_ARROWS_COUNTER_CLOCKWISE + " Restaurar Cortes da Malha") {
				if state.selected_layer_id in state.layer_meshes {
					m_ptr := &state.layer_meshes[state.selected_layer_id]
					clear(&m_ptr.erased)
					ui.toast_add(&state.toasts, "Triângulos apagados restaurados", .Success)
				}
			}

			im.Separator()
			// Controles de Pintura de Pesos
			im.Text("Pesos do esqueleto")
			editor_slider_float("Raio do Pincel", &state.weight_brush_radius, 5.0, 150.0, "%.1f px")
			editor_slider_float("Intensidade", &state.weight_brush_strength, 0.05, 1.0, "%.2f")
		}

		if state.selected_joint_id != "" {
			j_idx := rig.joint_find_index(state.character_joints[:], state.selected_joint_id)
			if j_idx >= 0 {
				if im.CollapsingHeader(ui.ICON_PH_TREE_STRUCTURE + " Propriedades da Junta", {.DefaultOpen}) {
					curr_j := &state.character_joints[j_idx]

					name_buf: [128]u8
					copy(name_buf[:], curr_j.name)
					im.Text("Nome:")
					im.SameLine()
					im.SetNextItemWidth(-1)
					if im.InputText("##joint_name_input", cstring(&name_buf[0]), 128) {
						curr_j.name = strings.clone_from_cstring(cstring(&name_buf[0]))
					}

					im.TextDisabled("ID: %s", cstring(raw_data(curr_j.id)))

					pos: [2]f32 = {curr_j.x, curr_j.y}
					if im.DragFloat2("Repouso X, Y", &pos, 1.0, 0, 512, "%.1f") {
						curr_j.x = pos.x
						curr_j.y = pos.y
					}

					im.Text("Pai:")
					im.SameLine()
					parent_label := curr_j.parent == "" ? "<Raiz / Nenhum>" : curr_j.parent
					if im.BeginCombo("##joint_parent_combo", cstring(raw_data(parent_label))) {
						if im.Selectable("<Raiz / Nenhum>", curr_j.parent == "") {
							rig.joint_set_parent(&state.character_joints, curr_j.id, "")
						}
						for other in state.character_joints {
							if other.id == curr_j.id do continue
							if rig.joint_is_descendant(state.character_joints[:], other.id, curr_j.id) do continue
							other_label := fmt.tprintf("%s (%s)", other.name, other.id)
							if im.Selectable(cstring(raw_data(other_label)), other.id == curr_j.parent) {
								rig.joint_set_parent(&state.character_joints, curr_j.id, other.id)
							}
						}
						im.EndCombo()
					}

					if im.Button(ui.ICON_PH_TRASH + " Excluir Junta") {
						target_del := curr_j.id
						if rig.joint_remove(&state.character_joints, target_del) {
							state.selected_joint_id = len(state.character_joints) > 0 ? state.character_joints[0].id : ""
							save_undo(state, "Excluir Junta")
							ui.toast_add(&state.toasts, "Junta excluída", .Info)
						}
					}
					im.Separator()
				}
			}
		}

		if state.selected_layer_id != "" {
			for &l in state.character_layers {
				if l.id == state.selected_layer_id {
					if im.CollapsingHeader(ui.ICON_PH_STACK + " Vínculo da Camada", {.DefaultOpen}) {
						im.TextDisabled("Camada: %s", cstring(raw_data(l.name)))
						im.Text("Vincular ao Osso:")
						im.SameLine()
						current_joint_lbl := l.joint == "" ? "<Nenhum / Desvinculado>" : l.joint
						if im.BeginCombo("##layer_joint_combo", cstring(raw_data(current_joint_lbl))) {
							if im.Selectable("<Nenhum / Desvinculado>", l.joint == "") {
								l.joint = ""
								save_undo(state, "Desvincular Camada")
							}
							for j in state.character_joints {
								j_lbl := fmt.tprintf("%s (%s)", j.name, j.id)
								if im.Selectable(cstring(raw_data(j_lbl)), j.id == l.joint) {
									l.joint = j.id
									save_undo(state, "Vincular Camada a Junta")
								}
							}
							im.EndCombo()
						}
						im.Separator()
					}
					break
				}
			}
		}

		if im.CollapsingHeader(ui.ICON_PH_PERSON_ARMS_SPREAD + " Pose", state.current_workspace == .Rig || state.current_workspace == .Animate ? im.TreeNodeFlags{.DefaultOpen} : im.TreeNodeFlags{}) {
			ui.Toggle("##ik_active_toggle", &state.ik_enabled)
			im.SameLine()
			im.Text("IK Ativo para Membros")

			if d, ok := state.character_pose.joints[state.selected_joint_id]; ok {
				delta := d
				im.Text("Rotação da junta")
				knob_changed := ui.Knob("##joint_rot_knob", &delta.angle, -math.PI, math.PI, 20.0 * state.editor.ui_scale)
				im.SameLine()
				slider_changed := editor_slider_value("##j_rot_slider", &delta.angle, -math.PI, math.PI)
				if knob_changed || slider_changed {
					state.character_pose.joints[state.selected_joint_id] = delta
				}
			} else {
				delta := rig.JOINT_DELTA_ZERO
				im.Text("Rotação da junta")
				knob_changed := ui.Knob("##joint_rot_knob", &delta.angle, -math.PI, math.PI, 20.0 * state.editor.ui_scale)
				im.SameLine()
				slider_changed := editor_slider_value("##j_rot_slider", &delta.angle, -math.PI, math.PI)
				if knob_changed || slider_changed {
					state.character_pose.joints[state.selected_joint_id] = delta
				}
			}

			if im.Button(ui.ICON_PH_ARROWS_COUNTER_CLOCKWISE + " Resetar Pose para o Repouso") {
				clear(&state.character_pose.joints)
				clear(&state.character_pose.layers)
			}
		}

		}
	}
	im.End()
}

render_layers_panel :: proc(state: ^AppState) {
	visible := &state.editor.preferences.panels[int(state.current_workspace)].layers
	if !visible^ do return
	if im.Begin(editor_panel_name(state, .Layers), visible) {
		if im.Button(ui.ICON_PH_PLUS + " Importar Imagem") {
			ui.file_dialog_open(&state.file_dialog, .OpenFile, "sprite.png")
		}
		im.Separator()

		io := im.GetIO()
		layer_to_delete := ""
		for &layer in state.character_layers {
			im.PushID(cstring(raw_data(layer.id)))
			vis_icon: cstring = layer.visible ? ui.ICON_PH_EYE : ui.ICON_PH_EYE_SLASH
			if editor_icon_button(vis_icon, layer.visible ? "Ocultar camada" : "Mostrar camada", size = {22 * state.editor.ui_scale, 22 * state.editor.ui_scale}) {
				layer.visible = !layer.visible
			}
			im.SameLine()
			is_sel := (layer.id == state.selected_layer_id || ui.selection_is_layer_selected(&state.selection, layer.id))
			if im.Selectable(cstring(raw_data(layer.name)), is_sel) {
				state.selected_layer_id = layer.id
				ui.selection_select_layer(&state.selection, layer.id, io.KeyShift, io.KeyCtrl)
			}

			if im.BeginPopupContextItem("##layer_ctx") {
				im.TextDisabled("Camada: %s", cstring(raw_data(layer.name)))
				im.Separator()
				if im.MenuItem(ui.ICON_PH_TRASH + " Excluir Camada") {
					layer_to_delete = layer.id
				}
				im.EndPopup()
			}
			im.PopID()
		}

		if layer_to_delete != "" {
			for l, idx in state.character_layers {
				if l.id == layer_to_delete {
					ordered_remove(&state.character_layers, idx)
					if state.selected_layer_id == layer_to_delete {
						state.selected_layer_id = len(state.character_layers) > 0 ? state.character_layers[0].id : ""
					}
					save_undo(state, "Excluir Camada")
					ui.toast_add(&state.toasts, "Camada removida", .Info)
					break
				}
			}
		}
	}
	im.End()
}

render_timeline_panel :: proc(state: ^AppState) {
	visible := &state.editor.preferences.panels[int(state.current_workspace)].timeline
	if !visible^ do return
	if im.Begin(editor_panel_name(state, .Timeline), visible) {
		available_width := im.GetContentRegionAvail().x
		compact := available_width < 560 * state.editor.ui_scale
		if compact {
			// Large text in a short timeline keeps icon actions on one row.
			im.PushStyleVarImVec2(.FramePadding, {6 * state.editor.ui_scale, 0})
		}

		// Seletor de Clipe Ativo
		current_clip_name := state.current_clip.name
		clip_combo_w := math.max(120 * state.editor.ui_scale, math.min(220 * state.editor.ui_scale, available_width * 0.28))
		im.SetNextItemWidth(clip_combo_w)
		if im.BeginCombo("##active_clip", cstring(raw_data(current_clip_name))) {
			for c, idx in state.animation_clips {
				clip_lbl := fmt.tprintf("%s (%.1fs)", c.name, c.duration)
				if im.Selectable(cstring(raw_data(clip_lbl)), idx == state.current_clip_index) {
					editor_switch_clip(state, idx)
				}
			}
			im.Separator()
			if im.Selectable(ui.ICON_PH_PLUS + " Novo Clipe...") {
				editor_add_new_clip(state)
			}
			if im.Selectable(ui.ICON_PH_FOLDER_OPEN + " Recarregar Pacote Padrão...") {
				editor_load_default_animation_pack(state)
			}
			im.EndCombo()
		}
		im.SameLine()

		play_label: cstring = state.is_playing ? ui.ICON_PH_PAUSE : ui.ICON_PH_PLAY
		if editor_icon_button(play_label, state.is_playing ? "Pausar" : "Reproduzir") do state.is_playing = !state.is_playing
		im.SameLine()
		if editor_icon_button(ui.ICON_PH_SKIP_BACK, "Primeiro quadro") {
			state.timeline_time = 0
			animation.sample_clip(&state.current_clip, 0, &state.character_pose)
		}
		im.SameLine()
		time_width := 150 * state.editor.ui_scale
		if compact {
			button_width := im.CalcTextSize(play_label).x + 2 * im.GetStyle().FramePadding.x
			time_width = math.min(time_width, math.max(70 * state.editor.ui_scale, available_width - 4 * button_width - clip_combo_w - 6 * im.GetStyle().ItemSpacing.x))
		}
		if editor_slider_value("##time", &state.timeline_time, 0, state.timeline_duration, "%.2f s", time_width) {
			animation.sample_clip(&state.current_clip, state.timeline_time, &state.character_pose)
		}
		im.SameLine()
		record_pressed := compact ? editor_icon_button(ui.ICON_PH_DIAMOND, "Gravar keyframe") : im.Button(ui.ICON_PH_DIAMOND + " Gravar")
		if record_pressed {
			animation.clip_add_or_update_keyframe(&state.current_clip, state.timeline_time, &state.character_pose, .Smooth)
			state.status_message = "Keyframe gravado."
		}
		im.SameLine()
		if editor_icon_button(ui.ICON_PH_TRASH, "Remover keyframe mais próximo") {
			ok_rem := animation.clip_remove_nearest_keyframe(&state.current_clip, state.timeline_time)
			state.status_message = ok_rem ? "Keyframe removido." : "Nenhum keyframe próximo."
		}
		if !compact && available_width > 760 * state.editor.ui_scale {
			im.SameLine()
			im.TextDisabled("%d / %d · 60 FPS · %d chaves", int(state.timeline_time * 60), int(state.timeline_duration * 60), len(state.current_clip.frames))
		}
		im.Separator()
		editor_render_timeline_ruler(state)
		if compact do im.PopStyleVar()
	}
	im.End()
}


get_layer_dimensions :: proc(id: string) -> [2]f32 {
	switch id {
	case "torso":     return {237, 293}
	case "head":      return {234, 309}
	case "arm-right": return {204, 368}
	case "arm-left":  return {212, 368}
	case "leg-right": return {161, 430}
	case "leg-left":  return {211, 426}
	case:             return {100, 100}
	}
}

find_layer_by_id :: proc(layers: []rig.Layer, id: string) -> (rig.Layer, bool) {
	for l in layers {
		if l.id == id do return l, true
	}
	return {}, false
}

get_layer_visual :: proc(state: ^AppState, layer: rig.Layer) -> render.LayerVisual {
	dims := get_layer_dimensions(layer.id)
	tex := state.layer_textures[layer.id]
	w := tex.width > 0 ? f32(tex.width) : dims.x
	h := tex.height > 0 ? f32(tex.height) : dims.y
	deform_ptr: ^mesh.Mesh = nil
	if layer.id in state.layer_meshes {
		deform_ptr = &state.layer_meshes[layer.id]
	}
	pins_slice: []mesh.Pin = nil
	if layer.id in state.layer_pins {
		pins_slice = state.layer_pins[layer.id][:]
	}
	return render.LayerVisual{
		layer       = layer,
		texture_id  = tex.id,
		width       = w,
		height      = h,
		deform_mesh = deform_ptr,
		pins        = pins_slice,
	}
}

render_character_to_fbo :: proc(state: ^AppState) {
	render.fbo_bind(&state.viewport_fbo)
	gl.ClearColor(0.12, 0.13, 0.16, 1.0)
	gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

	ortho := render.ortho_projection(0, 512, 512, 0, -1, 1)
	render.batch_begin(&state.render_batch, &ortho)

	bones := rig.bone_matrices(state.character_joints[:], &state.character_pose, state.scratch_arena.allocator)

	for layer in state.character_layers {
		if !layer.visible || layer.opacity <= 0 do continue

		visual := get_layer_visual(state, layer)

		// Máscara de emenda (Seam Mask) em GPU multi-pass
		if layer.has_seam_mask && layer.seam_mask.enabled && layer.seam_mask.layer != "" {
			if cover_layer, ok_cover := find_layer_by_id(state.character_layers[:], layer.seam_mask.layer); ok_cover {
				cover_visual := get_layer_visual(state, cover_layer)

				render.batch_flush(&state.render_batch)
				render.seam_mask_render_layer(
					&state.seam_mask_renderer,
					&state.render_batch,
					visual,
					cover_visual,
					state.character_joints[:],
					&state.character_pose,
					bones,
					layer.seam_mask.center,
					layer.seam_mask.radius,
					layer.seam_mask.feather,
					&state.viewport_fbo,
					512, 512,
					state.scratch_arena.allocator,
				)
				render.batch_begin(&state.render_batch, &ortho)
				continue
			}
		}

		render.render_layer(
			&state.render_batch,
			visual,
			state.character_joints[:],
			&state.character_pose,
			bones,
			{1, 1, 1, 1},
			state.scratch_arena.allocator,
		)
	}

	render.batch_end(&state.render_batch)
}

render_3d_scene_to_fbo :: proc(state: ^AppState) {
	render.fbo_bind(&state.viewport_fbo)
	gl.ClearColor(0.12, 0.13, 0.16, 1.0)
	gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

	if state.auto_rotate_3d {
		state.model_rotation_y += 0.015
		if state.model_rotation_y > math.PI * 2.0 {
			state.model_rotation_y -= math.PI * 2.0
		}
	}

	fov := f32(math.to_radians(f32(50.0)))
	aspect: f32 = 1.0 // FBO 512x512
	proj := core.mat4_perspective(fov, aspect, 0.1, 100.0)
	view := core.orbit_camera_view_matrix(&state.camera3d)
	cam_pos := core.orbit_camera_eye_pos(&state.camera3d)

	if state.show_grid_3d {
		render.render3d_draw_grid(&state.render3d, view, proj)
	}

	if state.has_mesh3d {
		model := core.mat4_rotate_y(state.model_rotation_y)
		render.render3d_draw_mesh(&state.render3d, &state.active_mesh3d, model, view, proj, cam_pos, {0.85, 0.85, 0.9, 1.0}, false)
		if state.show_wireframe_3d {
			render.render3d_draw_mesh(&state.render3d, &state.active_mesh3d, model, view, proj, cam_pos, {0.3, 0.7, 1.0, 0.9}, true)
		}
	}
}

render_viewport_scene :: proc(state: ^AppState) {
	if state.viewport_mode == .Mode2D {
		render_character_to_fbo(state)
	} else {
		render_3d_scene_to_fbo(state)
	}
}


main :: proc() {
	window, gl_ctx, ok := init_window_and_gl()
	if !ok do return
	defer shutdown_window_and_gl(window, gl_ctx)

	state: AppState
	init_app_state(&state)
	defer destroy_app_state(&state)

	init_gpu_resources(&state)

	im.CHECKVERSION()
	im.CreateContext()
	defer im.DestroyContext()

	io := im.GetIO()
	io.ConfigFlags += {.NavEnableKeyboard, .DockingEnable}

	editor_init(&state)
	defer editor_destroy(&state)

	imgui_impl_sdl2.InitForOpenGL(window, gl_ctx)
	defer imgui_impl_sdl2.Shutdown()

	imgui_impl_opengl3.Init("#version 330")
	defer imgui_impl_opengl3.Shutdown()

	for state.running {
		event: sdl.Event
		for sdl.PollEvent(&event) {
			imgui_impl_sdl2.ProcessEvent(&event)
			#partial switch event.type {
			case .QUIT:
				state.running = false
			case .DROPFILE:
				dropped_path := string(cstring(event.drop.file))
				ext := strings.to_lower(filepath.ext(dropped_path), context.temp_allocator)
				if ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".bmp" || ext == ".tga" {
					import_image_as_layer(&state, dropped_path)
				} else if ext == ".obj" || ext == ".gltf" || ext == ".glb" {
					new_mesh, ok := mesh3d.load_mesh3d_from_file(dropped_path)
					if ok {
						if state.has_mesh3d do mesh3d.mesh3d_destroy(&state.active_mesh3d)
						state.active_mesh3d = new_mesh
						state.has_mesh3d = true
						state.viewport_mode = .Mode3D
						core.orbit_camera_init(&state.camera3d, {0, 0, 0}, 4.0)
						ui.toast_add(&state.toasts, fmt.tprintf("Modelo 3D importado: %s", new_mesh.name), .Success)
					}
				} else if ext == ".json" || strings.has_suffix(dropped_path, ".puppet.json") {
					if load_project_file(&state, dropped_path) {
						ui.toast_add(&state.toasts, fmt.tprintf("Projeto carregado: %s", dropped_path), .Success)
					}
				}
				sdl.free(rawptr(event.drop.file))
			}
		}

		// Limpa a arena scratch no início do quadro para novos cálculos
		core.arena_context_reset(&state.scratch_arena)

		if state.is_playing {
			state.timeline_time += 1.0 / 60.0
			if state.timeline_time > state.timeline_duration {
				state.timeline_time = 0.0
			}
			animation.sample_clip(&state.current_clip, state.timeline_time, &state.character_pose)
		}

		// Renderiza a cena da viewport no FBO (2D ou 3D)
		render_viewport_scene(&state)

		display_w, display_h: i32
		sdl.GL_GetDrawableSize(window, &display_w, &display_h)
		render.fbo_unbind(display_w, display_h)

		if state.editor.appearance_dirty {
			ui.apply_theme(state.editor.preferences.appearance, state.editor.ui_scale)
			state.editor.appearance_dirty = false
		}
		imgui_impl_opengl3.NewFrame()
		imgui_impl_sdl2.NewFrame()
		im.NewFrame()

		// Atalhos globais de teclado
		if !editor_keyboard_blocked(&state) {
			if io.KeyCtrl && im.IsKeyPressed(.Z) && !io.KeyShift {
				trigger_undo(&state)
			}
			if io.KeyCtrl && (im.IsKeyPressed(.Y) || (io.KeyShift && im.IsKeyPressed(.Z))) {
				trigger_redo(&state)
			}
			if io.KeyCtrl && im.IsKeyPressed(.S) {
				if save_current_project(&state, "chocobones_project.puppet.json") {
					ui.toast_add(&state.toasts, "Projeto salvo com sucesso!", .Success)
				}
			}
		}

		editor_handle_tool_shortcuts(&state)
		geometry := editor_geometry(state.editor.ui_scale)
		editor_render_topbar(&state, geometry)
		editor_render_contextbar(&state, geometry)
		editor_render_toolrail(&state, geometry)
		editor_render_dockspace(&state, geometry)
		render_viewport_panel(&state)
		render_inspector_panel(&state)
		render_layers_panel(&state)
		editor_render_joints_panel(&state)
		render_timeline_panel(&state)
		editor_render_statusbar(&state, geometry)
		editor_render_appearance(&state)

		if state.show_demo_window {
			im.ShowDemoWindow(&state.show_demo_window)
		}

		// Diálogo de Arquivo modal (ImFileDialog)
		if ui.file_dialog_render(&state.file_dialog) {
			state.file_dialog.confirmed = false
			if state.file_dialog.mode == .OpenFile {
				selected_path := state.file_dialog.selected_file
				ext := strings.to_lower(filepath.ext(selected_path), context.temp_allocator)

				if ext == ".png" || ext == ".jpg" || ext == ".jpeg" || ext == ".bmp" || ext == ".tga" {
					import_image_as_layer(&state, selected_path)
				} else if ext == ".obj" || ext == ".gltf" || ext == ".glb" {
					new_mesh, ok := mesh3d.load_mesh3d_from_file(selected_path)
					if ok {
						if state.has_mesh3d {
							mesh3d.mesh3d_destroy(&state.active_mesh3d)
						}
						state.active_mesh3d = new_mesh
						state.has_mesh3d = true
						state.viewport_mode = .Mode3D
						core.orbit_camera_init(&state.camera3d, {0, 0, 0}, 4.0)
						ui.toast_add(&state.toasts, fmt.tprintf("Modelo 3D importado: %s (%d vértices, %d faces)", new_mesh.name, len(new_mesh.vertices), len(new_mesh.indices) / 3), .Success)
					} else {
						ui.toast_add(&state.toasts, "Erro ao carregar modelo 3D (.obj, .gltf, .glb)", .Error)
					}
				} else {
					if load_project_file(&state, selected_path) {
						ui.toast_add(&state.toasts, fmt.tprintf("Projeto carregado: %s", selected_path), .Success)
					} else {
						ui.toast_add(&state.toasts, "Erro ao abrir arquivo de projeto", .Error)
					}
				}
			} else if state.file_dialog.mode == .SaveFile {
				if save_current_project(&state, state.file_dialog.selected_file) {
					ui.toast_add(&state.toasts, fmt.tprintf("Projeto salvo: %s", state.file_dialog.selected_file), .Success)
				} else {
					ui.toast_add(&state.toasts, "Erro ao salvar arquivo de projeto", .Error)
				}
			}
		}

		// Modal de Código / JSON (ImGuiColorTextEdit)
		ui.text_editor_modal_render(&state.text_editor)

		// Notificações flutuantes (ImNotify)
		ui.toast_render(&state.toasts)

		editor_flush_preferences(&state)
		im.Render()

		render.fbo_unbind(display_w, display_h)
		bg := ui.current_palette.background
		gl.ClearColor(bg.x, bg.y, bg.z, bg.w)
		gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

		imgui_impl_opengl3.RenderDrawData(im.GetDrawData())
		sdl.GL_SwapWindow(window)
	}
}
