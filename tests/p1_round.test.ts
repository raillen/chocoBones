import { describe, expect, it } from "vitest";
import { buildGridMesh, detectIslands, normalizeWeights, pruneWeights, smoothWeightsTopological, weldVertices } from "../src/mesh/mesh";
import { pickEntity } from "../src/ui/viewport/picking";
import { createPin } from "../src/mesh/mesh";
import { createPose, Joint } from "../src/rig/joint";
import { addPin, deletePin, setPinAnchor, setPinInfluence, togglePinLock } from "../src/ui/actions/pin_actions";
import { chainToRoot, clampAngle, socketWorld, solveConstraints, solveFabrik } from "../src/rig/constraints";
import { createInitialAppState } from "../src/ui/store";

describe("P1-7 pin tool", () => {
  it("add/delete/lock/anchor/influence", () => {
    const s = createInitialAppState();
    const n0 = s.pins.length;
    const pin = addPin(s, "0", 33, 44, "Novo");
    expect(s.pins.length).toBe(n0 + 1);
    expect(pin.x).toBe(33);
    expect(togglePinLock(s, pin.id)).toBe(true);
    expect(setPinAnchor(s, pin.id, "joint", "root")).toBe(true);
    expect(setPinInfluence(s, pin.id, 80, 2.5, 0.5)).toBe(true);
    expect(pin.radius).toBe(80);
    expect(deletePin(s, pin.id)).toBe(true);
    expect(s.pins.length).toBe(n0);
    expect(deletePin(s, "inexistente")).toBe(false);
  });
});

describe("P1-8 picking por ferramenta", () => {
  const joints: Joint[] = [{ id: "root", name: "R", parent: "", x: 0, y: 0, color: "#fff" }];
  it("tool Pin prioriza pino sobre junta", () => {
    const pins = [createPin("pin1", "", 0, 0)];
    const pose = createPose();
    // pino e junta coincidem em (0,0): Pin tool deve retornar pin
    expect(pickEntity(joints, pins, pose, 1, 1, "Pin", 1)).toEqual({ kind: "pin", id: "pin1" });
    // Move tool prioriza junta
    expect(pickEntity(joints, pins, pose, 1, 1, "Move", 1).kind).toBe("joint");
  });
  it("pino desabilitado nunca é pego", () => {
    const pins = [createPin("p1", "", 0, 0, { enabled: false })];
    expect(pickEntity([], pins, createPose(), 0, 0, "Pin", 1).kind).toBe("none");
  });
});

describe("P1-10 constraints/FABRIK/sockets", () => {
  const mkChain = (): Joint[] => [
    { id: "root", name: "R", parent: "", x: 0, y: 0, color: "#fff" },
    { id: "a", name: "A", parent: "root", x: 0, y: 0, color: "#fff" },
    { id: "b", name: "B", parent: "a", x: 40, y: 0, color: "#fff" },
    { id: "c", name: "C", parent: "b", x: 80, y: 0, color: "#fff" },
    { id: "d", name: "D", parent: "c", x: 120, y: 0, color: "#fff" },
  ];
  it("chainToRoot ordena raiz→tip", () => {
    expect(chainToRoot(mkChain(), "d").map((j) => j.id)).toEqual(["root", "a", "b", "c", "d"]);
  });
  it("FABRIK aproxima tip do alvo", () => {
    const joints = mkChain();
    const pose = createPose();
    expect(solveFabrik(joints, pose, "d", [100, 30])).toBe(true);
  });
  it("solveConstraints resolve lista e respeita enabled", () => {
    const joints = mkChain();
    const pose = createPose();
    const n = solveConstraints(joints, pose, [
      { id: "k1", type: "ik", tipId: "c", target: [60, 20], enabled: true },
      { id: "k2", type: "ik", tipId: "d", target: [0, 0], enabled: false },
    ]);
    expect(n).toBe(1);
  });
  it("socketWorld segue junta", () => {
    const joints: Joint[] = [{ id: "root", name: "R", parent: "", x: 10, y: 20, color: "#fff" }];
    expect(socketWorld(joints, null, { id: "s", name: "S", jointId: "root", offset: [5, 5] })).toEqual([15, 25]);
    expect(clampAngle(Math.PI * 3, -0.5, 0.5)).toBeCloseTo(0.5);
  });
});

describe("P1-11 pesos topológicos", () => {
  it("prune remove e mantém ao menos 1 influência", () => {
    const mesh = buildGridMesh(20, 20, 2);
    mesh.weights = mesh.vertices.map(() => [{ joint: "a", weight: 0.001 }, { joint: "b", weight: 0.999 }]);
    expect(pruneWeights(mesh, 0.01)).toBe(mesh.vertices.length);
    for (const list of mesh.weights) {
      expect(list.length).toBe(1);
      expect(list[0]!.joint).toBe("b");
    }
  });
  it("normalize + smooth mantêm soma 1", () => {
    const mesh = buildGridMesh(20, 20, 2);
    mesh.weights = mesh.vertices.map(() => [{ joint: "a", weight: 2 }, { joint: "b", weight: 2 }]);
    normalizeWeights(mesh);
    smoothWeightsTopological(mesh, 2);
    for (const list of mesh.weights) {
      expect(list.reduce((s, w) => s + w.weight, 0)).toBeCloseTo(1);
    }
  });
  it("weld funde duplicados e detectIslands separa", () => {
    const mesh = buildGridMesh(10, 10, 1);
    mesh.vertices.push([0, 0]);
    mesh.weights.push([]);
    weldVertices(mesh, 1e-3);
    expect(mesh.triangles.every(([a, b, c]) => a !== b && b !== c && a !== c)).toBe(true);
    // duas grades disjuntas → 2 islands
    const m2 = buildGridMesh(10, 10, 1);
    const other = buildGridMesh(10, 10, 1);
    other.vertices = other.vertices.map(([x, y]) => [x + 1000, y] as [number, number]);
    const off = m2.vertices.length;
    m2.vertices.push(...other.vertices);
    m2.weights.push(...other.weights);
    m2.triangles.push(...other.triangles.map(([a, b, c]) => [a + off, b + off, c + off] as [number, number, number]));
    expect(detectIslands(m2).length).toBe(2);
  });
});
