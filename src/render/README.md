# Subsistema de Renderização e Shaders (`src/render`)

Fornece o pipeline de renderização acelerada por GPU (**WebGPU / WGSL**) e o gerador de Framebuffer em memória contínua para integração com o Slint.

## Componentes

* [`shaders.ts`](shaders.ts): Shaders em WGSL contendo o pipeline de batching de sprites 2D e o Compute Shader de deformação MLS paralela.
* [`viewport_buffer.ts`](viewport_buffer.ts): Buffer de pixels RGBA de alta velocidade (`Uint8ClampedArray`), gerando rasterização de grade ortográfica, linhas de Bresenham e representação anatômica do esqueleto articulado em tempo real.

## Comunicação com a UI

O buffer bruto de bytes do `ViewportBuffer` é alimentado diretamente para a propriedade `<Image>` da janela do Slint via `slint.Image.fromRgba8(width, height, buffer)`.
