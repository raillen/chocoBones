# Rigging e Cinemática

Este pacote implementa a estrutura esquelética, cinemática direta (FK), cinemática inversa (IK) de 2 ossos e gerenciamento dinâmico de juntas e predefinições.

| Arquivo | Responsabilidade |
|---|---|
| `joint.odin` | Estrutura `Joint`, `JointDelta`, `Layer`, `Pose` e busca básica de nós |
| `fk.odin` | Resolução hierárquica de matrizes afins 2D de ossos e camadas (`bone_matrices`, `layer_matrix`) |
| `ik.odin` | Solver analítico de cinemática inversa para membros de 2 juntas (`solve_ik`) |
| `presets.odin` | Operações dinâmicas de nós (`joint_add`, `joint_remove`, `joint_rename`, `joint_set_parent`, detecção de ciclos), predefinições prontas (`Humanoid`, `BipedSimple`, `Quadruped`, `Prop`, `Empty`) e heurística de mapeamento anatômico de camadas (`auto_guess_joint_for_layer`) |

## Convenções

- Hierarquias são representadas por referências de `parent` (ID da junta pai ou string vazia para raízes).
- Operações de remoção e reparentamento garantem integridade referencial, prevenindo ciclos circulares (`joint_has_cycle`).
- Verificação: `odin test tests` cobre criação de presets, manipulação dinâmica e prevenção de ciclos.
