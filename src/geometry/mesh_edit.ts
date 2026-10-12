/**
 * chocoBones edição de malha Fase 1: add/move/delete vértice + undo + testes topologia.
 */
import { Vec2 } from "../core/types";
import { Mesh } from "../mesh/mesh";
import { validateMeshTopology } from "../geometry/contour";

export function meshAddVertex(mesh: Mesh, pos: Vec2): number {
  mesh.vertices.push([pos[0], pos[1]]);
  mesh.weights.push([]);
  return mesh.vertices.length - 1;
}

export function meshMoveVertex(mesh: Mesh, idx: number, x: number, y: number): boolean {
  if (idx < 0 || idx >= mesh.vertices.length) return false;
  mesh.vertices[idx] = [x, y];
  return true;
}

export function meshDeleteVertex(mesh: Mesh, idx: number): boolean {
  if (idx < 0 || idx >= mesh.vertices.length) return false;
  mesh.vertices.splice(idx, 1);
  mesh.weights.splice(idx, 1);
  // Reindexa triângulos; remove os que usavam o vértice
  const tris: Array<[number, number, number]> = [];
  for (const [a, b, c] of mesh.triangles) {
    if (a === idx || b === idx || c === idx) continue;
    const remap = (v: number): number => (v > idx ? v - 1 : v);
    tris.push([remap(a), remap(b), remap(c)]);
  }
  mesh.triangles = tris;
  return true;
}

/** Retorna true se malha passa sem degenerados, winding misto ou isolados. */
export function meshTopologyClean(mesh: Mesh): boolean {
  const issues = validateMeshTopology(mesh.vertices, mesh.triangles);
  return issues.length === 0;
}
