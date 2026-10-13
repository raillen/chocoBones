import { computeGridUvs } from "../mesh/mesh";
import { matApply } from "../core/math";
import { boneMatrices, layerMatrix } from "../rig/fk";
import { createPose, type Pose } from "../rig/joint";
import { evaluateClipInto } from "../animation/evaluator";
import { drawTexturedMesh } from "./sprite_raster";
import { ViewportBuffer } from "./viewport_buffer";
import type { AppState } from "../ui/store";
import { deformSpriteMesh } from "./deformed_sprite";

/** Same texture/deformation path for preview, ghost frames and transparent export. */
export function drawSpriteScene(
  target: ViewportBuffer, state: AppState, pose: Pose,
  panX = 0, panY = 0, zoom = 1, opacity = 1,
): void {
  const bones = boneMatrices(state.joints, pose);
  for (const layer of state.layers) {
    const delta = pose.layers.get(layer.id);
    if (!layer.visible || delta?.visible === false) continue;
    const image = state.spriteAssets.get(delta?.asset || layer.asset);
    const meshId = state.meshLayer.get(layer.id);
    const mesh = meshId === undefined ? undefined : state.meshes[Number(meshId)];
    if (!image || !mesh) continue;
    const pins = state.pins.filter((pin) => pin.meshId === meshId);
    const storedUvs = state.meshUvs.get(meshId!);
    const baseImage = state.spriteAssets.get(layer.asset) ?? image;
    const uvs = storedUvs?.length === mesh.vertices.length ? storedUvs : computeGridUvs(mesh, baseImage.width, baseImage.height);
    const packet = deformSpriteMesh(mesh, uvs, pins, pose.pins);
    const matrix = layerMatrix(layer, state.joints, pose, bones);
    const screen = packet.vertices.map((point) => {
      const [x, y] = matApply(matrix, point);
      return target.worldToScreen(x, y, panX, panY, zoom);
    });
    drawTexturedMesh(target, screen, packet.triangles, packet.uvs, image,
      Math.max(0, Math.min(1, layer.opacity * (delta?.opacity ?? 1) * opacity)));
  }
}

export function renderArtwork(state: AppState, time?: number): ViewportBuffer {
  if (state.canvasWidth * state.canvasHeight > 16_777_216) throw new Error("Canvas acima do limite de 16 milhões de pixels.");
  const target = new ViewportBuffer(state.canvasWidth, state.canvasHeight);
  target.clear(0, 0, 0, 0);
  const pose = time === undefined ? state.currentPose : createPose();
  if (time !== undefined) evaluateClipInto(state.activeClip, time, pose);
  drawSpriteScene(target, state, pose);
  return target;
}
