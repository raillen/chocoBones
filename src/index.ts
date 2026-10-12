/**
 * chocoBones TypeScript Desktop Application Entrypoint
 * Inicializa a engine, carrega o arquivo Slint e abre a janela nativa.
 */

import path from "node:path";
import * as slint from "slint-ui";
import { bindSlintWindow, createInitialAppState } from "./ui/bridge";

async function main(): Promise<void> {
  const baseDir = (import.meta as any).dirname ?? (import.meta as any).dir ?? path.resolve(process.cwd(), "src");
  const uiFilePath = path.resolve(baseDir, "../ui/main.slint");
  const ui = slint.loadFile(uiFilePath);

  const window = new (ui as any).MainWindow();
  const state = createInitialAppState();

  const cleanup = bindSlintWindow(window, state);

  console.log("chocoBones Desktop (TypeScript + Node + pnpm + Slint) inicializado com sucesso!");
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
