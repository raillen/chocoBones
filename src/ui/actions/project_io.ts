/**
 * chocoBones project IO assíncrono (Item 5 — sem fs síncrono no loop UI)
 */
import { promises as fsp } from "fs";
import { loadProjectFromJson, migrateV1ToV2, Project, saveProjectToJson } from "../../project/project";
import { buildGridMesh, createPin } from "../../mesh/mesh";
import { Easing } from "../../animation/timeline";
import type { AppState } from "../store";

export function stateToProject(state: AppState): Project {
  return {
    schema: "survivor-puppet",
    version: 2,
    name: "chocoBones Puppet",
    width: 512,
    height: 512,
    assets: state.layers
      .map((l) => l.asset)
      .filter((a, i, arr) => a && arr.indexOf(a) === i)
      .map((a, i) => ({ id: `asset_${i}`, name: a, w: 256, h: 256, data: "", material: "default", color: 0, uri: `assets/${a}` })),
    joints: state.joints.map((j) => ({ id: j.id, name: j.name, parent: j.parent, x: j.x, y: j.y, color: j.color })),
    layers: state.layers.map((l) => ({
      id: l.id,
      name: l.name,
      asset: l.asset,
      transform: { x: l.transform.pos[0], y: l.transform.pos[1], rotation: l.transform.rotation, sx: l.transform.scale[0], sy: l.transform.scale[1], px: l.transform.pivot[0], py: l.transform.pivot[1] },
      joint: l.joint,
      visible: l.visible,
      locked: l.locked,
      opacity: l.opacity,
      blend: "normal",
      seamMask: { layer: l.seamMask.layer ?? "", enabled: l.seamMask.enabled, center: { x: l.seamMask.center[0], y: l.seamMask.center[1] }, radius: l.seamMask.radius, feather: l.seamMask.feather },
    })),
    meshes: state.meshes.map((m, i) => ({
      id: String(i),
      layerId: [...state.meshLayer.entries()].find(([, v]) => v === String(i))?.[0] ?? "",
      density: m.density,
      vertices: m.vertices.map((v) => [v[0], v[1]] as [number, number]),
      triangles: m.triangles.map((t) => [t[0], t[1], t[2]] as [number, number, number]),
      uvs: [],
      weights: m.weights.map((list) => list.map((w) => ({ joint: w.joint, weight: w.weight }))),
      mode: m.mode,
      skinning: m.skinning,
      strength: m.strength,
    })),
    pins: state.pins.map((p) => ({
      id: p.id,
      meshId: p.meshId ?? "",
      x: p.x,
      y: p.y,
      offsetX: state.currentPose.pins.get(p.id)?.[0] ?? 0,
      offsetY: state.currentPose.pins.get(p.id)?.[1] ?? 0,
      locked: p.locked,
      enabled: p.enabled ?? true,
      radius: p.radius ?? 64,
      falloff: p.falloff ?? 2.0,
      strength: p.strength ?? 1,
    })),
    clips: [{ id: state.activeClip.id, name: state.activeClip.name, duration: state.activeClip.duration, fps: state.activeClip.fps, loop: state.activeClip.loop, frames: state.activeClip.frames.map((f) => ({ id: f.id, time: f.time, joints: Object.fromEntries(f.joints), layers: Object.fromEntries(f.layers), pins: Object.fromEntries(f.pins), params: Object.fromEntries(f.params), easing: f.easing, bezier: f.bezier, channels: f.channels })) }],
    constraints: [],
  };
}

export function applyProjectToState(state: AppState, project: Project): void {
  const v2 = project.version >= 2 ? project : migrateV1ToV2(project);
  state.joints = v2.joints.map((j) => ({ id: j.id, name: j.name, parent: j.parent, x: j.x, y: j.y, color: j.color }));
  state.layers = v2.layers.map((l) => ({
    id: l.id,
    name: l.name,
    asset: l.asset,
    transform: { pos: [l.transform.x, l.transform.y] as [number, number], scale: [l.transform.sx, l.transform.sy] as [number, number], rotation: l.transform.rotation, pivot: [l.transform.px, l.transform.py] as [number, number] },
    joint: l.joint,
    visible: l.visible,
    locked: l.locked,
    opacity: l.opacity,
    hasSeamMask: l.seamMask.enabled,
    seamMask: { layer: l.seamMask.layer, enabled: l.seamMask.enabled, center: [l.seamMask.center.x, l.seamMask.center.y] as [number, number], radius: l.seamMask.radius, feather: l.seamMask.feather },
  }));
  // P0-5: restaura meshes/pins/offsets + primeiro clipe (roundtrip)
  if (v2.meshes) {
    state.meshes = v2.meshes.map((m) => {
      const mesh = buildGridMesh(10, 10, 2);
      mesh.density = m.density;
      mesh.vertices = m.vertices.map((v) => [v[0], v[1]] as [number, number]);
      mesh.triangles = m.triangles.map((t) => [t[0], t[1], t[2]] as [number, number, number]);
      mesh.weights = m.weights.map((list) => list.map((w) => ({ joint: w.joint, weight: w.weight })));
      return mesh;
    });
    state.meshLayer = new Map(v2.meshes.map((m, i) => [m.layerId || "", String(i)] as [string, string]).filter(([k]) => k !== ""));
  }
  if (v2.pins) {
    state.pins = v2.pins.map((p) => createPin(p.id, p.meshId, p.x, p.y, { locked: p.locked, enabled: p.enabled, radius: p.radius, falloff: p.falloff, strength: p.strength }));
    state.currentPose.pins.clear();
    for (const p of v2.pins) {
      if (p.offsetX !== 0 || p.offsetY !== 0) state.currentPose.pins.set(p.id, [p.offsetX, p.offsetY]);
    }
  }
  if (v2.clips && v2.clips[0]) {
    const c = v2.clips[0];
    state.activeClip = {
      id: c.id,
      name: c.name,
      duration: c.duration,
      fps: c.fps,
      loop: c.loop,
      frames: c.frames.map((f) => ({
        id: f.id,
        time: f.time,
        joints: new Map(Object.entries(f.joints ?? {})),
        layers: new Map(Object.entries(f.layers ?? {})),
        pins: new Map(Object.entries(f.pins ?? {})) as Map<string, [number, number]>,
        params: new Map(Object.entries(f.params ?? {})),
        easing: (f.easing ?? "Smooth") as Easing,
        bezier: (f.bezier ?? [0.25, 0.1, 0.25, 1.0]) as [number, number, number, number],
        channels: f.channels ?? [],
      })),
    };
    state.activeClipName = state.activeClip.id;
    state.timelineDuration = state.activeClip.duration;
  }
  state.selectedJointId = state.joints[0]?.id ?? "root";
  state.selection.selectedJointIds = [state.selectedJointId];
  state.selectedLayerId = state.layers[0]?.id ?? "";
  state.selection.selectedLayerIds = state.selectedLayerId ? [state.selectedLayerId] : [];
}

export async function saveProjectFile(state: AppState, filePath?: string): Promise<string> {
  const target = filePath ?? state.paths.projectFile;
  const json = saveProjectToJson(stateToProject(state));
  await fsp.writeFile(target, json, "utf-8");
  return target;
}

export async function loadProjectFile(state: AppState, filePath?: string): Promise<string> {
  const target = filePath ?? state.paths.projectFile;
  const raw = await fsp.readFile(target, "utf-8");
  const project = loadProjectFromJson(raw);
  state.history.push("Carregar Projeto", state.joints, state.layers, state.currentPose);
  applyProjectToState(state, project);
  return target;
}
