# Protocolo de Implementação e Matriz de Gaps

Roteiro obrigatório para o ciclo de desenvolvimento de novas features e migrações no ChocoBones.

## 1. Protocolo em Quatro Passos

1. **Inspeção de Baseline:**
   - Inspecione a implementação existente no TypeScript (`custom-char-creator/src/`).
   - Identifique quais estruturas de dados e funções matemáticas correspondem à tarefa.
   - Verifique os testes correspondentes em `tests/`.

2. **Grounded Implementation em Odin:**
   - Crie ou edite arquivos `.odin` mantendo o estilo idiomático da linguagem (nomes em snake_case, structs alinhadas, tratamento explícito de erros via booleanos ou enums de erro).
   - Não invente bibliotecas ou abstrações; utilize a stdlib do Odin (`core:`) ou `vendor:`.

3. **Verificação de Realidade (Reality Verification):**
   - O código deve compilar sem avisos: `odin check src/` deve retornar código de saída 0.
   - Execute o teste unitário local: `odin test tests/ -all-packages`.
   - Meça o tempo de execução caso a tarefa pertença ao domínio de renderização ou deformação de malha.

4. **Registro de Checkpoints:**
   - Se os critérios de aceitação foram cumpridos, atualize o `progress/tasks.json` registrando a evidência e marcando o checkpoint como `completed: true`.

## 2. Matriz de Gaps (Gap Matrix)

| Funcionalidade | Estado na Baseline (TS) | Estado Alvo (Odin) | Gap Crítico |
| :--- | :--- | :--- | :--- |
| **Álgebra Afim** | Arrays JS de 6 números | Struct `Mat2x3` nativa | Nenhum; tradução 1:1. |
| **Solvers IK/FK** | Funções puras em `math.ts` | Pacote `rig` com arrays planos | Índices inteiros substituindo IDs em string. |
| **Deformação MLS** | Loop JS por vértice | Loop com auto-vetorização SIMD | Alocador scratch para buffers temporários. |
| **Render de Malha** | Clipping de Canvas 2D em CPU | Shaders OpenGL 3.3 com VBOs | Compilação de shaders e uploads de textura. |
| **Interface / Dock** | Dockview React | Dear ImGui (branch docking) | Configuração de nós de docking e janelas nativas. |
| **Persistência** | IndexedDB / JSON browser | `core:encoding/json` + arquivo atômico | Parsing em memória estrita sem alocações ocultas. |
