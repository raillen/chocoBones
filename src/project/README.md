# Subsistema de Serialização e Projetos (`src/project`)

Gerencia a persistência, salvamento e carregamento de projetos de marionetes (`.puppet.json`).

## Componentes

* [`project.ts`](project.ts):
  * Esquemas Zod para validação em runtime (`ProjectSchema`, `ProjectLayerSchema`, `ProjectJointSchema`, `ProjectAssetSchema`).
  * `loadProjectFromJson`: Carrega e valida rigorosamente a estrutura, rejeitando schemas inválidos.
  * `saveProjectToJson`: Serializa a árvore com indentação padronizada.

## Contrato de Robustez (Zod)

Conforme a especificação `lang-typescript`, nenhum dado não tipado vindo de I/O externo penetra a arquitetura da aplicação sem validação de esquema estrita.
