import { describe, expect, it } from "vitest";
import { isProjectV2, loadProjectFromJson, migrateV1ToV2 } from "../src/project/project";
import { generateId, nextKeyframeId, resetIdCounter, resetKeyframeCounter } from "../src/core/ids";
import { EditorMode, restoreBindPose } from "../src/ui/modes";
import { applyJointDrag, pickJoint } from "../src/ui/viewport/controller";
import { createPose, Joint } from "../src/rig/joint";
import { boneMatrices } from "../src/rig/fk";
import { solveIK } from "../src/rig/ik";
import { createClip, createKeyframe, clearPose, isClipSorted, sampleClip, sortClipFrames, Easing } from "../src/animation/timeline";
import { evaluateClip, wrapTime } from "../src/animation/evaluator";
import { advanceTime, FixedStepAccumulator } from "../src/animation/clock";
import { autoSkinToJoints, buildGridMesh, buildHullMeshFromRgba, paintWeights, weightToHeatColor } from "../src/mesh/mesh";
import { crc32, encodeRgbaToPngAsync } from "../src/render/png_export";
import { mapKeyToAction, moveLayerOrder, selectionSelectLayerRange } from "../src/ui/selection";
import { loadObjFromString } from "../src/mesh3d/obj_loader";
import { loadGltfFromJson, parseGlb } from "../src/mesh3d/gltf_loader";
import { WebGpuRenderer } from "../src/render/webgpu_backend";
import { createInitialAppState } from "../src/ui/store";
import { tickAnimation, renderFrame } from "../src/render/loop";
import { jointHasCycle } from "../src/rig/presets";

describe("1 - Projeto v2 + migração", () => {
  it("migra v1 para v2 com coleções vazias", () => {
    const v1 = loadProjectFromJson(JSON.stringify({ schema: "survivor-puppet", version: 1, name: "V1", joints: [], layers: [] }));
    const v2 = migrateV1ToV2(v1);
    expect(v2.version).toBe(2);
    expect(v2.meshes).toEqual([]);
    expect(v2.pins).toEqual([]);
    expect(v2.clips).toEqual([]);
    expect(v2.constraints).toEqual([]);
    expect(isProjectV2(v2)).toBe(true);
    expect(isProjectV2(v1)).toBe(false);
  });
  it("carrega v2 com pins/meshes/clips/constraints", () => {
    const p = loadProjectFromJson(JSON.stringify({
      schema: "survivor-puppet", version: 2, name: "V2",
      joints: [], layers: [],
      pins: [{ id: "pin1", x: 10, y: 20 }],
      meshes: [{ id: "m1", vertices: [[0, 0]], triangles: [[0, 0, 0]] }],
      clips: [{ id: "c1", name: "Idle", frames: [] }],
      constraints: [{ id: "k1", type: "ik", joints: ["a", "b"] }],
    }));
    expect(p.pins!.length).toBe(1);
    expect(p.meshes!.length).toBe(1);
    expect(p.clips!.length).toBe(1);
    expect(p.constraints!.length).toBe(1);
  });
  it("rejeita ciclo hierárquico no load", () => {
    expect(() => loadProjectFromJson(JSON.stringify({
      schema: "survivor-puppet", version: 1, name: "Cycle",
      joints: [
        { id: "a", name: "A", parent: "b", x: 0, y: 0 },
        { id: "b", name: "B", parent: "a", x: 1, y: 1 },
      ],
      layers: [],
    }))).toThrow(/Ciclo/);
  });
});

