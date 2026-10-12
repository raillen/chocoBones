package core

import "core:math"

Vec3 :: [3]f32
Vec4 :: [4]f32
Quat :: [4]f32 // {x, y, z, w}

Mat4x4 :: [4][4]f32

MAT4_IDENTITY :: Mat4x4{
	{1, 0, 0, 0},
	{0, 1, 0, 0},
	{0, 0, 1, 0},
	{0, 0, 0, 1},
}

QUAT_IDENTITY :: Quat{0, 0, 0, 1}

// =========================================================================
// Operações Vetoriais 3D
// =========================================================================

vec3_add :: proc(a, b: Vec3) -> Vec3 {
	return {a.x + b.x, a.y + b.y, a.z + b.z}
}

vec3_sub :: proc(a, b: Vec3) -> Vec3 {
	return {a.x - b.x, a.y - b.y, a.z - b.z}
}

vec3_scale :: proc(v: Vec3, s: f32) -> Vec3 {
	return {v.x * s, v.y * s, v.z * s}
}

vec3_dot :: proc(a, b: Vec3) -> f32 {
	return a.x * b.x + a.y * b.y + a.z * b.z
}

vec3_cross :: proc(a, b: Vec3) -> Vec3 {
	return {
		a.y * b.z - a.z * b.y,
		a.z * b.x - a.x * b.z,
		a.x * b.y - a.y * b.x,
	}
}

vec3_length :: proc(v: Vec3) -> f32 {
	return math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
}

vec3_dist :: proc(a, b: Vec3) -> f32 {
	return vec3_length(vec3_sub(a, b))
}

vec3_normalize :: proc(v: Vec3) -> Vec3 {
	l := vec3_length(v)
	if l < 1e-9 do return {0, 0, 0}
	inv := 1.0 / l
	return {v.x * inv, v.y * inv, v.z * inv}
}

vec3_lerp :: proc(a, b: Vec3, t: f32) -> Vec3 {
	return {
		a.x + (b.x - a.x) * t,
		a.y + (b.y - a.y) * t,
		a.z + (b.z - a.z) * t,
	}
}

// =========================================================================
// Operações Matriciais 4x4
// =========================================================================

mat4_mul :: proc(m1, m2: Mat4x4) -> Mat4x4 {
	r: Mat4x4
	for i in 0 ..< 4 {
		for j in 0 ..< 4 {
			r[i][j] = m1[i][0] * m2[0][j] +
			          m1[i][1] * m2[1][j] +
			          m1[i][2] * m2[2][j] +
			          m1[i][3] * m2[3][j]
		}
	}
	return r
}

mat4_translate :: proc(v: Vec3) -> Mat4x4 {
	m := MAT4_IDENTITY
	m[3][0] = v.x
	m[3][1] = v.y
	m[3][2] = v.z
	return m
}

mat4_scale :: proc(v: Vec3) -> Mat4x4 {
	m := MAT4_IDENTITY
	m[0][0] = v.x
	m[1][1] = v.y
	m[2][2] = v.z
	return m
}

mat4_rotate_x :: proc(rad: f32) -> Mat4x4 {
	c := math.cos(rad)
	s := math.sin(rad)
	m := MAT4_IDENTITY
	m[1][1] = c
	m[1][2] = s
	m[2][1] = -s
	m[2][2] = c
	return m
}

mat4_rotate_y :: proc(rad: f32) -> Mat4x4 {
	c := math.cos(rad)
	s := math.sin(rad)
	m := MAT4_IDENTITY
	m[0][0] = c
	m[0][2] = -s
	m[2][0] = s
	m[2][2] = c
	return m
}

mat4_rotate_z :: proc(rad: f32) -> Mat4x4 {
	c := math.cos(rad)
	s := math.sin(rad)
	m := MAT4_IDENTITY
	m[0][0] = c
	m[0][1] = s
	m[1][0] = -s
	m[1][1] = c
	return m
}

