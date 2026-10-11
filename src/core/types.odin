package core

Vec2 :: [2]f32

// Matriz Afim 2D 2x3 correspondente à matriz afim 3x3:
// | a   c   tx |
// | b   d   ty |
// | 0   0   1  |
Mat2x3 :: struct {
	a:  f32,
	b:  f32,
	c:  f32,
	d:  f32,
	tx: f32,
	ty: f32,
}

MAT_IDENTITY :: Mat2x3{
	a  = 1,
	b  = 0,
	c  = 0,
	d  = 1,
	tx = 0,
	ty = 0,
}

Rect :: struct {
	x: f32,
	y: f32,
	w: f32,
	h: f32,
}

Transform :: struct {
	pos:      Vec2,
	rotation: f32,
	scale:    Vec2,
	pivot:    Vec2,
}

TRANSFORM_DEFAULT :: Transform{
	pos      = {0, 0},
	rotation = 0,
	scale    = {1, 1},
	pivot    = {0, 0},
}

SeamMask :: struct {
	layer:   string,
	enabled: bool,
	center:  Vec2,
	radius:  f32,
	feather: f32,
}

