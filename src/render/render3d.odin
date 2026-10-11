package render

import "core:fmt"
import gl "vendor:OpenGL"
import "../core"
import "../mesh3d"

SHADER_3D_VERT :: `#version 330 core
layout (location = 0) in vec3 a_pos;
layout (location = 1) in vec3 a_normal;
layout (location = 2) in vec2 a_uv;

uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_proj;

out vec3 v_normal;
out vec3 v_frag_pos;
out vec2 v_uv;

void main() {
    vec4 world_pos = u_model * vec4(a_pos, 1.0);
    v_frag_pos = world_pos.xyz;
    v_normal = mat3(transpose(inverse(u_model))) * a_normal;
    v_uv = a_uv;
    gl_Position = u_proj * u_view * world_pos;
}
`

SHADER_3D_FRAG :: `#version 330 core
in vec3 v_normal;
in vec3 v_frag_pos;
in vec2 v_uv;

out vec4 FragColor;

uniform vec3 u_light_pos;
uniform vec3 u_view_pos;
uniform vec4 u_base_color;
uniform int u_use_lighting;

void main() {
    if (u_use_lighting == 0) {
        FragColor = u_base_color;
        return;
    }

    vec3 norm = normalize(v_normal);
    vec3 light_dir = normalize(u_light_pos - v_frag_pos);

    // Luz ambiente
    float ambient_strength = 0.35;
    vec3 ambient = ambient_strength * vec3(1.0, 1.0, 1.0);

    // Luz difusa (Lambertiana de dois lados suave)
    float diff = max(dot(norm, light_dir), 0.0);
    float back_diff = max(dot(-norm, light_dir), 0.0) * 0.2;
    vec3 diffuse = (diff + back_diff) * vec3(0.9, 0.9, 0.95);

    // Especular (Blinn-Phong)
    vec3 view_dir = normalize(u_view_pos - v_frag_pos);
    vec3 halfway_dir = normalize(light_dir + view_dir);
    float spec = pow(max(dot(norm, halfway_dir), 0.0), 32.0);
    vec3 specular = 0.3 * spec * vec3(1.0, 1.0, 1.0);

    vec3 result = (ambient + diffuse + specular) * u_base_color.rgb;
    FragColor = vec4(result, u_base_color.a);
}
`

SHADER_LINE_VERT :: `#version 330 core
layout (location = 0) in vec3 a_pos;
layout (location = 1) in vec4 a_color;

uniform mat4 u_view;
uniform mat4 u_proj;

out vec4 v_color;

void main() {
    v_color = a_color;
    gl_Position = u_proj * u_view * vec4(a_pos, 1.0);
}
`

SHADER_LINE_FRAG :: `#version 330 core
in vec4 v_color;
out vec4 FragColor;

void main() {
    FragColor = v_color;
}
`

Renderer3D :: struct {
	shader_mesh:      u32,
	shader_lines:     u32,

	// Uniforms de Mesh
	u_model_loc:      i32,
	u_view_loc:       i32,
	u_proj_loc:       i32,
	u_light_loc:      i32,
	u_cam_loc:        i32,
	u_color_loc:      i32,
	u_lighting_loc:   i32,

	// Uniforms de Linhas
	u_line_view_loc:  i32,
	u_line_proj_loc:  i32,

	// Buffers de Mesh
	vao_mesh:         u32,
	vbo_mesh:         u32,
	ebo_mesh:         u32,

	// Buffers de Grid
	vao_grid:         u32,
	vbo_grid:         u32,
	grid_vert_count:  i32,
}

