# Schema `survivor-puppet` v1 e Persistência de Arquivo

O formato de arquivo `.puppet.json` é um formato aberto e padronizado em JSON.

## 1. Contrato do Projeto

```json
{
  "schema": "survivor-puppet",
  "version": 1,
  "name": "Sobrevivente Padrão",
  "width": 512,
  "height": 512,
  "assets": [
    {
      "id": "asset-head",
      "name": "Cabeça",
      "w": 234,
      "h": 309,
      "data": "data:image/png;base64,...",
      "material": "skin",
      "color": 0
    }
  ],
  "joints": [
    {
      "id": "root",
      "name": "Centro / quadril",
      "parent": null,
      "x": 256,
      "y": 300,
      "color": "#eab308"
    }
  ],
  "layers": [
    {
      "id": "layer-head",
      "name": "Cabeça",
      "asset": "asset-head",
      "transform": { "x": 256, "y": 211, "rotation": 0, "sx": 1, "sy": 1, "px": 115, "py": 259 },
      "joint": "head",
      "visible": true,
      "locked": false,
      "opacity": 1.0,
      "blend": "source-over",
      "mesh": null,
      "pins": []
    }
  ],
  "clips": [],
  "poses": []
}
```

## 2. Serialização em Odin

Utiliza-se o pacote nativo `core:encoding/json`:
* Structs do Odin espelham os campos com tags de campo idênticas.
* Campos numéricos são serializados com precisão de ponto flutuante adequada.
* Imagens importadas são armazenadas como data URLs base64 ou caminhos relativos ao arquivo do projeto.

## 3. Gravação Atômica (Atomic Write)

Para evitar corrupção em caso de queda de energia ou fechamento inesperado:
1. O documento é serializado em um arquivo temporário (`.puppet.json.tmp`).
2. O arquivo temporário é sincronizado com o disco.
3. Executa-se a substituição atômica (`os.rename`) sobre o arquivo final de destino.
