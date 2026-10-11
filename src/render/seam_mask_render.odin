package render

import "core:fmt"
import "core:math"
import "core:strings"
import gl "vendor:OpenGL"
import "../core"
import "../mesh"
import "../rig"

SEAM_MASK_VERTEX_SHADER :: `#version 330 core
layout (location = 0) in vec2 a_pos;
layout (location = 1) in vec2 a_uv;

out vec2 v_uv;

void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

// O recorte usa a operação destination-out no alfa:
// art_alpha *= (1.0 - cover_alpha * gradient(dist)).
// As texturas de arte e cobertura já estão em alfa pré-multiplicado, portanto
// apenas os canais RGB são conservados e o alfa resultante é recomposto.
SEAM_MASK_FRAGMENT_SHADER :: `#version 330 core
in vec2 v_uv;

uniform sampler2D u_art;
uniform sampler2D u_cover;
uniform vec2 u_center;
uniform float u_radius;
uniform float u_feather;
uniform vec2 u_resolution;

out vec4 frag_color;

void main() {
    vec4 art = texture(u_art, v_uv);
    vec4 cover = texture(u_cover, v_uv);

    vec2 world_pixel = vec2(v_uv.x * u_resolution.x, (1.0 - v_uv.y) * u_resolution.y);
    float dist = distance(world_pixel, u_center);
    float factor = 1.0;
    float inner = max(0.0, u_radius - u_feather);
    if (u_feather > 0.001 && dist > inner) {
        factor = clamp(1.0 - (dist - inner) / u_feather, 0.0, 1.0);
    }

    float cut = cover.a * factor;
    art.rgb *= (1.0 - cut);
    art.a *= (1.0 - cut);
    frag_color = art;
}
`

SeamMaskRenderer :: struct {
	shader_program: u32,
	vao:            u32,
	vbo:            u32,
	art_fbo:        Framebuffer,
	cover_fbo:      Framebuffer,
	u_art_loc:      i32,
	u_cover_loc:    i32,
	u_center_loc:   i32,
	u_radius_loc:   i32,
	u_feather_loc:  i32,
	u_res_loc:      i32,
	width:          i32,
	height:         i32,
}

seam_mask_renderer_init :: proc(seam: ^SeamMaskRenderer, width, height: i32) -> bool {
	program, ok := create_shader_program(SEAM_MASK_VERTEX_SHADER, SEAM_MASK_FRAGMENT_SHADER)
	if !ok do return false
	seam.shader_program = program
	seam.width = width
	seam.height = height

	seam.u_art_loc = gl.GetUniformLocation(program, "u_art")
	seam.u_cover_loc = gl.GetUniformLocation(program, "u_cover")
	seam.u_center_loc = gl.GetUniformLocation(program, "u_center")
	seam.u_radius_loc = gl.GetUniformLocation(program, "u_radius")
	seam.u_feather_loc = gl.GetUniformLocation(program, "u_feather")
	seam.u_res_loc = gl.GetUniformLocation(program, "u_resolution")

	art_fbo, ok_art := fbo_create(width, height)
	if !ok_art {
		gl.DeleteProgram(program)
		return false
	}
	seam.art_fbo = art_fbo

	cover_fbo, ok_cover := fbo_create(width, height)
	if !ok_cover {
		fbo_destroy(&seam.art_fbo)
		gl.DeleteProgram(program)
		return false
	}
	seam.cover_fbo = cover_fbo

	// Quad de tela cheia em NDC com UVs 0..1
	vertices := []f32{
		// pos        uv
		-1, -1, 0, 0,
		1, -1, 1, 0,
		1, 1, 1, 1,
		-1, 1, 0, 1,
	}
	indices := []u32{0, 1, 2, 0, 2, 3}

	gl.GenVertexArrays(1, &seam.vao)
	gl.GenBuffers(1, &seam.vbo)

	ebo: u32
	gl.GenBuffers(1, &ebo)

	gl.BindVertexArray(seam.vao)

	gl.BindBuffer(gl.ARRAY_BUFFER, seam.vbo)
	gl.BufferData(gl.ARRAY_BUFFER, len(vertices) * size_of(f32), raw_data(vertices), gl.STATIC_DRAW)

	gl.BindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo)
	gl.BufferData(gl.ELEMENT_ARRAY_BUFFER, len(indices) * size_of(u32), raw_data(indices), gl.STATIC_DRAW)

	stride: i32 = 4 * size_of(f32)
	gl.EnableVertexAttribArray(0)
	gl.VertexAttribPointer(0, 2, gl.FLOAT, gl.FALSE, stride, uintptr(0))
	gl.EnableVertexAttribArray(1)
	gl.VertexAttribPointer(1, 2, gl.FLOAT, gl.FALSE, stride, uintptr(2 * size_of(f32)))

	gl.BindVertexArray(0)
	gl.DeleteBuffers(1, &ebo) // O EBO permanece vinculado ao VAO após a deleção

	return true
}

seam_mask_renderer_destroy :: proc(seam: ^SeamMaskRenderer) {
	if seam.shader_program != 0 {
		gl.DeleteProgram(seam.shader_program)
		seam.shader_program = 0
	}
	if seam.vao != 0 {
		gl.DeleteVertexArrays(1, &seam.vao)
		seam.vao = 0
	}
	if seam.vbo != 0 {
		gl.DeleteBuffers(1, &seam.vbo)
		seam.vbo = 0
	}
	fbo_destroy(&seam.cover_fbo)
	fbo_destroy(&seam.art_fbo)
}

/**
 * Renderiza uma camada com máscara de emenda no framebuffer de destino.
 *
 * O centro e o raio da máscara são definidos em coordenadas locais da camada;
 * ambos são convertidos para o espaço do mundo aplicando a matriz local e a
 * escala uniforme da camada, de modo que o recorte acompanhe a articulação
 * mesmo quando o membro é rotacionado pela animação.
 */
seam_mask_render_layer :: proc(
	seam: ^SeamMaskRenderer,
	batch: ^RenderBatch,
	visual: LayerVisual,
	cover_visual: LayerVisual,
	joints: []rig.Joint,
	pose: ^rig.Pose,
	bones: map[string]core.Mat2x3,
	center: core.Vec2,
	radius: f32,
	feather: f32,
	target_fbo: ^Framebuffer,
	view_w, view_h: f32,
	allocator := context.allocator,
) {
	if seam.shader_program == 0 || visual.deform_mesh == nil && visual.texture_id == 0 do return

	layer_mat := rig.layer_matrix(visual.layer, joints, pose, bones)
	world_center := core.mat_apply(layer_mat, center)
	layer_scale := math.hypot(layer_mat.a, layer_mat.b)
	world_radius := radius * layer_scale
	world_feather := feather * layer_scale

	ortho := ortho_projection(0, view_w, view_h, 0, -1, 1)

	// Passo 1: desenha a camada mascarada no FBO de arte
	batch_flush(batch)
	fbo_bind(&seam.art_fbo)
	gl.ClearColor(0, 0, 0, 0)
	gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
	gl.Enable(gl.BLEND)
	gl.BlendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
	batch_begin(batch, &ortho)
	draw_layer_geometry(batch, visual, joints, pose, bones, {1, 1, 1, 1}, allocator)
	batch_end(batch)

	// Passo 2: desenha a camada de cobertura no FBO de cobertura
	fbo_bind(&seam.cover_fbo)
	gl.ClearColor(0, 0, 0, 0)
	gl.Clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
	gl.Enable(gl.BLEND)
	gl.BlendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

	if cover_visual.layer.visible && cover_visual.layer.opacity > 0 {
		cover_color: [4]f32 = {1, 1, 1, cover_visual.layer.opacity}
		batch_begin(batch, &ortho)
		draw_layer_geometry(batch, cover_visual, joints, pose, bones, cover_color, allocator)
		batch_end(batch)
	}

	// Passo 3: recompõe com o recorte suave sobre o framebuffer de destino
	if target_fbo != nil && target_fbo.fbo != 0 {
		fbo_bind(target_fbo)
	} else {
		gl.BindFramebuffer(gl.FRAMEBUFFER, 0)
		gl.Viewport(0, 0, seam.width, seam.height)
	}

	gl.Disable(gl.DEPTH_TEST)
	gl.Enable(gl.BLEND)
	gl.BlendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

	gl.UseProgram(seam.shader_program)

	gl.ActiveTexture(gl.TEXTURE0)
	gl.BindTexture(gl.TEXTURE_2D, seam.art_fbo.texture)
	gl.ActiveTexture(gl.TEXTURE1)
	gl.BindTexture(gl.TEXTURE_2D, seam.cover_fbo.texture)

	if seam.u_art_loc >= 0 do gl.Uniform1i(seam.u_art_loc, 0)
	if seam.u_cover_loc >= 0 do gl.Uniform1i(seam.u_cover_loc, 1)
	if seam.u_center_loc >= 0 do gl.Uniform2f(seam.u_center_loc, world_center.x, world_center.y)
	if seam.u_radius_loc >= 0 do gl.Uniform1f(seam.u_radius_loc, world_radius)
	if seam.u_feather_loc >= 0 do gl.Uniform1f(seam.u_feather_loc, world_feather)
	if seam.u_res_loc >= 0 do gl.Uniform2f(seam.u_res_loc, view_w, view_h)

	gl.BindVertexArray(seam.vao)
	gl.DrawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, nil)
	gl.BindVertexArray(0)

	gl.ActiveTexture(gl.TEXTURE0)
}