render3d_init :: proc(r: ^Renderer3D) -> bool {
	// Cria Shader de Mesh 3D
	ok_mesh := false
	r.shader_mesh, ok_mesh = create_shader_program(SHADER_3D_VERT, SHADER_3D_FRAG)
	if !ok_mesh {
		fmt.eprintln("[Render3D] Falha ao compilar shader 3D de malha")
		return false
	}

	r.u_model_loc    = gl.GetUniformLocation(r.shader_mesh, "u_model")
	r.u_view_loc     = gl.GetUniformLocation(r.shader_mesh, "u_view")
	r.u_proj_loc     = gl.GetUniformLocation(r.shader_mesh, "u_proj")
	r.u_light_loc    = gl.GetUniformLocation(r.shader_mesh, "u_light_pos")
	r.u_cam_loc      = gl.GetUniformLocation(r.shader_mesh, "u_view_pos")
	r.u_color_loc    = gl.GetUniformLocation(r.shader_mesh, "u_base_color")
	r.u_lighting_loc = gl.GetUniformLocation(r.shader_mesh, "u_use_lighting")

	// Cria Shader de Linhas / Grid
	ok_lines := false
	r.shader_lines, ok_lines = create_shader_program(SHADER_LINE_VERT, SHADER_LINE_FRAG)
	if !ok_lines {
		fmt.eprintln("[Render3D] Falha ao compilar shader de linhas 3D")
		return false
	}
	r.u_line_view_loc = gl.GetUniformLocation(r.shader_lines, "u_view")
	r.u_line_proj_loc = gl.GetUniformLocation(r.shader_lines, "u_proj")

	// Buffers de Mesh
	gl.GenVertexArrays(1, &r.vao_mesh)
	gl.GenBuffers(1, &r.vbo_mesh)
	gl.GenBuffers(1, &r.ebo_mesh)

	gl.BindVertexArray(r.vao_mesh)
	gl.BindBuffer(gl.ARRAY_BUFFER, r.vbo_mesh)
	gl.BindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.ebo_mesh)

	// a_pos (location 0)
	gl.EnableVertexAttribArray(0)
	gl.VertexAttribPointer(0, 3, gl.FLOAT, gl.FALSE, size_of(mesh3d.Vertex3D), offset_of(mesh3d.Vertex3D, pos))

	// a_normal (location 1)
	gl.EnableVertexAttribArray(1)
	gl.VertexAttribPointer(1, 3, gl.FLOAT, gl.FALSE, size_of(mesh3d.Vertex3D), offset_of(mesh3d.Vertex3D, normal))

	// a_uv (location 2)
	gl.EnableVertexAttribArray(2)
	gl.VertexAttribPointer(2, 2, gl.FLOAT, gl.FALSE, size_of(mesh3d.Vertex3D), offset_of(mesh3d.Vertex3D, uv))

	gl.BindVertexArray(0)

	// Gera Geometria do Grid de Chão
	init_grid_buffer(r, 10.0, 10)

	return true
}

LineVertex :: struct {
	pos:   core.Vec3,
	color: [4]f32,
}

@(private="file")
init_grid_buffer :: proc(r: ^Renderer3D, size: f32, divisions: int) {
	lines := make([dynamic]LineVertex, 0, (divisions + 1) * 4)
	defer delete(lines)

	half := size * 0.5
	step := size / f32(divisions)

	axis_x_color := [4]f32{0.8, 0.25, 0.25, 0.8} // Vermelho
	axis_z_color := [4]f32{0.25, 0.45, 0.85, 0.8} // Azul
	grid_color   := [4]f32{0.35, 0.38, 0.45, 0.4} // Cinza suave

	for i in 0 ..= divisions {
		pos := -half + f32(i) * step

		// Linha paralela ao eixo Z (X constante)
		col_x := grid_color
		if math_abs_f32(pos) < 1e-4 do col_x = axis_z_color

		append(&lines, LineVertex{pos = {pos, 0, -half}, color = col_x})
		append(&lines, LineVertex{pos = {pos, 0,  half}, color = col_x})

		// Linha paralela ao eixo X (Z constante)
		col_z := grid_color
		if math_abs_f32(pos) < 1e-4 do col_z = axis_x_color

		append(&lines, LineVertex{pos = {-half, 0, pos}, color = col_z})
		append(&lines, LineVertex{pos = { half, 0, pos}, color = col_z})
	}

	r.grid_vert_count = i32(len(lines))

	gl.GenVertexArrays(1, &r.vao_grid)
	gl.GenBuffers(1, &r.vbo_grid)

	gl.BindVertexArray(r.vao_grid)
	gl.BindBuffer(gl.ARRAY_BUFFER, r.vbo_grid)
	gl.BufferData(gl.ARRAY_BUFFER, len(lines) * size_of(LineVertex), raw_data(lines), gl.STATIC_DRAW)

	gl.EnableVertexAttribArray(0)
	gl.VertexAttribPointer(0, 3, gl.FLOAT, gl.FALSE, size_of(LineVertex), offset_of(LineVertex, pos))

	gl.EnableVertexAttribArray(1)
	gl.VertexAttribPointer(1, 4, gl.FLOAT, gl.FALSE, size_of(LineVertex), offset_of(LineVertex, color))

	gl.BindVertexArray(0)
}

@(private="file")
math_abs_f32 :: proc(x: f32) -> f32 {
	return x < 0 ? -x : x
}

