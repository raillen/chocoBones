# Prumo Workforce — Catálogo Completo e Verificável

> **Fonte oficial:** [poppy-lat/prumo](https://github.com/poppy-lat/prumo) · [diretório workforce](https://github.com/poppy-lat/prumo/tree/main/src/prumo/resources/workforce)
>
> Inventário integral de capacidades: **39 agentes, 189 skills e 20 recipes**. Cada entrada abaixo descreve o ecossistema canônico de engenharia adotado pelo ChocoBones.

## Como Utilizar no ChocoBones

1. Selecione **o menor subconjunto** de habilidades aplicável à tarefa.
2. Diretivas específicas do ChocoBones (DOD em Odin, OpenGL 3.3, ausência de frameworks de álgebra pesados) prevalecem sobre orientações genéricas.
3. Não presuma que todas as ferramentas estão instaladas localmente; carregue apenas o que estiver disponível em `~/.claude/skills/` ou no ambiente ativo.

## Distribuição dos Agentes (39)

Consulte o [Catálogo Detalhado de Agentes](./agents-catalog.md) para a lista exata dos 39 agentes especializados em arquitetura, qualidade, segurança, motores de jogos e interfaces.

## Categorias de Skills (189)

| Seção | Escopo e Especialidades |
| :--- | :--- |
| [Fundações e Qualidade](./skills-foundations.md) | Clean Code, arquitetura de sistemas, debugging, Git, CI, engenharia de contexto e testes. |
| [Acessibilidade e Experiência](./skills-experience.md) | Ergonomia cognitiva, neurodivergência (W3C COGA), foco, teclado, contraste e design systems. |
| [Engine, Gráficos e Jogos](./skills-engine-graphics.md) | Arquitetura de motores 2D/3D, shaders, renderização, animação esquelética e performance nativa. |
| [Linguagens e Especialidades](./skills-languages-specialized.md) | Odin (`lang-odin`), C, C++, Rust, GLSL, Bash e ferramentas de sistemas. |

## Receitas de Engenharia (20)

Consulte o [Catálogo de Receitas](./recipes-catalog.md) para workflows padronizados de resolução de bugs, novas features, mudanças arquiteturais e auditorias visuais.
