package animation

import "../rig"

// Cria um clipe de respiração / repouso orgânico
animation_create_idle_clip :: proc(allocator := context.allocator) -> Clip {
	clip: Clip
	clip_init(&clip, "idle", "Respiração / Repouso", 1.6, 60.0, true, allocator)

	k0: Keyframe
	keyframe_init(&k0, allocator)
	k0.time = 0.0
	k0.easing = .Smooth
	k0.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k0.joints["head"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k0.joints["upper_arm_near"] = rig.JointDelta{angle = 0.10, x = 0, y = 0}
	k0.joints["forearm_near"] = rig.JointDelta{angle = -0.15, x = 0, y = 0}
	k0.joints["upper_arm_far"] = rig.JointDelta{angle = -0.10, x = 0, y = 0}
	k0.joints["forearm_far"] = rig.JointDelta{angle = -0.15, x = 0, y = 0}
	k0.joints["thigh_near"] = rig.JointDelta{angle = -0.05, x = 0, y = 0}
	k0.joints["shin_near"] = rig.JointDelta{angle = 0.05, x = 0, y = 0}
	k0.joints["thigh_far"] = rig.JointDelta{angle = 0.05, x = 0, y = 0}
	k0.joints["shin_far"] = rig.JointDelta{angle = 0.05, x = 0, y = 0}
	append(&clip.frames, k0)

	k1: Keyframe
	keyframe_init(&k1, allocator)
	k1.time = 0.8
	k1.easing = .Smooth
	k1.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = -2.5}
	k1.joints["head"] = rig.JointDelta{angle = -0.04, x = 0, y = 0}
	k1.joints["upper_arm_near"] = rig.JointDelta{angle = 0.18, x = 0, y = 0}
	k1.joints["forearm_near"] = rig.JointDelta{angle = -0.24, x = 0, y = 0}
	k1.joints["upper_arm_far"] = rig.JointDelta{angle = -0.18, x = 0, y = 0}
	k1.joints["forearm_far"] = rig.JointDelta{angle = -0.24, x = 0, y = 0}
	k1.joints["thigh_near"] = rig.JointDelta{angle = -0.03, x = 0, y = 0}
	k1.joints["shin_near"] = rig.JointDelta{angle = 0.03, x = 0, y = 0}
	k1.joints["thigh_far"] = rig.JointDelta{angle = 0.03, x = 0, y = 0}
	k1.joints["shin_far"] = rig.JointDelta{angle = 0.03, x = 0, y = 0}
	append(&clip.frames, k1)

	k2: Keyframe
	keyframe_init(&k2, allocator)
	k2.time = 1.6
	k2.easing = .Smooth
	for j_id, j_delta in k0.joints {
		k2.joints[j_id] = j_delta
	}
	append(&clip.frames, k2)

	return clip
}

