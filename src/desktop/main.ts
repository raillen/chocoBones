/** Electrobun main process: native dialogs/files; the Solid view owns editor state. */
import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/main";
import type { DesktopRPC } from "./shared";
import { startAssetServer } from "./host/asset_server";
import { createDesktopServices } from "./host/services";

const DEFAULT_DEV_URL = "http://localhost:5173";

async function mainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    const candidate = process.env["CHOCOBONES_DEV_URL"] ?? DEFAULT_DEV_URL;
    const url = new URL(candidate);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("O servidor de desenvolvimento deve usar HTTP local.");
    try {
      const response = await fetch(candidate, { method: "HEAD", signal: AbortSignal.timeout(1000) });
      if (response.ok) return candidate;
    } catch { /* A packaged view also works without a running Vite server. */ }
  }
  return `views://editor/index.html${process.env["CHOCOBONES_QA"] === "1" ? "?qa=1" : ""}`;
}

const assetServer = startAssetServer();
const services = createDesktopServices({
  assets: assetServer.registry,
  configDir: Utils.paths.userData,
  dialogs: {
    openImages: () => Utils.openFileDialog({
      startingFolder: Utils.paths.pictures,
      allowedFileTypes: "png",
      canChooseFiles: true, canChooseDirectory: false, allowsMultipleSelection: true,
    }),
    openProject: async () => (await Utils.openFileDialog({
      startingFolder: Utils.paths.documents,
      allowedFileTypes: "json",
      canChooseFiles: true, canChooseDirectory: false, allowsMultipleSelection: false,
    }))[0] ?? null,
    chooseDirectory: async () => (await Utils.openFileDialog({
      startingFolder: Utils.paths.documents,
      canChooseFiles: false, canChooseDirectory: true, allowsMultipleSelection: false,
    }))[0] ?? null,
  },
});

const rpc = BrowserView.defineRPC<DesktopRPC>({
  maxRequestTime: 120_000,
  handlers: { requests: services, messages: {} },
});

const url = await mainViewUrl();
const mainWindow = new BrowserWindow({
  title: "chocoBones",
  url,
  rpc,
  renderer: "cef",
  frame: { width: 1440, height: 960 },
  allowedProtocols: { views: true, appData: false },
  navigationRules: JSON.stringify(["views://editor/*", ...(url.startsWith("http:") ? [`${new URL(url).origin}/*`] : [])]),
});

mainWindow.on("close", () => {
  assetServer.stop();
  Utils.quit();
});

let checkingClose = false;
mainWindow.on("will-close", (event) => {
  (event as { response: { allow: boolean } }).response = { allow: false };
  if (checkingClose) return;
  checkingClose = true;
  void rpc.request.confirmClose({}).then((allow) => { if (allow) mainWindow.close(); })
    .catch((error) => console.error("Não foi possível verificar as alterações antes de fechar:", error))
    .finally(() => { checkingClose = false; });
});

if (process.env["CHOCOBONES_DEVTOOLS"] === "1") mainWindow.webview.openDevTools();
