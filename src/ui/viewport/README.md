# Módulo `ui/viewport`

Gerenciamento de entrada do mouse, translação de coordenadas mundo/tela e seleção contextual de elementos.

## Responsabilidades
- Controle de arraste (*drag-and-drop*) para movimentação de câmera (pan) e manipulação direta de juntas/pinos (`controller.ts`).
- Seleção precisa com prioridade de contexto por ferramenta ativa (`picking.ts`), garantindo que ferramentas de pinos não entrem em conflito com juntas esqueléticas.
- Integração fluida entre o palco 2D/3D e o sistema de coordenadas do Slint.

## Estrutura
- `controller.ts`: Estado da máquina de arraste (`ViewportDrag`), detecção de acerto de juntas (`pickJoint`) e aplicação de transformações relativas/absolutas (`applyJointDrag`).
- `picking.ts`: Resolução de clique unificada (`pickEntity`) considerando pinos MLS, juntas e nível de zoom da câmera.
