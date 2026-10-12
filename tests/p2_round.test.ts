import { describe, expect, it } from "vitest";
import { compileRig, compiledJointIndex, isRigFresh, topoOrder } from "../src/rig/compiled";
import { boneMatrices } from "../src/rig/fk";
import { createPose, Joint } from "../src/rig/joint";
import { GpuBufferManager, MeshCache, VertexPool } from "../src/mesh/cache";
import { buildGridMesh } from "../src/mesh/mesh";
import { checkRuntimeContract, composeSpritesheet, exportImageSequence, exportRuntimeManifest } from "../src/export/runtime";
import { compareSkinning, deformSkinning, DEFORM_ORDER, DEFORM_ORDER_VERSION, skinDualQuaternionPlanar, skinLBS } from "../src/deform/lbs";
import { createInitialAppState } from "../src/ui/store";

const joints: Joint[] = [
  { id: "root", name: "R", parent: "", x: 0, y: 0, color: "#fff" },
  { id: "a", name: "A", parent: "root", x: 10, y: 0, color: "#fff" },
  { id: "b", name: "B", parent: "a", x: 20, y: 0, color: "#fff" },
];

describe("P2-12 rig pré-compilado", () => {
  it("ordem topológica põe pais antes", () => {
    const order = topoOrder([...joints].reverse());
    expect(order.indexOf("root")).toBeLessThan(order.indexOf("a"));
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
  });
  it("compileRig equivale a boneMatrices", () => {
    const pose = createPose();
    pose.joints.set("a", { angle: 0.5, x: 0, y: 0 });
    const rig = compileRig(joints, pose);
    const bones = boneMatrices(joints, pose);
    for (const j of joints) {
      const m1 = rig.bones.get(j.id)!;
      const m2 = bones.get(j.id)!;
      expect(m1.tx).toBeCloseTo(m2.tx);
      expect(m1.a).toBeCloseTo(m2.a);
    }
    expect(compiledJointIndex(rig, "b")).toBeGreaterThanOrEqual(0);
    expect(compiledJointIndex(rig, "ghost")).toBe(-1);
    expect(isRigFresh(rig, joints)).toBe(true);
    expect(isRigFresh(rig, [...joints, { id: "x", name: "X", parent: "", x: 0, y: 0, color: "#fff" }])).toBe(false);
  });
});

describe("P2-13 cache + buffers dirty", () => {
  it("ensure cacheia e markDirty invalida", () => {
    const cache = new MeshCache();
    const mesh = buildGridMesh(20, 20, 2);
    const e1 = cache.ensure("m", mesh);
    expect(cache.isDirty("m")).toBe(true);
    cache.markClean("m", e1.version);
    expect(cache.isDirty("m")).toBe(false);
    cache.markDirty("m");
    expect(cache.dirtyIds()).toEqual(["m"]);
  });
  it("GpuBufferManager só envia dirty", () => {
    const mgr = new GpuBufferManager();
    const m1 = buildGridMesh(20, 20, 2);
    const m2 = buildGridMesh(10, 10, 2);
    const first = mgr.sync(new Map([["a", m1], ["b", m2]]));
    expect(first.uploaded.length).toBe(2);
    const second = mgr.sync(new Map([["a", m1], ["b", m2]]));
    expect(second.uploaded.length).toBe(0);
    expect(second.skipped.length).toBe(2);
    mgr.cache.markDirty("a");
    const third = mgr.sync(new Map([["a", m1], ["b", m2]]));
    expect(third.uploaded).toEqual(["a"]);
  });
  it("VertexPool reusa memória", () => {
    const pool = new VertexPool();
    const a = pool.acquire(100);
    pool.release(a);
    expect(pool.size()).toBe(1);
    const b = pool.acquire(50);
    expect(pool.size()).toBe(0);
    void b;
  });
});

describe("P2-14 runtime/export", () => {
  it("manifest versionado valida", () => {
    const s = createInitialAppState();
    const m = exportRuntimeManifest(s);
    expect(m.runtimeVersion).toBe(2);
    expect(checkRuntimeContract(m)).toEqual([]);
    expect(checkRuntimeContract({ ...m, runtimeVersion: 99 }).length).toBeGreaterThan(0);
  });
  it("image sequence usa mesmo evaluate + spritesheet compõe", () => {
    const s = createInitialAppState();
    s.isPlaying = false;
    const frames = exportImageSequence(s, 4);
    expect(frames.length).toBe(4);
    // determinismo: segunda chamada igual
    const frames2 = exportImageSequence(s, 4);
    expect(Buffer.from(frames[0]!).equals(Buffer.from(frames2[0]!))).toBe(true);
    const sheet = composeSpritesheet(frames, s.viewportBuffer.width, s.viewportBuffer.height, 2);
    expect(sheet.width).toBe(s.viewportBuffer.width * 2);
    expect(sheet.height).toBe(s.viewportBuffer.height * 2);
    expect(() => composeSpritesheet([], 10, 10, 2)).toThrow();
  });
});

describe("P2-15 LBS/DQ", () => {
  it("influência única: DQ == LBS == bone*v", () => {
    const pose = createPose();
    pose.joints.set("a", { angle: Math.PI / 2, x: 0, y: 0 });
    const rig = compileRig(joints, pose);
    const v: [number, number] = [20, 0];
    const w = [{ joint: "a", weight: 1 }];
    const lbs = skinLBS(v, w, rig);
    const dq = skinDualQuaternionPlanar(v, w, rig);
    expect(dq[0]).toBeCloseTo(lbs[0]);
    expect(dq[1]).toBeCloseTo(lbs[1]);
  });
  it("deformSkinning + compare funcionam", () => {
    const mesh = buildGridMesh(20, 20, 2);
    mesh.weights = mesh.vertices.map(() => [{ joint: "root", weight: 0.5 }, { joint: "a", weight: 0.5 }]);
    const pose = createPose();
    pose.joints.set("a", { angle: 1.2, x: 0, y: 0 });
    const rig = compileRig(joints, pose);
    const a = deformSkinning(mesh, rig, undefined, false);
    const b = deformSkinning(mesh, rig, undefined, true);
    expect(a.length).toBe(mesh.vertices.length);
    expect(b.length).toBe(mesh.vertices.length);
    const cmp = compareSkinning(mesh, rig);
    expect(cmp.meanDist).toBeGreaterThanOrEqual(0);
    expect(DEFORM_ORDER).toBe("bones-then-mls");
    expect(DEFORM_ORDER_VERSION).toBe(1);
  });
});
