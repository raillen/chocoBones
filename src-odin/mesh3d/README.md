# Modelos e Geometria 3D (Mesh3D)

Módulo responsável pelo carregamento e representação de malhas 3D para o pipeline de visualização e renderização híbrida.

| Arquivo | Responsabilidade |
|---|---|
| `mesh3d.odin` | Estrutura `Mesh3D`, `Vertex3D`, inicialização e destruição de recursos de vértice/índice |
| `obj_loader.odin` | Decodificador do formato Wavefront .obj (vértices, normais e coordenadas de textura) |
| `gltf_loader.odin` | Decodificador de modelos glTF/GLB (geometria, buffer views e acessores) |
| `primitives.odin` | Geradores de primitivas 3D paramétricas (cubo, cilindro, esfera) |
