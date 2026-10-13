/** A shared local-space packet for the texture, wireframe, ghosts and exports. */
import type { Vec2 } from "../core/types";
import { createArapSolver, type ArapSolver } from "../deform/arap_solver";
import { insertMeshPoints } from "../mesh/adaptive_sprite_mesh";
import { warpPoint, type Mesh, type Pin } from "../mesh/mesh";

export interface DeformedSprite {
  vertices: Vec2[];
  triangles: [number, number, number][];
  uvs: Vec2[];
  /** Index in the augmented packet for each input pin; null if disabled/outside. */
  pinIndices: (number | null)[];
}

interface Prepared {
  signature: string;
  mesh: Mesh;
  uvs: Vec2[];
  pinIndices: (number | null)[];
  solver: ArapSolver;
  poses: Map<string, DeformedSprite>;
}
const cache = new WeakMap<Mesh, Prepared>();

export function deformSpriteMesh(
  mesh: Mesh, uvs: Vec2[], pins: Pin[], deltas: Map<string, Vec2> | null,
): DeformedSprite {
  if (uvs.length !== mesh.vertices.length) throw new Error("A malha precisa de um UV por vértice.");
  if (mesh.deformation !== "ARAP") {
    return {
      vertices: mesh.vertices.map((v) => warpPoint(v, pins, deltas, mesh.strength)),
      triangles: mesh.triangles, uvs, pinIndices: pins.map(() => null),
    };
  }
  // Geometry remains mutable in the editor: object identity alone would allow stale solvers.
  const signature = JSON.stringify([mesh.vertices, mesh.triangles, uvs,
    pins.map((p) => [p.id, p.x, p.y, p.enabled !== false])]);
  let prepared = cache.get(mesh);
  if (prepared?.signature !== signature) {
    const enabled = pins.filter((p) => p.enabled !== false);
    const inserted = insertMeshPoints(mesh, uvs, enabled.map((p): Vec2 => [p.x, p.y]));
    if (inserted.mesh.vertices.length > 4096) throw new Error("ARAP aceita até 4096 vértices; reduza a densidade ou o refinamento.");
    let cursor = 0;
    prepared = {
      signature, mesh: inserted.mesh, uvs: inserted.uvs,
      pinIndices: pins.map((p) => p.enabled === false ? null : inserted.indices[cursor++] ?? null),
      solver: createArapSolver(inserted.mesh.vertices, inserted.mesh.triangles), poses: new Map(),
    };
    cache.set(mesh, prepared);
  }
  const strength = Number.isFinite(mesh.strength) ? Math.max(0, Math.min(1, mesh.strength)) : 1;
  const poseKey = JSON.stringify([strength, pins.map((p) => [p.locked, deltas?.get(p.id) ?? [0, 0]])]);
  const existing = prepared.poses.get(poseKey);
  if (existing) return existing;
  const handles = new Map<number, { vertex: number; target: Vec2; locked: boolean }>();
  pins.forEach((pin, index) => {
    const vertex = prepared!.pinIndices[index];
    if (vertex === null || vertex === undefined) return;
    const delta = pin.locked ? undefined : deltas?.get(pin.id);
    const target: Vec2 = [pin.x + (delta?.[0] ?? 0) * strength, pin.y + (delta?.[1] ?? 0) * strength];
    // Coincident pins share a vertex. A fixed anchor takes priority over a moved pin.
    if (!handles.has(vertex) || pin.locked) handles.set(vertex, { vertex, target, locked: pin.locked });
  });
  const packet: DeformedSprite = {
    vertices: prepared.solver.solve([...handles.values()]),
    triangles: prepared.mesh.triangles, uvs: prepared.uvs, pinIndices: prepared.pinIndices,
  };
  prepared.poses.set(poseKey, packet);
  if (prepared.poses.size > 4) prepared.poses.delete(prepared.poses.keys().next().value!);
  return packet;
}
