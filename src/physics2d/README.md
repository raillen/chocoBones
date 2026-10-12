# Módulo `physics2d`

Subssistema de física secundária e cadeias elásticas 2D determinísticas para o chocoBones.

## Responsabilidades
- Simulação de movimento secundário em cabelo, orelhas, caudas e tecidos (`spring.ts`).
- Integração semi-implícita de Euler com passo de tempo fixo determinístico.
- Suporte a checkpoints, rebobinamento (*rewind*) e assamento (*bake*) para scrub na linha do tempo e renderização consistente.

## Estrutura
- `spring.ts`: Modelo de cadeias elásticas (`SpringChain`), parâmetros de rigidez/amortecimento/gravidade (`SpringParams`), avanço temporal determinístico (`stepSpring`), checkpoints (`checkpointSpring`), restauração (`rewindSpring`) e exportação para animação fixa (`bakeSpring`).
