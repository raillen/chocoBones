/**
 * chocoBones TypeScript Wavefront OBJ Loader
 * Parser para geometria 3D, normais e coordenadas UV no formato .obj.
 */

import { Vec3 } from "../core/math3d";
import { Vec2 } from "../core/types";
import { createMesh3D, Mesh3D, mesh3dRecalculateNormals, mesh3dUpdateAABB } from "./mesh3d";

export function loadObjFromString(content: string, name = "obj_model"): Mesh3D {
  const mesh = createMesh3D(name);
  const positions: Vec3[] = [];
  const normals: Vec3[] = [];
  const uvs: Vec2[] = [];

  const vertexMap = new Map<string, number>();

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) continue;

    const parts = line.split(/\s+/);
    const type = parts[0];

    switch (type) {
      case "v": {
        if (parts.length >= 4) {
          const x = parseFloat(parts[1]!);
          const y = parseFloat(parts[2]!);
          const z = parseFloat(parts[3]!);
          positions.push([x, y, z]);
        }
        break;
      }

      case "vn": {
        if (parts.length >= 4) {
          const x = parseFloat(parts[1]!);
          const y = parseFloat(parts[2]!);
          const z = parseFloat(parts[3]!);
          normals.push([x, y, z]);
        }
        break;
      }

      case "vt": {
        if (parts.length >= 3) {
          const u = parseFloat(parts[1]!);
          const v = parseFloat(parts[2]!);
          uvs.push([u, v]);
        }
        break;
      }

      case "f": {
        if (parts.length < 4) continue;
        const faceIndices: number[] = [];

        for (let i = 1; i < parts.length; i++) {
          const token = parts[i]!;
          let vertexIdx = vertexMap.get(token);

          if (vertexIdx === undefined) {
            const sub = token.split("/");
            const posIdx = parseInt(sub[0]!, 10) - 1;
            const uvIdx = sub[1] && sub[1] !== "" ? parseInt(sub[1], 10) - 1 : -1;
            const normIdx = sub[2] && sub[2] !== "" ? parseInt(sub[2], 10) - 1 : -1;

            const pos: Vec3 = (posIdx >= 0 && posIdx < positions.length) ? positions[posIdx]! : [0, 0, 0];
            const uv: Vec2 = (uvIdx >= 0 && uvIdx < uvs.length) ? uvs[uvIdx]! : [0, 0];
            const norm: Vec3 = (normIdx >= 0 && normIdx < normals.length) ? normals[normIdx]! : [0, 1, 0];

            vertexIdx = mesh.vertices.length;
            mesh.vertices.push({
              pos,
              normal: norm,
              uv,
              joints: [0, 0, 0, 0],
              weights: [1, 0, 0, 0],
            });
            vertexMap.set(token, vertexIdx);
          }

          faceIndices.push(vertexIdx);
        }

        // Triangulação em leque para polígonos com mais de 3 vértices
        for (let i = 1; i < faceIndices.length - 1; i++) {
          mesh.indices.push(faceIndices[0]!, faceIndices[i]!, faceIndices[i + 1]!);
        }
        break;
      }
    }
  }

  if (normals.length === 0) {
    mesh3dRecalculateNormals(mesh);
  }
  mesh3dUpdateAABB(mesh);
  return mesh;
}
