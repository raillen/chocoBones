/**
 * chocoBones TypeScript 3D Mesh Primitives
 * Gerador de geometrias paramétricas: Cubo, Cilindro, Esfera e Plano.
 */

import { Vec3 } from "../core/math3d";
import { createMesh3D, Mesh3D, mesh3dUpdateAABB } from "./mesh3d";

export function createCubeMesh(size = 1.0): Mesh3D {
  const m = createMesh3D("Cubo");
  const h = size * 0.5;

  interface FaceDef {
    normal: Vec3;
    p0: Vec3;
    p1: Vec3;
    p2: Vec3;
    p3: Vec3;
  }

  const faces: FaceDef[] = [
    // Front (+Z)
    { normal: [0, 0, 1], p0: [-h, -h, h], p1: [h, -h, h], p2: [h, h, h], p3: [-h, h, h] },
    // Back (-Z)
    { normal: [0, 0, -1], p0: [h, -h, -h], p1: [-h, -h, -h], p2: [-h, h, -h], p3: [h, h, -h] },
    // Top (+Y)
    { normal: [0, 1, 0], p0: [-h, h, h], p1: [h, h, h], p2: [h, h, -h], p3: [-h, h, -h] },
    // Bottom (-Y)
    { normal: [0, -1, 0], p0: [-h, -h, -h], p1: [h, -h, -h], p2: [h, -h, h], p3: [-h, -h, h] },
    // Right (+X)
    { normal: [1, 0, 0], p0: [h, -h, h], p1: [h, -h, -h], p2: [h, h, -h], p3: [h, h, h] },
    // Left (-X)
    { normal: [-1, 0, 0], p0: [-h, -h, -h], p1: [-h, -h, h], p2: [-h, h, h], p3: [-h, h, -h] },
  ];

  for (const f of faces) {
    const baseIdx = m.vertices.length;
    m.vertices.push({ pos: f.p0, normal: f.normal, uv: [0, 0], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });
    m.vertices.push({ pos: f.p1, normal: f.normal, uv: [1, 0], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });
    m.vertices.push({ pos: f.p2, normal: f.normal, uv: [1, 1], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });
    m.vertices.push({ pos: f.p3, normal: f.normal, uv: [0, 1], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });

    m.indices.push(baseIdx + 0, baseIdx + 1, baseIdx + 2);
    m.indices.push(baseIdx + 0, baseIdx + 2, baseIdx + 3);
  }

  mesh3dUpdateAABB(m);
  return m;
}

export function createPlaneMesh(width = 2.0, depth = 2.0): Mesh3D {
  const m = createMesh3D("Plano");
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const norm: Vec3 = [0, 1, 0];

  m.vertices.push({ pos: [-hw, 0, hd], normal: norm, uv: [0, 0], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });
  m.vertices.push({ pos: [hw, 0, hd], normal: norm, uv: [1, 0], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });
  m.vertices.push({ pos: [hw, 0, -hd], normal: norm, uv: [1, 1], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });
  m.vertices.push({ pos: [-hw, 0, -hd], normal: norm, uv: [0, 1], joints: [0, 0, 0, 0], weights: [1, 0, 0, 0] });

  m.indices.push(0, 1, 2, 0, 2, 3);
  mesh3dUpdateAABB(m);
  return m;
}
