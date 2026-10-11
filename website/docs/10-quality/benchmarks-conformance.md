# Benchmarks, Conformance e Critérios de Qualidade

A estabilidade da reimplementação nativa em Odin é avaliada por critérios objetivos de desempenho e fidelidade matemática.

## 1. Orçamento de Performance (Performance Budget)

| Métrica | Limite Tolerado | Alvo em Odin |
| :--- | :--- | :--- |
| **Tempo de deformação MLS (2.000 vértices)** | $< 1.0\text{ ms}$ | $< 0.1\text{ ms}$ |
| **Tempo de Skinning com Dual Quat (2.000 vértices)** | $< 0.8\text{ ms}$ | $< 0.08\text{ ms}$ |
| **Taxa de quadros do editor (Playback 60 FPS)** | $60\text{ FPS}$ estável | $\ge 120\text{ FPS}$ |
| **Consumo de memória RAM base** | $< 120\text{ MB}$ | $< 35\text{ MB}$ |
| **Tempo de inicialização do executável** | $< 1.0\text{ s}$ | $< 0.15\text{ s}$ |

## 2. Testes de Invariância Matemática

O conjunto de testes verifica contra os casos de prova legados do Playwright:
1. **Invariância de Repouso:** Um rig em repouso absoluto com deltas nulos deve produzir exatamente a mesma matriz de camada independentemente de quantas juntas existirem na cadeia.
2. **Alcance do IK:** Um alvo de IK além do comprimento total do braço ($L_1 + L_2$) deve esticar o braço em linha reta na direção do alvo sem colapsar ou produzir valores complexos/NaN.
3. **Pinos Fixos no MLS:** Vértices coincidentes com um pino travado (`locked = true`) devem permanecer estritamente imóveis ($dx = 0, dy = 0$), mesmo quando outros pinos livres são movidos.
4. **Soma Unitária de Pesos:** A soma dos pesos de qualquer vértice de malha deve ser igual a $1.000000 \pm 10^{-6}$.

## 3. Rastreamento de Memória

A compilação em modo de desenvolvimento ativa o `mem.Tracking_Allocator` do Odin:
* Todas as alocações e liberações são registradas.
* O encerramento do aplicativo falha com log de erro se houver qualquer vazamento (`bad free` ou `memory leak`) remanescente da Arena de documento.
