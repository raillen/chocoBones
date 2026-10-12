import { describe, expect, it } from "bun:test";
import {
  bezierSolve,
  matApply,
  matInverse,
  matMul,
  rotate,
  scale,
  translate,
} from "../src/core/math";
import {
  mat4Apply,
  mat4Translate,
  OrbitCamera,
  vec3Cross,
  vec3Dot,
  vec3Normalize,
} from "../src/core/math3d";

describe("Core 2D Math", () => {
  it("translates point correctly", () => {
    const m = translate(10, 20);
    const p = matApply(m, [5, 5]);
    expect(p[0]).toBeCloseTo(15);
    expect(p[1]).toBeCloseTo(25);
  });

  it("rotates point 90 degrees (PI/2 rad)", () => {
    const m = rotate(Math.PI / 2);
    const p = matApply(m, [1, 0]);
    expect(p[0]).toBeCloseTo(0);
    expect(p[1]).toBeCloseTo(1);
  });

  it("multiplies matrices and inverts successfully", () => {
    const t = translate(15, -30);
    const s = scale(2, 3);
    const combined = matMul(t, s);

    const inv = matInverse(combined);
    const identityCheck = matMul(combined, inv);

    expect(identityCheck.a).toBeCloseTo(1);
    expect(identityCheck.b).toBeCloseTo(0);
    expect(identityCheck.c).toBeCloseTo(0);
    expect(identityCheck.d).toBeCloseTo(1);
    expect(identityCheck.tx).toBeCloseTo(0);
    expect(identityCheck.ty).toBeCloseTo(0);
  });

  it("solves cubic bezier accurately", () => {
    // Curva linear: (0,0) a (1,1)
    const valMid = bezierSolve(0.5, 0.25, 0.25, 0.75, 0.75);
    expect(valMid).toBeCloseTo(0.5, 2);

    // Início e fim
    expect(bezierSolve(0.0, 0.42, 0, 0.58, 1)).toBeCloseTo(0, 2);
    expect(bezierSolve(1.0, 0.42, 0, 0.58, 1)).toBeCloseTo(1, 2);
  });
});

describe("Core 3D Math", () => {
  it("computes 3D vector operations", () => {
    const v1: [number, number, number] = [1, 0, 0];
    const v2: [number, number, number] = [0, 1, 0];
    const cross = vec3Cross(v1, v2);
    expect(cross).toEqual([0, 0, 1]);
    expect(vec3Dot(v1, v2)).toBe(0);
    expect(vec3Normalize([0, 5, 0])).toEqual([0, 1, 0]);
  });

  it("transforms 3D point with perspective and translate", () => {
    const m = mat4Translate([10, 20, 30]);
    const res = mat4Apply(m, [1, 2, 3]);
    expect(res[0]).toBeCloseTo(11);
    expect(res[1]).toBeCloseTo(22);
    expect(res[2]).toBeCloseTo(33);
  });

  it("calculates camera view matrix", () => {
    const cam = new OrbitCamera([0, 0, 0], 5.0, 0, 0);
    const eye = cam.getEyePosition();
    expect(eye[1]).toBeCloseTo(0);
    expect(eye[2]).toBeCloseTo(5.0);

    const view = cam.getViewMatrix();
    expect(view[3]![3]).toBe(1.0);
  });
});
