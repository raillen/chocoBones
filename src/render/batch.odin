package render

import "core:slice"
import gl "vendor:OpenGL"
import "../core"

Vertex2D :: struct {
	pos:   [2]f32,
	uv:    [2]f32,
	color: [4]f32,
}

MAX_VERTICES :: 16384
MAX_INDICES :: 65536

RenderBatch :: struct {
	vao:             u32,
	vbo:             u32,
	ebo:             u32,
	shader_program:  u32,
	u_proj_loc:      i32,
	u_tex_loc:       i32,
	current_texture: u32,
	vertices:        [dynamic]Vertex2D,
	indices:         [dynamic]u32,
}

batch_init :: proc(batch: ^RenderBatch, shader_program: u32, allocator := context.allocator) -> bool {
	batch.shader_program = shader_program
	batch.u_proj_loc = gl.GetUniformLocation(shader_program, "u_projection")
	batch.u_tex_loc = gl.GetUniformLocation(shader_program, "u_texture")

	batch.vertices = make([dynamic]Vertex2D, 0, 1024, allocator)
	batch.indices = make([dynamic]u32, 0, 2048, allocator)

	gl.GenVertexArrays(1, &batch.vao)
	gl.GenBuffers(1, &batch.vbo)
	gl.GenBuffers(1, &batch.ebo)

	gl.BindVertexArray(batch.vao)

	gl.BindBuffer(gl.ARRAY_BUFFER, batch.vbo)
	gl.BufferData(gl.ARRAY_BUFFER, MAX_VERTICES * size_of(Vertex2D), nil, gl.DYNAMIC_DRAW)

	gl.BindBuffer(gl.ELEMENT_ARRAY_BUFFER, batch.ebo)
	gl.BufferData(gl.ELEMENT_ARRAY_BUFFER, MAX_INDICES * size_of(u32), nil, gl.DYNAMIC_DRAW)

	// a_pos (location = 0)
	gl.EnableVertexAttribArray(0)
	gl.VertexAttribPointer(0, 2, gl.FLOAT, gl.FALSE, size_of(Vertex2D), offset_of(Vertex2D, pos))

	// a_uv (location = 1)
	gl.EnableVertexAttribArray(1)
	gl.VertexAttribPointer(1, 2, gl.FLOAT, gl.FALSE, size_of(Vertex2D), offset_of(Vertex2D, uv))

	// a_color (location = 2)
	gl.EnableVertexAttribArray(2)
	gl.VertexAttribPointer(2, 4, gl.FLOAT, gl.FALSE, size_of(Vertex2D), offset_of(Vertex2D, color))

	gl.BindVertexArray(0)
	return true
}

batch_begin :: proc(batch: ^RenderBatch, projection: ^[4][4]f32) {
	clear(&batch.vertices)
	clear(&batch.indices)
	batch.current_texture = 0

	gl.UseProgram(batch.shader_program)
	if batch.u_proj_loc >= 0 && projection != nil {
		gl.UniformMatrix4fv(batch.u_proj_loc, 1, gl.FALSE, &projection[0][0])
	}
	if batch.u_tex_loc >= 0 {
		gl.Uniform1i(batch.u_tex_loc, 0)
	}
}

batch_flush :: proc(batch: ^RenderBatch) {
	if len(batch.indices) == 0 do return

	gl.ActiveTexture(gl.TEXTURE0)
	gl.BindTexture(gl.TEXTURE_2D, batch.current_texture)

	gl.BindVertexArray(batch.vao)

	gl.BindBuffer(gl.ARRAY_BUFFER, batch.vbo)
	gl.BufferSubData(gl.ARRAY_BUFFER, 0, len(batch.vertices) * size_of(Vertex2D), raw_data(batch.vertices))

	gl.BindBuffer(gl.ELEMENT_ARRAY_BUFFER, batch.ebo)
	gl.BufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, len(batch.indices) * size_of(u32), raw_data(batch.indices))

	gl.Enable(gl.BLEND)
	gl.BlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA) // Alfa pré-multiplicado

	gl.DrawElements(gl.TRIANGLES, i32(len(batch.indices)), gl.UNSIGNED_INT, nil)

	gl.BindVertexArray(0)

	clear(&batch.vertices)
	clear(&batch.indices)
}

batch_draw_mesh :: proc(
	batch: ^RenderBatch,
	texture_id: u32,
	vertices: []core.Vec2,
	uvs: []core.Vec2,
	triangles: [][3]u32,
	erased: []u32,
	color: [4]f32 = {1, 1, 1, 1},
) {
	if len(vertices) == 0 || len(triangles) == 0 do return

	// Troca de textura exige envio dos triângulos acumulados
	if batch.current_texture != 0 && batch.current_texture != texture_id {
		batch_flush(batch)
	}
	batch.current_texture = texture_id

	if len(batch.vertices) + len(vertices) >= MAX_VERTICES || len(batch.indices) + len(triangles) * 3 >= MAX_INDICES {
		batch_flush(batch)
	}

	base_vertex := u32(len(batch.vertices))

	for v, i in vertices {
		uv_coords := (i < len(uvs)) ? uvs[i] : core.Vec2{0, 0}
		append(&batch.vertices, Vertex2D{
			pos   = {v.x, v.y},
			uv    = {uv_coords.x, uv_coords.y},
			color = color,
		})
	}

	for tri, i in triangles {
		if slice.contains(erased, u32(i)) do continue

		append(&batch.indices, base_vertex + tri[0])
		append(&batch.indices, base_vertex + tri[1])
		append(&batch.indices, base_vertex + tri[2])
	}
}

batch_end :: proc(batch: ^RenderBatch) {
	batch_flush(batch)
}

batch_destroy :: proc(batch: ^RenderBatch) {
	delete(batch.vertices)
	delete(batch.indices)

	if batch.ebo != 0 do gl.DeleteBuffers(1, &batch.ebo)
	if batch.vbo != 0 do gl.DeleteBuffers(1, &batch.vbo)
	if batch.vao != 0 do gl.DeleteVertexArrays(1, &batch.vao)
}
