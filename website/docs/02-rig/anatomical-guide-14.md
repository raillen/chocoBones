# Guia Anatômico de 14 Juntas (Fluxo 2D)

Inspirado no consagrado assistente do Mixamo, o ChocoBones adota um fluxo guiado de 14 pontos anatômicos adaptado para montagens 2D bidimensionais.

## O Esquema de 14 Juntas

As 14 juntas essenciais que formam o esqueleto bípede do projeto:

| ID | Nome em Português | Pai no Esqueleto | Função |
| :--- | :--- | :--- | :--- |
| `root` | Centro / Quadril | *Nenhum* (Raiz) | Origem global do personagem, centro de massa. |
| `head` | Pescoço / Cabeça | `root` | Rotação da cabeça e anexos faciais. |
| `upper_arm_near` | Ombro próximo | `root` | Articulação do braço frontal. |
| `forearm_near` | Cotovelo próximo | `upper_arm_near` | Dobra do antebraço frontal. |
| `hand_near` | Punho próximo | `forearm_near` | Extremidade e ponta do IK do braço frontal. |
| `upper_arm_far` | Ombro distante | `root` | Articulação do braço traseiro. |
| `forearm_far` | Cotovelo distante | `upper_arm_far` | Dobra do antebraço traseiro. |
| `hand_far` | Punho distante | `forearm_far` | Extremidade e ponta do IK do braço traseiro. |
| `thigh_near` | Quadril próximo | `root` | Articulação da perna frontal. |
| `shin_near` | Joelho próximo | `thigh_near` | Dobra da canela frontal. |
| `foot_near` | Tornozelo próximo | `shin_near` | Extremidade e ponta do IK da perna frontal. |
| `thigh_far` | Quadril distante | `root` | Articulação da perna traseira. |
| `shin_far` | Joelho distante | `thigh_far` | Dobra da canela traseira. |
| `foot_far` | Tornozelo distante | `shin_far` | Extremidade e ponta do IK da perna traseira. |

## Fluxo Interativo do Assistente

1. O usuário visualiza a arte do personagem no palco.
2. O assistente solicita sequencialmente cada um dos 14 pontos com marcadores com mira visual.
3. Ao clicar sobre a imagem, a coordenada de repouso é gravada.
4. Juntas adicionais (para cabelos longos, saias, capas, armas ou acessórios) podem ser adicionadas livremente como filhas de qualquer uma das 14 juntas anatômicas.
5. As juntas anatômicas permanecem como âncoras para presets de movimentos e espelhamento automático.