describe("2/4 - Setup vs Animate + IDs + ciclos", () => {
  it("generateId é único sob spam", () => {
    resetIdCounter();
    const ids = new Set(Array.from({ length: 50 }, () => generateId("j")));
    expect(ids.size).toBe(50);
  });
  it("nextKeyframeId é determinístico após reset", () => {
    resetKeyframeCounter();
    expect(nextKeyframeId()).toBe("kf_0001");
    expect(nextKeyframeId()).toBe("kf_0002");
  });
  it("createKeyframe não usa Math.random", () => {
    resetKeyframeCounter();
    const a = createKeyframe(0);
    const b = createKeyframe(1);
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith("kf_")).toBe(true);
  });
  it("Setup muta repouso, Animate muta pose", () => {
    const joints: Joint[] = [{ id: "root", name: "R", parent: "", x: 0, y: 0, color: "#fff" }];
    const pose = createPose();
    applyJointDrag(joints, pose, "root", 10, 5, 1, EditorMode.Setup, false, [10, 5]);
    expect(joints[0]!.x).toBe(10);
    expect(pose.joints.size).toBe(0);
    joints[0]!.x = 0; joints[0]!.y = 0;
    applyJointDrag(joints, pose, "root", 10, 5, 1, EditorMode.Animate, false, [10, 5]);
    expect(joints[0]!.x).toBe(0);
    expect(pose.joints.get("root")!.x).toBe(10);
  });
  it("restoreBindPose limpa sem tocar repouso", () => {
    const pose = createPose();
    pose.joints.set("a", { angle: 1, x: 2, y: 3 });
    pose.pins.set("p", [4, 5]);
    restoreBindPose(pose);
    expect(pose.joints.size).toBe(0);
    expect(pose.pins.size).toBe(0);
  });
  it("boneMatrices não entra em recursão infinita com ciclo", () => {
    const joints: Joint[] = [
      { id: "a", name: "A", parent: "b", x: 0, y: 0, color: "#fff" },
      { id: "b", name: "B", parent: "a", x: 5, y: 0, color: "#fff" },
    ];
    expect(jointHasCycle(joints)).toBe(true);
    const bones = boneMatrices(joints, null);
    expect(bones.size).toBe(2);
  });
  it("pickJoint encontra junta dentro do raio", () => {
    const joints: Joint[] = [{ id: "root", name: "R", parent: "", x: 100, y: 100, color: "#fff" }];
    expect(pickJoint(joints, null, 102, 101, 16)).toBe("root");
    expect(pickJoint(joints, null, 500, 500, 16)).toBe("");
  });
});

