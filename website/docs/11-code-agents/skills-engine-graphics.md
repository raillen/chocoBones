# Prumo Skills — Editor, Engine e Render

Habilidades focadas em sistemas de jogos, computação gráfica e ferramentas de produção visual.

## Skills Críticas para o ChocoBones

### `game-engine-architecture`
- **Foco:** Loops de jogo desacoplados, taxa de quadros fixa vs variável, pools de memória e desacoplamento de subsistemas.
- **Aplicação no ChocoBones:** Ciclo principal do editor desacopla o tick lógico de simulação de tempo da taxa de atualização do monitor.

### `rendering-2d`
- **Foco:** Batching dinâmico de sprites, atlas de texturas, projeção ortográfica, minimização de draw calls e gerenciamento de VBOs/IBOs.
- **Aplicação no ChocoBones:** Renderizador OpenGL desenha todas as camadas com uma ou duas chamadas de desenho indexadas.

### `lang-glsl`
- **Foco:** Robustez em shaders, qualificação explícita de precisão, empacotamento de uniform buffers e prevenção de ramificações caras.
- **Aplicação no ChocoBones:** Shaders GLSL 330 core limpos para renderização de malhas com texturas e blend modes.
