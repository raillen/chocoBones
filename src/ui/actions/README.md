# Módulo `ui/actions`

Controladores de ação e mutações de domínio desacopladas da camada de apresentação Slint.

## Responsabilidades
- Execução pura e testável das operações de rigging, camadas, pinos MLS, animação e entrada/saída de projetos.
- Registro automático de alterações no histórico de *undo/redo*.
- Encapsulamento de regras de negócio sem dependências diretas de widgets de interface.

## Estrutura
- `animation_actions.ts`: Comandos de transporte (play/pause), busca (*seek*), seleção de clipes e restauração da pose de repouso (*bind*).
- `layer_actions.ts`: Criação, remoção, reordenação de profundidade (z-order), visibilidade, bloqueio e opacidade de camadas de sprites.
- `pin_actions.ts`: Criação, seleção, ancoragem e ajuste de parâmetros de influência para pinos de deformação MLS rígidos.
- `project_io.ts`: Serialização e desserialização assíncrona de projetos em formato `.puppet.json` (v1 e v2).
- `rig_actions.ts`: Adição, remoção, transformação e aplicação de *presets* de esqueleto humanoide e quadrúpede.