describe("3/8 - evaluate(t), clock, timeline pins/channels", () => {
  it("evaluateClip é puro e determinístico", () => {
    const clip = createClip("c", "C", 2, 60, true);
    const k0 = createKeyframe(0); k0.joints.set("root", { angle: 0, x: 0, y: 0 });
    const k1 = createKeyframe(1); k1.joints.set("root", { angle: 1, x: 0, y: 0 });
    clip.frames.push(k0, k1);
    const p1 = evaluateClip(clip, 0.5);
    const p2 = evaluateClip(clip, 0.5);
    expect(p1.joints.get("root")!.angle).toBeCloseTo(0.5, 1);
    expect(p1.joints.get("root")!.angle).toBe(p2.joints.get("root")!.angle);
    expect(clip.frames.length).toBe(2); // sem mutação
  });
  it("wrapTime equaliza 30/60/120fps", () => {
    expect(wrapTime(1.8, 1.6, true)).toBeCloseTo(0.2);
    expect(wrapTime(5, 2, false)).toBe(2);
  });
  it("advanceTime usa delta real com clamp", () => {
    expect(advanceTime(1.2, 0.2, 1.6, true)).toBeCloseTo(1.4);
    expect(advanceTime(1.5, 0.5, 1.6, true)).toBeCloseTo(0.15); // spike clamp 0.25
    expect(advanceTime(0, 10, 5, false)).toBeCloseTo(0.25); // spike clamp 0.25
  });
  it("FixedStepAccumulator gera steps determinísticos", () => {
    const acc = new FixedStepAccumulator(120);
    expect(acc.stepsFor(1 / 120 + 0.0001)).toBe(1);
  });
  it("sampleClip interpola pins e limpa resíduos", () => {
    const clip = createClip("c", "C", 2, 60, false);
    const k0 = createKeyframe(0); k0.pins.set("pin1", [0, 0]); k0.joints.set("stale", { angle: 9, x: 9, y: 9 });
    const k1 = createKeyframe(2); k1.pins.set("pin1", [10, 20]);
    clip.frames.push(k0, k1);
    const pose = createPose();
    pose.joints.set("old", { angle: 5, x: 5, y: 5 }); // resíduo deve sumir
    sampleClip(clip, 1, pose);
    expect(pose.joints.has("old")).toBe(false);
    expect(pose.pins.get("pin1")![0]).toBeCloseTo(5);
    expect(pose.pins.get("pin1")![1]).toBeCloseTo(10);
  });
  it("channels filtram interpolação", () => {
    const clip = createClip("c", "C", 2, 60, false);
    const k0 = createKeyframe(0); k0.channels = ["joint:keep"]; k0.joints.set("keep", { angle: 0, x: 0, y: 0 }); k0.joints.set("drop", { angle: 0, x: 0, y: 0 });
    const k1 = createKeyframe(2); k1.channels = ["joint:keep"]; k1.joints.set("keep", { angle: 2, x: 0, y: 0 }); k1.joints.set("drop", { angle: 8, x: 0, y: 0 });
    clip.frames.push(k0, k1);
    const pose = createPose();
    sampleClip(clip, 1, pose);
    expect(pose.joints.has("keep")).toBe(true);
    expect(pose.joints.has("drop")).toBe(false);
  });
  it("isClipSorted evita sort desnecessário", () => {
    const clip = createClip("c", "C", 2, 60, true);
    clip.frames.push(createKeyframe(0), createKeyframe(1));
    expect(isClipSorted(clip)).toBe(true);
    clip.frames.push(createKeyframe(0.5));
    // frames: 0,1,0.5 → fora de ordem
    expect(isClipSorted(clip)).toBe(false);
    sortClipFrames(clip);
    expect(isClipSorted(clip)).toBe(true);
  });
  it("clearPose distingue ausente de zero", () => {
    const pose = createPose();
    pose.joints.set("a", { angle: 1, x: 1, y: 1 });
    clearPose(pose);
    expect(pose.joints.size).toBe(0);
  });
  it("Hold congela no prev", () => {
    const clip = createClip("c", "C", 2, 60, false);
    const k0 = createKeyframe(0); k0.easing = Easing.Hold; k0.joints.set("j", { angle: 0, x: 0, y: 0 });
    const k1 = createKeyframe(2); k1.joints.set("j", { angle: 10, x: 0, y: 0 });
    clip.frames.push(k0, k1);
    const pose = createPose();
    sampleClip(clip, 1.9, pose);
    expect(pose.joints.get("j")!.angle).toBeCloseTo(0);
  });
});

