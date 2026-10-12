import { describe, expect, it } from "vitest";
import { HistoryStack } from "../src/history/history";
import { Joint, Layer } from "../src/rig/joint";

describe("History & Undo/Redo Engine", () => {
  it("pushes states, un-does and re-does correctly", () => {
    const history = new HistoryStack(10);
    const joints: Joint[] = [{ id: "root", name: "Root", parent: "", x: 0, y: 0, color: "#fff" }];
    const layers: Layer[] = [];

    // Estado inicial salvo
    history.push("Ação 1: Mover Root", joints, layers);

    // Modifica junta
    joints[0]!.x = 50;
    history.push("Ação 2: Mover Root de novo", joints, layers);

    joints[0]!.x = 100;

    // Desfaz Ação 2
    const desc1 = history.undo(joints, layers);
    expect(desc1).toBe("Ação 2: Mover Root de novo");
    expect(joints[0]!.x).toBe(50);

    // Desfaz Ação 1
    const desc2 = history.undo(joints, layers);
    expect(desc2).toBe("Ação 1: Mover Root");
    expect(joints[0]!.x).toBe(0);

    // Refaz Ação 1
    const redoDesc = history.redo(joints, layers);
    expect(redoDesc).toBe("Ação 1: Mover Root");
    expect(joints[0]!.x).toBe(50);
  });
});
