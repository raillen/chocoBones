/** Browser-safe project mapping. The desktop host verifies and decodes embedded PNGs. */
import { type SpriteImage, validateSpriteImage } from "../assets/image";
import { type Vec2 } from "../core/types";
import { migrateV1ToV2, type Project, ProjectSchema } from "../project/project";
import { buildGridMesh, computeGridUvs, createPin, MeshMode, SkinningMode } from "../mesh/mesh";
import { createClip, Easing, sortClipFrames, type Clip } from "../animation/timeline";
import { createPose, type Joint, type Layer } from "../rig/joint";
import type { AppState } from "../ui/store";
import { syncSpriteBuildSettings, validateSpriteMeshDeformation } from "../ui/actions/sprite_document";

/** Chunked conversion avoids spread/apply stack limits on multi-megabyte PNGs. */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}

export function editorStateToProject(state: AppState): Project {
  const assetKeys = [...new Set(state.layers.map((l) => l.asset).filter(Boolean))];
  const includedImages = new Set(assetKeys.map((key) => state.spriteAssets.get(key)).filter(Boolean));
  // Preserva assets sem camada, evitando duplicar aliases produzidos ao importar projetos.
  for (const [key, image] of state.spriteAssets) {
    if (!includedImages.has(image)) {
      assetKeys.push(key);
      includedImages.add(image);
    }
  }
  return {
    schema: "survivor-puppet",
    version: 2,
    name: "chocoBones Puppet",
    width: state.canvasWidth,
    height: state.canvasHeight,
    assets: assetKeys.map((key) => {
      const image = state.spriteAssets.get(key);
      return {
        id: key, name: key, w: image?.width ?? 256, h: image?.height ?? 256,
        data: image ? encodeBase64(image.png) : "", material: "default", color: 0,
        uri: `assets/${key}`,
      };
    }),
    joints: state.joints.map((j) => ({ ...j })),
    layers: state.layers.map((l) => ({
      id: l.id, name: l.name, asset: l.asset,
      transform: { x: l.transform.pos[0], y: l.transform.pos[1], rotation: l.transform.rotation, sx: l.transform.scale[0], sy: l.transform.scale[1], px: l.transform.pivot[0], py: l.transform.pivot[1] },
      joint: l.joint, visible: l.visible, locked: l.locked, opacity: l.opacity, blend: "normal",
      seamMask: { layer: l.seamMask.layer ?? "", enabled: l.seamMask.enabled, center: { x: l.seamMask.center[0], y: l.seamMask.center[1] }, radius: l.seamMask.radius, feather: l.seamMask.feather },
    })),
    meshes: state.meshes.map((m, i) => ({
      id: String(i),
      layerId: [...state.meshLayer.entries()].find(([, v]) => v === String(i))?.[0] ?? "",
      density: m.density,
      vertices: m.vertices.map((v) => [...v] as Vec2),
      triangles: m.triangles.map((t) => [...t] as [number, number, number]),
      uvs: (state.meshUvs.get(String(i)) ?? []).map((uv) => [...uv] as Vec2),
      weights: m.weights.map((list) => list.map((w) => ({ ...w }))),
      mode: m.mode, skinning: m.skinning, strength: m.strength,
      deformation: m.deformation ?? "MLS", build: m.build ? { ...m.build } : undefined,
      buildStats: m.buildStats ? { ...m.buildStats } : undefined,
    })),
    pins: state.pins.map((p) => ({
      id: p.id, name: p.name, meshId: p.meshId ?? "", x: p.x, y: p.y,
      offsetX: state.currentPose.pins.get(p.id)?.[0] ?? 0,
      offsetY: state.currentPose.pins.get(p.id)?.[1] ?? 0,
      locked: p.locked, enabled: p.enabled ?? true,
      anchorMode: p.anchorMode ?? "free", anchorJoint: p.anchorJoint ?? "",
      radius: p.radius ?? 0, falloff: p.falloff ?? 2.0, strength: p.strength ?? 1,
    })),
    clips: [{
      id: state.activeClip.id, name: state.activeClip.name, duration: state.activeClip.duration,
      fps: state.activeClip.fps, loop: state.activeClip.loop,
      frames: state.activeClip.frames.map((f) => ({
        id: f.id, time: f.time, joints: Object.fromEntries(f.joints),
        layers: Object.fromEntries(f.layers), pins: Object.fromEntries(f.pins),
        params: Object.fromEntries(f.params), easing: f.easing, bezier: f.bezier, channels: f.channels,
      })),
    }],
    constraints: [],
  };
}

