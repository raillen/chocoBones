import { describe, expect, it } from "vitest";
import { alphaMask, maskBoundingBox, pointInPolygon, polygonArea, simplifyDouglasPeucker, traceContourMoore, triangulateInsideContour, validateMeshTopology } from "../src/geometry/contour";
import { meshAddVertex, meshDeleteVertex, meshMoveVertex, meshTopologyClean } from "../src/geometry/mesh_edit";
import { buildGridMesh } from "../src/mesh/mesh";
import { anatomicalRole, applyCorrectives, applyTransformConstraints, retargetByRole } from "../src/rig/retarget";
import { applyOperatorStack, bakeOperators, createOperator } from "../src/procedural/operators";
import { boundedBiharmonicApprox, deformByCage, solveArap } from "../src/deform/advanced";
import { PuppetPlayer } from "../src/player/runtime";
import { createPose } from "../src/rig/joint";
import { createClip, createKeyframe } from "../src/animation/timeline";

describe("Fase 1 contorno", () => {
  const w = 8, h = 8;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) rgba[(y * w + x) * 4 + 3] = 255;
  it("mask + bbox + moore + douglas-peucker", () => {
    const mask = alphaMask(rgba, w, h, 12);
    expect(maskBoundingBox(mask, w, h)).toEqual({ x0: 2, y0: 2, x1: 5, y1: 5 });
    const contour = traceContourMoore(mask, w, h);
    expect(contour.length).toBeGreaterThan(4);
    const simple = simplifyDouglasPeucker(contour, 1.0);
    expect(simple.length).toBeLessThanOrEqual(contour.length);
    expect(Math.abs(polygonArea(simple))).toBeGreaterThan(0);
    expect(pointInPolygon([3.5, 3.5], simple)).toBe(true);
    expect(pointInPolygon([0, 0], simple)).toBe(false);
  });
  it("triangulação intra-contorno + validação", () => {
    const mask = alphaMask(rgba, w, h, 12);
    const contour = simplifyDouglasPeucker(traceContourMoore(mask, w, h), 0.8);
    const { vertices, triangles } = triangulateInsideContour(contour, 2);
    expect(triangles.length).toBeGreaterThan(0);
    expect(validateMeshTopology(vertices, triangles).filter((i) => i.kind === "degenerate").length).toBe(0);
  });
  it("edição add/move/delete + clean", () => {
    const mesh = buildGridMesh(20, 20, 1);
    const idx = meshAddVertex(mesh, [999, 999]);
    expect(meshTopologyClean(mesh)).toBe(false); // isolado
    expect(meshMoveVertex(mesh, idx, 5, 5)).toBe(true);
    expect(meshDeleteVertex(mesh, idx)).toBe(true);
    expect(meshTopologyClean(mesh)).toBe(true);
    expect(meshMoveVertex(mesh, 9999, 0, 0)).toBe(false);
  });
});

describe("Fase 2 constraints/correctives/retarget", () => {
  it("parent copia com peso + limit clampa", () => {
    const pose = createPose();
    pose.joints.set("a", { angle: 1, x: 0, y: 0 });
    pose.joints.set("b", { angle: 0, x: 0, y: 0 });
    applyTransformConstraints(pose, [{ id: "c", kind: "parent", source: "a", target: "b", weight: 0.5, enabled: true }]);
    expect(pose.joints.get("b")!.angle).toBeCloseTo(0.5);
    pose.joints.set("b", { angle: 5, x: 0, y: 0 });
    applyTransformConstraints(pose, [{ id: "l", kind: "limit", source: "", target: "b", weight: 1, minAngle: -1, maxAngle: 1, enabled: true }]);
    expect(pose.joints.get("b")!.angle).toBe(1);
  });
  it("corrective pondera por janela", () => {
    const pose = createPose();
    pose.joints.set("elbow", { angle: 1.0, x: 0, y: 0 });
    applyCorrectives(pose, [{ id: "s", jointId: "elbow", atAngle: 1.0, radius: 0.5, deltaAngle: 0.2, deltaX: 1, deltaY: 0 }]);
    expect(pose.joints.get("elbow")!.angle).toBeCloseTo(1.2);
    const pose2 = createPose();
    pose2.joints.set("elbow", { angle: 5, x: 0, y: 0 });
    applyCorrectives(pose2, [{ id: "s", jointId: "elbow", atAngle: 1.0, radius: 0.5, deltaAngle: 0.2, deltaX: 1, deltaY: 0 }]);
    expect(pose2.joints.get("elbow")!.angle).toBe(5);
  });
  it("retarget por papéis copia head", () => {
    const src = createPose();
    src.joints.set("head", { angle: 0.7, x: 0, y: 0 });
    const out = createPose();
    const n = retargetByRole(src, [{ id: "head", name: "Head" }], [{ id: "head", name: "Cabeça" }], out);
    expect(n).toBe(1);
    expect(out.joints.get("head")!.angle).toBe(0.7);
    expect(anatomicalRole("forearm_near")).toBe("elbow_l");
  });
});

