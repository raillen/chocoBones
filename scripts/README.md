# Verificação nativa da interface

`qa_editor_ui.py` captura 18 combinações de Dark/Light, resoluções 1280×720,
1440×900 e 1920×1080, e escalas de 100%, 150% e 200%. Verifica saída limpa,
preferências e docking persistidos em diretórios temporários isolados.

`qa_editor_interactions.py` verifica salvar, seleção/arrasto, undo/redo,
exportação independente do tema, accent livre, espaços de trabalho, painéis,
restauração, playback, keyframes, modo 3D e reinício. Inclui rolagem das ferramentas
e uma captura da timeline compacta em 1280×720 a 200%. As coordenadas de interação correspondem
ao layout padrão de 1440×900 em 100%; uma alteração na composição exige revisar
o roteiro pelas capturas. Os arquivos de personagem e configurações do usuário
não são utilizados.

Requer Python 3, X11, `xdotool` e ImageMagick (`import` e `convert`). Para executar
em um display Xvfb próprio:

```sh
odin build src -out:bin/chocobones
Xvfb :99 -screen 0 2560x1600x24 -nolisten tcp
```

Em outro terminal, na raiz do projeto:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 scripts/qa_editor_ui.py --display :99 --output /tmp/chocobones-ui-qa
PYTHONDONTWRITEBYTECODE=1 python3 scripts/qa_editor_interactions.py --display :99 --output /tmp/chocobones-ui-qa
```

As capturas são janelas reais do aplicativo SDL/OpenGL. O ambiente Xvfb valida
composição e interação com renderização por software; desempenho e integração
com o gerenciador de janelas do usuário dependem do ambiente de execução.
