# Código-Fonte chocoBones (`src/`)

Arquitetura limpa modular em **TypeScript estrito** executando sobre o runtime **Bun** e interface declarativa **Slint**.

## Mapa de Módulos

| Diretório | Responsabilidade |
|---|---|
| [`core/`](core/) | Tipos primitivos, matrizes afins 2x3 e 4x4, matemática 2D/3D e câmera orbital |
| [`rig/`](rig/) | Esqueleto de juntas, cinemática direta (**FK**), cinemática inversa (**IK**) e presets anatômicos |
| [`mesh/`](mesh/) | Geração de malhas poligonais 2D e deformação elástica/rígida **MLS** (*Moving Least Squares*) |
| [`mesh3d/`](mesh3d/) | Primitivas 3D, cálculo de normais e parsers para **Wavefront OBJ** e **glTF 2.0 / GLB** |
| [`animation/`](animation/) | Linha do tempo, interpolação por curvas de Bézier cúbicas e clipes de animação |
| [`history/`](history/) | Pilha transacional de estados com suporte a *Undo* e *Redo* |
| [`project/`](project/) | Validação de schema com **Zod** e persistência de projetos `.puppet.json` |
| [`render/`](render/) | Pipeline de shaders **WGSL** e Framebuffer de alta performance |
| [`ui/`](ui/) | Ponte de comunicação com a interface nativa do **Slint** |

## Compilação e Testes

* `bun test`: Executa toda a suíte de testes unitários.
* `bun run src/index.ts`: Inicia a aplicação desktop nativa.
