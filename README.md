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

## Arquitetura e Status (коном 2026-10-12: 70 testes, 10 suítes)

| Módulo | Responsabilidade | Status |
|---|---|---|
| [`src/core/`](src/core/) | Afim 2D, 4x4, perspectiva, `OrbitCamera`, Bézier + `ids.ts` determinísticos | Núcleo pareado + IDs estáveis |
| [`src/rig/`](src/rig/) | FK com guarda anti-ciclo, **IK genérica** (`bend/limits/pole`), presets, `autoGuess` | Núcleo pareado + IK estendida |
| [`src/mesh/`](src/mesh/) | Grade + **alpha-hull**, UV, **auto-skin**, pincel `add/smooth/set` + heatmap, MLS | Além do pareamento mínimo |
| [`src/mesh3d/`](src/mesh3d/) | Cubo/Plano, normais, OBJ (`usemtl`, índices negativos), glTF (`JOINTS/WEIGHTS`, `byteStride`, `parseGlb`) | Núcleo pareado + skinning parcial |
| [`src/animation/`](src/animation/) | Timeline (pins, channels, sort sob demanda), `evaluator.ts` único, `clock.ts` delta/fixed-step, presets | Núcleo pareado + determinismo |
| [`src/history/`](src/history/) | Undo/redo de juntas+camadas+pose | Pareado |
| [`src/project/`](src/project/) | Zod **v2** (`meshes/pins/clips/constraints`), `migrateV1ToV2`, anti-ciclo, limite 20 MB | Além do pareamento (v1 era só joints/layers) |
| [`src/render/`](src/render/) | WGSL sprite + MLS compute, `WebGpuRenderer` (fallback CPU), PNG sync+async, `loop.ts` delta | WGSL real + fallback; GPU física não validada |
| [`src/ui/`](src/ui/) | `store/actions/viewport/loop`, Setup/Animate, multisseleção, reorder, teclado, `editor_mode` | Bridge refatorada; editor Odin completo (showcase, spritesheet, seam_mask) **não** pareado |
| [`ui/`](ui/) | Slint com workspaces + `editor_mode` + `move_layer` | Funcional |
| [`tests/`](tests/) | 70 testes (35 legados + 35 novos `new_features.test.ts`) | Verde (`pnpm test`), `tsc --noEmit` limpo |

## Desenvolvimento e Prumo

O projeto segue estritamente a metodologia **Prumo v0.6.0**, o protocolo v3 e **Lean Progressive Context (LPC)**.

Com Prumo instalado:

```sh
prumo validate .
prumo doctor .
```
