/** Typed boundary between the native Bun host and the browser editor. */
import type { Project } from "../project/project";
import type { JointDelta, LayerDelta } from "../rig/joint";
import type { Vec2 } from "../core/types";

export interface DesktopAsset {
  id: string;
  name: string;
  width: number;
  height: number;
  pngUrl: string;
  rgbaUrl: string;
}

export interface DesktopPreferences {
  theme: "dark" | "dim" | "light" | "system";
  leftPanelWidth: number;
  rightPanelWidth: number;
  timelineHeight: number;
}

export interface DesktopBootstrap {
  preferences: DesktopPreferences;
  platform: string;
  version: string;
}

/** Assets carry bytes over the loopback server, never as arrays in RPC JSON. */
export interface ProjectPayload {
  project: Project;
  assets: DesktopAsset[];
  path: string | null;
}

export interface SaveProjectParams {
  project: Project;
  path?: string;
  /** Set after an explicit overwrite choice in the editor. */
  overwrite?: boolean;
}

export interface ExportArtworkParams extends SaveProjectParams {
  kind: "png" | "spritesheet";
  /** Omit to export the current pin pose stored in the project. */
  time?: number;
  frames?: number;
  columns?: number;
  /** Current edited pose, including channels not yet baked into keyframes. */
  pose?: { joints: Record<string, JointDelta>; layers: Record<string, LayerDelta>; pins: Record<string, Vec2>; params: Record<string, number> };
}

export interface ExportArtworkResult {
  path: string;
  width: number;
  height: number;
  frames: number;
}

export type DesktopRPC = {
  bun: {
    requests: {
      bootstrap: { params: Record<string, never>; response: DesktopBootstrap };
      importImages: { params: { paths?: string[] }; response: DesktopAsset[] };
      openProject: { params: { path?: string }; response: ProjectPayload | null };
      chooseDirectory: { params: Record<string, never>; response: string | null };
      saveProject: { params: SaveProjectParams; response: { path: string } };
      exportArtwork: { params: ExportArtworkParams; response: ExportArtworkResult };
      savePreferences: { params: { preferences: DesktopPreferences }; response: DesktopPreferences };
    };
    messages: {};
  };
  webview: {
    requests: { confirmClose: { params: Record<string, never>; response: boolean } };
    messages: {};
  };
};
