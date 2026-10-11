# Exportação de PNG, Spritesheet e Pacote de Runtime

O ChocoBones oferece suporte a quatro modalidades principais de exportação.

## 1. Imagem PNG Estática
* Gera um PNG transparente em alta fidelidade na pose corrente.
* Dimensões padronizadas em $512 \times 512$ px (ou resolução personalizada do projeto).
* Gizmos, guias de juntas e fundos de auxílio do editor são completamente omitidos.
* Utiliza `vendor:stb/image_write` para gravação instantânea de PNG sem dependências pesadas.

## 2. Folha de Spritesheet (Atlas)
* Amostra $N$ quadros da animação selecionada (padrão: 8 tempos por direção).
* Duas linhas de animação:
  * Linha 1: Direção Direita (normal).
  * Linha 2: Direção Esquerda (espelhamento visual da raiz do personagem).
* Gera um arquivo de folha único em alta velocidade acompanhado de metadados `animation.json` com duração de quadros, repetição (`loop`) e limites de célula.

## 3. Sequência Numerada de Quadros
* Exporta cada quadro como arquivo individual (`frame_0001.png`, `frame_0002.png`, etc.) dentro de uma pasta ou arquivo compactado.
* Ideal para pipelines de edição de vídeo ou importadores de motores 2D.

## 4. Pacote de Runtime ZIP (`core:compress/zip`)
Para uso dinâmico em jogos onde o motor recalcula poses e interpolações em tempo real:
* Texturas individuais preparadas e recortadas por camada.
* Arquivo `puppet.json` contendo o esqueleto, pesos de malha, posições de pinos e lista de clipes com trilhas de keyframes.
* Formato aberto que permite escrever runtimes leves para Raylib, Godot, Defold ou Love2D.
