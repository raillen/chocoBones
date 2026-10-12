# Subsistema de Rigging e Cinemática (`src/rig`)

Gerencia o esqueleto de juntas articuladas, resolução de cinemática direta (**FK**) e cinemática inversa (**IK**), manipulação de hierarquia em árvore e pré-configurações esqueléticas.

## Componentes

* [`joint.ts`](joint.ts): Estruturas centrais `Joint`, `JointDelta`, `Layer`, `LayerDelta` e `Pose`.
* [`fk.ts`](fk.ts): Resolução da cadeia hierárquica esquelética e transformações espaciais locais e mundiais.
* [`ik.ts`](ik.ts): Solver analítico *Two-Bone IK* com controle do ângulo do cotovelo/joelho via fator `bend`.
* [`presets.ts`](presets.ts): Presets esqueléticos (*Humanoid*, *BipedSimple*, *Quadruped*, *Prop*), algoritmos de detecção de ciclo, adição/remoção/reparentamento de juntas e heurística anatômica `autoGuessJointForLayer`.

## Garantias de Integridade

- Árvores esqueléticas são validadas contra ciclos direcionados (`jointHasCycle`).
- Remoção de nós propaga reparentamento seguro para filhos sem deixar nós órfãos.
- Renomeação atualiza atomicamente camadas vinculadas e canais de pose.