describe("6 - Mesh alpha-hull, auto-skin, paint, heatmap", () => {
  it("hull descarta quads transparentes", () => {
    const w = 4, h = 4;
    const rgba = new Uint8ClampedArray(w * h * 4);
    // Bloco 2x2 opaco no canto superior-esquerdo
    for (const [px, py] of [[0, 0], [1, 0], [0, 1], [1, 1]] as Array<[number, number]>) {
      rgba[(py * w + px) * 4 + 3] = 255;
      rgba[(py * w + px) * 4] = 255;
    }
    const { mesh, uvs } = buildHullMeshFromRgba(w, h, rgba, 2, 12);
    expect(mesh.triangles.length).toBeGreaterThan(0);
    expect(mesh.triangles.length).toBeLessThan(32); // grade cheia 2x2 teria 8 tris
    expect(uvs.length).toBe(mesh.vertices.length);
  });
  it("autoSkin normaliza pesos", () => {
    const mesh = buildGridMesh(100, 100, 2);
    autoSkinToJoints(mesh, [
      { id: "root", x: 0, y: 0, parent: "" },
      { id: "mid", x: 50, y: 0, parent: "root" },
    ]);
    for (const list of mesh.weights) {
      const sum = list.reduce((s, e) => s + e.weight, 0);
      expect(sum).toBeCloseTo(1);
    }
  });
  it("paintWeights add/smooth/set + heatmap", () => {
    const mesh = buildGridMesh(100, 100, 2);
    autoSkinToJoints(mesh, [
      { id: "root", x: 0, y: 0, parent: "" },
      { id: "mid", x: 50, y: 0, parent: "root" },
    ]);
    const n = paintWeights(mesh, "mid", [50, 50], 200, 0.5, "add");
    expect(n).toBeGreaterThan(0);
    paintWeights(mesh, "mid", [50, 50], 200, 0.2, "set");
    paintWeights(mesh, "mid", [50, 50], 200, 0, "smooth");
    expect(weightToHeatColor(0)).toEqual([0, 120, 255]);
    expect(weightToHeatColor(1)).toEqual([255, 100, 0]);
  });
});

describe("7 - IK genérica", () => {
  it("resolve cadeia com base root (antes rejeitada)", () => {
    const joints: Joint[] = [
      { id: "root", name: "Root", parent: "", x: 0, y: 0, color: "#fff" },
      { id: "mid", name: "Mid", parent: "root", x: 50, y: 0, color: "#fff" },
      { id: "tip", name: "Tip", parent: "mid", x: 100, y: 0, color: "#fff" },
    ];
    const pose = createPose();
    expect(solveIK(joints, pose, "tip", [60, 40])).toBe(true);
  });
  it("aplica limits angulares", () => {
    const joints: Joint[] = [
      { id: "base0", name: "B", parent: "", x: 0, y: 0, color: "#fff" },
      { id: "base", name: "Base", parent: "base0", x: 0, y: 0, color: "#fff" },
      { id: "mid", name: "Mid", parent: "base", x: 50, y: 0, color: "#fff" },
      { id: "tip", name: "Tip", parent: "mid", x: 100, y: 0, color: "#fff" },
    ];
    const pose = createPose();
    solveIK(joints, pose, "tip", [-80, 0], { minAngle: -0.1, maxAngle: 0.1 });
    expect(Math.abs(pose.joints.get("base")!.angle)).toBeLessThanOrEqual(0.11);
  });
  it("pole-vector escolhe lado", () => {
    const mk = (): Joint[] => [
      { id: "b0", name: "B", parent: "", x: 0, y: 0, color: "#fff" },
      { id: "base", name: "Base", parent: "b0", x: 0, y: 0, color: "#fff" },
      { id: "mid", name: "Mid", parent: "base", x: 50, y: 0, color: "#fff" },
      { id: "tip", name: "Tip", parent: "mid", x: 100, y: 0, color: "#fff" },
    ];
    const p1 = createPose(); solveIK(mk(), p1, "tip", [70, 0], { pole: [0, 100] });
    const p2 = createPose(); solveIK(mk(), p2, "tip", [70, 0], { pole: [0, -100] });
    expect(p1.joints.get("base")!.angle).not.toBeCloseTo(p2.joints.get("base")!.angle, 2);
  });
});

describe("9/10 - WebGPU backend + PNG async", () => {
  it("WebGPU cai para cpu-fallback em Node sem navigator.gpu", async () => {
    const r = new WebGpuRenderer();
    expect(await r.init()).toBe("cpu-fallback");
    expect(r.submitSprites([{ pos: [0, 0], size: [10, 10], uvMin: [0, 0], uvMax: [1, 1], color: [1, 1, 1, 1] }])).toBe(1);
    const out = r.deformMlsCpu([[50, 50]], [{ x: 0, y: 0, dx: 10, dy: 0, locked: false }]);
    expect(out[0]![0]).toBeGreaterThan(50);
  });
  it("crc32 é estável e PNG async gera assinatura válida", async () => {
    const a = crc32(Buffer.from("hello"));
    expect(crc32(Buffer.from("hello"))).toBe(a);
    const px = new Uint8ClampedArray([255, 0, 0, 255]);
    const png = await encodeRgbaToPngAsync(1, 1, px);
    expect(png[0]).toBe(137); expect(png[1]).toBe(80);
  });
});

