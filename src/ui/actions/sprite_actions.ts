/** Legacy Node/Slint file adapter over the shared sprite document actions. */
import { promises as fs } from "node:fs";
import path from "node:path";
import { decodePng } from "../../assets/png";
import { importDecodedSprite } from "./sprite_document";
import type { AppState } from "../store";
import type { Layer } from "../../rig/joint";
export { fitCanvas, syncSpriteBuildSettings, setSpriteDeformation, rebuildSpriteMesh, autoSpritePins, importDecodedSprite } from "./sprite_document";

export function importSpriteData(state: AppState, png: Buffer, name: string): Layer {
  return importDecodedSprite(state, decodePng(png), name);
}

export async function importSpriteFile(state: AppState, filename: string): Promise<Layer> {
  const stat = await fs.stat(filename);
  if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new Error("Escolha um PNG com até 10 MB.");
  return importSpriteData(state, await fs.readFile(filename), path.basename(filename));
}
