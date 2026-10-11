# Fontes do editor

- `Inter-Regular.ttf` e `Inter-Medium.ttf`: Inter 4.1, obtida na
  [release oficial](https://github.com/rsms/inter/releases/tag/v4.1).
  A licença SIL Open Font License 1.1 acompanha os arquivos em `LICENSE.txt`.
- `Phosphor.ttf`: fonte de ícones já utilizada pelo projeto.

O editor carrega as fontes em 14 px e combina os ícones Phosphor com cada peso
da Inter. A configuração exclui a faixa de uso privado da Inter, que também
contém alternates tipográficos, para evitar colisões com os ícones Phosphor.
Ausência da Inter utiliza a fonte padrão do ImGui.

A escala lógica da interface pode ser configurada para verificação com
`CHOCOBONES_UI_SCALE=1`, `1.5` ou `2`.
