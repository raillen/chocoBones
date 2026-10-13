# Interface Slint legada

`main.slint` e `studio-controls.slint` preservam a interface anterior do chocoBones para compatibilidade. O desktop principal agora usa Electrobun + SolidJS + TypeScript em `src/desktop/`; execute esta versão Slint com:

```sh
pnpm run legacy:start
```

Ela contém os fluxos Montagem/Rig/Animação/Foco, temas Dark/Dim/Light, SVGs Phosphor e o painel Puppet com importação PNG, refinamento conforme, MLS/ARAP, pinos, presets, gesto e exportação transparente. A bridge e seus testes permanecem no repositório. A migração não modifica retroativamente os resultados de QA desta implementação.

O painel Slint exige Enter para confirmar campos numéricos e Aplicar para reconstruir a malha. Repouso edita pinos locais; Pose grava offsets. MLS usa Raio/Peso; ARAP usa alvos exatos sobre a malha. Locks mantêm repouso local, sem lock IK global.

[Interface principal e organização das ferramentas](../docs/development/editor-ui.md) · [Arquitetura da migração](../docs/development/desktop-migration.md) · [Capturas atuais Solid](../docs/development/screenshots/solid-editor/README.md) · [Capturas históricas Slint](../docs/development/screenshots/slint-studio/README.md) · [Deformação](../docs/development/screenshots/deformation-tools/README.md).
