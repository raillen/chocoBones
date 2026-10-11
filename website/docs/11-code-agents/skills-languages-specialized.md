# Prumo Skills — Odin e Especialidades Técnicas

Habilidades técnicas direcionadas às linguagens e especialidades do projeto.

## A Skill Canônica: `lang-odin`

Diretrizes para desenvolvimento limpo e idiomático em Odin:

1. **Alocação Consciente de Memória:**
   - O alocador padrão (`context.allocator`) deve ser evitado em laços internos por quadro.
   - Sempre passe o alocador explicitamente quando a função alocar: `allocator := context.allocator`.
   - Limpe recursos usando `defer` ou esvazie a arena do quadro no final do loop principal: `mem.arena_free_all(&scratch_arena)`.

2. **Tipos e Arrays Nativos:**
   - Aproveite os tipos de matriz e vetor da linguagem: `[2]f32`, `[4]f32`, `matrix[2, 3]f32`.
   - Fatias dinâmicas utilizam `[dynamic]T`. Ao saber a capacidade com antecedência, pré-aloque com `make([dynamic]T, 0, capacity, allocator)`.

3. **Tratamento de Erros:**
   - Funções retornam booleanos (`ok: bool`) ou enums de erro explícitos (`Error`).
   - Não use asserções em código de produção que processe dados externos de arquivos `.puppet.json`; faça validação com retorno de erro controlado.

4. **Pacotes Vendor Oficiais:**
   - Acesse dependências externas exclusivamente pelos pacotes integrados no compilador Odin:
     - `import "vendor:glfw"`
     - `import gl "vendor:OpenGL"`
     - `import stbi "vendor:stb/image"`
     - `import imgui "vendor:odin-imgui"`
