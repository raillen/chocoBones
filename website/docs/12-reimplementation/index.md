# Acompanhamento e Atualização de Status

Regras formais de governança e procedimento para atualizar a tabela viva de processos em `progress/tasks.json`.

## 1. Regras do Banco de Tarefas

O arquivo `website/progress/tasks.json` alimenta dinamicamente a rota [#/progress](#/progress). Ele é estritamente validado por `website/progress/progress.js` no carregamento.

### Critérios de Validação
1. **Schema e Branch:** `schemaVersion` deve ser `1`, e `branch` deve refletir a branch ativa de desenvolvimento.
2. **Datas:** Todas as datas devem usar formato ISO `AAAA-MM-DD`.
3. **Fases e Documentos:**
   - Cada tarefa deve apontar para uma fase declarada no array `phases`.
   - O campo `document` de cada tarefa deve existir em `website/docs/manifest.json`.
   - O primeiro item do array `documents` deve ser identicamente igual a `task.document`.
4. **Estados e Checkpoints:**
   - Status `TODO`: Exige que **nenhum** checkpoint esteja marcado como concluído (`completed: false`).
   - Status `DONE`: Exige que **todos** os checkpoints estejam concluídos (`completed: true`).
   - Status `IN PROGRESS`: Exige pelo menos um checkpoint concluído e pelo menos um checkpoint pendente.
5. **Vínculo com Evidências:**
   - Todo checkpoint marcado como `completed: true` deve ter um campo `evidence` apontando para uma chave existente no objeto `evidence` do JSON.
   - O documento citado na evidência deve estar contido na lista `documents` da respectiva tarefa.

## 2. Como Registrar uma Nova Evidência

Ao concluir um passo de desenvolvimento:
1. Abra `website/progress/tasks.json`.
2. Adicione ou atualize um registro no nó `evidence`:
```json
"minha-evidencia": {
  "revision": "hash-do-commit-ou-arquivo:linhas",
  "document": "caminho/do/documento.md",
  "summary": "Resumo objetivo dos testes executados e resultados obtidos."
}
```
3. No checkpoint correspondente da tarefa, altere `completed` para `true` e aponte `evidence` para `"minha-evidencia"`.
4. Atualize o campo `status` da tarefa caso todos os checkpoints tenham sido concluídos (`DONE`) ou se o trabalho foi iniciado (`IN PROGRESS`).
5. Atualize o campo `updated` da tarefa e o campo global `updated` do documento.
