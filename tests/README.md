# Suíte de Testes Automatizados (`tests/`)

Testes automatizados executados nativamente via `bun test`.

## Cobertura

* [`core_math.test.ts`](core_math.test.ts): Validação de matrizes afins 2x3, transformações 4x4, câmera orbital e curvas de Bézier.
* [`rig_fk_ik.test.ts`](rig_fk_ik.test.ts): Testes de cinemática direta, resolução analítica 2-bone IK, prevenção de ciclos e presets de juntas.
* [`mesh_mls.test.ts`](mesh_mls.test.ts): Triangulação de malha e deformação rígida MLS.
* [`mesh3d_loaders.test.ts`](mesh3d_loaders.test.ts): Primitivas 3D, parsers de arquivos `.obj` e `.gltf`.
* [`animation.test.ts`](animation.test.ts): Interpolação de keyframes, atenuações (*easing*) e ciclos de animação.
* [`history.test.ts`](history.test.ts): Transações de desfazer e refazer (*Undo/Redo*).
* [`project_serialization.test.ts`](project_serialization.test.ts): Validação de esquemas com Zod e roundtrip JSON.

## Execução

```sh
bun test
```