render3d_destroy :: proc(r: ^Renderer3D) {
	if r.shader_mesh != 0 {
		gl.DeleteProgram(r.shader_mesh)
		r.shader_mesh = 0
	}
	if r.shader_lines != 0 {
		gl.DeleteProgram(r.shader_lines)
		r.shader_lines = 0
	}
	if r.vao_mesh != 0 {
		gl.DeleteVertexArrays(1, &r.vao_mesh)
		r.vao_mesh = 0
	}
	if r.vbo_mesh != 0 {
		gl.DeleteBuffers(1, &r.vbo_mesh)
		r.vbo_mesh = 0
	}
	if r.ebo_mesh != 0 {
		gl.DeleteBuffers(1, &r.ebo_mesh)
		r.ebo_mesh = 0
	}
	if r.vao_grid != 0 {
		gl.DeleteVertexArrays(1, &r.vao_grid)
		r.vao_grid = 0
	}
	if r.vbo_grid != 0 {
		gl.DeleteBuffers(1, &r.vbo_grid)
		r.vbo_grid = 0
	}
}

render3d_draw_grid :: proc(r: ^Renderer3D, view, proj: core.Mat4x4) {
	if r.vao_grid == 0 || r.grid_vert_count == 0 do return

	gl.Enable(gl.DEPTH_TEST)
	gl.Enable(gl.BLEND)
	gl.BlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

	gl.UseProgram(r.shader_lines)

	v := view
	p := proj
	gl.UniformMatrix4fv(r.u_line_view_loc, 1, gl.FALSE, &v[0][0])
	gl.UniformMatrix4fv(r.u_line_proj_loc, 1, gl.FALSE, &p[0][0])

	gl.BindVertexArray(r.vao_grid)
	gl.DrawArrays(gl.LINES, 0, r.grid_vert_count)
	gl.BindVertexArray(0)
}

render3d_draw_mesh :: proc(
	r:          ^Renderer3D,
	mesh:       ^mesh3d.Mesh3D,
	model:      core.Mat4x4,
	view:       core.Mat4x4,
	proj:       core.Mat4x4,
	cam_pos:    core.Vec3,
	color:      [4]f32 = {0.85, 0.85, 0.88, 1.0},
	wireframe:  bool = false,
) {
	if mesh == nil || len(mesh.vertices) == 0 || len(mesh.indices) == 0 do return

	gl.Enable(gl.DEPTH_TEST)
	gl.Enable(gl.BLEND)
	gl.BlendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

	gl.UseProgram(r.shader_mesh)

	m := model
	v := view
	p := proj
	gl.UniformMatrix4fv(r.u_model_loc, 1, gl.FALSE, &m[0][0])
	gl.UniformMatrix4fv(r.u_view_loc, 1, gl.FALSE, &v[0][0])
	gl.UniformMatrix4fv(r.u_proj_loc, 1, gl.FALSE, &p[0][0])

	// Luz vindo de cima/diagonal frontal
	light_pos := core.Vec3{cam_pos.x + 2.0, cam_pos.y + 4.0, cam_pos.z + 3.0}
	gl.Uniform3f(r.u_light_loc, light_pos.x, light_pos.y, light_pos.z)
	gl.Uniform3f(r.u_cam_loc, cam_pos.x, cam_pos.y, cam_pos.z)
	gl.Uniform4f(r.u_color_loc, color.r, color.g, color.b, color.a)
	gl.Uniform1i(r.u_lighting_loc, wireframe ? 0 : 1)

	// Atualiza os dados de geometria na GPU
	gl.BindVertexArray(r.vao_mesh)

	gl.BindBuffer(gl.ARRAY_BUFFER, r.vbo_mesh)
	gl.BufferData(gl.ARRAY_BUFFER, len(mesh.vertices) * size_of(mesh3d.Vertex3D), raw_data(mesh.vertices), gl.DYNAMIC_DRAW)

	gl.BindBuffer(gl.ELEMENT_ARRAY_BUFFER, r.ebo_mesh)
	gl.BufferData(gl.ELEMENT_ARRAY_BUFFER, len(mesh.indices) * size_of(u32), raw_data(mesh.indices), gl.DYNAMIC_DRAW)

	if wireframe {
		gl.PolygonMode(gl.FRONT_AND_BACK, gl.LINE)
	} else {
		gl.PolygonMode(gl.FRONT_AND_BACK, gl.FILL)
	}

	gl.DrawElements(gl.TRIANGLES, i32(len(mesh.indices)), gl.UNSIGNED_INT, nil)

	// Restaura PolygonMode padrão
	if wireframe {
		gl.PolygonMode(gl.FRONT_AND_BACK, gl.FILL)
	}

	gl.BindVertexArray(0)
}
