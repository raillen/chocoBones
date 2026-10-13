import { describe, expect, it } from "vitest";
import { createSnapshot, HistoryStack } from "../src/history/history";
import { createPin, type Pin } from "../src/mesh/mesh";
import { createPose, type Joint, type Layer } from "../src/rig/joint";

describe("Histórico de pinos e documento", () => {
  it("desfaz o primeiro pino até a lista vazia e refaz com o mesmo binding", () => {
    const history = new HistoryStack();
    const joints: Joint[] = [];
    const layers: Layer[] = [];
    const pose = createPose();
    const pins: Pin[] = [];
    history.push("Adicionar primeiro pino", joints, layers, pose, pins);
    pins.push(createPin("p", "0", 10, 20, { name: "Peito", anchorMode: "joint", anchorJoint: "root" }));
    pose.pins.set("p", [3, 4]);
    expect(history.undo(joints, layers, pose, pins)).toBe("Adicionar primeiro pino");
    expect(pins).toEqual([]);
    expect(pose.pins.size).toBe(0);
    expect(history.redo(joints, layers, pose, pins)).toBe("Adicionar primeiro pino");
    expect(pins[0]).toMatchObject({ id: "p", name: "Peito", meshId: "0", anchorMode: "joint", anchorJoint: "root" });
    expect(pose.pins.get("p")).toEqual([3, 4]);
    history.undo(joints, layers, pose, pins);
    expect(pins).toEqual([]);
  });

  it("refaz a exclusão do último pino até a lista vazia", () => {
    const history = new HistoryStack();
    const pins = [createPin("last", "0", 5, 7)];
    history.push("Remover último pino", [], [], null, pins);
    pins.splice(0, 1);
    history.undo([], [], null, pins);
    expect(pins[0]!.id).toBe("last");
    history.redo([], [], null, pins);
    expect(pins).toEqual([]);
  });

  it("snapshots sem argumento de pinos não alteram sua lista nem no redo", () => {
    const history = new HistoryStack();
    const joints: Joint[] = [{ id: "root", name: "Root", parent: "", x: 0, y: 0, color: "#fff" }];
    const pins = [createPin("existing", "0", 10, 20)];
    history.push("Mover junta", joints, []);
    joints[0]!.x = 10;
    history.undo(joints, [], null, pins);
    expect(joints[0]!.x).toBe(0);
    pins[0]!.x = 99;
    history.redo(joints, [], null, pins);
    expect(joints[0]!.x).toBe(10);
    expect(pins[0]!.x).toBe(99);
    expect(createSnapshot("Legacy", [], []).pinsIncluded).toBe(false);
    expect(createSnapshot("Empty pins", [], [], null, []).pinsIncluded).toBe(true);
  });

  it("captura/restaura dados adicionais de documento com joints/pinos/pose no undo e redo", () => {
    const history = new HistoryStack();
    const joints: Joint[] = [];
    const layers: Layer[] = [];
    const pins: Pin[] = [];
    const pose = createPose();
    let document = { canvasWidth: 512, meshUvs: new Map<string, [number, number][]>(), assetIds: [] as string[] };
    history.setDocumentHooks(
      () => ({ canvasWidth: document.canvasWidth, meshUvs: new Map([...document.meshUvs].map(([id, uvs]) => [id, uvs.map((uv) => [...uv])])), assetIds: [...document.assetIds] }),
      (saved) => { document = saved as typeof document; },
    );
    history.push("Importar sprite", joints, layers, pose, pins);
    document.canvasWidth = 800;
    document.meshUvs.set("0", [[0.25, 0.75]]);
    document.assetIds.push("sprite");
    pins.push(createPin("pin", "0", 1, 2));
    pose.pins.set("pin", [3, 4]);
    history.undo(joints, layers, pose, pins);
    expect(document.canvasWidth).toBe(512);
    expect(document.meshUvs.size).toBe(0);
    expect(document.assetIds).toEqual([]);
    expect(pins).toEqual([]);
    history.redo(joints, layers, pose, pins);
    expect(document.canvasWidth).toBe(800);
    expect(document.meshUvs.get("0")).toEqual([[0.25, 0.75]]);
    expect(document.assetIds).toEqual(["sprite"]);
    expect(pins[0]!.id).toBe("pin");
    expect(pose.pins.get("pin")).toEqual([3, 4]);
    document.meshUvs.get("0")![0]![0] = 1;
    history.undo(joints, layers, pose, pins);
    expect(document.meshUvs.size).toBe(0);
  });

  it("não chama restore para snapshots legados capturados antes dos hooks", () => {
    const history = new HistoryStack();
    history.push("Anterior", [], []);
    let restores = 0;
    history.setDocumentHooks(() => ({ asset: "current" }), () => { restores++; });
    history.undo([], []);
    expect(restores).toBe(0);
    history.redo([], []);
    expect(restores).toBe(1);
  });
});
