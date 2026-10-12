# Subsistema de Histórico e Desfazer/Refazer (`src/history`)

Fornece gerenciamento transacional do estado do editor com suporte completo a *Undo* e *Redo*.

## Componentes

* [`history.ts`](history.ts):
  * `Snapshot`: Registro imutável contendo clones profundos do esqueleto de juntas, lista de camadas e deltas de pose.
  * `HistoryStack`: Pilha delimitada com limite máximo de passos configurável (padrão 50), gerenciamento automático de descarte de estados expirados e esvaziamento da pilha de redo ao iniciar uma nova ação.
