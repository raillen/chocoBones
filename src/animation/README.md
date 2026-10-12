# Subsistema de Animação e Linha do Tempo (`src/animation`)

Gerencia clipes de animação, keyframes, amostragem e interpolação por curvas de Bézier cúbicas e funções de atenuação (*easing*).

## Componentes

* [`timeline.ts`](timeline.ts): Estruturas `Keyframe`, `Clip`, funções de atenuação (`Easing`: *Linear*, *Smooth*, *Hold*, *Bezier*) e amostragem temporal em tempo real com reprodução em loop contínuo (`sampleClip`).
* [`presets.ts`](presets.ts): Clipes de animação prontos para uso (*Idle* / Repouso e *Walk* / Caminhada sincronizada).

## Desempenho

A interpolação opera com vetores contínuos e deltas em tempo de execução sem alocações desnecessárias no laço de amostragem.
