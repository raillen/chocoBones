package render

import "core:fmt"
import "core:strings"
import gl "vendor:OpenGL"

DEFAULT_VERTEX_SHADER :: `#version 330 core
layout (location = 0) in vec2 a_pos;
layout (location = 1) in vec2 a_uv;
layout (location = 2) in vec4 a_color;

uniform mat4 u_projection;

out vec2 v_uv;
out vec4 v_color;

void main() {
    v_uv = a_uv;
    v_color = a_color;
    gl_Position = u_projection * vec4(a_pos, 0.0, 1.0);
}
`

DEFAULT_FRAGMENT_SHADER :: `#version 330 core
in vec2 v_uv;
in vec4 v_color;

uniform sampler2D u_texture;

out vec4 frag_color;

void main() {
    vec4 tex = texture(u_texture, v_uv);
    frag_color = tex * v_color;
}
`

compile_shader :: proc(source: string, shader_type: u32) -> (u32, bool) {
	shader := gl.CreateShader(shader_type)
	length := i32(len(source))
	c_str := strings.clone_to_cstring(source, context.temp_allocator)
	gl.ShaderSource(shader, 1, &c_str, &length)
	gl.CompileShader(shader)

	success: i32
	gl.GetShaderiv(shader, gl.COMPILE_STATUS, &success)
	if success == 0 {
		info_log: [512]u8
		gl.GetShaderInfoLog(shader, 512, nil, &info_log[0])
		fmt.eprintf("Erro na compilação do shader: %s\n", cstring(&info_log[0]))
		gl.DeleteShader(shader)
		return 0, false
	}

	return shader, true
}

create_shader_program :: proc(vs_source, fs_source: string) -> (u32, bool) {
	vs, vs_ok := compile_shader(vs_source, gl.VERTEX_SHADER)
	if !vs_ok do return 0, false
	defer gl.DeleteShader(vs)

	fs, fs_ok := compile_shader(fs_source, gl.FRAGMENT_SHADER)
	if !fs_ok do return 0, false
	defer gl.DeleteShader(fs)

	program := gl.CreateProgram()
	gl.AttachShader(program, vs)
	gl.AttachShader(program, fs)
	gl.LinkProgram(program)

	success: i32
	gl.GetProgramiv(program, gl.LINK_STATUS, &success)
	if success == 0 {
		info_log: [512]u8
		gl.GetProgramInfoLog(program, 512, nil, &info_log[0])
		fmt.eprintf("Erro no link do shader program: %s\n", cstring(&info_log[0]))
		gl.DeleteProgram(program)
		return 0, false
	}

	return program, true
}
