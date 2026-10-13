import { describe, expect, it } from "vitest";
import { EditorController } from "../src/editor/controller";
import { DeformationQueue, prepareStageFrame } from "../src/desktop/view/stage/deformation";
import { packGeometry, type DeformationRequest, type DeformationResult, type StageFrame } from "../src/desktop/view/stage/protocol";

class FakeWorker {
  onmessage: ((event: MessageEvent<DeformationResult>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  requests: DeformationRequest[] = [];
  terminated = false;
  postMessage(request: DeformationRequest): void { this.requests.push(structuredClone(request)); }
  terminate(): void { this.terminated = true; }
  complete(index = this.requests.length - 1): void {
    const request = this.requests[index]!;
    this.onmessage?.({ data: { type: "deformed", id: request.id, document: request.document,
      packets: [], elapsedMs: 3 } } as unknown as MessageEvent<DeformationResult>);
  }
  crash(): void { this.onerror?.({ message: "worker interrupted", preventDefault() {} } as ErrorEvent); }
}

function document(): EditorController {
  const editor = new EditorController();
  editor.importDecoded({ width: 8, height: 8, pixels: new Uint8ClampedArray(8 * 8 * 4).fill(255), png: new Uint8Array() }, "Sprite");
  return editor;
}

describe("desktop deformation worker queue", () => {
  it("keeps only one solve in flight and replaces the pending pose", () => {
    const editor = document();
    const worker = new FakeWorker();
    const frames: StageFrame[] = [];
    const queue = new DeformationQueue((frame) => frames.push(frame), () => {}, () => worker as unknown as Worker);
    queue.request(editor.state);
    for (let i = 1; i <= 12; i++) {
      editor.state.currentPose.pins.set("test", [i, i * 2]);
      queue.request(editor.state);
    }
    expect(worker.requests).toHaveLength(1);
    worker.complete();
    expect(worker.requests).toHaveLength(2);
    expect(worker.requests[1]!.poses[0]!.pins).toEqual([["test", [12, 24]]]);
    expect(worker.requests[1]!.updates).toHaveLength(0);
    expect(frames).toHaveLength(1);
    worker.complete();
    expect(frames).toHaveLength(2);
    queue.dispose();
  });

  it("discards old document output and snapshots pending geometry before Setup mutates it", () => {
    const editor = document();
    const worker = new FakeWorker();
    const frames: StageFrame[] = [];
    const queue = new DeformationQueue((frame) => frames.push(frame), () => {}, () => worker as unknown as Worker);
    queue.request(editor.state);
    const mesh = editor.state.meshes[Number(editor.state.meshLayer.get(editor.state.selectedLayerId))]!;
    mesh.vertices[0]![0] = 2;
    queue.request(editor.state);
    // The pending frame must remain a coherent snapshot even if mutation happens before flush.
    mesh.vertices[0]![0] = 3;
    worker.complete();
    expect(frames).toHaveLength(0);
    expect(worker.requests[1]!.updates[0]!.mesh.vertices[0]![0]).toBe(2);
    queue.request(editor.state);
    worker.complete();
    expect(frames).toHaveLength(0);
    expect(worker.requests[2]!.updates[0]!.mesh.vertices[0]![0]).toBe(3);
    worker.complete();
    expect(frames).toHaveLength(1);
    queue.dispose();
  });

  it("restarts a crashed worker once with the latest pose and then allows explicit retry", () => {
    const editor = document();
    const workers: FakeWorker[] = [];
    const errors: string[] = [];
    const queue = new DeformationQueue(() => {}, (message) => errors.push(message), () => {
      const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker;
    });
    queue.request(editor.state);
    editor.state.currentPose.pins.set("test", [40, 10]);
    queue.request(editor.state);
    workers[0]!.crash();
    expect(workers[0]!.terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1]!.requests[0]!.updates.length).toBeGreaterThan(0);
    expect(workers[1]!.requests[0]!.poses[0]!.pins).toEqual([["test", [40, 10]]]);
    workers[1]!.crash();
    expect(workers).toHaveLength(2);
    expect(errors.at(-1)).toContain("Tentar novamente");
    queue.retry();
    expect(workers).toHaveLength(3);
    expect(workers[2]!.requests).toHaveLength(1);
    workers[2]!.complete();
    queue.dispose();
  });

  it("does not solve again just because the camera or selection changed", () => {
    const editor = document();
    const worker = new FakeWorker();
    const queue = new DeformationQueue(() => {}, () => {}, () => worker as unknown as Worker);
    queue.request(editor.state);
    worker.complete();
    editor.state.cameraPan.x += 20;
    editor.state.cameraZoom = 1.5;
    editor.state.selectedPinId = "unrelated";
    queue.request(editor.state);
    expect(worker.requests).toHaveLength(1);
    queue.dispose();
  });

  it("packs owned output buffers without transferring or modifying source geometry", () => {
    const source = { vertices: [[0, 0], [8, 0], [0, 8]] as [number, number][],
      triangles: [[0, 1, 2]] as [number, number, number][], uvs: [[0, 0], [1, 0], [0, 1]] as [number, number][] };
    const packet = packGeometry("layer", source);
    structuredClone(packet, { transfer: [packet.vertices.buffer, packet.uvs.buffer, packet.triangles.buffer] });
    expect(source.vertices).toEqual([[0, 0], [8, 0], [0, 8]]);
    expect(source.triangles).toEqual([[0, 1, 2]]);
    expect(prepareStageFrame(document().state).geometries[0]!.mesh.vertices.length).toBeGreaterThan(0);
  });
});
