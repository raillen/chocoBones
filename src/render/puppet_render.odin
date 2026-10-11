package render

import "../core"
import "../mesh"
import "../rig"

LayerVisual :: struct {
	layer:       rig.Layer,
	texture_id:  u32,
	width:       f32,
	height:      f32,
	deform_mesh: ^mesh.Mesh,
	pins:        []mesh.Pin,
}

ortho_projection :: proc(left, right, bottom, top, near, far: f32) -> [4][4]f32 {
	m: [4][4]f32
	m[0][0] = 2.0 / (right - left)
	m[1][1] = 2.0 / (top - bottom)
	m[2][2] = -2.0 / (far - near)
	m[3][3] = 1.0

	m[3][0] = -(right + left) / (right - left)
	m[3][1] = -(top + bottom) / (top - bottom)
	m[3][2] = -(far + near) / (far - near)
	return m
}

/** Desenha apenas a geometria da camada (malha deformada ou quad rígido) no batch ativo. */
draw_layer_geometry :: proc(
	batch: ^RenderBatch,
	visual: LayerVisual,
	joints: []rig.Joint,
	pose: ^rig.Pose,
	bones: map[string]core.Mat2x3,
	color: [4]f32,
	allocator := context.allocator,
) {
	if visual.deform_mesh != nil && len(visual.deform_mesh.vertices) > 0 {
		world_verts := mesh.mesh_world(
			visual.deform_mesh,
			visual.pins,
			nil,
			visual.layer,
			joints,
			pose,
			bones,
			allocator,
		)
		defer delete(world_verts, allocator)

		uvs := make([]core.Vec2, len(visual.deform_mesh.vertices), allocator)
		defer delete(uvs, allocator)

		w := visual.width > 0 ? visual.width : 1.0
		h := visual.height > 0 ? visual.height : 1.0
		for v, i in visual.deform_mesh.vertices {
			uvs[i] = core.Vec2{v.x / w, v.y / h}
		}

		erased_slice := visual.deform_mesh.erased[:] if len(visual.deform_mesh.erased) > 0 else nil
		batch_draw_mesh(
			batch,
			visual.texture_id,
			world_verts,
			uvs,
			visual.deform_mesh.triangles[:],
			erased_slice,
			color,
		)
		return
	}

	// Desenho rígido: quad com 4 cantos transformados
	layer_mat := rig.layer_matrix(visual.layer, joints, pose, bones)
	w := visual.width
	h := visual.height

	c0 := core.mat_apply(layer_mat, {0, 0})
	c1 := core.mat_apply(layer_mat, {w, 0})
	c2 := core.mat_apply(layer_mat, {w, h})
	c3 := core.mat_apply(layer_mat, {0, h})

	verts := []core.Vec2{c0, c1, c2, c3}
	uvs := []core.Vec2{{0, 0}, {1, 0}, {1, 1}, {0, 1}}
	triangles := [][3]u32{{0, 1, 2}, {0, 2, 3}}

	batch_draw_mesh(batch, visual.texture_id, verts, uvs, triangles, nil, color)
}

render_layer :: proc(
	batch: ^RenderBatch,
	visual: LayerVisual,
	joints: []rig.Joint,
	pose: ^rig.Pose,
	bones: map[string]core.Mat2x3,
	color: [4]f32 = {1, 1, 1, 1},
	allocator := context.allocator,
) {
	if !visual.layer.visible || visual.layer.opacity <= 0 do return

	final_color := color
	final_color.w *= visual.layer.opacity

	draw_layer_geometry(batch, visual, joints, pose, bones, final_color, allocator)
}