describe("11 - Editor seleção/teclado/reorder", () => {
  const layers = [
    { id: "a", name: "A", asset: "", transform: { pos: [0, 0] as [number, number], scale: [1, 1] as [number, number], rotation: 0, pivot: [0, 0] as [number, number] }, joint: "", visible: true, locked: false, opacity: 1, hasSeamMask: false, seamMask: { layer: "", enabled: false, center: [0, 0] as [number, number], radius: 0, feather: 0 } },
    { id: "b", name: "B", asset: "", transform: { pos: [0, 0] as [number, number], scale: [1, 1] as [number, number], rotation: 0, pivot: [0, 0] as [number, number] }, joint: "", visible: true, locked: false, opacity: 1, hasSeamMask: false, seamMask: { layer: "", enabled: false, center: [0, 0] as [number, number], radius: 0, feather: 0 } },
    { id: "c", name: "C", asset: "", transform: { pos: [0, 0] as [number, number], scale: [1, 1] as [number, number], rotation: 0, pivot: [0, 0] as [number, number] }, joint: "", visible: true, locked: false, opacity: 1, hasSeamMask: false, seamMask: { layer: "", enabled: false, center: [0, 0] as [number, number], radius: 0, feather: 0 } },
  ];
  it("range com shift seleciona faixa", () => {
    const sel = { selectedJointIds: [], selectedLayerIds: [], anchorLayerIdx: -1 };
    selectionSelectLayerRange(layers, sel, "a", false);
    selectionSelectLayerRange(layers, sel, "c", true);
    expect(sel.selectedLayerIds).toEqual(["a", "b", "c"]);
  });
  it("moveLayerOrder reordena z-index", () => {
    const arr = [{ id: "x" }, { id: "y" }, { id: "z" }] as unknown as Parameters<typeof moveLayerOrder>[0];
    expect(moveLayerOrder(arr, "x", 1)).toBe(true);
    expect(arr[1]!.id).toBe("x");
    expect(moveLayerOrder(arr, "x", -1)).toBe(true);
    expect(arr[0]!.id).toBe("x");
  });
  it("mapKeyToAction cobre atalhos", () => {
    expect(mapKeyToAction(" ")).toBe("toggle-play");
    expect(mapKeyToAction("Delete", { hasLayerSelection: true })).toBe("delete-selection");
    expect(mapKeyToAction("Delete", { hasLayerSelection: false })).toBe("none");
    expect(mapKeyToAction("r", { alt: true })).toBe("reset-bind");
    expect(mapKeyToAction("F")).toBe("reset-view");
    expect(mapKeyToAction("c")).toBe("new-bone-mode");
  });
});

