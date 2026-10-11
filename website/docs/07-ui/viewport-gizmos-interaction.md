# Viewport, Gizmos e Ferramentas de Interação

A janela de Viewport é a área dominante do editor onde o artista manipula diretamente o personagem.

## 1. Ferramentas Principais

| Ferramenta | Tecla de Atalho | Comportamento |
| :--- | :--- | :--- |
| **Move** | `V` ou `W` | Translação da camada ou junta selecionada com restrição de eixo segurando Shift. |
| **Rotate** | `R` ou `E` | Rotação em torno do pivô da camada/junta, com passos de 15° segurando Shift. |
| **Scale** | `S` | Escala uniforme ou nos eixos X/Y através das alças do retângulo envolvente. |
| **Pivot** | `P` | Reposiciona o pivô de rotação sem alterar a posição atual do desenho na tela. |
| **Joint / Rig** | `J` | Cria ou reposiciona marcadores do esqueleto. |
| **Pose** | `Space` | Manipula juntas no modo de animação (com suporte a cinemática inversa com IK). |
| **Pin** | `N` | Adiciona ou move pinos de deformação da malha MLS. |
| **Weight** | `K` | Pincel de pintura de pesos esqueléticos sobre os vértices da malha. |
| **Pan / Zoom** | Botão do Meio / Roda | Navegação livre na área de trabalho e centralização. |

## 2. Renderização de Overlays e Gizmos

Gizmos são renderizados sobre a cena após a composição das texturas:
- Retângulo de seleção com 8 alças de controle.
- Ponto de pivô destacado em cruz.
- Linhas de ossos esqueléticos conectando as juntas pais aos filhos.
- Círculos indicadores de pinos (verde para livres, vermelho para bloqueados).
- Overlays nunca contaminam os buffers de exportação de imagem.

## 3. Seleção por Hit-Testing Preciso

O hit-testing na viewport testa:
1. Pinos e juntas através de distância euclidiana simples ao cursor ($r \le 8\text{px}$).
2. Camadas rígidas testando o ponto contra os 4 cantos transformados da peça.
3. Camadas de malha testando se o ponto do cursor está dentro de algum triângulo da malha através do teste baricêntrico (`pointInTriangle`).