/** Prepara e valida todos os dados antes de tocar no documento/histórico aberto. */
export function prepareEditorProject(project: Project, decodedAssets: ReadonlyMap<string, SpriteImage>) {
  const parsed = ProjectSchema.parse(project);
  const v2 = migrateV1ToV2(parsed);
  const byId = new Map<string, SpriteImage>();
  const byName = new Map<string, SpriteImage>();
  const assetIds = new Set<string>();
  for (const asset of v2.assets) {
    if (assetIds.has(asset.id)) throw new Error(`Asset duplicado: '${asset.id}'`);
    assetIds.add(asset.id);
    const image = decodedAssets.get(asset.id);
    // Native RPC sends PNG pixels through an asset capability, leaving JSON data empty.
    if (!image && asset.data === "") continue; // Legacy manifests without pixels remain valid.
    if (!image) throw new Error(`Asset '${asset.id}': pixels decodificados ausentes`);
    validateSpriteImage(image);
    if (image.width !== asset.w || image.height !== asset.h) {
      throw new Error(`Asset '${asset.id}': dimensões do PNG não correspondem ao manifest`);
    }
    byId.set(asset.id, image);
    if (!byName.has(asset.name)) byName.set(asset.name, image);
  }
  const spriteAssets = new Map(byId);
  const joints: Joint[] = v2.joints.map((j) => ({ ...j }));
  const layers: Layer[] = v2.layers.map((l) => {
    const image = byId.get(l.asset) ?? byName.get(l.asset);
    if (image) spriteAssets.set(l.asset, image);
    return {
      id: l.id, name: l.name, asset: l.asset,
      transform: { pos: [l.transform.x, l.transform.y], scale: [l.transform.sx, l.transform.sy], rotation: l.transform.rotation, pivot: [l.transform.px, l.transform.py] },
      joint: l.joint, visible: l.visible, locked: l.locked, opacity: l.opacity,
      hasSeamMask: l.seamMask.enabled,
      seamMask: { layer: l.seamMask.layer, enabled: l.seamMask.enabled, center: [l.seamMask.center.x, l.seamMask.center.y], radius: l.seamMask.radius, feather: l.seamMask.feather },
    };
  });
  const meshIndices = new Map<string, string>();
  const meshLayer = new Map<string, string>();
  const meshUvs = new Map<string, Vec2[]>();
  const meshes = v2.meshes.map((m, i) => {
    if (meshIndices.has(m.id)) throw new Error(`Malha duplicada: '${m.id}'`);
    const meshId = String(i);
    meshIndices.set(m.id, meshId);
    if (m.layerId) meshLayer.set(m.layerId, meshId);
    if (m.uvs.length && m.uvs.length !== m.vertices.length) {
      throw new Error(`Malha '${m.id}': número de UVs não corresponde aos vértices`);
    }
    for (const tri of m.triangles) {
      if (tri.some((index) => !Number.isInteger(index) || index < 0 || index >= m.vertices.length)) {
        throw new Error(`Malha '${m.id}': triângulo referencia vértice inexistente`);
      }
    }
    const mesh = buildGridMesh(10, 10, 2);
    mesh.density = m.density;
    mesh.vertices = m.vertices.map((v) => [...v] as Vec2);
    mesh.triangles = m.triangles.map((t) => [...t] as [number, number, number]);
    mesh.weights = m.weights.map((list) => list.map((w) => ({ ...w })));
    mesh.mode = m.mode === MeshMode.Skin ? MeshMode.Skin : MeshMode.Pins;
    mesh.skinning = m.skinning === SkinningMode.DualQuaternion ? SkinningMode.DualQuaternion : SkinningMode.Linear;
    mesh.strength = m.strength;
    mesh.deformation = m.deformation;
    mesh.build = m.build ? { ...m.build } : undefined;
    mesh.buildStats = m.buildStats ? { ...m.buildStats } : undefined;
    meshUvs.set(meshId, m.uvs.map((uv) => [...uv] as Vec2));
    return mesh;
  });
  const pose = createPose();
  const pins = v2.pins.map((p) => {
    const meshId = p.meshId ? meshIndices.get(p.meshId) : "";
    if (meshId === undefined) throw new Error(`Pino '${p.id}': malha '${p.meshId}' inexistente`);
    if (p.offsetX !== 0 || p.offsetY !== 0) pose.pins.set(p.id, [p.offsetX, p.offsetY]);
    return createPin(p.id, meshId, p.x, p.y, {
      name: p.name || p.id, locked: p.locked, enabled: p.enabled,
      anchorMode: p.anchorMode, anchorJoint: p.anchorJoint,
      radius: p.radius, falloff: p.falloff, strength: p.strength,
    });
  });
  const sourceClip = v2.clips[0];
  // Reject an unsupported ARAP document before replacing the editor state.
  for (const [layerId, meshId] of meshLayer) {
    const mesh = meshes[Number(meshId)]!;
    if (mesh.deformation !== "ARAP") continue;
    const layer = layers.find((l) => l.id === layerId);
    const image = layer ? spriteAssets.get(layer.asset) : undefined;
    if (!image) continue;
    const stored = meshUvs.get(meshId);
    const uvs = stored?.length === mesh.vertices.length ? stored : computeGridUvs(mesh, image.width, image.height);
    validateSpriteMeshDeformation(mesh, uvs, pins.filter((p) => p.meshId === meshId));
  }
  const activeClip: Clip = sourceClip ? {
    id: sourceClip.id, name: sourceClip.name, duration: sourceClip.duration,
    fps: sourceClip.fps, loop: sourceClip.loop,
    frames: sourceClip.frames.map((f) => ({
      id: f.id, time: f.time,
      joints: new Map(Object.entries(f.joints).map(([id, delta]) => [id, { ...delta }])),
      layers: new Map(Object.entries(f.layers).map(([id, delta]) => [id, { ...delta }])),
      pins: new Map(Object.entries(f.pins).map(([id, delta]) => [id, [...delta] as Vec2])),
      params: new Map(Object.entries(f.params)), easing: f.easing as Easing,
      bezier: [...f.bezier] as [number, number, number, number], channels: [...f.channels],
    })),
  } : createClip("idle", "Idle", 2, 60, true);
  sortClipFrames(activeClip);
  return { joints, layers, spriteAssets, meshes, meshLayer, meshUvs, pins, pose, activeClip, width: v2.width, height: v2.height };
}

