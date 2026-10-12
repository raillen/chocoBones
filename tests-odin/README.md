# Suíte de Testes Automatizados (Tests)

Este diretório contém a suíte completa de testes unitários, integração e conformidade para o ChocoBones em Odin.

## Execução

Para rodar todos os testes com rastreamento automático de vazamentos de memória (Memory Tracking):

```bash
odin test tests
```

Para rodar um teste específico:

```bash
odin test tests -define:ODIN_TEST_NAMES=tests.test_auto_guess_joint_humanoid
```

## Cobertura de Testes

| Arquivo de Teste | Área Testada |
|---|---|
| `test_math.odin` | Vetores 2D, matrizes afins, transformações, produto vetorial e normalização |
| `test_mesh.odin` | Geração de malhas triangulares, deformação MLS afim/rígida e pinos |
| `test_rig_presets.odin` | Predefinições de rig, manipulação de juntas e detecção estrita de ciclos |
| `test_animation.odin` | Clipes, canais, curvas Bezier cúbicas e interpolação de poses |
| `test_animation_pack.odin` | Pacote padrão de animações prontas (caminhada, corrida, salto, ataque, ocioso) |
| `test_image_import.odin` | Decodificação de imagem bruta, metadados de camadas e heurística anatômica `auto_guess_joint_for_layer` |
| `test_native_dialog.odin` | Integração do assistente de diálogo de arquivos nativo do sistema operacional |
| `test_showcase.odin` | Conjuntos de vitrine de alta fidelidade (Sobrevivente 18 partes e Lobo Quadrúpede) |
| `test_history.odin` | Pilha de histórico de edição, capacidade circular e comandos Desfazer/Refazer |
| `test_project.odin` | Serialização e desserialização de arquivos de projeto `.puppet.json` |
| `test_export.odin` | Renderização e exportação para arquivos PNG e spritesheets de animação |
| `test_mesh3d.odin` | Carregamento de modelos 3D Wavefront OBJ, glTF/GLB e primitivas paramétricas |
| `test_theme.odin` | Paletas de cores, contraste acessível WCAG 2.2 e temas Claro/Escuro |
| `test_preferences.odin` | Esquema de preferências do editor e serialização JSON |
| `test_ui.odin` | Componentes de interface do usuário, seleção e notificações flutuantes |
| `test_seam_mask.odin` | Máscaras de emenda para junções suaves de articulações |
| `test_conformance.odin` | Testes de conformidade e tolerâncias numéricas |
