# Histórico e Desfazer/Refazer (History)

Módulo responsável pela pilha de comandos e snapshots para desfazer e refazer edições (Undo/Redo) no documento.

| Arquivo | Responsabilidade |
|---|---|
| `history.odin` | Estruturas `History`, `HistoryCommand`, gravação de snapshots (`history_push`), execução de `history_undo` e `history_redo` |
