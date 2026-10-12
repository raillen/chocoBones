# chocoBones — Dossiê técnico de pesquisa: animação 2D procedural, bones e puppet

**Data:** 11 de outubro de 2026  
**Projeto-alvo:** https://github.com/raillen/chocoBones  
**Natureza:** análise de tecnologias e proposta de arquitetura; **não** é relatório de funcionalidades já implementadas nem afirmação de testes executados nesta análise.  
**Stack verificada:** Odin, Dear ImGui/docking, SDL2, OpenGL; WGPU está presente de forma experimental/inicial.  
**Princípio:** preservar o editor nativo, ter uma única verdade de pose, separar geometria de repouso de deformação animada, produzir resultados determinísticos e proporcionar controle artístico em toda etapa.

## 1. Resumo executivo

A evolução mais vantajosa é um **pipeline híbrido**: malha de silhueta + bones com FK/IK + puppet points (MLS) + constraints + correções de pose + sistema procedural não destrutivo. Em vez de escolher entre Spine, Moho, Live2D e OpenToonz, adotar padrões complementares: a robustez da preparação de weights e de meshes do Spine; as correções e a dinâmica de ossos do Moho; o sistema de deformadores e parâmetros do Live2D; a clareza da ferramenta Plastic do OpenToonz; e os deformadores de ponto/curva/envelope do Toon Boom Harmony.

**Ordem correta:** corrigir fundamentos e persistência -> entregar Puppet Pin real e malha por contorno -> autorig/constraints/weight painting -> animação procedural/springs/foot planting -> melhorias artísticas avançadas ARAP/BBWeights/cages/retargeting. Não reescrever tudo nem trocar de linguagem ou backend apenas para esta feature.

## 2. Estado real do repositório — evidências de código

Arquivos consultados:

