# Interface Gráfica Declarativa Slint (`ui/`)

Contém os arquivos de layout compilados e interpretados pelo **Slint**.

## Componentes

* [`main.slint`](main.slint):
  * **MainWindow**: Janela desktop com resolução preferida 1280×768 e tema escuro (#18181b).
  * **Barra de Navegação**: Alternador entre os quatro espaços de trabalho (*Montagem*, *Rig*, *Animação* e *Foco*).
  * **Painel Esquerdo**: Árvore hierárquica de camadas e esqueleto de juntas.
  * **Viewport Central**: Container dinâmico com superfície `<Image>` recebendo o buffer de pixels 2D/3D gerado pelo motor da aplicação.
  * **Painel Direito**: Inspetor de propriedades, parâmetros de deformação MLS e shaders.
  * **Linha do Tempo (Timeline)**: Régua temporal, controles de Play/Pause e slider para scrubbing em tempo real.
