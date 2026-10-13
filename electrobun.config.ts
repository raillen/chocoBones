import type { ElectrobunConfig } from "./.hutch/devkit/api/config/ElectrobunConfig";

const chromiumFlags = {
  "disable-gpu": false,
  ...(process.env["CHOCOBONES_DEBUG_PORT"] ? { "remote-debugging-port": process.env["CHOCOBONES_DEBUG_PORT"] } : {}),
};

export default {
  app: {
    name: process.env["CHOCOBONES_APP_NAME"] ?? "chocoBones",
    identifier: process.env["CHOCOBONES_APP_IDENTIFIER"] ?? "studio.chocobones.editor",
    version: "0.1.0",
  },
  build: {
    buildFolder: process.env["CHOCOBONES_BUILD_FOLDER"] ?? "build",
    mainProcess: "bun",
    bun: { entrypoint: "src/desktop/main.ts" },
    copy: { "web-dist": "views/editor" },
    watchIgnore: ["web-dist/**", "dist/**", "docs/**", "tests/**", "node_modules/**"],
    linux: { bundleCEF: true, chromiumFlags },
    win: { bundleCEF: true, chromiumFlags },
    mac: { bundleCEF: true, chromiumFlags },
  },
} satisfies ElectrobunConfig;
