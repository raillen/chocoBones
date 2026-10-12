/**
 * chocoBones TypeScript Desktop Application Entrypoint
 * Inicializa a engine, carrega o arquivo Slint e abre a janela nativa.
 */

import path from "node:path";
import slint from "slint-ui";
import { bindSlintWindow, createInitialAppState } from "./ui/bridge";

async function main(): Promise<void> {
  const uiFilePath = path.resolve(import.meta.dir, "../ui/main.slint");
  const ui = slint.loadFile(uiFilePath);

  const window = new (ui as any).MainWindow();
  const state = createInitialAppState();

  const cleanup = bindSlintWindow(window, state);

  console.log("🦴 chocoBones Desktop (TypeScript + Bun + Slint) inicializado com sucesso!");
  console.log("   - Workspaces: Montagem, Rig, Animação, Foco");
  console.log("   - Cinemática: FK / 2-Bone IK");
  console.log("   - Deformação: MLS Rígido 2D");
  console.log("   - Shaders: WebGPU WGSL");

  await window.run();
  cleanup();
}

main().catch((err) => {
  console.error("Erro ao executar chocoBones:", err);
  process.exit(1);
});
