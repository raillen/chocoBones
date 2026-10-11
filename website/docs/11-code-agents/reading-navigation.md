# Leitura, Autoridade e Contexto Progressivo

Como navegar com eficiência técnica nos artefatos do ChocoBones evitando alucinações e sobrecarga de contexto.

## 1. Pirâmide de Autoridade Documental

Em caso de divergência ou ambiguidade entre fontes, a ordem estrita de autoridade é:

1. **Documento Canônico de Arquitetura (`website/docs/`):** Define a decisão formal aprovada para a reimplementação em Odin.
2. **Código de Referência Validado (`custom-char-creator/src/studio/`):** Fonte da verdade para equações matemáticas comprovadas (algoritmos de `math.ts`).
3. **Casos de Teste Legados (`custom-char-creator/tests/`):** Baseline de comportamento e tolerância numérica.
4. **Skills e Guidelines Globais (`Prumo Workforce`):** Padrões gerais de estilo e engenharia.

## 2. Padrão Lean Progressive Context

Assistentes LLM devem operar em três fases sequenciais:

```text
[ Descoberta ]           [ Leitura Seletiva ]          [ Ação Grounded ]
Buscar caminho no     ──► Ler apenas o documento  ──► Escrever código e
manifesto / progress       do domínio alvo             testar antes de concluir
```

- **Fase de Descoberta:** Consulte o `manifest.json` ou execute buscas textuais por palavras-chave com a ferramenta de busca.
- **Fase de Leitura:** Carregue apenas o arquivo `.md` correspondente à feature. Não leia domínios não correlatos.
- **Fase de Ação:** Edite o código localmente, execute o compilador (`odin build` ou `odin test`), valide contra regressões e gere o relatório conciso de entrega.
