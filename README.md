# chocoBones-std

Editor nativo de personagens 2D/3D, montagem de peças, rig e animação em Odin. A interface usa Dear ImGui com docking sobre SDL2/OpenGL, com espaços Montagem, Rig, Animação e Foco, temas Dark/Light e accent configurável.

## Compilar e executar

Executar na raiz do projeto para resolver os recursos de `assets/`. É necessário ter Odin e as dependências nativas SDL2/OpenGL disponíveis; os bindings e as bibliotecas empacotadas ficam em `libs/`.

```sh
odin check src
mkdir -p bin
odin build src -out:bin/chocobones
./bin/chocobones
```

Para compilar e executar diretamente:

```sh
odin run src
```

Para executar os testes:

```sh
odin test tests
```

A escala pode ser ajustada entre 1 e 2, por exemplo:

```sh
CHOCOBONES_UI_SCALE=1.5 ./bin/chocobones
```

## Aparência e espaços de trabalho

Aparência oferece Light/Dark, presets ciano, azul, violeta, rosa, verde e âmbar, seletor livre e campo `#RRGGBB`. As fontes Inter Regular/Medium 4.1 e os ícones Phosphor acompanham o projeto. A licença da Inter está em `assets/fonts/LICENSE.txt`.

Montagem mostra Camadas e Inspetor; Rig destaca Juntas; Animação inclui a timeline; Foco amplia o palco. O menu de painéis permite reabrir painéis e restaurar o espaço ativo. Layouts e preferências ficam em `preferences.json` e `layouts.ini` no diretório retornado por `SDL_GetPrefPath("chocoBones", "chocoBones-std")`, separados dos arquivos de personagem. Tema e accent mantêm os pixels exportados.

O [guia da interface](docs/development/editor-ui.md) documenta os contratos, a persistência e a QA. Em 2026-10-11, check/build e os 41 testes passaram. A QA nativa em Xvfb `:99` com OpenGL por software passou em 18 casos de resolução/tema/escala e 14 verificações de interação, incluindo spritesheet, rolagem em 200% e keyframes/foco/teclado da timeline. As capturas e os roteiros confirmam a execução nesse ambiente; a validação no hardware do usuário não foi realizada.

## Kit de sprites para testes

O [Frontier Survival](assets/test-kits/frontier-survival/README.md) reúne seis humanos, seis animais e 24 roupas/equipamentos em PNG transparente com aparência vetorial, além de um humano modular com 15 peças corporais e seis acessórios em SVG editável e PNG. O catálogo está em `assets/test-kits/frontier-survival/index.html`; fontes, pivôs e instruções ficam junto aos assets.

O kit é material independente para testes. O editor nativo ainda não importa imagens próprias pelo diálogo nem restaura seus assets pelo JSON; o demonstrador do kit roda no navegador. Os PNGs das pranchas são poses estáticas, e somente o conjunto SVG modular compartilha alinhamento e pivôs definidos.

## Desenvolvimento e Prumo

O projeto usa **Prumo 0.6.0**, protocolo v3 e Lean Progressive Context. A fase registrada é **P00 — Foundation**; não há Goal formal selecionado. `prumo.json` é o manifesto, [ENTRYPOINT.md](ENTRYPOINT.md) define a recuperação e [PROJECT_STATE.md](PROJECT_STATE.md) registra o estado operacional.

Com Prumo instalado:

```sh
prumo validate .
prumo doctor .
```

| Diretório/arquivo | Conteúdo |
|---|---|
| `src/` | Aplicativo Odin e subsistemas de personagem/renderização |
| `src/ui/` | Temas, preferências, seleção, gizmos e widgets |
| `assets/` | Recursos e fontes empacotadas |
| `tests/` | Suíte automatizada Odin |
| `scripts/` | QA nativa da interface e das interações |
| `docs/` | Documentação canônica, organizada por público |
| `.prumo/` | Runtime e registro de inteligência/evidência |
| `CHANGELOG.md` | Histórico das alterações |

Consulte [docs/PRUMO.md](docs/PRUMO.md) para navegação e [docs/development/testing-strategy.md](docs/development/testing-strategy.md) para a estratégia de testes.
