package tests

import "core:math"
import "core:testing"
import "../src/animation"
import "../src/core"
import "../src/rig"

@(test)
test_sample_clip_linear :: proc(t: ^testing.T) {
	clip: animation.Clip
	animation.clip_init(&clip, "test_walk", "Caminhada", 2.0, 60.0, true)
	defer animation.clip_destroy(&clip)

	k0: animation.Keyframe
	animation.keyframe_init(&k0)
	k0.time = 0.0
	k0.easing = .Linear
	k0.joints["root"] = rig.JointDelta{angle = 0.0, x = 100, y = 200}
	append(&clip.frames, k0)

	k1: animation.Keyframe
	animation.keyframe_init(&k1)
	k1.time = 1.0
	k1.easing = .Linear
	k1.joints["root"] = rig.JointDelta{angle = 1.0, x = 200, y = 400}
	append(&clip.frames, k1)

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	animation.sample_clip(&clip, 0.5, &pose)

	root_delta, ok := pose.joints["root"]
	testing.expect(t, ok, "Deveria conter a junta root")
	testing.expect(t, math.abs(root_delta.angle - 0.5) < 1e-4, "Ângulo linear em t=0.5 deve ser 0.5")
	testing.expect(t, math.abs(root_delta.x - 150) < 1e-4, "X linear em t=0.5 deve ser 150")
	testing.expect(t, math.abs(root_delta.y - 300) < 1e-4, "Y linear em t=0.5 deve ser 300")
}

@(test)
test_sample_clip_hold :: proc(t: ^testing.T) {
	clip: animation.Clip
	animation.clip_init(&clip, "test_hold", "Hold Test", 1.0, 60.0, false)
	defer animation.clip_destroy(&clip)

	k0: animation.Keyframe
	animation.keyframe_init(&k0)
	k0.time = 0.0
	k0.easing = .Hold
	k0.joints["root"] = rig.JointDelta{angle = 0.2, x = 10, y = 20}
	append(&clip.frames, k0)

	k1: animation.Keyframe
	animation.keyframe_init(&k1)
	k1.time = 1.0
	k1.easing = .Hold
	k1.joints["root"] = rig.JointDelta{angle = 1.8, x = 50, y = 80}
	append(&clip.frames, k1)

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	animation.sample_clip(&clip, 0.7, &pose)

	root_delta, ok := pose.joints["root"]
	testing.expect(t, ok, "Deveria conter a junta root")
	testing.expect(t, math.abs(root_delta.angle - 0.2) < 1e-5, "Hold deve preservar o valor do frame inicial até atingir o próximo")
}

@(test)
test_sample_clip_loop :: proc(t: ^testing.T) {
	clip: animation.Clip
	animation.clip_init(&clip, "loop_clip", "Loop", 2.0, 60.0, true)
	defer animation.clip_destroy(&clip)

	k0: animation.Keyframe
	animation.keyframe_init(&k0)
	k0.time = 0.0
	k0.easing = .Linear
	k0.joints["head"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	append(&clip.frames, k0)

	k1: animation.Keyframe
	animation.keyframe_init(&k1)
	k1.time = 2.0
	k1.easing = .Linear
	k1.joints["head"] = rig.JointDelta{angle = 2.0, x = 0, y = 0}
	append(&clip.frames, k1)

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	// Amostra em t = 2.5s (com loop de 2s, equivale a t = 0.5s, logo angle = 0.5)
	animation.sample_clip(&clip, 2.5, &pose)
	testing.expect(t, math.abs(pose.joints["head"].angle - 0.5) < 1e-4, "Looping deve modularizar o tempo de amostragem")
}

@(test)
test_keyframe_add_and_remove :: proc(t: ^testing.T) {
	clip: animation.Clip
	animation.clip_init(&clip, "test_edit", "Edit", 2.0, 60.0, true)
	defer animation.clip_destroy(&clip)

	pose: rig.Pose
	rig.pose_init(&pose)
	defer rig.pose_destroy(&pose)

	pose.joints["arm"] = rig.JointDelta{angle = 1.2, x = 0, y = 0}
	animation.clip_add_or_update_keyframe(&clip, 0.5, &pose, .Smooth)

	testing.expect(t, len(clip.frames) == 1, "Deveria ter 1 frame")
	testing.expect(t, math.abs(clip.frames[0].time - 0.5) < 1e-5, "Tempo do frame deve ser 0.5")
	testing.expect(t, math.abs(clip.frames[0].joints["arm"].angle - 1.2) < 1e-5, "Ângulo do frame deve ser 1.2")

	// Atualização do mesmo frame
	pose.joints["arm"] = rig.JointDelta{angle = 1.5, x = 0, y = 0}
	animation.clip_add_or_update_keyframe(&clip, 0.51, &pose, .Linear)
	testing.expect(t, len(clip.frames) == 1, "Atualização próxima não deve duplicar o frame")
	testing.expect(t, math.abs(clip.frames[0].joints["arm"].angle - 1.5) < 1e-5, "Ângulo deve ter sido atualizado para 1.5")

	// Adiciona segundo frame
	pose.joints["arm"] = rig.JointDelta{angle = 2.0, x = 0, y = 0}
	animation.clip_add_or_update_keyframe(&clip, 1.5, &pose, .Linear)
	testing.expect(t, len(clip.frames) == 2, "Deveria ter 2 frames")

	// Remove o primeiro
	ok_rem := animation.clip_remove_nearest_keyframe(&clip, 0.5)
	testing.expect(t, ok_rem, "Remoção do frame deve retornar true")
	testing.expect(t, len(clip.frames) == 1, "Deve restar 1 frame após remoção")
	testing.expect(t, math.abs(clip.frames[0].time - 1.5) < 1e-5, "Frame restante deve ser o de 1.5s")
}

