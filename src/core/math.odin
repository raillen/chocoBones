package core

import "core:math"

translate :: proc(x, y: f32) -> Mat2x3 {
	return {
		a  = 1,
		b  = 0,
		c  = 0,
		d  = 1,
		tx = x,
		ty = y,
	}
}

rotate :: proc(angle: f32) -> Mat2x3 {
	c := math.cos(angle)
	s := math.sin(angle)
	return {
		a  = c,
		b  = s,
		c  = -s,
		d  = c,
		tx = 0,
		ty = 0,
	}
}

scale :: proc(sx, sy: f32) -> Mat2x3 {
	return {
		a  = sx,
		b  = 0,
		c  = 0,
		d  = sy,
		tx = 0,
		ty = 0,
	}
}

mat_mul :: proc(m1, m2: Mat2x3) -> Mat2x3 {
	return {
		a  = m1.a * m2.a + m1.c * m2.b,
		b  = m1.b * m2.a + m1.d * m2.b,
		c  = m1.a * m2.c + m1.c * m2.d,
		d  = m1.b * m2.c + m1.d * m2.d,
		tx = m1.a * m2.tx + m1.c * m2.ty + m1.tx,
		ty = m1.b * m2.tx + m1.d * m2.ty + m1.ty,
	}
}

mat_inverse :: proc(m: Mat2x3) -> Mat2x3 {
	det := m.a * m.d - m.b * m.c
	if math.abs(det) < 1e-10 {
		return MAT_IDENTITY
	}
	inv_det := 1.0 / det
	return {
		a  = m.d * inv_det,
		b  = -m.b * inv_det,
		c  = -m.c * inv_det,
		d  = m.a * inv_det,
		tx = (m.c * m.ty - m.d * m.tx) * inv_det,
		ty = (m.b * m.tx - m.a * m.ty) * inv_det,
	}
}

mat_apply :: proc(m: Mat2x3, p: Vec2) -> Vec2 {
	return {
		m.a * p.x + m.c * p.y + m.tx,
		m.b * p.x + m.d * p.y + m.ty,
	}
}

vec2_dist :: proc(a, b: Vec2) -> f32 {
	dx := a.x - b.x
	dy := a.y - b.y
	return math.sqrt(dx * dx + dy * dy)
}

vec2_length :: proc(v: Vec2) -> f32 {
	return math.sqrt(v.x * v.x + v.y * v.y)
}

lerp :: proc(a, b, t: f32) -> f32 {
	return a + (b - a) * t
}

lerp_vec2 :: proc(a, b: Vec2, t: f32) -> Vec2 {
	return {
		lerp(a.x, b.x, t),
		lerp(a.y, b.y, t),
	}
}

clamp :: proc(val, min_val, max_val: f32) -> f32 {
	if val < min_val do return min_val
	if val > max_val do return max_val
	return val
}

bezier_solve :: proc(t, x1, y1, x2, y2: f32) -> f32 {
	cubic :: proc(u, a, b: f32) -> f32 {
		return 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u
	}

	lo: f32 = 0.0
	hi: f32 = 1.0
	for _ in 0 ..< 18 {
		mid := (lo + hi) * 0.5
		if cubic(mid, x1, x2) < t {
			lo = mid
		} else {
			hi = mid
		}
	}
	return cubic((lo + hi) * 0.5, y1, y2)
}

point_in_triangle :: proc(p, a, b, c: Vec2) -> bool {
	sign :: proc(x, y, z: Vec2) -> f32 {
		return (x.x - z.x) * (y.y - z.y) - (y.x - z.x) * (x.y - z.y)
	}

	d1 := sign(p, a, b)
	d2 := sign(p, b, c)
	d3 := sign(p, c, a)

	has_neg := (d1 < 0) || (d2 < 0) || (d3 < 0)
	has_pos := (d1 > 0) || (d2 > 0) || (d3 > 0)

	return !(has_neg && has_pos)
}
