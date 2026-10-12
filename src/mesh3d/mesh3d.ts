/**
 * chocoBones TypeScript 3D Mesh Definitions & Normal Calculations
 */

import { vec3Add, vec3Cross, vec3Normalize, vec3Sub, Vec3 } from "../core/math3d";
import { Vec2 } from "../core/types";

export interface Vertex3D {
  pos: Vec3;
  normal: Vec3;
  uv: Vec2;
  joints: [number, number, number, number];
  weights: [number, number, number, number];
}

export interface Mesh3D {
  name: string;
  vertices: Vertex3D[];
  indices: number[];
  aabbMin: Vec3;
  aabbMax: Vec3;
  hasSkinning: boolean;
}

export function createMesh3D(name = "mesh3d"): Mesh3D {
  return {
    name,
    vertices: [],
    indices: [],
    aabbMin: [1e9, 1e9, 1e9],
    aabbMax: [-1e9, -1e9, -1e9],
    hasSkinning: false,
  };
}

export function mesh3dUpdateAABB(m: Mesh3D): void {
  if (m.vertices.length === 0) {
    m.aabbMin = [0, 0, 0];
    m.aabbMax = [0, 0, 0];
    return;
  }

  const minP: Vec3 = [1e9, 1e9, 1e9];
  const maxP: Vec3 = [-1e9, -1e9, -1e9];

  for (const v of m.vertices) {
    minP[0] = Math.min(minP[0], v.pos[0]);
    minP[1] = Math.min(minP[1], v.pos[1]);
    minP[2] = Math.min(minP[2], v.pos[2]);

    maxP[0] = Math.max(maxP[0], v.pos[0]);
    maxP[1] = Math.max(maxP[1], v.pos[1]);
    maxP[2] = Math.max(maxP[2], v.pos[2]);
  }

  m.aabbMin = minP;
  m.aabbMax = maxP;
}

export function mesh3dRecalculateNormals(m: Mesh3D): void {
  if (m.indices.length === 0) return;

  for (const v of m.vertices) {
    v.normal = [0, 0, 0];
  }

  const numTris = Math.floor(m.indices.length / 3);
  for (let t = 0; t < numTris; t++) {
    const i0 = m.indices[t * 3 + 0]!;
    const i1 = m.indices[t * 3 + 1]!;
    const i2 = m.indices[t * 3 + 2]!;

    const v0 = m.vertices[i0]!;
    const v1 = m.vertices[i1]!;
    const v2 = m.vertices[i2]!;

    const e1 = vec3Sub(v1.pos, v0.pos);
    const e2 = vec3Sub(v2.pos, v0.pos);
    const fn = vec3Cross(e1, e2);

    v0.normal = vec3Add(v0.normal, fn);
    v1.normal = vec3Add(v1.normal, fn);
    v2.normal = vec3Add(v2.normal, fn);
  }

  for (const v of m.vertices) {
    v.normal = vec3Normalize(v.normal);
  }
}

export function mesh3dNormalizeAndCenter(m: Mesh3D, targetSize = 2.0): void {
  mesh3dUpdateAABB(m);
  const cx = (m.aabbMin[0] + m.aabbMax[0]) * 0.5;
  const cy = (m.aabbMin[1] + m.aabbMax[1]) * 0.5;
  const cz = (m.aabbMin[2] + m.aabbMax[2]) * 0.5;

  const dx = m.aabbMax[0] - m.aabbMin[0];
  const dy = m.aabbMax[1] - m.aabbMin[1];
  const dz = m.aabbMax[2] - m.aabbMin[2];
  const maxDim = Math.max(dx, dy, dz);
  const scale = maxDim > 1e-6 ? targetSize / maxDim : 1.0;

  for (const v of m.vertices) {
    v.pos[0] = (v.pos[0] - cx) * scale;
    v.pos[1] = (v.pos[1] - cy) * scale;
    v.pos[2] = (v.pos[2] - cz) * scale;
  }
  mesh3dUpdateAABB(m);
}

