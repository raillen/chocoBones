# Princípios em Odin e Filosofia Data-Oriented (DOD)

A reimplementação do **ChocoBones** em Odin obedece a regras de engenharia orientadas a desempenho determinístico, legibilidade e simplicidade de manutenção.

## Diretrizes Fundamentais

1. **Dados em Primeiro Lugar (DOD):**
   - Elimine árvores de nós conectadas por ponteiros espalhados na memória.
   - Guarde dados em arrays contíguos (`[dynamic]Joint`, `[dynamic]Vec2`, `[dynamic]u32`).
   - Referências entre entidades usam índices inteiros (`int` ou `u32`), facilitando a serialização e a segurança contra ponteiros nulos ou inválidos.

2. **Gerenciamento de Memória Explícito com Arenas:**
   - **Document Arena:** Armazena o estado persistente do projeto e sobrevive enquanto o arquivo estiver aberto.
   - **Frame/Scratch Arena:** Criada no início do frame e descartada no final com `free_all(scratch_arena)`. Usada para matrizes temporárias de ossos, triângulos deformados do MLS e buffers de vértice transitórios.
   - Nenhuma alocação individual de nó por quadro no heap geral.

3. **Stdlib e Vendor First:**
   - Use os pacotes canônicos da linguagem:
     - `core:mem` para alocadores e arenas.
     - `core:math` e `core:math/linalg` para funções trigonométricas.
     - `core:encoding/json` para parse/encode do projeto.
     - `core:compress/zip` para empacotamento de runtime.
     - `vendor:glfw` e `vendor:OpenGL` para janela e renderização gráfica.
     - `vendor:stb/image` para decodificação de texturas PNG/JPEG.
   - Zero dependências de bibliotecas de terceiros para o que algumas dezenas de linhas de código nativo resolvem.

4. **Zero Abstrações Prematuras:**
   - Não crie interfaces com apenas uma implementação.
   - Não crie hierarquias de herança artificial ou fábricas complexas.
   - Funções puras que recebem fatias (`[]T`) e transformam dados sem efeitos colaterais ocultos.

5. **Paridade com a Baseline Web:**
   - O comportamento visual do personagem montado no protótipo TypeScript deve ser identicamente reproduzido no binário nativo.
   - Tolerância de precisão em transformações afins e vértices: menor que $10^{-5}$ pixels.