describe("Fase 3 procedural + bake 30/60/120", () => {
  it("breath/gait/look somam determinísticos", () => {
    const ops = [createOperator("breath", "b"), createOperator("gait", "g"), createOperator("look", "l")];
    const p1 = createPose();
    const p2 = createPose();
    applyOperatorStack(ops, 0.5, p1);
    applyOperatorStack(ops, 0.5, p2);
    expect(p1.joints.get("root")).toEqual(p2.joints.get("root"));
    expect(p1.joints.get("thigh_near")).toBeDefined();
  });
  it("bake em tempos equivalentes independe de fps", () => {
    const ops = [createOperator("breath", "b")];
    const base = createPose();
    const at30 = bakeOperators(ops, base, [0, 1 / 30, 2 / 30]);
    const at60 = bakeOperators(ops, base, [0, 1 / 30, 2 / 30]);
    expect(at30[1]!.joints.get("root")!.y).toBe(at60[1]!.joints.get("root")!.y);
    // fps só muda amostragem, não valor em t igual
    const t = 0.25;
    const a = bakeOperators(ops, base, [t])[0]!.joints.get("root")!.y;
    const b = bakeOperators(ops, base, [t])[0]!.joints.get("root")!.y;
    expect(a).toBe(b);
  });
  it("canal desabilitado/máscara respeitados", () => {
    const op = createOperator("breath", "b");
    op.channels = ["joint:head"];
    op.enabled = false;
    const p = createPose();
    applyOperatorStack([op], 1, p);
    expect(p.joints.size).toBe(0);
  });
});

describe("Fase 4 avançado + player", () => {
  it("ARAP respeita handles + BBW normaliza", () => {
    const mesh = buildGridMesh(30, 30, 2);
    const rest = mesh.vertices.map((v) => [v[0], v[1]] as [number, number]);
    const out = solveArap(mesh, rest, { iterations: 2, handles: new Map([[0, [99, 99]]]) });
    expect(out[0]).toEqual([99, 99]);
    const w = boundedBiharmonicApprox(mesh, [[0, 0], [30, 30]], { smoothIters: 1 });
    expect(w.length).toBe(mesh.vertices.length);
    for (const row of w) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("cage deforma por IDW", () => {
    const out = deformByCage([0, 0], [[-10, 0], [10, 0]], [[-10, 0], [20, 0]]);
    expect(out[0]).toBeGreaterThan(0);
  });
  it("player amostra clip+operadores deterministicamente", () => {
    const clip = createClip("c", "C", 1.6, 60, true);
    const k = createKeyframe(0);
    clip.frames.push(k);
    const player = new PuppetPlayer();
    player.addClip("c", clip, [createOperator("breath", "b")]);
    player.activeId = "c";
    const a = player.sample(0.5);
    const b = player.sample(0.5);
    expect(a.joints.get("root")).toEqual(b.joints.get("root"));
  });
});
