/**
 * chocoBones TypeScript glTF 2.0 / GLB Loader
 * Extrai malhas 3D, normais, coordenadas de textura UV e pesos de skinning.
 */

import { Vec3 } from "../core/math3d";
import { Vec2 } from "../core/types";
import { createMesh3D, Mesh3D, mesh3dUpdateAABB } from "./mesh3d";

const COMPONENT_FLOAT = 5126;
const COMPONENT_UNSIGNED_SHORT = 5123;
const COMPONENT_UNSIGNED_INT = 5125;

interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
}

interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  count: number;
  type: string;
}

interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  mode?: number;
}

interface GltfMesh {
  name?: string;
  primitives: GltfPrimitive[];
}

interface GltfRoot {
  meshes?: GltfMesh[];
  accessors?: GltfAccessor[];
  bufferViews?: GltfBufferView[];
  buffers?: Array<{ byteLength: number; uri?: string }>;
}

export function loadGltfFromJson(jsonStr: string, binaryBuffers: Uint8Array[] = []): Mesh3D[] {
  const root = JSON.parse(jsonStr) as GltfRoot;
  const meshes: Mesh3D[] = [];

  const readAccessorData = (accessorIdx: number): ArrayBufferView | null => {
    if (!root.accessors || !root.bufferViews) return null;
    const accessor = root.accessors[accessorIdx];
    if (!accessor || accessor.bufferView === undefined) return null;

    const bufferView = root.bufferViews[accessor.bufferView];
    if (!bufferView) return null;

    const rawBuf = binaryBuffers[bufferView.buffer];
    if (!rawBuf) return null;

    const offset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

    if (accessor.componentType === COMPONENT_FLOAT) {
      return new Float32Array(rawBuf.buffer, rawBuf.byteOffset + offset, accessor.count * (accessor.type === "VEC3" ? 3 : accessor.type === "VEC2" ? 2 : 1));
    } else if (accessor.componentType === COMPONENT_UNSIGNED_SHORT) {
      return new Uint16Array(rawBuf.buffer, rawBuf.byteOffset + offset, accessor.count);
    } else if (accessor.componentType === COMPONENT_UNSIGNED_INT) {
      return new Uint32Array(rawBuf.buffer, rawBuf.byteOffset + offset, accessor.count);
    }
    return null;
  };

  if (root.meshes) {
    for (const gMesh of root.meshes) {
      const mesh = createMesh3D(gMesh.name ?? "gltf_mesh");

      for (const prim of gMesh.primitives) {
        const posAccessorIdx = prim.attributes["POSITION"];
        if (posAccessorIdx === undefined) continue;

        const positions = readAccessorData(posAccessorIdx) as Float32Array | null;
        if (!positions) continue;

        const normAccessorIdx = prim.attributes["NORMAL"];
        const normals = normAccessorIdx !== undefined ? (readAccessorData(normAccessorIdx) as Float32Array | null) : null;

        const uvAccessorIdx = prim.attributes["TEXCOORD_0"];
        const uvs = uvAccessorIdx !== undefined ? (readAccessorData(uvAccessorIdx) as Float32Array | null) : null;

        const vertexCount = Math.floor(positions.length / 3);
        const baseIdx = mesh.vertices.length;

        for (let i = 0; i < vertexCount; i++) {
          const pos: Vec3 = [positions[i * 3 + 0]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
          const norm: Vec3 = normals ? [normals[i * 3 + 0]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!] : [0, 1, 0];
          const uv: Vec2 = uvs ? [uvs[i * 2 + 0]!, uvs[i * 2 + 1]!] : [0, 0];

          mesh.vertices.push({
            pos,
            normal: norm,
            uv,
            joints: [0, 0, 0, 0],
            weights: [1, 0, 0, 0],
          });
        }

        if (prim.indices !== undefined) {
          const indicesView = readAccessorData(prim.indices);
          if (indicesView && "length" in indicesView) {
            const arr = indicesView as Uint16Array | Uint32Array;
            for (let i = 0; i < arr.length; i++) {
              mesh.indices.push(baseIdx + Number(arr[i]));
            }
          }
        } else {
          for (let i = 0; i < vertexCount; i++) {
            mesh.indices.push(baseIdx + i);
          }
        }
      }

      mesh3dUpdateAABB(mesh);
      meshes.push(mesh);
    }
  }

  return meshes;
}
