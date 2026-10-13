/// <reference lib="webworker" />
import { deformSpriteMesh } from "../../../render/deformed_sprite";
import { packGeometry, type DeformationRequest, type DeformationResult, type WorkerMesh } from "../stage/protocol";

const rest = new Map<string, WorkerMesh>();
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<DeformationRequest>) => {
  const request = event.data;
  if (request.type !== "deform") return;
  const start = performance.now();
  try {
    const keep = new Set(request.keep);
    for (const id of rest.keys()) if (!keep.has(id)) rest.delete(id);
    for (const update of request.updates) rest.set(update.id, update);
    const packets = request.poses.map((pose) => {
      const geometry = rest.get(pose.mesh);
      if (!geometry) throw new Error(`Malha ausente: ${pose.mesh}`);
      return packGeometry(pose.key, deformSpriteMesh(geometry.mesh, geometry.uvs, geometry.pins, new Map(pose.pins)));
    });
    const result: DeformationResult = {
      type: "deformed", id: request.id, document: request.document,
      packets, elapsedMs: performance.now() - start,
    };
    scope.postMessage(result, packets.flatMap((packet) => [packet.vertices.buffer, packet.triangles.buffer, packet.uvs.buffer]));
  } catch (error) {
    const result: DeformationResult = {
      type: "deformed", id: request.id, document: request.document,
      packets: [], elapsedMs: performance.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
    scope.postMessage(result);
  }
};