- [`src/mesh/mesh.odin`](https://github.com/raillen/chocoBones/blob/main/src/mesh/mesh.odin): grade retangular triangular, MLS rígido por pinos, LBS e mistura dual-quaternion planar.
- [`src/rig/fk.odin`](https://github.com/raillen/chocoBones/blob/main/src/rig/fk.odin) e [`src/rig/ik.odin`](https://github.com/raillen/chocoBones/blob/main/src/rig/ik.odin): FK hierárquica e IK analítica de dois segmentos.
- [`src/animation/timeline.odin`](https://github.com/raillen/chocoBones/blob/main/src/animation/timeline.odin): clipes, keyframes, easing, amostragem e mapas de juntas, camadas e pinos.
- [`src/animation/presets.odin`](https://github.com/raillen/chocoBones/blob/main/src/animation/presets.odin): cinco animações com poses pré-definidas, ainda não um gerador procedural dependente de parâmetros externos.
- [`src/render/puppet_render.odin`](https://github.com/raillen/chocoBones/blob/main/src/render/puppet_render.odin): renderização do mesh e peça rígida. Atualmente chama `mesh_world` com deslocamentos de pinos `nil`.
- [`src/main.odin`](https://github.com/raillen/chocoBones/blob/main/src/main.odin): estado e interações do editor; ferramenta Pin altera `p.x/p.y`, que são posições de repouso; `state.pin_deltas` é inicializado, mas não está conectado ao render nesse caminho; avanço de playback soma 1/60 a cada ciclo do desenho, em vez de progredir com tempo real medido.
- [`src/project/project.odin`](https://github.com/raillen/chocoBones/blob/main/src/project/project.odin): `Project` versão 1 guarda assets, joints e layers, **não** serializa malhas, pinos, pesos, clipes e operadores procedurais. Implementar esquema v2 e migração v1-v2 antes de ampliar o sistema.
- [`src/rig/presets.odin`](https://github.com/raillen/chocoBones/blob/main/src/rig/presets.odin): presets Humanoid, BipedSimple, Quadruped, Prop e Empty. Atualmente a ativação de IK no input do editor depende de IDs fixos das mãos/pés do humanoide.
- [`PROJECT_STATE.md`](https://github.com/raillen/chocoBones/blob/main/PROJECT_STATE.md): meta P00-G02 e evidências declaradas de testes. Há contagem de 41 testes no README e atualização interna para 48 no estado de projeto; **não** foram executados testes nesta pesquisa. O README registra QA em OpenGL por software/Xvfb, não validação em GPU física.

### Questões encontradas, por prioridade

**P0 — corretude funcional:**
1. Separar `rest_pin_local` de `animated_pin_offset` e persistir ambos; o usuário precisa de modos claros **Setup** e **Animate**.
2. Fazer `render_layer -> draw_layer_geometry -> mesh_world` receber deslocamentos efetivos de `pose.pins`, não `nil`.
3. Corrigir gravação/restauração de keyframes: canais independentes de joints, layers, pins e parâmetros; cópias de clips devem preservar channels.
4. Introduzir limpeza explícita de pose/frame a cada amostragem; prevenir valores anteriores residuais e distinguir canal ausente de valor zero.
5. Serializar completamente assets, malhas, rest pose, pesos, pins, clipes, operadores, bindings e informações de material, com migração de arquivos antigos.
6. Trocar incremento por frame de desenho por `delta_time` controlado; no caso de física, simulação de passo fixo.

**P1 — limitações de edição:**
7. Exibir e manipular pinos animados sem modificar coordenadas originais; permitir lock/anchor e reset.
8. IA da ferramenta / picking: pino deve ter prioridade quando ferramenta Pin estiver ativa; joints não devem sequestrar clique.
9. Identidade única de pinos e juntas; não reutilizar IDs por comprimento do vetor depois de exclusões.
10. Generalizar IK usando metadados de constraint, não comparações `hand_near/foot_near`.
11. Implementar auto weights em função de ossos e topologia da malha; um pincel que apenas incrementa pesos não basta.

**P2 — desempenho, robustez e DX:**
12. `mesh_world` procura o índice de junta percorrendo todos os joints para cada influência de vértice; pré-compilar índices e transforms.
13. Pré-computar dependências e buffers por personagem, reutilizar memória de vertices/UV e enviar somente malhas dirty ao GPU.
14. Versionar explicitamente contratos do runtime e export; adicionar testes de ida-e-volta com assets incorporados/externos.
15. Considerar dual quaternion apenas onde for matematicamente adequado; ele pode reduzir artefatos de volume, mas não garante preservação de área/contorno em qualquer pose.

## 3. Comparação de softwares — o que estudar e aproveitar

| Referência | Recurso central | Aprendizado para chocoBones | Nota |
|---|---|---|---|
| [Spine — meshes](https://us.esotericsoftware.com/spine-meshes) | Malhas, trace automático, arestas, linked meshes | Auto hull com alpha; edição de malha; reuso de rig | Preferir bone weights a keyframe de todos os vértices |
| [Spine — weights](https://us.esotericsoftware.com/spine-weights) | Bind, auto, smooth, prune, weld | Pipeline profissional de pesos e manutenção de costuras | Diferenciar topologia de distância euclidiana |
| [Spine — physics](https://us.esotericsoftware.com/spine-physics-constraints) | Movimento secundário em bones | Springs ajustáveis e opcionais | Preview e export devem usar o mesmo avaliador |
| [Moho — bone dynamics](https://www.lostmarble.com/moho/manual/tut03/03/index.html) | Springs de osso | Dinâmica de cabelo, roupa e cartunesco | Forte referência de UX para parâmetros |
| [Moho — constraints](https://www.lostmarble.com/moho/manual/tut03/02/index.html) | Limites angulares | Prevenir cotovelos/joelhos invertidos | Suporte a flip e pole vector |
| [Moho — Quick Tips](https://moho.lostmarble.com/blogs/news/moho-quick-tips) | Smart Bones, Live Mesh, Physics | Correções artísticas separadas da FK | Biblioteca de exemplos ótima para QA visual |
| [Live2D — deformers](https://docs.live2d.com/en/cubism-editor-manual/deformer/) | Warp e rotation deformers | Hierarquia de deformadores e controles por parâmetro | Warp para rosto, roupas e expressão |
| [Live2D — warp](https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/) | Warp grids & Bézier | Localizar deformação e oferecer níveis de edição | Evitar contração linear na rotação |
| [OpenToonz — Plastic](https://opentoonz.readthedocs.io/en/latest/create_animations_using_plastic_tool.html) | Gera mesh por desenho + skeleton | Fluxo 'Importar -> Gerar malha -> Criar ossos -> Animar' | Boa referência de facilidade e clareza |
| [Toon Boom Harmony 25](https://docs.toonboom.com/help/harmony-25/premium/getting-started/deformation.html) | Bone, Curve, Envelope, Free Form, Shape-Aware | Unificar diferentes deformadores sobre a mesma malha | Uma modalidade mais avançada, não seis ferramentas logo de início |
| [Rive](https://rive.app/features) | Parâmetros e lógica interativa | State machine e layer mixing | Útil para uso em jogos/UI em tempo real |
| [Synfig — Skeleton](https://wiki.synfig.org/Skeleton_Deformation_Layer) | Esqueleto e desenho em software livre | Referência de compatibilidade de formatos | Não equivale a autorig universal |

### Síntese de práticas

- *Bones governam movimento grande; pinos e deformadores governam correções locais*. Não tratar todo vértice como uma curva principal.
- Incluir transições claras entre criação de rig (setup), poses (animate), simulação e edição final.
- Qualidade vem de boas malhas e pesos: uma malha com muitos vértices mal distribuídos pode deformar pior que uma menor orientada às articulações.
- Enriquecer a paleta de movimento sem sobrecarregar o usuário com configuração de parâmetros até que seja necessário.

## 4. Papers e métodos científicos

### Moving Least Squares — MLS, Schaefer, McPhail & Warren (2006)

Referência: [ACM TOG DOI 10.1145/1141911.1141920](https://doi.org/10.1145/1141911.1141920). MLS usa correspondência de pontos/segmentos para criar transformações locais rígidas, por similaridade ou afins. O chocoBones **já utiliza** uma variante de MLS rígido. O melhor investimento é corrigir seu caminho de dados e benchmarkar pinos antes de reescrever o algoritmo. Vantagem: rápido e intuitivo. Limitação: pode deformar mal perto de muitas restrições contraditórias, contornos côncavos ou âncoras próximas.

### As-Rigid-As-Possible — ARAP, Igarashi, Moscovich & Hughes (2005)

Referência: [página acadêmica Brown](https://cs.brown.edu/people/jhughes/papers/Igarashi-ASM-2005/main.htm), [ACM DOI 10.1145/1073204.1073323](https://doi.org/10.1145/1073204.1073323). Resolve posições de vértices minimizando distorção dos triângulos sob handles impostos. Excelente opção de qualidade para Free Form/Push/Pull e grandes dobras, **mas** exige topologia consistente, gestão de inversão dos triângulos e solver numérico. Implementar como modo 'Qualidade' posteriormente; não substituir MLS no núcleo de uma vez.

### Bounded Biharmonic Weights — BBW, Jacobson et al. (2011)

Referência: [ETH Zürich](https://igl.ethz.ch/projects/bbw/) / [Adobe Research](https://research.adobe.com/publication/bounded-biharmonic-weights-for-real-time-deformation/). Pesos suaves para bones, handles e cages baseados em otimização de energia com limites. Útil no **preprocessamento do autorig**, não no loop de renderização. Enquanto isso, adotar auto weights topologia-aware mais simples com smooth/prune/normalização; testar BBW no P3.

### SPRITETOMESH (2026)

Referência: [arXiv 2602.21153](https://arxiv.org/abs/2602.21153). Pipeline híbrido segmentação, contorno simplificado, amostragem interior e triangulação. Valida a direção 'alpha -> contorno -> malha'. **As métricas descritas são dos autores e não foram reproduzidas neste dossiê.** Para PNG com transparência, começar com algoritmo determinístico; rede neural somente como fallback para fundos não transparentes ou casos difíceis.

### Alternativas complementares

- [Earcut.hpp](https://github.com/mapbox/earcut.hpp): triangulação de polígonos complexos; verificar licença e critérios de validade antes de incorporar/portar. Não resolve por si só a distribuição interna de vértices nem gera pesos.
- [First Order Motion Model (2020)](https://arxiv.org/abs/2003.00196): fluxo por keypoints aprendidos e occlusão a partir de vídeo; é pesquisa inspiradora, mas contrária ao requisito de rigs determinísticos e editáveis do MVP.

## 5. Discussões da comunidade e vídeos

**Relatos qualitativos, não estudos controlados:**

1. [Reddit r/gamedev: Rigging 2D sprites — procedural deformation? (18 abr 2026)](https://www.reddit.com/r/gamedev/comments/1sp26xd/rigging_2d_sprites_procedural_deformation/): desenvolvedor destaca rig 2D rígido demais e falta de squash/stretch expressivo. A resposta prática é combinar IK com deformação local/poses corretivas.
2. [Reddit r/gamedev: 2D sprites to 3D-like motion (22 ago 2026)](https://www.reddit.com/r/gamedev/comments/1vvhp6e/rigging_2d_sprites_to_3d_model_followup_with/): interesse em ilusões de volume; animação 2D precisa de troca de arte, layer ordering e deformações específicas, não apenas bones.
3. [Reddit r/godot: Procedural Legs Animator (3 ago 2026)](https://www.reddit.com/r/godot/comments/1vesmwg/hi_everyone_ive_just_released_my_first_godot/): implementação comunitária detalha predictive placement, foot locking, slope, hip bounce, passo em marcha e aérea.
4. [Fórum Spine: Automatic skinning weights](https://us.esotericsoftware.com/forum/d/3108-automatic-skinning-weights/12): orienta usar poucos vértices necessários, auto-bind e smooth, pois cada influência aumenta custo.

**Vídeos para reprodução de testes:**

- [Using the Plastic Tool — OpenToonz, Darren T (2018)](https://www.youtube.com/watch?v=iQpv871bpvU): mesh aos 1:10, skeleton aos 2:54, 'Paint rigid' para preservar regiões aos 4:21, loop aos 9:00.
- [OpenToonz Skeleton — Pepinadas (2021)](https://www.youtube.com/watch?v=BnqnAe5YsA8): rig aos 2:39, animação aos 8:15, IK aos 9:38.
- [Moho Quick Tips](https://moho.lostmarble.com/blogs/news/moho-quick-tips): vídeos de Smart Bones, Live Mesh, Bone Dynamics, Physics e Elastic Interpolation.
- [Live2D Tutorial: Adding Body Movement](https://docs.live2d.com/en/cubism-editor-tutorials/deformer/): warp, rotação, parâmetros e cabelo.

**Conclusão da pesquisa qualitativa:** não basta oferecer rig, IK e 'gerar caminhada'; os diferenciais reais percebidos são controlar deformações, evitar membros que achatam, manter contato com o chão, conservar continuidade visual das peças e corrigir as poses de modo acessível.

## 6. Tecnologias e repositórios open source para estudo

- [MangoLion/stretchystudio](https://github.com/MangoLion/stretchystudio) — MIT, editor de deformação por malha; [notas técnicas do pipeline](https://github.com/MangoLion/stretchystudio/blob/master/olddocs/MESH_DEFORM_DOCUMENTATION.md): detecção alpha, Moore Neighbor tracing, Delaunay, UV e handles. **Prioridade máxima para comparar implementação** de auto-mesh e edição. Confirmar a licença de cada dependência e asset ao reutilizar código.
- [zeikar/iki](https://github.com/zeikar/iki) — MIT declarado; sistema de parâmetros, deformadores, atlas, máscaras, physics/springs e export `.iki`; referência para protocolo de player open source e controles independentes do editor. Ainda projeto inicial, não substitui runtime em Odin.
- [OpenToonz](https://github.com/opentoonz/opentoonz) — referência de interação Plastic, mas seu código possui exigências próprias de licença/integração; tratar principalmente como estudo de conceitos.
- [Spine runtimes](https://github.com/EsotericSoftware/spine-runtimes) — conferir termos de licença específicos: **não copiar** código para ChocoBones como se fosse MIT apenas por estar público.

## 7. Arquitetura-alvo proposta

```text
Editor ImGui (setup / rig / animate / procedural)
      |
      v
Editor Commands / Undo / Viewport Interaction
      |
      v
Document v2 --- Asset Manifest --- Save/Migration
      |
      v
Animation Evaluation @ time t
  1. Base rest pose + clip sampling / blending
  2. Parameters + state machine / graph
  3. Procedural generators (breathing, walk, aim, look-at)
  4. Constraints (IK, angular limits, parent, aim, pole)
  5. Secondary dynamics (spring chains / inertia)
  6. Corrective poses + layer ordering
  7. Bone matrices
  8. Mesh deformation: LBS/DQ -> MLS/FreeForm or agreed stack
  9. Scene & texture render (OpenGL 2D)
      |
      v
Preview, export, headless tests: SAME deterministic evaluate(t)
```

**Não definir ordem de deformadores implicitamente para todos os documentos.** Um pipeline típico pode aplicar bones -> deform local, mas deve haver representação explícita de pilha/modificadores com espaços de coordenadas claros (rest local, layer local, world), inclusive se pinos são antes ou depois de skinning; a ordem determina resultados e precisa ser documentada, visualizada e versionada. Para produto inicial, padronizar ordem fixa segura e expandir depois.

### Módulos sugeridos (Odin)

```text
src/document/           schema_v2.odin; migrations.odin; asset_manifest.odin
src/rig/                joints, constraints, ik2, fabrik, sockets, limits
src/geometry/           alpha_contour, triangulation, mesh_edit, weight_bind
src/deform/             mls, lbs, planar_dq, corrective, modifiers
src/animation/          clips, channels, curves, blend, retarget, evaluator
src/procedural/         parameters, generators, gait, lookat, scheduler
src/physics2d/          spring, verlet_chain, state_cache, fixed_step
src/render/             existing GL; immutable render pose + buffers
src/ui/                 inspector, context panel, hierarchy, timeline
src/export/             image sequence, spritesheet, runtime manifest
```

Módulos separados não significam reescrever imediatamente; usar adaptadores para chamar código atual em `src/mesh`, `src/rig`, `src/animation` e migrar funções de modo incremental.

### Esquema documental mínimo

```json
{
  "schema": "chocobones-project",
  "version": 2,
  "scene": {"canvas": {"width": 512, "height": 512}},
  "assets": [],
  "layers": [],
  "skeletons": [],
  "meshes": [
    {"id": "mesh-body", "restVertices": [], "triangles": [],
     "uvs": [], "weights": [], "pins": [], "bindMatrices": []}
  ],
  "constraints": [],
  "clips": [],
  "parameters": [],
  "procedural": {"operators": [], "links": []},
  "physics": {"fixedHz": 120, "chains": []}
}
```

Este JSON é **proposta conceitual**, não uma especificação compatível com o parser atual. Preferir IDs estáveis, unidades explícitas, caminhos de assets portáveis, faixas de parâmetros validadas, migrador v1->v2, roundtrip lossless e limites de tamanho para entrada não confiável.

## 8. Plano do algoritmo Puppet Mesh

### 8.1 Pré-processamento de malha (setup)

1. Importar PNG/SVG (com rasterização separada do contrato geométrico), ler canal alpha e calcular bounding box útil.
2. Definir limiar alpha; detectar múltiplos contornos, ilhas e buracos internos; oferecer escolha de ilhas e tolerância, evitando preencher buracos incorretamente.
3. Simplificar pontos do contorno com Douglas-Peucker com tolerância configurável, preservar cantos, extremidades e pontos de articulação.
4. Distribuir vértices interiores prioritariamente junto a cotovelos, joelhos, pescoço, juntas e feições; gerar triangulação **dentro do contorno**, preservar restrições/bordas e rejeitar triângulos degenerados.
5. Construir UV em coordenadas da imagem original (independentes da deformação).
6. Gerar bone weights por distância ao segmento e suavização topológica; aparar influências insignificantes, normalizar e pintar correções; preservar islands independentes.
7. Cachear vizinhança de vértices, índices e bind matrices; não regenerar a mesh a cada frame.
8. Permitir edição manual da malha com undo e testes de topologia.

### 8.2 Puppet points (setup/animate)

`Pin = { id, meshId, restPosition, animatedOffset, anchorMode, influenceRadius, falloff, enabled }`.

- **Setup:** mover pin muda apenas `restPosition`; não gera keyframe.
- **Animate:** mover pin gera apenas `animatedOffset` relativo ao rest, por clip/tempo.
- Pins podem ser 'fixos' (zero movimento relativo) ou 'livres'; pin preso a joint acompanha transformação-base; pin preso a espaço mundo serve como alvo.
- Primeira versão usa MLS; incluir reset, strength, peso/raio e opção preview pin delta.
- Pinos precisam sobreviver ao save/load/export, undo/redo e troca de clip.
- Calcular poses via um avaliador único para evitar preview diferente de spritesheet.

### 8.3 Método de deformação padrão

- **Peça rígida:** textura em quad sem malha especial.
- **Puppet Pin:** MLS por handles para deformação rápida e controle local.
- **Bones:** LBS para deformação por esqueleto; DQ opcional onde for melhor, sempre comparável.
- **Correções:** corrective shape condicionado a ângulo de joint, blend de poses e offsets de mesh.
- **Qualidade futura:** solver ARAP com matriz pré-fatorada, iniciado após feedback em casos difíceis.

Critério artístico: medir com imagens-padrão do braço dobrado em 45/90/135°, perna cruzada, cabelo longo, cauda, pano e rosto; observar aspecto de contorno, manchas texel/UV, volume, dobragem de junção e máscara.

## 9. Geradores procedurais prioritários

### A. Respiração/Idle

Operador com frequência, amplitude, fase e offset para peito, ombros, cabeça e braços. Noise/oscillator opcional, seed persistida. Não alterar permanentemente a rest pose.

### B. Caminhada orientada por parâmetros (v1)

Inputs: `speedNormalized`, `direction2D`, `strideLength`, `stepHeight`, `groundY` e `facing`. Hip bob, oposição de braços, balanço tronco e fase contínua. Separar fases de apoio e balanço; manter pé plantado em mundo durante apoio; resolver joelho via IK com bend/pole vector correto; sem raycast no editor, fornecer ground plane local; runtime externo pode fornecer contatos.

### C. Look-at / Aim

Head/eyes target, amplitude, limite angular, amortecimento e blend; para personagens 2D em 3/4 vistas, desviar só onde a arte comporta sem esticar facialmente; trocas de sprites opcionais.

### D. Springs e Inércia

Cabelo, orelha, cauda, tecido, braços soltos e acessórios. Simulação com passo fixo e damping. Priorizar **spring angular** por cadeia para personagens. Executar determinístico sob export e scrubbing via checkpoints/rewind ou bake. Parâmetros `stiffness`, `damping`, `gravity`, `inertia`, `maxAngle` e `weight`.

### E. Squash & Stretch, Follow Through

Operadores com limites por articulação e pose, preservação aproximada de área quando artisticamente desejável, escalas configuráveis, curvas de easing com anticipation, overshoot e recuperação. **Não** prometer volume 3D matemático de uma arte 2D.

### F. Corrective Pose / Smart Bones

Definir poses corretivas em marcos de rotação/posição e interpolá-las para cotovelos, joelhos, pescoço, ombros e rosto. Elas corrigem perda de volume, artefatos UV, intersecções e sutilezas de desenho. Diferenciar **correção manual autoral** de auto-solver.

## 10. Proposta UX: poucos controles, profundidade sob demanda

Quatro estados funcionais (podem ser submodos nos workspaces atuais):

1. **Montar**: importar, organizar camadas, pivôs e recortes.
2. **Rig**: marcação guiada (mínimo: cabeça, pescoço, quadril, ombros, cotovelos, punhos, joelhos, tornozelos); gerar bones, pesos e mesh; permitir edição de pinos em Setup.
3. **Animar**: FK/IK, mover Puppet Pins, registrar keyframes, editor de curvas, operações na timeline, flip/poses corretivas.
4. **Procedural**: adicionar operadores com presets amigáveis 'Respiração', 'Cabelo', 'Cauda', 'Caminhada', 'Olhar', com knobs, visualizador de origem de movimento e bake para keyframes.

Princípios de acessibilidade: permitir rótulo dos ícones e tooltips; paleta de movimento reduzido, playback reduzido e pausa global; contrastar bones e pesos além da cor; hit targets ampliáveis; navegação por teclado e seleção via árvore; undo em toda operação destrutiva; prévia do antes/depois; impedir auto-bake/sobrescrita silenciosa.

## 11. Roadmap por entregáveis e critérios de aceite

**Fase 0 — Consertar fundamentos e persistence (bloqueante)**
- Rotas de Pin Setup/Animate; offsets chegam de `Pose` ao render e ao export.
- Editor registra/restaura channels completos e usa clock correto.
- Document v2 roundtrip, migrate v1, paths portáteis, schema validation.
- Testes golden pose, IK, clamp, loops, import/save/reopen, pin adicionado/movido e export.

**Fase 1 — Puppet mesh utilizável**
- Alpha hull, contornos, triangulação, edição, UV e Auto Weight.
- Ferramentas add/move/delete pin, lock, anchor, influence, weight paint.
- Exemplo funcional PNG de braço inteiro dobrado sem separação de peças; qualidade versus grid antiga.

**Fase 2 — Constraints e correções artísticas**
- IK generic parametrizada, angular limits/pole vectors, transform constraints, parenting, sockets.
- Smart Bones/pose correctives para evitar joelho quebrado e cotovelo estreito.
- Retarget por papéis anatômicos; biblioteca simples de rig & poses.

**Fase 3 — Sistema procedural determinístico**
- Parameters & operator stack; mix aditivo/sobreposto, weights e máscara de canais.
- Idle, gait, aim/look-at, spring chains; scrubbing e bake.
- Teste mesmo resultado exportado em 30/60/120 fps com amostragem em tempos equivalentes e physics fixed-step.

**Fase 4 — Avançado e interoperabilidade**
- ARAP/BBW opcionais; envelope/cage/curve; mesh otimizada; retarget quadrúpede.
- Player/runtime independente do editor em Odin, integração com engines via spritesheet e dados documentados.
- 3D apenas como trilha própria, sem misturar requisitos nem forçar migração de renderizador.

### Critérios de aceite prioritários

- Um único PNG com silhueta clara gera malha editável sem ocupar grandes áreas transparentes.
- Um pin movido em Animate modifica pixels em preview e em PNG exportado, mas **não** altera rest pose.
- Reabrir projeto reproduz exatamente a mesma pose e keyframes; clipe mantém layout de camadas, pinos, textura, pesos e assets.
- IK permite alvos de mãos/pés em qualquer esqueleto configurado, sem depender dos IDs da demo.
- Ao deformar braços contínuos a 90° e 135°, não surgem triângulos invertidos; se ocorrer risco, sinalizar e oferecer limite/fallback em vez de produzir NaN/artefatos.
- O mesmo `evaluate(t)` alimenta palco e export; no modo procedural com física, bake reproduz resultado.
- Performance verificada em software GL e GPU física, CPU/RAM por frame, vertices/weights/pins, P95/P99; metas de FPS definidas somente após medir.

## 12. Riscos e decisões explícitas

| Risco | Mitigação |
|---|---|
| Deformação com imagem única revela partes inexistentes | Camadas e recortes alternativos; não prometer reconstrução mágica |
| IK causa passos robóticos | Planting, curva de passo, constraints, squash/stretch e correctives |
| MLS causa torção de regiões | Control anchors, radius/falloff, topologia, modo ARAP futuro |
| Auto-mesh gera triângulos inválidos | Validação de winding, área, buracos e máscara alpha |
| Aumento de custo por vértice | Batching, influência limitada, cache e prune |
| Renderer difere da exportação | Engine única com render offscreen determinístico |
| Física muda quando FPS muda | Passo fixo, checkpoints, seeds e bake |
| Controles complexos alienam novos usuários | Presets simples; modo avançado opcional |
| Código de concorrentes licenciado | Copiar **conceitos**; reaproveitar código só depois de inspeção de licença e atribuição |
| 2D e 3D competem pelo roadmap | Foco no 2D, ampliar modo 3D separadamente |

## 13. Leituras originais e rastreabilidade

### Software/documentação

1. Spine Meshes — https://us.esotericsoftware.com/spine-meshes
2. Spine Weights — https://us.esotericsoftware.com/spine-weights
3. Spine Physics Constraints — https://us.esotericsoftware.com/spine-physics-constraints
4. Spine Mesh Weight Workflows — https://us.esotericsoftware.com/blog/Mesh-weight-workflows
5. Moho Bone Dynamics — https://www.lostmarble.com/moho/manual/tut03/03/index.html
6. Moho Bone Constraints — https://www.lostmarble.com/moho/manual/tut03/02/index.html
7. Moho Quick Tips — https://moho.lostmarble.com/blogs/news/moho-quick-tips
8. Live2D Deformers — https://docs.live2d.com/en/cubism-editor-manual/deformer/
9. Live2D Warp Deformer — https://docs.live2d.com/en/cubism-editor-manual/making-and-placement-of-warp-deformer/
10. OpenToonz Plastic Tool — https://opentoonz.readthedocs.io/en/latest/create_animations_using_plastic_tool.html
11. Harmony Deformation — https://docs.toonboom.com/help/harmony-25/premium/getting-started/deformation.html
12. Rive — https://rive.app/features

### Academics

13. Schaefer et al. MLS (2006) — https://doi.org/10.1145/1141911.1141920
14. Igarashi et al. ARAP (2005) — https://cs.brown.edu/people/jhughes/papers/Igarashi-ASM-2005/main.htm
15. Jacobson et al. BBW (2011) — https://igl.ethz.ch/projects/bbw/
16. SpriteToMesh (2026) — https://arxiv.org/abs/2602.21153
17. First Order Motion Model (2020) — https://arxiv.org/abs/2003.00196

### Open source, comunidade, vídeos

18. stretchystudio MIT — https://github.com/MangoLion/stretchystudio
19. stretchystudio technical mesh notes — https://github.com/MangoLion/stretchystudio/blob/master/olddocs/MESH_DEFORM_DOCUMENTATION.md
20. iki MIT — https://github.com/zeikar/iki
21. Reddit rigging 2D 2026 — https://www.reddit.com/r/gamedev/comments/1sp26xd/rigging_2d_sprites_procedural_deformation/
22. Reddit IK legs 2026 — https://www.reddit.com/r/godot/comments/1vesmwg/hi_everyone_ive_just_released_my_first_godot/
23. OpenToonz Plastic video — https://www.youtube.com/watch?v=iQpv871bpvU
24. OpenToonz Skeleton video — https://www.youtube.com/watch?v=BnqnAe5YsA8
25. OpenToonz source — https://github.com/opentoonz/opentoonz
26. Spine runtimes licensing — https://github.com/EsotericSoftware/spine-runtimes

---

**Decisão sugerida (não registrada no repositório):** avançar com **ChocoBones Hybrid Rig + Procedural Deformation** em Odin, iniciado por pose/pin corretos, documento v2, auto-mesh e Auto Weight; sem migrar backend ou reimplementar editor. As fases seguintes dependem de testes de qualidade artística e performance com assets reais e de validação de UX por animação prática.
