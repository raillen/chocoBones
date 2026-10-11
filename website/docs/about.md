# Sobre o ChocoBones

**ChocoBones** é uma ferramenta e engine para autoria manual e animação de personagens 2D esqueléticos com malhas deformáveis, criada originalmente para o protótipo de sobrevivência (*Survivor Prototype*).

## Origem e Evolução

O projeto nasceu sob o nome de *Puppet Studio / Custom Char Creator*, implementado inicialmente na web com React, TypeScript, Canvas 2D e Dockview.

Embora o protótipo web tenha comprovado a ergonomia do fluxo (com manipulação livre de peças, marcação anatômica guiada inspirada no Mixamo em 2D, e deformação por pinos e pesos inspirada no Warp Studio), o renderizador 2D baseado em Canvas em software atinge limites de taxa de quadros e consumo de memória ao escalar para dezenas de camadas e milhares de vértices.

A reimplementação em **Odin** transfere esse núcleo para um binário nativo ultra-rápido, aproveitando aceleração por hardware (OpenGL 3.3 Core Profile), ausência de pausas de garbage collection e a robustez de interfaces imediatas com Dear ImGui.

## O Que o ChocoBones Faz

- **Montagem Livre:** Posicionamento de peças de sprites, ajuste de pivôs, escala, rotação e ordem de camadas.
- **Rigging 2D:** Esqueleto hierárquico com cinemática direta (FK) e cinemática inversa analítica (IK) para membros de 2 ossos.
- **Malhas Deformáveis:** Triangulação regular com deformação por pinos via Moving Least Squares (MLS) e skinning esquelético com Linear Blend e Dual Quaternions planares.
- **Máscaras de Junção (Seam Masks):** Eliminação de fendas e descontinuidades visuais nas dobras dos membros (ombro, cotovelo, joelho) sem exigir a fragmentação prévia da arte.
- **Animação em Linha do Tempo:** Criação de clipes com trilhas independentes por canal, curvas de interpolação Bézier cúbicas, auto-key e onion skinning.
- **Exportação Multiformato:** Saída em PNG estático, folhas de spritesheet geradas por código, sequências de quadros e pacote de runtime pronto para motores de jogos.

## Licença e Ecossistema

O ChocoBones é um projeto de código aberto, alinhado à filosofia de software minimalista, autodocumentado e livre de amarras a ecossistemas proprietários ou serviços de nuvem.
