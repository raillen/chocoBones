# Malhas 2D e Deformação MLS (Mesh)

Módulo responsável pela geração de vértices triangulados e algoritmos de deformação por imagem via Moving Least Squares (MLS) e pinos interativos.

| Arquivo | Responsabilidade |
|---|---|
| `mesh.odin` | Estruturas `Vertex`, `Mesh`, `Pin`, geração de malha quadriculada (`build_grid_mesh`), interpolação MLS afim/rígida e aplicação de pesos |
