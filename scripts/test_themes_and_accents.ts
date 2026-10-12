import path from "node:path";
import * as fs from "node:fs";
import * as slint from "slint-ui";
import { bindSlintWindow, createInitialAppState, exportPngSync } from "../src/ui/bridge";
import { renderFrame } from "../src/render/loop";

async function main(): Promise<void> {
  const uiFilePath = path.resolve(process.cwd(), "ui/main.slint");
  const ui = slint.loadFile(uiFilePath);

  const window = new (ui as any).MainWindow();
  const state = createInitialAppState();
  const cleanup = bindSlintWindow(window, state);

  console.log("=== Testando Adaptabilidade Dinâmica do chocoBones ===");

  // 1. Tema Dark (Padrão)
  expectEqual(window.theme_mode, "Dark", "Tema inicial Slint");
  expectEqual(state.themeMode, "Dark", "Tema inicial AppState");
  renderFrame(state);
  const darkPng = exportPngSync(state);
  fs.writeFileSync("/tmp/chocobones_dark_2d.png", darkPng);
  console.log("OK: Tema Dark: PNG exportado com sucesso (", darkPng.length, "bytes)");

  // 2. Transição para Tema Claro (Light)
  window.change_theme("Light");
  expectEqual(window.theme_mode, "Light", "Tema após change_theme(Light)");
  expectEqual(state.themeMode, "Light", "AppState após change_theme(Light)");
  renderFrame(state);
  // Pixel (5, 5) deve ser papel claro
  const idx = (5 * state.viewportBuffer.width + 5) * 4;
  expectEqual(state.viewportBuffer.pixels[idx], 244, "Light R");
  expectEqual(state.viewportBuffer.pixels[idx + 1], 244, "Light G");
  expectEqual(state.viewportBuffer.pixels[idx + 2], 246, "Light B");
  const lightPng = exportPngSync(state);
  fs.writeFileSync("/tmp/chocobones_light_2d.png", lightPng);
  console.log("OK: Tema Light: fundo reativo (244, 244, 246) e PNG exportado (", lightPng.length, "bytes)");

  // 3. Transição para Tema Dim (Grafite)
  window.change_theme("Dim");
  expectEqual(window.theme_mode, "Dim", "Tema após change_theme(Dim)");
  expectEqual(state.themeMode, "Dim", "AppState após change_theme(Dim)");
  renderFrame(state);
  expectEqual(state.viewportBuffer.pixels[idx], 32, "Dim R");
  expectEqual(state.viewportBuffer.pixels[idx + 1], 32, "Dim G");
  expectEqual(state.viewportBuffer.pixels[idx + 2], 36, "Dim B");
  const dimPng = exportPngSync(state);
  fs.writeFileSync("/tmp/chocobones_dim_2d.png", dimPng);
  console.log("OK: Tema Dim: fundo reativo (32, 32, 36) e PNG exportado (", dimPng.length, "bytes)");

  // 4. Teste de 3D nos 3 Temas
  window.set_viewport_mode("3D");
  expectEqual(window.viewport_mode, "3D", "Modo Viewport 3D");
  renderFrame(state);
  const dim3dPng = exportPngSync(state);
  fs.writeFileSync("/tmp/chocobones_dim_3d.png", dim3dPng);
  console.log("OK: Palco 3D em Dim exportado (", dim3dPng.length, "bytes)");

  window.change_theme("Light");
  renderFrame(state);
  const light3dPng = exportPngSync(state);
  fs.writeFileSync("/tmp/chocobones_light_3d.png", light3dPng);
  console.log("OK: Palco 3D em Light exportado (", light3dPng.length, "bytes)");

  // 5. Troca de Cores de Acento (ACCENT_PRESETS)
  const accents = ["Ciano", "Azul", "Violeta", "Rosa", "Verde", "Ambar"];
  for (const acc of accents) {
    window.change_accent(acc);
    expectEqual(window.accent_name, acc, `Acento ${acc}`);
    expectEqual(state.accentName, acc, `AppState acento ${acc}`);
  }
  console.log("OK: Troca dos 6 acentos validada com sucesso");

  // 6. Troca de Ferramentas e Abas
  const tools = ["Move", "Rotate", "Scale", "Pivot", "Joint", "CreateBone", "Pose", "Pin", "Weight"];
  for (const t of tools) {
    window.select_tool(t);
    expectEqual(window.active_tool, t, `Ferramenta ${t}`);
  }
  console.log("OK: Todas as ferramentas de manipulação validadas com sucesso");

  window.set_element_tab("Camadas");
  expectEqual(window.element_tab, "Camadas", "Aba de elementos: Camadas");
  window.set_element_tab("Juntas");
  expectEqual(window.element_tab, "Juntas", "Aba de elementos: Juntas");
  console.log("OK: Abas do inspetor de elementos validadas com sucesso");

  console.log("\nTODOS OS TESTES DE ADAPTABILIDADE E ESTILO PASSARAM COM SUCESSO!");
  cleanup();
  process.exit(0);
}

function expectEqual<T>(actual: T, expected: T, desc: string): void {
  if (actual !== expected) {
    throw new Error(`Falha em [${desc}]: esperado ${expected}, obtido ${actual}`);
  }
}

main().catch((err) => {
  console.error("Erro no teste de adaptabilidade:", err);
  process.exit(1);
});
