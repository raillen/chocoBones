# Interface Slint

`main.slint` compõe um editor de personagens com duas barras compactas, ferramentas Phosphor, palco proporcional e painéis contínuos. `studio-controls.slint` define os controles e a paleta compartilhada de Dark, Dim e Light, com seis acentos.

Montagem prioriza camadas; Rig, juntas; Animação inclui timeline sob o palco; Foco amplia o palco. Em larguras abaixo de 1100 px, Elementos e Inspetor usam abas. Listas e propriedades têm rolagem; o mínimo é 760×560.

Todos os ícones são SVGs Phosphor existentes em `assets/icons/`. Fontes Inter vêm de `assets/fonts/`. Não há emojis ou seletores de cores do personagem sem ação real.

As ações permanecem conectadas à bridge TypeScript. O palco preserva proporção e usa coordenadas convertidas para picking e arrasto. Botões, cores de destaque e timeline oferecem foco e navegação por teclado.

A análise da referência, os detalhes de adaptação e os comandos de QA estão em [Interface do editor](../docs/development/editor-ui.md).
