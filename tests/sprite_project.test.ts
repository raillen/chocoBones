import { promises as fsp } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodePng } from "../src/assets/png";
import { createClip, createKeyframe, Easing, sampleClip } from "../src/animation/timeline";
import { buildGridMesh, computeGridUvs, createPin, MeshMode, SkinningMode } from "../src/mesh/mesh";
import { loadProjectFromJson, MAX_PROJECT_BYTES, saveProjectToJson } from "../src/project/project";
import { encodeRgbaToPng } from "../src/render/png_export";
import { applyProjectToState, loadProjectFile, saveProjectFile, stateToProject } from "../src/ui/actions/project_io";
import { createInitialAppState } from "../src/ui/store";

function spriteDocument() {
  const state = createInitialAppState();
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 128,
    0, 0, 255, 0, 17, 45, 99, 255,
  ]);
  const sprite = decodePng(encodeRgbaToPng(2, 2, pixels));
  state.canvasWidth = 800;
  state.canvasHeight = 600;
  state.layers = [state.layers[0]!];
  state.layers[0]!.asset = "hero.png";
  state.spriteAssets = new Map([["hero.png", sprite]]);
  const mesh = buildGridMesh(2, 2, 2);
  mesh.mode = MeshMode.Skin;
  mesh.skinning = SkinningMode.DualQuaternion;
  mesh.strength = 0.63;
  mesh.weights = mesh.vertices.map(() => [{ joint: "root", weight: 1 }]);
  state.meshes = [mesh];
  state.meshLayer = new Map([[state.layers[0]!.id, "0"]]);
  state.meshUvs = new Map([["0", computeGridUvs(mesh, 2, 2)]]);
  state.pins = [createPin("torso_pin", "0", 1, 1, {
    name: "Peito", anchorMode: "joint", anchorJoint: "root", radius: 42, falloff: 1.3,
  })];
  state.currentPose.pins.set("torso_pin", [2, -1]);
  state.activeClip = createClip("bounce", "Bounce", 1, 24, false);
  const start = createKeyframe(0);
  start.easing = Easing.Linear;
  start.pins.set("torso_pin", [0, 0]);
  const end = createKeyframe(1);
  end.pins.set("torso_pin", [6, -2]);
  state.activeClip.frames = [start, end];
  return { state, pixels, sprite };
}

