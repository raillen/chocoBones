# Subsistema de Malhas 2D e Deformação MLS (`src/mesh`)

Responsável pela triangulação de quads em grade 2D e pela deformação rígida de superfícies baseada no algoritmo **Moving Least Squares (MLS)**.

## Componentes

* [`mesh.ts`](mesh.ts):
  * Estruturas de dados `Mesh`, `Pin`, `Influence`.
  * `buildGridMesh`: Gerador de malhas regulares indexadas por densidade configurável.
  * `warpPoint`: Implementação do algoritmo MLS rígido com ponderação de distância inversamente quadrática, calculando centróides ponderados e a rotação ideal sem distorção afim excessiva.
  * `meshWorld`: Deformação espacial completa integrando pinos e a matriz hierárquica do esqueleto e camada.

## Características Técnicas

- Resolução contínua de vértices em TypeScript com suporte a desacoplamento para Compute Shaders na WebGPU.
- Pinos travados (`locked: true`) agem como âncoras invariantes na superfície da imagem.
