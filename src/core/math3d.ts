/**
 * chocoBones TypeScript Core 3D Math
 * Operações com matrizes 4x4, vetores 3D/4D, quaternions e câmera orbital.
 */

import { clamp } from "./math";

export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
export type Quat = [number, number, number, number]; // [x, y, z, w]

// Matriz 4x4 armazenada como tupla de 4 linhas com 4 colunas ou Float32Array
export type Mat4x4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number]
];

export const MAT4_IDENTITY: Readonly<Mat4x4> = Object.freeze([
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
]);

export const QUAT_IDENTITY: Readonly<Quat> = Object.freeze([0, 0, 0, 1]);

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Dist(a: Vec3, b: Vec3): number {
  return vec3Length(vec3Sub(a, b));
}

export function vec3Normalize(v: Vec3): Vec3 {
  const l = vec3Length(v);
  if (l < 1e-9) return [0, 0, 0];
  const inv = 1.0 / l;
  return [v[0] * inv, v[1] * inv, v[2] * inv];
}

export function vec3Lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function mat4Mul(m1: Mat4x4, m2: Mat4x4): Mat4x4 {
  const r: Mat4x4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const row1 = m1[i]!;
    const resRow = r[i]!;
    for (let j = 0; j < 4; j++) {
      resRow[j] =
        row1[0] * m2[0]![j]! +
        row1[1] * m2[1]![j]! +
        row1[2] * m2[2]![j]! +
        row1[3] * m2[3]![j]!;
    }
  }
  return r;
}

export function mat4Translate(v: Vec3): Mat4x4 {
  const m = mat4Clone(MAT4_IDENTITY);
  m[3]![0] = v[0];
  m[3]![1] = v[1];
  m[3]![2] = v[2];
  return m;
}

export function mat4Scale(v: Vec3): Mat4x4 {
  const m = mat4Clone(MAT4_IDENTITY);
  m[0]![0] = v[0];
  m[1]![1] = v[1];
  m[2]![2] = v[2];
  return m;
}

export function mat4Clone(m: Readonly<Mat4x4>): Mat4x4 {
  return [
    [m[0]![0], m[0]![1], m[0]![2], m[0]![3]],
    [m[1]![0], m[1]![1], m[1]![2], m[1]![3]],
    [m[2]![0], m[2]![1], m[2]![2], m[2]![3]],
    [m[3]![0], m[3]![1], m[3]![2], m[3]![3]],
  ];
}

export function mat4Apply(m: Mat4x4, p: Vec3): Vec3 {
  let w = m[0]![3] * p[0] + m[1]![3] * p[1] + m[2]![3] * p[2] + m[3]![3];
  if (Math.abs(w) < 1e-9) w = 1.0;
  const invW = 1.0 / w;
  return [
    (m[0]![0] * p[0] + m[1]![0] * p[1] + m[2]![0] * p[2] + m[3]![0]) * invW,
    (m[0]![1] * p[0] + m[1]![1] * p[1] + m[2]![1] * p[2] + m[3]![1]) * invW,
    (m[0]![2] * p[0] + m[1]![2] * p[1] + m[2]![2] * p[2] + m[3]![2]) * invW,
  ];
}

export function mat4Perspective(fovyRad: number, aspect: number, near: number, far: number): Mat4x4 {
  const tanHalf = Math.tan(fovyRad * 0.5);
  const m: Mat4x4 = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  m[0]![0] = 1.0 / (aspect * tanHalf);
  m[1]![1] = 1.0 / tanHalf;
  m[2]![2] = -(far + near) / (far - near);
  m[2]![3] = -1.0;
  m[3]![2] = -(2.0 * far * near) / (far - near);
  return m;
}

export function mat4LookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4x4 {
  const f = vec3Normalize(vec3Sub(target, eye));
  const s = vec3Normalize(vec3Cross(f, up));
  const u = vec3Cross(s, f);

  return [
    [s[0], u[0], -f[0], 0],
    [s[1], u[1], -f[1], 0],
    [s[2], u[2], -f[2], 0],
    [-vec3Dot(s, eye), -vec3Dot(u, eye), vec3Dot(f, eye), 1.0],
  ];
}

export class OrbitCamera {
  public target: Vec3;
  public distance: number;
  public yaw: number;
  public pitch: number;

  constructor(target: Vec3 = [0, 0, 0], distance = 4.0, yaw = 0.0, pitch = 0.2) {
    this.target = target;
    this.distance = distance;
    this.yaw = yaw;
    this.pitch = pitch;
  }

  public getEyePosition(): Vec3 {
    const clampedPitch = clamp(this.pitch, -Math.PI * 0.48, Math.PI * 0.48);
    const x = this.target[0] + this.distance * Math.cos(clampedPitch) * Math.sin(this.yaw);
    const y = this.target[1] + this.distance * Math.sin(clampedPitch);
    const z = this.target[2] + this.distance * Math.cos(clampedPitch) * Math.cos(this.yaw);
    return [x, y, z];
  }

  public getViewMatrix(): Mat4x4 {
    const eye = this.getEyePosition();
    return mat4LookAt(eye, this.target, [0, 1, 0]);
  }
}
