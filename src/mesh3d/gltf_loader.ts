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
  materials?: Array<{ name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[] } }>;
}

function numComponents(type: string): number {
  if (type === "SCALAR") return 1;
  if (type === "VEC2") return 2;
  if (type === "VEC3") return 3;
  if (type === "VEC4") return 4;
  if (type === "MAT4") return 16;
  return 1;
}

/** Extrai JSON + binário de um container GLB. Lança erro em magic/version inválidos. */
export function parseGlb(glb: Uint8Array): { json: string; binary: Uint8Array } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error("GLB inválido: magic mismatch");
  const jsonLen = view.getUint32(12, true);
  const jsonBytes = glb.slice(20, 20 + jsonLen);
  const json = Buffer.from(jsonBytes).toString("utf-8");
  // Chunk BIN (opcional)
  let binary = new Uint8Array(0);
  const binHeaderOff = 20 + jsonLen;
  if (binHeaderOff + 8 <= glb.length) {
    const binLen = view.getUint32(binHeaderOff, true);
    binary = glb.slice(binHeaderOff + 8, binHeaderOff + 8 + binLen);
  }
  return { json, binary };
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

    const stride = bufferView.byteStride ?? 0;
    const comps = numComponents(accessor.type);
    const offset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);

    // Caminho rápido: tightly-packed
    const packedSize =
      accessor.count * comps * (accessor.componentType === COMPONENT_FLOAT ? 4 : accessor.componentType === COMPONENT_UNSIGNED_SHORT ? 2 : 4);
    const isPacked = stride === 0 || stride === comps * (accessor.componentType === COMPONENT_FLOAT ? 4 : 2);

    if (accessor.componentType === COMPONENT_FLOAT) {
      if (isPacked && offset + packedSize <= rawBuf.byteLength) {
        return new Float32Array(rawBuf.buffer, rawBuf.byteOffset + offset, accessor.count * comps);
      }
      // Strided: copia elemento a elemento
      const out = new Float32Array(accessor.count * comps);
      const dv = new DataView(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
      for (let i = 0; i < accessor.count; i++) {
        for (let c = 0; c < comps; c++) {
          out[i * comps + c] = dv.getFloat32(offset + i * stride + c * 4, true);
        }
      }
      return out;
    } else if (accessor.componentType === COMPONENT_UNSIGNED_SHORT) {
      if (isPacked) {
        return new Uint16Array(rawBuf.buffer, rawBuf.byteOffset + offset, accessor.count * (comps === 1 ? 1 : 1));
      }
      const out = new Uint16Array(accessor.count * comps);
      const dv = new DataView(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
      for (let i = 0; i < accessor.count; i++) {
        for (let c = 0; c < comps; c++) {
          out[i * comps + c] = dv.getUint16(offset + i * stride + c * 2, true);
        }
      }
      return out;
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

        const jointsAccessorIdx = prim.attributes["JOINTS_0"];
        const jointsData = jointsAccessorIdx !== undefined ? (readAccessorData(jointsAccessorIdx) as Uint16Array | Uint32Array | null) : null;

        const weightsAccessorIdx = prim.attributes["WEIGHTS_0"];
        const weightsData = weightsAccessorIdx !== undefined ? (readAccessorData(weightsAccessorIdx) as Float32Array | null) : null;

        const vertexCount = Math.floor(positions.length / 3);
        const baseIdx = mesh.vertices.length;

        for (let i = 0; i < vertexCount; i++) {
          const pos: Vec3 = [positions[i * 3 + 0]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
          const norm: Vec3 = normals ? [normals[i * 3 + 0]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!] : [0, 1, 0];
          const uv: Vec2 = uvs ? [uvs[i * 2 + 0]!, uvs[i * 2 + 1]!] : [0, 0];
          const joints: [number, number, number, number] = jointsData
            ? [Number(jointsData[i * 4 + 0] ?? 0), Number(jointsData[i * 4 + 1] ?? 0), Number(jointsData[i * 4 + 2] ?? 0), Number(jointsData[i * 4 + 3] ?? 0)]
            : [0, 0, 0, 0];
          const weights: [number, number, number, number] = weightsData
            ? [weightsData[i * 4 + 0] ?? 0, weightsData[i * 4 + 1] ?? 0, weightsData[i * 4 + 2] ?? 0, weightsData[i * 4 + 3] ?? 0]
            : [1, 0, 0, 0];

          mesh.vertices.push({
            pos,
            normal: norm,
            uv,
            joints,
            weights,
          });
          if (weightsData) mesh.hasSkinning = true;
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
