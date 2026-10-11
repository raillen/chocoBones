# Pipeline GPU OpenGL 3.3 e Shaders 2D

O novo renderizador substitui o antigo desenho por clipping afim em CPU do Canvas 2D por um pipeline de aceleração por hardware moderno em OpenGL 3.3 Core Profile.

## 1. Arquitetura do Renderer

O pipeline opera por **desenho em batelada (Batched Drawing)**:

1. **Vertex Buffer Object (VBO) Dinâmico:**
   Estrutura de vértice compacto:
   ```odin
   Vertex2D :: struct {
       pos:      [2]f32, // Posição X, Y no espaço do mundo
       uv:       [2]f32, // Coordenadas de textura U, V
       color:    [4]f32, // Multiplicador de cor / opacidade
   }
   ```
2. **Index Buffer Object (IBO):**
   Lista de índices de triângulos de 32 bits (`u32`).
3. **Texture Atlas Manager:**
   Texturas carregadas via `vendor:stb/image` e organizadas em texturas OpenGL com filtragem bilinear e tratamento de alfa pré-multiplicado (`GL_ONE, GL_ONE_MINUS_SRC_ALPHA`).

## 2. Vertex & Fragment Shaders

O shader básico de renderização 2D é enxuto e de alta performance:

### Vertex Shader (GLSL 330 core)
```glsl
#version 330 core
layout(location = 0) in vec2 a_pos;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_color;

uniform mat4 u_projection; // Matriz ortográfica da câmera/viewport

out vec2 v_uv;
out vec4 v_color;

void main() {
    v_uv = a_uv;
    v_color = a_color;
    gl_Position = u_projection * vec4(a_pos, 0.0, 1.0);
}
```

### Fragment Shader (GLSL 330 core)
```glsl
#version 330 core
in vec2 v_uv;
in vec4 v_color;

uniform sampler2D u_texture;

out vec4 frag_color;

void main() {
    vec4 tex = texture(u_texture, v_uv);
    frag_color = tex * v_color;
}
```

## 3. Renderização para Textura e Offscreen (FBO)

Tanto a renderização da viewport quanto a exportação de PNGs de alta resolução utilizam Framebuffer Objects (FBOs):
* O palco é desenhado para um FBO de textura.
* A textura resultante é desenhada dentro do painel da Viewport do Dear ImGui via `imgui.Image()`.
* Isso isola a resolução do personagem do DPI da tela e das dimensões da janela da interface.
