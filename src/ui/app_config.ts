/**
 * chocoBones App paths configuráveis (sem hardcode espalhado).
 * Item 5: centraliza arquivos para testes + portabilidade.
 */
import * as path from "path";

export interface AppPaths {
  projectFile: string;
  exportPng: string;
  suzanneObj: string;
}

export function defaultAppPaths(cwd: string = process.cwd()): AppPaths {
  return {
    projectFile: path.resolve(cwd, "choco_puppet.project.json"),
    exportPng: path.resolve(cwd, "screenshot_export.png"),
    suzanneObj: path.resolve(cwd, "assets/models/suzanne.obj"),
  };
}
