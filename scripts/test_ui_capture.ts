import path from "node:path";
import * as slint from "slint-ui";
import { bindSlintWindow, createInitialAppState } from "../src/ui/bridge";

async function main(): Promise<void> {
  const uiFilePath = path.resolve(process.cwd(), "ui/main.slint");
  const ui = slint.loadFile(uiFilePath);

  const window = new (ui as any).MainWindow();
  const state = createInitialAppState();
  bindSlintWindow(window, state);

  console.log("Iniciando janela de teste para captura...");

  // Permite renderizar alguns frames e depois fechar
  setTimeout(() => {
    console.log("Fechando janela após captura.");
    process.exit(0);
  }, 4000);

  await window.run();
}

main().catch((err) => {
  console.error("Erro na captura de teste:", err);
  process.exit(1);
});
