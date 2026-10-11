# Animação e Linha do Tempo

Este pacote gerencia curvas de animação, keyframes com interpolação Bézier, amostragem temporal de poses e pacotes de clipes pré-configurados.

| Arquivo | Responsabilidade |
|---|---|
| `timeline.odin` | Estruturas `Clip` e `Keyframe`, interpolação temporal de deltas de pose, fator de easing Bézier, clonagem e manipulação de chaves |
| `presets.odin` | Clipes prontos e pacotes de movimento funcional (`animation_create_default_pack`: *Idle*, *Walk Cycle*, *Run Cycle*, *Melee Attack*, *Shield Block*) |

## Convenções

- Os ângulos de rotação nos deltas são expressos em radianos.
- Clipes com `loop = true` realizam amostragem contínua com envoltória temporal suave entre o último e o primeiro quadro.
- A amostragem de poses (`sample_clip`) atualiza os mapas de juntas e camadas sem alocações adicionais por quadro.
