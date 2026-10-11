# Prumo Skills — Fundações de Engenharia e Documentação

Habilidades canônicas de qualidade, arquitetura e processos técnicos.

## Principais Skills Aplicáveis ao ChocoBones

### `clean-code`
- **Foco:** Nomenclatura descritiva, responsabilidade clara de funções, funções curtas, redução de mutações e acoplamento frouxo.
- **Aplicação no ChocoBones:** Funções puras em `math` e `rig`, sem estados globais ocultos.

### `architecture-quality`
- **Foco:** Direção de dependência unidirecional, ausência de ciclos, fronteiras bem delimitadas entre domínio, I/O e renderização.
- **Aplicação no ChocoBones:** O motor matemático não conhece OpenGL nem ImGui; o renderer apenas consome dados da pose.

### `testing-quality`
- **Foco:** Pirâmide de testes, testes determinísticos de regressão, sem mocks desnecessários, testes de invariância matemática.
- **Aplicação no ChocoBones:** Testes com tolerância numérica estrita para cinemática e interpolação de poses.

### `grounded-implementation`
- **Foco:** Inspeção profunda antes de qualquer afirmação; proibição de código inventado sem fundamentação na base existente.
- **Aplicação no ChocoBones:** Migração precisa dos algoritmos validados em `math.ts`.

### `implementation-reality-verification`
- **Foco:** Eliminação de "false-greens"; validação de que o código compila, roda e é exercitado de verdade antes de marcar tarefas como concluídas.
- **Aplicação no ChocoBones:** Execução obrigatória de `odin test` e verificação de saída.
