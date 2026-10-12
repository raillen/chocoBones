import { describe, expect, it } from "vitest";
import { loadGltfFromJson } from "../src/mesh3d/gltf_loader";
import { loadObjFromString } from "../src/mesh3d/obj_loader";
import { createCubeMesh, createPlaneMesh } from "../src/mesh3d/primitives";
import { mesh3dNormalizeAndCenter } from "../src/mesh3d/mesh3d";

describe("3D Mesh Primitives", () => {
  it("creates cube mesh with 24 vertices and 12 triangles", () => {
    const cube = createCubeMesh(2.0);
    expect(cube.vertices.length).toBe(24);
    expect(cube.indices.length).toBe(36); // 12 triângulos * 3
    expect(cube.aabbMin[0]).toBeCloseTo(-1.0);
    expect(cube.aabbMax[0]).toBeCloseTo(1.0);
  });

  it("creates plane mesh with proper normal pointing up (+Y)", () => {
    const plane = createPlaneMesh(4.0, 4.0);
    expect(plane.vertices.length).toBe(4);
    expect(plane.indices.length).toBe(6);
    expect(plane.vertices[0]!.normal).toEqual([0, 1, 0]);
  });
});

describe("Wavefront OBJ Loader", () => {
  it("parses quad face and triangulates into 2 triangles", () => {
    const objText = `
v -1.0 -1.0 0.0
v  1.0 -1.0 0.0
v  1.0  1.0 0.0
v -1.0  1.0 0.0
vn 0.0 0.0 1.0
f 1//1 2//1 3//1 4//1
`;
    const mesh = loadObjFromString(objText, "quad_test");
    expect(mesh.vertices.length).toBe(4);
    expect(mesh.indices.length).toBe(6);
    expect(mesh.aabbMin[0]).toBeCloseTo(-1.0);
    expect(mesh.aabbMax[0]).toBeCloseTo(1.0);
  });

  it("loads Suzanne 3D model and normalizes/centers AABB", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const filePath = path.resolve(process.cwd(), "assets/models/suzanne.obj");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const suzanne = loadObjFromString(content, "Suzanne");
      expect(suzanne.vertices.length).toBe(507);
      expect(suzanne.indices.length).toBe(2904);

      mesh3dNormalizeAndCenter(suzanne, 2.0);
      expect(suzanne.aabbMin[0]).toBeCloseTo(-1.0);
      expect(suzanne.aabbMax[0]).toBeCloseTo(1.0);
    }
  });
});

describe("glTF 2.0 Loader", () => {
  it("parses glTF with float positions and indices", () => {
    const positions = new Float32Array([
      0.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      0.0, 1.0, 0.0,
    ]);
    const indices = new Uint16Array([0, 1, 2]);

    const posBytes = new Uint8Array(positions.buffer);
    const idxBytes = new Uint8Array(indices.buffer);
    const combined = new Uint8Array(posBytes.length + idxBytes.length);
    combined.set(posBytes, 0);
    combined.set(idxBytes, posBytes.length);

    const gltfJson = JSON.stringify({
      asset: { version: "2.0" },
      buffers: [{ byteLength: combined.length }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: posBytes.length },
        { buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length },
      ],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 3, type: "VEC3" },
        { bufferView: 1, componentType: 5123, count: 3, type: "SCALAR" },
      ],
      meshes: [
        {
          name: "Triangle",
          primitives: [
            {
              attributes: { POSITION: 0 },
              indices: 1,
            },
          ],
        },
      ],
    });

    const meshes = loadGltfFromJson(gltfJson, [combined]);
    expect(meshes.length).toBe(1);
    expect(meshes[0]!.vertices.length).toBe(3);
    expect(meshes[0]!.indices).toEqual([0, 1, 2]);
  });
});
