# Subsistema de Interface e Bridge do Slint (`src/ui`)

Conecta a engine reativa do chocoBones em TypeScript com os componentes nativos de janela do Slint.

## Componentes

* [`bridge.ts`](bridge.ts):
  * `createInitialAppState`: Cria o estado global da aplicação com o preset de juntas *Humanoid* e o buffer de renderização.
  * `bindSlintWindow`: Associa os callbacks da UI (`toggle_play`, `change_workspace`, `timeline_seek`) e dispara o ciclo de amostragem de animação a 60 FPS, transmitindo os frames RGBA para o Slint.