// Cria um ciclo completo de caminhada com todos os membros sincronizados
animation_create_walk_clip :: proc(allocator := context.allocator) -> Clip {
	clip: Clip
	clip_init(&clip, "walk_cycle", "Ciclo de Caminhada", 1.6, 60.0, true, allocator)

	// Quadro 0.0s: Contato 1 (perna near à frente, braço near atrás)
	k0: Keyframe
	keyframe_init(&k0, allocator)
	k0.time = 0.0
	k0.easing = .Smooth
	k0.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k0.joints["head"] = rig.JointDelta{angle = -0.05, x = 0, y = 0}
	k0.joints["upper_arm_near"] = rig.JointDelta{angle = -0.45, x = 0, y = 0}
	k0.joints["forearm_near"] = rig.JointDelta{angle = -0.20, x = 0, y = 0}
	k0.joints["hand_near"] = rig.JointDelta{angle = 0.10, x = 0, y = 0}
	k0.joints["upper_arm_far"] = rig.JointDelta{angle = 0.45, x = 0, y = 0}
	k0.joints["forearm_far"] = rig.JointDelta{angle = -0.55, x = 0, y = 0}
	k0.joints["hand_far"] = rig.JointDelta{angle = -0.10, x = 0, y = 0}
	k0.joints["thigh_near"] = rig.JointDelta{angle = 0.45, x = 0, y = 0}
	k0.joints["shin_near"] = rig.JointDelta{angle = 0.20, x = 0, y = 0}
	k0.joints["foot_near"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k0.joints["thigh_far"] = rig.JointDelta{angle = -0.45, x = 0, y = 0}
	k0.joints["shin_far"] = rig.JointDelta{angle = 0.45, x = 0, y = 0}
	k0.joints["foot_far"] = rig.JointDelta{angle = -0.15, x = 0, y = 0}
	append(&clip.frames, k0)

	// Quadro 0.4s: Passagem 1
	k1: Keyframe
	keyframe_init(&k1, allocator)
	k1.time = 0.4
	k1.easing = .Smooth
	k1.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = -3.0}
	k1.joints["head"] = rig.JointDelta{angle = 0.03, x = 0, y = 0}
	k1.joints["upper_arm_near"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k1.joints["forearm_near"] = rig.JointDelta{angle = -0.35, x = 0, y = 0}
	k1.joints["upper_arm_far"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k1.joints["forearm_far"] = rig.JointDelta{angle = -0.35, x = 0, y = 0}
	k1.joints["thigh_near"] = rig.JointDelta{angle = 0.10, x = 0, y = 0}
	k1.joints["shin_near"] = rig.JointDelta{angle = 0.10, x = 0, y = 0}
	k1.joints["thigh_far"] = rig.JointDelta{angle = -0.15, x = 0, y = 0}
	k1.joints["shin_far"] = rig.JointDelta{angle = 0.70, x = 0, y = 0}
	append(&clip.frames, k1)

	// Quadro 0.8s: Contato 2 (perna far à frente, braço far atrás)
	k2: Keyframe
	keyframe_init(&k2, allocator)
	k2.time = 0.8
	k2.easing = .Smooth
	k2.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k2.joints["head"] = rig.JointDelta{angle = -0.05, x = 0, y = 0}
	k2.joints["upper_arm_near"] = rig.JointDelta{angle = 0.45, x = 0, y = 0}
	k2.joints["forearm_near"] = rig.JointDelta{angle = -0.55, x = 0, y = 0}
	k2.joints["hand_near"] = rig.JointDelta{angle = -0.10, x = 0, y = 0}
	k2.joints["upper_arm_far"] = rig.JointDelta{angle = -0.45, x = 0, y = 0}
	k2.joints["forearm_far"] = rig.JointDelta{angle = -0.20, x = 0, y = 0}
	k2.joints["hand_far"] = rig.JointDelta{angle = 0.10, x = 0, y = 0}
	k2.joints["thigh_near"] = rig.JointDelta{angle = -0.45, x = 0, y = 0}
	k2.joints["shin_near"] = rig.JointDelta{angle = 0.45, x = 0, y = 0}
	k2.joints["foot_near"] = rig.JointDelta{angle = -0.15, x = 0, y = 0}
	k2.joints["thigh_far"] = rig.JointDelta{angle = 0.45, x = 0, y = 0}
	k2.joints["shin_far"] = rig.JointDelta{angle = 0.20, x = 0, y = 0}
	k2.joints["foot_far"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	append(&clip.frames, k2)

	// Quadro 1.2s: Passagem 2
	k3: Keyframe
	keyframe_init(&k3, allocator)
	k3.time = 1.2
	k3.easing = .Smooth
	k3.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = -3.0}
	k3.joints["head"] = rig.JointDelta{angle = 0.03, x = 0, y = 0}
	k3.joints["upper_arm_near"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k3.joints["forearm_near"] = rig.JointDelta{angle = -0.35, x = 0, y = 0}
	k3.joints["upper_arm_far"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k3.joints["forearm_far"] = rig.JointDelta{angle = -0.35, x = 0, y = 0}
	k3.joints["thigh_near"] = rig.JointDelta{angle = -0.15, x = 0, y = 0}
	k3.joints["shin_near"] = rig.JointDelta{angle = 0.70, x = 0, y = 0}
	k3.joints["thigh_far"] = rig.JointDelta{angle = 0.10, x = 0, y = 0}
	k3.joints["shin_far"] = rig.JointDelta{angle = 0.10, x = 0, y = 0}
	append(&clip.frames, k3)

	// Quadro 1.6s: Fecha o loop perfeitamente
	k4: Keyframe
	keyframe_init(&k4, allocator)
	k4.time = 1.6
	k4.easing = .Smooth
	for j_id, j_delta in k0.joints {
		k4.joints[j_id] = j_delta
	}
	append(&clip.frames, k4)

	return clip
}

// Cria um ciclo de corrida dinâmica
animation_create_run_clip :: proc(allocator := context.allocator) -> Clip {
	clip: Clip
	clip_init(&clip, "run_cycle", "Ciclo de Corrida", 0.8, 60.0, true, allocator)

	k0: Keyframe
	keyframe_init(&k0, allocator)
	k0.time = 0.0
	k0.easing = .Smooth
	k0.joints["root"] = rig.JointDelta{angle = 0.15, x = 0, y = 0}
	k0.joints["head"] = rig.JointDelta{angle = -0.12, x = 0, y = 0}
	k0.joints["upper_arm_near"] = rig.JointDelta{angle = -0.80, x = 0, y = 0}
	k0.joints["forearm_near"] = rig.JointDelta{angle = -0.70, x = 0, y = 0}
	k0.joints["upper_arm_far"] = rig.JointDelta{angle = 0.75, x = 0, y = 0}
	k0.joints["forearm_far"] = rig.JointDelta{angle = -0.90, x = 0, y = 0}
	k0.joints["thigh_near"] = rig.JointDelta{angle = 0.85, x = 0, y = 0}
	k0.joints["shin_near"] = rig.JointDelta{angle = 0.35, x = 0, y = 0}
	k0.joints["thigh_far"] = rig.JointDelta{angle = -0.75, x = 0, y = 0}
	k0.joints["shin_far"] = rig.JointDelta{angle = 0.95, x = 0, y = 0}
	append(&clip.frames, k0)

	k1: Keyframe
	keyframe_init(&k1, allocator)
	k1.time = 0.4
	k1.easing = .Smooth
	k1.joints["root"] = rig.JointDelta{angle = 0.15, x = 0, y = -5.0}
	k1.joints["head"] = rig.JointDelta{angle = -0.12, x = 0, y = 0}
	k1.joints["upper_arm_near"] = rig.JointDelta{angle = 0.75, x = 0, y = 0}
	k1.joints["forearm_near"] = rig.JointDelta{angle = -0.90, x = 0, y = 0}
	k1.joints["upper_arm_far"] = rig.JointDelta{angle = -0.80, x = 0, y = 0}
	k1.joints["forearm_far"] = rig.JointDelta{angle = -0.70, x = 0, y = 0}
	k1.joints["thigh_near"] = rig.JointDelta{angle = -0.75, x = 0, y = 0}
	k1.joints["shin_near"] = rig.JointDelta{angle = 0.95, x = 0, y = 0}
	k1.joints["thigh_far"] = rig.JointDelta{angle = 0.85, x = 0, y = 0}
	k1.joints["shin_far"] = rig.JointDelta{angle = 0.35, x = 0, y = 0}
	append(&clip.frames, k1)

	k2: Keyframe
	keyframe_init(&k2, allocator)
	k2.time = 0.8
	k2.easing = .Smooth
	for j_id, j_delta in k0.joints {
		k2.joints[j_id] = j_delta
	}
	append(&clip.frames, k2)

	return clip
}

// Cria um clipe de golpe / ataque corpo a corpo
animation_create_melee_attack_clip :: proc(allocator := context.allocator) -> Clip {
	clip: Clip
	clip_init(&clip, "melee_attack", "Ataque com Arma / Espada", 1.0, 60.0, false, allocator)

	// Pronto
	k0: Keyframe
	keyframe_init(&k0, allocator)
	k0.time = 0.0
	k0.easing = .Smooth
	k0.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k0.joints["upper_arm_near"] = rig.JointDelta{angle = 0.20, x = 0, y = 0}
	k0.joints["forearm_near"] = rig.JointDelta{angle = -0.40, x = 0, y = 0}
	append(&clip.frames, k0)

	// Wind-up (preparação para o golpe)
	k1: Keyframe
	keyframe_init(&k1, allocator)
	k1.time = 0.3
	k1.easing = .Smooth
	k1.joints["root"] = rig.JointDelta{angle = -0.10, x = -8, y = 2}
	k1.joints["upper_arm_near"] = rig.JointDelta{angle = -0.90, x = 0, y = 0}
	k1.joints["forearm_near"] = rig.JointDelta{angle = -1.10, x = 0, y = 0}
	append(&clip.frames, k1)

	// Slash (impacto do golpe)
	k2: Keyframe
	keyframe_init(&k2, allocator)
	k2.time = 0.5
	k2.easing = .Smooth
	k2.joints["root"] = rig.JointDelta{angle = 0.15, x = 12, y = -1}
	k2.joints["upper_arm_near"] = rig.JointDelta{angle = 1.15, x = 0, y = 0}
	k2.joints["forearm_near"] = rig.JointDelta{angle = 0.20, x = 0, y = 0}
	append(&clip.frames, k2)

	// Recuperação
	k3: Keyframe
	keyframe_init(&k3, allocator)
	k3.time = 0.75
	k3.easing = .Smooth
	k3.joints["root"] = rig.JointDelta{angle = 0.05, x = 4, y = 0}
	k3.joints["upper_arm_near"] = rig.JointDelta{angle = 0.50, x = 0, y = 0}
	k3.joints["forearm_near"] = rig.JointDelta{angle = -0.20, x = 0, y = 0}
	append(&clip.frames, k3)

	// Retorno
	k4: Keyframe
	keyframe_init(&k4, allocator)
	k4.time = 1.0
	k4.easing = .Smooth
	for j_id, j_delta in k0.joints {
		k4.joints[j_id] = j_delta
	}
	append(&clip.frames, k4)

	return clip
}

// Cria um clipe de postura defensiva / bloqueio com escudo
animation_create_shield_block_clip :: proc(allocator := context.allocator) -> Clip {
	clip: Clip
	clip_init(&clip, "shield_block", "Bloqueio com Escudo", 0.8, 60.0, false, allocator)

	k0: Keyframe
	keyframe_init(&k0, allocator)
	k0.time = 0.0
	k0.easing = .Smooth
	k0.joints["root"] = rig.JointDelta{angle = 0.0, x = 0, y = 0}
	k0.joints["upper_arm_far"] = rig.JointDelta{angle = 0.2, x = 0, y = 0}
	k0.joints["forearm_far"] = rig.JointDelta{angle = -0.3, x = 0, y = 0}
	append(&clip.frames, k0)

	// Ergue o escudo e agacha levemente
	k1: Keyframe
	keyframe_init(&k1, allocator)
	k1.time = 0.2
	k1.easing = .Smooth
	k1.joints["root"] = rig.JointDelta{angle = 0.08, x = -4, y = 5}
	k1.joints["upper_arm_far"] = rig.JointDelta{angle = 0.90, x = 0, y = 0}
	k1.joints["forearm_far"] = rig.JointDelta{angle = -1.25, x = 0, y = 0}
	append(&clip.frames, k1)

	// Sustenta
	k2: Keyframe
	keyframe_init(&k2, allocator)
	k2.time = 0.55
	k2.easing = .Smooth
	for j_id, j_delta in k1.joints {
		k2.joints[j_id] = j_delta
	}
	append(&clip.frames, k2)

	// Retorna
	k3: Keyframe
	keyframe_init(&k3, allocator)
	k3.time = 0.8
	k3.easing = .Smooth
	for j_id, j_delta in k0.joints {
		k3.joints[j_id] = j_delta
	}
	append(&clip.frames, k3)

	return clip
}

// Retorna o pacote completo com as 5 animações padrão
animation_create_default_pack :: proc(allocator := context.allocator) -> [dynamic]Clip {
	pack := make([dynamic]Clip, 0, 5, allocator)
	append(&pack, animation_create_walk_clip(allocator))
	append(&pack, animation_create_idle_clip(allocator))
	append(&pack, animation_create_run_clip(allocator))
	append(&pack, animation_create_melee_attack_clip(allocator))
	append(&pack, animation_create_shield_block_clip(allocator))
	return pack
}