describe("12 - OBJ/glTF estendidos", () => {
  it("OBJ suporta índices negativos e usemtl", () => {
    const mesh = loadObjFromString("v 0 0 0\nv 1 0 0\nv 0 1 0\nusemtl mat1\nf -3 -2 -1\n");
    expect(mesh.indices.length).toBe(3);
  });
  it("glTF lê JOINTS/WEIGHTS e marca skinning", () => {
    const pos = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    const joints = new Uint16Array([0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0]);
    const weights = new Float32Array([0.5, 0.5, 0, 0, 1, 0, 0, 0, 0.7, 0.3, 0, 0]);
    const buf = new Uint8Array(pos.byteLength + joints.byteLength + weights.byteLength);
    buf.set(new Uint8Array(pos.buffer), 0);
    buf.set(new Uint8Array(joints.buffer), pos.byteLength);
    buf.set(new Uint8Array(weights.buffer), pos.byteLength + joints.byteLength);
    const json = JSON.stringify({
      meshes: [{ name: "sk", primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
        { bufferView: 1, componentType: 5123, count: 3, type: "VEC4" },
        { bufferView: 2, componentType: 5126, count: 3, type: "VEC4" },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: pos.byteLength },
        { buffer: 0, byteOffset: pos.byteLength, byteLength: joints.byteLength },
        { buffer: 0, byteOffset: pos.byteLength + joints.byteLength, byteLength: weights.byteLength },
      ],
      buffers: [{ byteLength: buf.byteLength }],
    });
    const meshes = loadGltfFromJson(json, [buf]);
    expect(meshes[0]!.hasSkinning).toBe(true);
    expect(meshes[0]!.vertices[0]!.joints[1]).toBe(1);
  });
  it("parseGlb rejeita magic inválido", () => {
    expect(() => parseGlb(new Uint8Array(24))).toThrow();
  });
});

describe("5 - Store + loop", () => {
  it("store inicial tem editorMode + drag + paths", () => {
    const s = createInitialAppState();
    expect(s.editorMode).toBe(EditorMode.Animate);
    expect(s.viewportDrag.mode).toBe("none");
    expect(s.paths.projectFile.includes("choco_puppet")).toBe(true);
  });
  it("tick avança com delta e render não lança", () => {
    const s = createInitialAppState();
    s.isPlaying = true;
    tickAnimation(s, 0.1);
    expect(s.timelineTime).toBeGreaterThan(0);
    renderFrame(s);
    expect(s.viewportBuffer.pixels.length).toBeGreaterThan(0);
  });
  it("renderFrame adapta paleta de fundo e grid para Light, Dim e Dark em 2D e 3D", () => {
    const s = createInitialAppState();
    expect(s.themeMode).toBe("Dark");
    expect(s.accentName).toBe("Ciano");
    expect(s.activeTool).toBe("Move");
    expect(s.elementTab).toBe("Juntas");

    // Dark 2D
    s.themeMode = "Dark";
    s.viewportMode = "2D";
    renderFrame(s);
    // pixel no canto superior esquerdo (fundo limpo)
    expect(s.viewportBuffer.pixels[0]).toBe(14);
    expect(s.viewportBuffer.pixels[1]).toBe(14);
    expect(s.viewportBuffer.pixels[2]).toBe(16);

    // Dim 2D
    s.themeMode = "Dim";
    renderFrame(s);
    expect(s.viewportBuffer.pixels[0]).toBe(32);
    expect(s.viewportBuffer.pixels[1]).toBe(32);
    expect(s.viewportBuffer.pixels[2]).toBe(36);

    // Light 2D
    s.themeMode = "Light";
    renderFrame(s);
    expect(s.viewportBuffer.pixels[0]).toBe(244);
    expect(s.viewportBuffer.pixels[1]).toBe(244);
    expect(s.viewportBuffer.pixels[2]).toBe(246);

    // Light 3D
    s.viewportMode = "3D";
    renderFrame(s);
    // pixel (5, 5) fica entre as linhas de grade de passo 40
    const idx5 = (5 * s.viewportBuffer.width + 5) * 4;
    expect(s.viewportBuffer.pixels[idx5]).toBe(244);
    expect(s.viewportBuffer.pixels[idx5 + 1]).toBe(244);
    expect(s.viewportBuffer.pixels[idx5 + 2]).toBe(246);

    // Dark 3D
    s.themeMode = "Dark";
    renderFrame(s);
    expect(s.viewportBuffer.pixels[idx5]).toBe(14);
    expect(s.viewportBuffer.pixels[idx5 + 1]).toBe(14);
    expect(s.viewportBuffer.pixels[idx5 + 2]).toBe(16);
  });
});