mat4_from_quat :: proc(q: Quat) -> Mat4x4 {
	x := q.x; y := q.y; z := q.z; w := q.w
	x2 := x + x; y2 := y + y; z2 := z + z
	xx := x * x2; xy := x * y2; xz := x * z2
	yy := y * y2; yz := y * z2; zz := z * z2
	wx := w * x2; wy := w * y2; wz := w * z2

	m := MAT4_IDENTITY
	m[0][0] = 1.0 - (yy + zz)
	m[0][1] = xy + wz
	m[0][2] = xz - wy

	m[1][0] = xy - wz
	m[1][1] = 1.0 - (xx + zz)
	m[1][2] = yz + wx

	m[2][0] = xz + wy
	m[2][1] = yz - wx
	m[2][2] = 1.0 - (xx + yy)

	return m
}

mat4_apply :: proc(m: Mat4x4, p: Vec3) -> Vec3 {
	w := m[0][3] * p.x + m[1][3] * p.y + m[2][3] * p.z + m[3][3]
	if math.abs(w) < 1e-9 do w = 1.0
	inv_w := 1.0 / w
	return {
		(m[0][0] * p.x + m[1][0] * p.y + m[2][0] * p.z + m[3][0]) * inv_w,
		(m[0][1] * p.x + m[1][1] * p.y + m[2][1] * p.z + m[3][1]) * inv_w,
		(m[0][2] * p.x + m[1][2] * p.y + m[2][2] * p.z + m[3][2]) * inv_w,
	}
}

// Projeção perspectiva (convenção WebGPU e OpenGL: Z normalizado [-1, 1] ou [0, 1])
mat4_perspective :: proc(fovy_rad, aspect, near, far: f32) -> Mat4x4 {
	tan_half := math.tan(fovy_rad * 0.5)
	m: Mat4x4
	m[0][0] = 1.0 / (aspect * tan_half)
	m[1][1] = 1.0 / tan_half
	m[2][2] = -(far + near) / (far - near)
	m[2][3] = -1.0
	m[3][2] = -(2.0 * far * near) / (far - near)
	return m
}

mat4_look_at :: proc(eye, target, up: Vec3) -> Mat4x4 {
	f := vec3_normalize(vec3_sub(target, eye))
	s := vec3_normalize(vec3_cross(f, up))
	u := vec3_cross(s, f)

	m: Mat4x4
	m[0][0] = s.x;  m[1][0] = s.y;  m[2][0] = s.z;  m[3][0] = -vec3_dot(s, eye)
	m[0][1] = u.x;  m[1][1] = u.y;  m[2][1] = u.z;  m[3][1] = -vec3_dot(u, eye)
	m[0][2] = -f.x; m[1][2] = -f.y; m[2][2] = -f.z; m[3][2] = vec3_dot(f, eye)
	m[0][3] = 0;    m[1][3] = 0;    m[2][3] = 0;    m[3][3] = 1.0
	return m
}

// =========================================================================
// Câmera Orbital 3D
// =========================================================================

OrbitCamera :: struct {
	target:   Vec3,
	distance: f32,
	yaw:      f32, // Ângulo azimutal em radianos
	pitch:    f32, // Ângulo de elevação em radianos
}

orbit_camera_init :: proc(cam: ^OrbitCamera, target: Vec3 = {0, 0, 0}, distance: f32 = 4.0) {
	cam.target = target
	cam.distance = distance
	cam.yaw = 0.0
	cam.pitch = 0.2
}

orbit_camera_eye_pos :: proc(cam: ^OrbitCamera) -> Vec3 {
	clamped_pitch := clamp(cam.pitch, -math.PI * 0.48, math.PI * 0.48)
	x := cam.target.x + cam.distance * math.cos(clamped_pitch) * math.sin(cam.yaw)
	y := cam.target.y + cam.distance * math.sin(clamped_pitch)
	z := cam.target.z + cam.distance * math.cos(clamped_pitch) * math.cos(cam.yaw)
	return {x, y, z}
}

orbit_camera_view_matrix :: proc(cam: ^OrbitCamera) -> Mat4x4 {
	eye := orbit_camera_eye_pos(cam)
	return mat4_look_at(eye, cam.target, {0, 1, 0})
}
