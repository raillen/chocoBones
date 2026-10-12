# Renderização 2D e Texturas

Este pacote implementa o pipeline de desenho 2D com OpenGL 3.3, batching dinâmico de sprites/malhas deformadas, texturas e renderização de máscaras de emenda.

| Arquivo | Responsabilidade |
|---|---|
| `batch.odin` | Dynamic Sprite Batcher com projeção ortográfica e minimização de draw calls |
| `texture.odin` | Carregamento de imagens via stb_image (`ImageRaw`, `image_load_raw`, `image_free_raw`), gerenciamento de texturas GPU e sub-imagens |
| `fbo.odin` | Framebuffer Objects (FBO) para viewport isolada e renderização offscreen |
| `seam_mask.odin` | Passagem multi-pass para suavização de emendas e corte de junções entre membros |

## Convenções

- O carregamento de texturas da CPU para a GPU é desacoplado através de `ImageRaw` para permitir testes unitários headless sem contexto OpenGL.
