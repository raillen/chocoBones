import type { Vec2, Mat2x3 } from "../../../core/types";
import type { Mesh, Pin } from "../../../mesh/mesh";

/** Rest geometry stays in the worker; each frame sends only the current pin offsets. */
export interface WorkerMesh {
  id: string;
  signature: string;
  mesh: Mesh;
  uvs: Vec2[];
  pins: Pin[];
}

export interface DeformationRequest {
  type: "deform";
  id: number;
  document: string;
  updates: WorkerMesh[];
  keep: string[];
  poses: { key: string; mesh: string; pins: [string, Vec2][] }[];
}

export interface GeometryPacket {
  key: string;
  vertices: Float64Array;
  triangles: Uint32Array;
  uvs: Float64Array;
}

export interface DeformationResult {
  type: "deformed";
  id: number;
  document: string;
  packets: GeometryPacket[];
  elapsedMs: number;
  error?: string;
}

export interface SpriteDraw {
  key: string;
  layer: string;
  asset: string;
  matrix: Mat2x3;
  opacity: number;
  ghost: boolean;
}

export interface StageFrame {
  document: string;
  draws: SpriteDraw[];
  packets: Map<string, GeometryPacket>;
  elapsedMs: number;
}

/** Worker output owns these buffers. Document/history arrays are never transferred. */
export function packGeometry(
  key: string,
  packet: { vertices: Vec2[]; triangles: [number, number, number][]; uvs: Vec2[] },
): GeometryPacket {
  return {
    key,
    vertices: new Float64Array(packet.vertices.flat()),
    triangles: new Uint32Array(packet.triangles.flat()),
    uvs: new Float64Array(packet.uvs.flat()),
  };
}
