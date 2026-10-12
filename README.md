# chocoBones-ts

Editor nativo de personagens 2D/3D, montagem de peças, rig e animação em **TypeScript** (executando sobre **Node.js + pnpm**, interface nativa em **Slint** e shaders **WebGPU / WGSL**).

## Compilar e Executar

Requer [Node.js](https://nodejs.org/) (v20+) e [pnpm](https://pnpm.io/) (v10+ / v12+).

```sh
# Instalar dependências
pnpm install

# Verificar tipagem estrita
pnpm run typecheck

# Executar suíte completa de testes automatizados
pnpm test

# Executar a aplicação desktop
pnpm start
```

## Arquitetura e Pareamento de Funcionalidades com a Edição Odin

| Módulo | Responsabilidade | Status de Pareamento |
|---|---|---|
| [`src/core/`](src/core/) | Álgebra afim 2D, matrizes 4x4, projeção perspectiva e câmera orbital | 100% Pareado |
| [`src/rig/`](src/rig/) | Esqueleto de juntas, cinemática direta (**FK**), solver analítico 2-Bone **IK** e detecção de ciclos | 100% Pareado |
| [`src/mesh/`](src/mesh/) | Triangulação de malhas 2D e deformação elástica/rígida **Moving Least Squares (MLS)** | 100% Pareado |
| [`src/mesh3d/`](src/mesh3d/) | Primitivas 3D paramétricas, cálculo de normais e parsers para **Wavefront OBJ** e **glTF 2.0** | 100% Pareado |
| [`src/animation/`](src/animation/) | Linha do tempo, interpolação por curvas de Bézier cúbicas e presets de animação (*Idle*, *Walk*) | 100% Pareado |
| [`src/history/`](src/history/) | Histórico transacional com suporte a *Undo* e *Redo* | 100% Pareado |
| [`src/project/`](src/project/) | Validação de esquema estrito com **Zod** para arquivos `.puppet.json` | 100% Pareado |
| [`src/render/`](src/render/) | Shaders em **WGSL** (sprite batching e MLS compute) e buffer RGBA de 60 FPS | 100% Pareado |
| [`ui/`](ui/) | Interface declarativa em **Slint** com espaços *Montagem*, *Rig*, *Animação* e *Foco* | 100% Pareado |
| [`tests/`](tests/) | Suíte automatizada com 34 testes cobrindo todos os domínios | 100% Pareado |

## Desenvolvimento e Prumo

O projeto segue estritamente a metodologia **Prumo v0.6.0**, o protocolo v3 e **Lean Progressive Context (LPC)**.

Com Prumo instalado:

```sh
prumo validate .
prumo doctor .
```