describe("Projetos sprite portáteis", () => {
  it("salva/reabre RGBA e alfa exatos, canvas, UVs, binding e configurações de malha/pino", () => {
    const { state, pixels, sprite } = spriteDocument();
    const json = saveProjectToJson(stateToProject(state));
    const project = loadProjectFromJson(json);
    const restored = createInitialAppState();
    applyProjectToState(restored, project);
    expect(project.width).toBe(800);
    expect(project.height).toBe(600);
    expect(project.assets[0]!.w).toBe(2);
    expect(project.assets[0]!.h).toBe(2);
    expect(project.assets[0]!.data).toBe(sprite.png.toString("base64"));
    expect(restored.canvasWidth).toBe(800);
    expect(restored.canvasHeight).toBe(600);
    expect(restored.spriteAssets.get("hero.png")!.pixels).toEqual(pixels);
    expect(restored.spriteAssets.get("hero.png")!.png).toEqual(sprite.png);
    expect(restored.meshUvs.get("0")).toEqual(state.meshUvs.get("0"));
    expect(restored.meshLayer.get(restored.layers[0]!.id)).toBe("0");
    expect(restored.meshes[0]!.mode).toBe(MeshMode.Skin);
    expect(restored.meshes[0]!.skinning).toBe(SkinningMode.DualQuaternion);
    expect(restored.meshes[0]!.strength).toBe(0.63);
    expect(restored.meshes[0]!.weights).toEqual(state.meshes[0]!.weights);
    expect(restored.pins).toEqual(state.pins);
    expect(restored.currentPose.pins.get("torso_pin")).toEqual([2, -1]);
    sampleClip(restored.activeClip, 0.5, restored.currentPose);
    expect(restored.currentPose.pins.get("torso_pin")).toEqual([3, -1]);
  });

  it("resolve IDs arbitrários de assets/malhas e aceita PNG em data URL", () => {
    const { state, pixels } = spriteDocument();
    const project = stateToProject(state);
    project.assets[0]!.id = "texture:hero";
    project.assets[0]!.name = "Hero original.png";
    project.assets[0]!.data = `data:image/png;base64,${project.assets[0]!.data}`;
    project.layers[0]!.asset = "texture:hero";
    project.meshes![0]!.id = "mesh:torso/custom";
    project.pins![0]!.meshId = "mesh:torso/custom";
    const restored = createInitialAppState();
    applyProjectToState(restored, project);
    expect(restored.layers[0]!.asset).toBe("texture:hero");
    expect(restored.spriteAssets.get("texture:hero")!.pixels).toEqual(pixels);
    expect(restored.pins[0]!.meshId).toBe("0");
    expect(restored.meshUvs.get("0")).toEqual(state.meshUvs.get("0"));
    const savedAgain = stateToProject(restored);
    expect(savedAgain.layers[0]!.asset).toBe(savedAgain.assets[0]!.id);
    expect(savedAgain.pins![0]!.meshId).toBe(savedAgain.meshes![0]!.id);
  });

  it("mantém bindings legados por nome do arquivo sem duplicar aliases no novo manifest", () => {
    const { state, pixels } = spriteDocument();
    const project = stateToProject(state);
    project.assets[0]!.id = "legacy-asset-0";
    const restored = createInitialAppState();
    applyProjectToState(restored, project);
    expect(restored.spriteAssets.get("hero.png")!.pixels).toEqual(pixels);
    expect(stateToProject(restored).assets).toHaveLength(1);
  });

  it.each(["base64", "png", "dimensions", "second-asset", "uvs", "triangles", "pin-binding"])(
    "rejeita %s inválido sem modificar o documento aberto", (invalid) => {
      const { state } = spriteDocument();
      const project = stateToProject(state);
      if (invalid === "base64") project.assets[0]!.data = "%%%";
      if (invalid === "png") project.assets[0]!.data = Buffer.from("not a PNG").toString("base64");
      if (invalid === "dimensions") project.assets[0]!.w = 99;
      if (invalid === "second-asset") project.assets.push({ ...project.assets[0]!, id: "bad second image", data: "invalid" });
      if (invalid === "uvs") project.meshes![0]!.uvs = [[0, 0]];
      if (invalid === "triangles") project.meshes![0]!.triangles = [[0, 1, 999]];
      if (invalid === "pin-binding") project.pins![0]!.meshId = "missing";
      const target = createInitialAppState();
      const originalJoints = target.joints;
      const originalLayers = target.layers;
      target.currentPose.params.set("original", 7);
      const before = stateToProject(target);
      expect(() => applyProjectToState(target, project)).toThrow();
      expect(target.joints).toBe(originalJoints);
      expect(target.layers).toBe(originalLayers);
      expect(stateToProject(target)).toEqual(before);
      expect(target.currentPose.params.get("original")).toBe(7);
    },
  );

  it("abre projetos v1 sem imagens incorporadas e elimina dados/transientes do documento anterior", () => {
    const { state } = spriteDocument();
    state.currentPose.joints.set("stale", { angle: 1, x: 2, y: 3 });
    state.currentPose.layers.set("stale", { x: 1, y: 1, rotation: 0, sx: 1, sy: 1, opacity: 1, visible: true, asset: "" });
    state.currentPose.params.set("stale", 8);
    state.selectedPinId = "torso_pin";
    state.viewportDrag.beginPin(10, 10, "torso_pin", state.cameraPan);
    state.isPlaying = true;
    state.timelineTime = 0.5;
    const old = loadProjectFromJson(JSON.stringify({
      schema: "survivor-puppet", version: 1, name: "Legacy", joints: [],
      assets: [{ id: "a", name: "head.png", w: 256, h: 256, data: "" }],
      layers: [{ id: "head", name: "Head", asset: "head.png" }],
    }));
    applyProjectToState(state, old);
    expect(state.spriteAssets.size).toBe(0);
    expect(state.meshes).toEqual([]);
    expect(state.meshLayer.size).toBe(0);
    expect(state.meshUvs.size).toBe(0);
    expect(state.pins).toEqual([]);
    expect(state.currentPose.joints.size).toBe(0);
    expect(state.currentPose.layers.size).toBe(0);
    expect(state.currentPose.pins.size).toBe(0);
    expect(state.currentPose.params.size).toBe(0);
    expect(state.activeClip.frames).toEqual([]);
    expect(state.selectedJointId).toBe("");
    expect(state.selection.selectedJointIds).toEqual([]);
    expect(state.selectedPinId).toBe("");
    expect(state.selection.selectedLayerIds).toEqual(["head"]);
    expect(state.viewportDrag.mode).toBe("none");
    expect(state.timelineTime).toBe(0);
    expect(state.isPlaying).toBe(false);
    expect(state.canvasWidth).toBe(512);
    expect(state.canvasHeight).toBe(512);
  });

  it("preenche nome/âncoras de pinos legados sem estes campos", () => {
    const project = loadProjectFromJson(JSON.stringify({
      schema: "survivor-puppet", version: 2, name: "Legacy pins", joints: [], layers: [],
      meshes: [{ id: "m", vertices: [[0, 0]], triangles: [] }],
      pins: [{ id: "old_pin", meshId: "m", x: 0, y: 0 }],
    }));
    const state = createInitialAppState();
    applyProjectToState(state, project);
    expect(state.pins[0]!.name).toBe("old_pin");
    expect(state.pins[0]!.anchorMode).toBe("free");
    expect(state.pins[0]!.anchorJoint).toBe("");
  });

  it("grava e carrega .puppet.json pelo fluxo real e não cria histórico ao rejeitar PNG", async () => {
    const dir = await fsp.mkdtemp(join(tmpdir(), "chocobones-sprite-project-"));
    try {
      const file = join(dir, "portable.puppet.json");
      const { state, pixels } = spriteDocument();
      await saveProjectFile(state, file);
      const restored = createInitialAppState();
      const beforeLoad = stateToProject(restored);
      await loadProjectFile(restored, file);
      expect(restored.spriteAssets.get("hero.png")!.pixels).toEqual(pixels);
      expect(restored.history.canUndo()).toBe(true);
      restored.history.undo(restored.joints, restored.layers, restored.currentPose, restored.pins);
      expect(stateToProject(restored)).toEqual(beforeLoad);
      restored.history.redo(restored.joints, restored.layers, restored.currentPose, restored.pins);
      expect(restored.spriteAssets.get("hero.png")!.pixels).toEqual(pixels);
      expect(restored.meshUvs.get("0")).toEqual(state.meshUvs.get("0"));
      expect(restored.canvasWidth).toBe(800);
      sampleClip(restored.activeClip, 0.5, restored.currentPose);
      expect(restored.currentPose.pins.get("torso_pin")).toEqual([3, -1]);
      const project = stateToProject(state);
      project.assets[0]!.data = "broken";
      await fsp.writeFile(file, saveProjectToJson(project));
      const unchanged = createInitialAppState();
      await expect(loadProjectFile(unchanged, file)).rejects.toThrow();
      expect(unchanged.history.canUndo()).toBe(false);
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  });

  it("calcula o limite de 20 MiB em bytes UTF-8, inclusive ao salvar", () => {
    const project = stateToProject(createInitialAppState());
    project.name = "ç".repeat(MAX_PROJECT_BYTES / 2);
    const json = JSON.stringify(project);
    expect(json.length).toBeLessThan(MAX_PROJECT_BYTES);
    expect(() => loadProjectFromJson(json)).toThrow(/limite/);
    expect(() => saveProjectToJson(project)).toThrow(/limite/);
  });
});
