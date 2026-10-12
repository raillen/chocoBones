/**
 * chocoBones cache de malha + buffers dirty (P2-13)
 * Adjacência/bind pré-computados por personagem; reuso de memória;
 * upload simulado só de malhas dirty (espelha futuro path WebGPU).
 */
import { Mat2x3 } from "../core/types";
import { meshAdjacency, Mesh } from "./mesh";

export interface MeshCacheEntry {
  meshId: string;
  adjacency: Map<number, Set<number>>;
  bindPos: Array<{ x: number; y: number }>;
  version: number;
  dirty: boolean;
  uploadedVersion: number;
}

export class MeshCache {
  private entries = new Map<string, MeshCacheEntry>();

  /** Garante entrada fresca; recomputa só se dirty ou ausente. */
  public ensure(meshId: string, mesh: Mesh): MeshCacheEntry {
    let e = this.entries.get(meshId);
    if (!e || e.version !== mesh.vertices.length * 31 + mesh.triangles.length) {
      e = {
        meshId,
        adjacency: meshAdjacency(mesh),
        bindPos: mesh.vertices.map(([x, y]) => ({ x, y })),
        version: mesh.vertices.length * 31 + mesh.triangles.length,
        dirty: true,
        uploadedVersion: -1,
      };
      this.entries.set(meshId, e);
    }
    return e;
  }

  public markDirty(meshId: string): void {
    const e = this.entries.get(meshId);
    if (e) e.dirty = true;
  }

  public markClean(meshId: string, version: number): void {
    const e = this.entries.get(meshId);
    if (e) {
      e.dirty = false;
      e.uploadedVersion = version;
    }
  }

  public isDirty(meshId: string): boolean {
    return this.entries.get(meshId)?.dirty ?? true;
  }

  public dirtyIds(): string[] {
    return [...this.entries.values()].filter((e) => e.dirty).map((e) => e.meshId);
  }
}

/** Pool reutilizável de Float32Array p/ vértices/UV (evita GC por frame). */
export class VertexPool {
  private pool: Float32Array[] = [];
  public acquire(n: number): Float32Array {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i]!.length >= n) return this.pool.splice(i, 1)[0]!;
    }
    return new Float32Array(n);
  }
  public release(arr: Float32Array): void {
    if (this.pool.length < 8) this.pool.push(arr);
  }
  public size(): number {
    return this.pool.length;
  }
}

export interface UploadStats {
  uploaded: string[];
  skipped: string[];
}

/**
 * Gerenciador de buffers: só "envia" malhas dirty.
 * Em CPU retorna stats; com device WebGPU real faria writeBuffer por mesh dirty.
 */
export class GpuBufferManager {
  public cache = new MeshCache();
  public pool = new VertexPool();
  public uploadCount = 0;

  public sync(meshes: Map<string, Mesh>): UploadStats {
    const uploaded: string[] = [];
    const skipped: string[] = [];
    for (const [id, mesh] of meshes) {
      const entry = this.cache.ensure(id, mesh);
      if (entry.dirty || entry.uploadedVersion !== entry.version) {
        // Simula upload: aluga buffer, preenche, devolve (reuso)
        const buf = this.pool.acquire(mesh.vertices.length * 2);
        for (let i = 0; i < mesh.vertices.length; i++) {
          buf[i * 2] = mesh.vertices[i]![0];
          buf[i * 2 + 1] = mesh.vertices[i]![1];
        }
        this.pool.release(buf);
        this.cache.markClean(id, entry.version);
        this.uploadCount++;
        uploaded.push(id);
      } else {
        skipped.push(id);
      }
    }
    return { uploaded, skipped };
  }
}

export type { Mat2x3 };
