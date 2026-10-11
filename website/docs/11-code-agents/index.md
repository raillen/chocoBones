# Code Agents — Comece Aqui

Instruções para assistentes de inteligência artificial, agentes de codificação e revisores automatizados que atuam no repositório do **ChocoBones**.

## Governança e Regras de Ouro

1. **O Prumo governa o processo de trabalho; o ChocoBones governa o produto e a arquitetura.**
   Nenhum agente autônomo possui autorização para introduzir dependências ou refatorações estruturais sem conformidade com as decisões registradas em `00-philosophy/decision-register.md`.
2. **Contexto Progressivo Mínimo (Lean Progressive Context):**
   Não carregue a totalidade da documentação ou skills simultaneamente. Carregue apenas os documentos do domínio afetado pela tarefa e as skills estritamente requeridas.
3. **Verificação de Realidade da Implementação:**
   Nenhuma tarefa é considerada concluída com base em intenção ou código apenas escrito. O agente deve fornecer evidência de compilação sem avisos (`odin check` ou `odin build`) e execução de testes.
4. **Sem Efeitos Colaterais no Documento:**
   Ao modificar a lógica do rig ou da malha, certifique-se de que a compatibilidade com o schema `survivor-puppet` v1 seja mantida.

## Como Iniciar uma Tarefa

1. **Localize o Processo no Caderno Vivo:**
   Abra a página de [Acompanhamento de Reimplementação](#/progress) e identifique o ID da tarefa (`M01`, `D01`, `R01`, etc.).
2. **Consulte a Documentação Canônica do Domínio:**
   Leia o documento especificado como autoridade primária na tarefa antes de propor qualquer alteração de código.
3. **Selecione o Menor Subconjunto de Skills:**
   Consulte o [Catálogo do Prumo Workforce](./workforce-index.md) e carregue as skills necessárias (ex: `lang-odin`, `game-engine-architecture`, `clean-code`).
4. **Produza Evidência Verificável:**
   Registre o resultado dos testes, commits e revisões no formato exigido em [Evidências e Handoffs](../12-reimplementation/index.md).