export function applyPreparedEditorProject(state: AppState, document: ReturnType<typeof prepareEditorProject>): void {
  state.joints = document.joints;
  state.layers = document.layers;
  state.spriteAssets = document.spriteAssets;
  state.canvasWidth = document.width;
  state.canvasHeight = document.height;
  state.meshes = document.meshes;
  state.meshLayer = document.meshLayer;
  state.meshUvs = document.meshUvs;
  state.pins = document.pins;
  state.currentPose = document.pose;
  state.activeClip = document.activeClip;
  state.activeClipName = document.spriteAssets.size ? document.activeClip.name : document.activeClip.id;
  state.isPlaying = false;
  state.timelineDuration = document.activeClip.duration;
  state.timelineTime = 0;
  state.isPlaying = false;
  state.selectedJointId = state.joints[0]?.id ?? "";
  state.selection.selectedJointIds = state.selectedJointId ? [state.selectedJointId] : [];
  state.selectedLayerId = state.layers.find((layer) => state.spriteAssets.has(layer.asset))?.id ?? state.layers[0]?.id ?? "";
  state.selection.selectedLayerIds = state.selectedLayerId ? [state.selectedLayerId] : [];
  state.selection.anchorLayerIdx = state.layers.length ? 0 : -1;
  state.selectedPinId = "";
  syncSpriteBuildSettings(state);
  state.viewportDrag.end();
}
