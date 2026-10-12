# Subsistema de Malhas 3D e Loaders (`src/mesh3d`)

Gerencia malhas tridimensionais, cálculo de normais e importação de formatos padrão da indústria (**Wavefront OBJ** e **glTF 2.0 / GLB**).

## Componentes

* [`mesh3d.ts`](mesh3d.ts): Estrutura `Mesh3D` e cálculo automático de *Axis-Aligned Bounding Box* (AABB) e normais de vértices acumuladas.
* [`primitives.ts`](primitives.ts): Gerador paramétrico de Cubos e Planos.
* [`obj_loader.ts`](obj_loader.ts): Parser de arquivos `.obj` de texto com suporte a triangulação de polígonos e mapeamento de UVs.
* [`gltf_loader.ts`](gltf_loader.ts): Parser do padrão `glTF 2.0` lendo descritores JSON e dados de *bufferViews* binários.

## Integração

As malhas são consumidas pelo Viewport 3D da aplicação para renderização de manequins de referência e exportação.
