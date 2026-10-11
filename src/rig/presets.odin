package rig

import "../core"
import "core:strings"

RigPreset :: enum {
	Humanoid,
	BipedSimple,
	Quadruped,
	Prop,
	Empty,
}

// Retorna o índice de uma junta ou -1 se não existir
joint_find_index :: proc(joints: []Joint, id: string) -> int {
	for j, idx in joints {
		if j.id == id do return idx
	}
	return -1
}

// Verifica se candidate_id é descendente (filho, neto...) de ancestor_id
joint_is_descendant :: proc(joints: []Joint, candidate_id, ancestor_id: string) -> bool {
	if candidate_id == "" || ancestor_id == "" do return false
	curr := candidate_id
	visited_count := 0
	max_depth := len(joints)

	for curr != "" && visited_count <= max_depth {
		j_idx := joint_find_index(joints, curr)
		if j_idx < 0 do break
		parent := joints[j_idx].parent
		if parent == ancestor_id do return true
		curr = parent
		visited_count += 1
	}
	return false
}

// Verifica se há ciclo na hierarquia de juntas
joint_has_cycle :: proc(joints: []Joint) -> bool {
	for j in joints {
		curr := j.parent
		visited := 0
		for curr != "" && visited <= len(joints) {
			if curr == j.id do return true
			p_idx := joint_find_index(joints, curr)
			if p_idx < 0 do break
			curr = joints[p_idx].parent
			visited += 1
		}
		if visited > len(joints) do return true
	}
	return false
}

// Adiciona uma junta ao esqueleto, validando ID duplicado e ciclo
joint_add :: proc(joints: ^[dynamic]Joint, joint: Joint) -> bool {
	if joint.id == "" do return false
	if joint_find_index(joints[:], joint.id) >= 0 do return false // ID já existe

	if joint.parent != "" && joint_find_index(joints[:], joint.parent) < 0 {
		return false // Pai inexistente
	}

	append(joints, joint)
	if joint_has_cycle(joints[:]) {
		pop(joints)
		return false
	}
	return true
}

// Remove uma junta do esqueleto, reparentando os filhos para reparent_to (ou para a raiz se vazio)
joint_remove :: proc(joints: ^[dynamic]Joint, id: string, reparent_to: string = "") -> bool {
	idx := joint_find_index(joints[:], id)
	if idx < 0 do return false

	removed_parent := joints[idx].parent
	target_parent := reparent_to != "" ? reparent_to : removed_parent

	// Se reparentar para uma junta inexistente ou para o próprio que está saindo, vai para raiz
	if target_parent == id || (target_parent != "" && joint_find_index(joints[:], target_parent) < 0) {
		target_parent = ""
	}

	// Reparenta filhos
	for &j in joints {
		if j.parent == id {
			j.parent = target_parent
		}
	}

	ordered_remove(joints, idx)
	return true
}

// Altera o pai de uma junta, prevenindo ciclos
joint_set_parent :: proc(joints: ^[dynamic]Joint, id, new_parent: string) -> bool {
	idx := joint_find_index(joints[:], id)
	if idx < 0 do return false

	if new_parent == id do return false
	if new_parent != "" {
		if joint_find_index(joints[:], new_parent) < 0 do return false
		if joint_is_descendant(joints[:], new_parent, id) do return false // Evita ciclo
	}

	old_parent := joints[idx].parent
	joints[idx].parent = new_parent

	if joint_has_cycle(joints[:]) {
		joints[idx].parent = old_parent
		return false
	}
	return true
}

// Renomeia o ID e/ou nome da junta, atualizando referências em filhos, camadas e pose
joint_rename :: proc(
	joints: ^[dynamic]Joint,
	old_id, new_id, new_name: string,
	layers: ^[dynamic]Layer = nil,
	pose: ^Pose = nil,
	allocator := context.allocator,
) -> bool {
	idx := joint_find_index(joints[:], old_id)
	if idx < 0 do return false

	if new_id != old_id && new_id != "" {
		if joint_find_index(joints[:], new_id) >= 0 do return false // Novo ID já ocupado
	}

	final_id := new_id != "" ? new_id : old_id
	final_name := new_name != "" ? new_name : joints[idx].name

	joints[idx].id = final_id
	joints[idx].name = final_name

	if final_id != old_id {
		// Atualiza filhos que apontavam para old_id
		for &j in joints {
			if j.parent == old_id {
				j.parent = final_id
			}
		}

		// Atualiza camadas vinculadas
		if layers != nil {
			for &l in layers {
				if l.joint == old_id {
					l.joint = final_id
				}
			}
		}

		// Atualiza mapa de deltas na pose
		if pose != nil {
			if delta, ok := pose.joints[old_id]; ok {
				delete_key(&pose.joints, old_id)
				pose.joints[final_id] = delta
			}
		}
	}

	return true
}

// Cria um esqueleto baseado em predefinições
rig_create_preset :: proc(preset: RigPreset, allocator := context.allocator) -> [dynamic]Joint {
	joints := make([dynamic]Joint, 0, 16, allocator)

	switch preset {
	case .Humanoid:
		append(&joints, Joint{id = "root", name = "Centro / quadril", parent = "", x = 256, y = 300, color = "#eab308"})
		append(&joints, Joint{id = "head", name = "Pescoço / cabeça", parent = "root", x = 256, y = 210, color = "#3b82f6"})
		append(&joints, Joint{id = "upper_arm_near", name = "Ombro próximo", parent = "root", x = 220, y = 216, color = "#10b981"})
		append(&joints, Joint{id = "forearm_near", name = "Cotovelo próximo", parent = "upper_arm_near", x = 195, y = 256, color = "#10b981"})
		append(&joints, Joint{id = "hand_near", name = "Punho próximo", parent = "forearm_near", x = 175, y = 295, color = "#10b981"})
		append(&joints, Joint{id = "upper_arm_far", name = "Ombro distante", parent = "root", x = 294, y = 216, color = "#6366f1"})
		append(&joints, Joint{id = "forearm_far", name = "Cotovelo distante", parent = "upper_arm_far", x = 315, y = 256, color = "#6366f1"})
		append(&joints, Joint{id = "hand_far", name = "Punho distante", parent = "forearm_far", x = 335, y = 295, color = "#6366f1"})
		append(&joints, Joint{id = "thigh_near", name = "Quadril próximo", parent = "root", x = 239, y = 302, color = "#f97316"})
		append(&joints, Joint{id = "shin_near", name = "Joelho próximo", parent = "thigh_near", x = 239, y = 360, color = "#f97316"})
		append(&joints, Joint{id = "foot_near", name = "Tornozelo próximo", parent = "shin_near", x = 239, y = 420, color = "#f97316"})
		append(&joints, Joint{id = "thigh_far", name = "Quadril distante", parent = "root", x = 278, y = 302, color = "#ec4899"})
		append(&joints, Joint{id = "shin_far", name = "Joelho distante", parent = "thigh_far", x = 278, y = 360, color = "#ec4899"})
		append(&joints, Joint{id = "foot_far", name = "Tornozelo distante", parent = "shin_far", x = 278, y = 420, color = "#ec4899"})

	case .BipedSimple:
		append(&joints, Joint{id = "root", name = "Tronco / Raiz", parent = "", x = 256, y = 290, color = "#eab308"})
		append(&joints, Joint{id = "head", name = "Cabeça", parent = "root", x = 256, y = 200, color = "#3b82f6"})
		append(&joints, Joint{id = "arm_l", name = "Braço Esquerdo", parent = "root", x = 210, y = 220, color = "#10b981"})
		append(&joints, Joint{id = "hand_l", name = "Mão Esquerda", parent = "arm_l", x = 180, y = 280, color = "#10b981"})
		append(&joints, Joint{id = "arm_r", name = "Braço Direito", parent = "root", x = 302, y = 220, color = "#6366f1"})
		append(&joints, Joint{id = "hand_r", name = "Mão Direita", parent = "arm_r", x = 332, y = 280, color = "#6366f1"})
		append(&joints, Joint{id = "leg_l", name = "Perna Esquerda", parent = "root", x = 230, y = 360, color = "#f97316"})
		append(&joints, Joint{id = "leg_r", name = "Perna Direita", parent = "root", x = 282, y = 360, color = "#ec4899"})

	case .Quadruped:
		append(&joints, Joint{id = "spine_root", name = "Coluna / Centro", parent = "", x = 256, y = 280, color = "#eab308"})
		append(&joints, Joint{id = "chest", name = "Peito", parent = "spine_root", x = 200, y = 270, color = "#f59e0b"})
		append(&joints, Joint{id = "neck", name = "Pescoço", parent = "chest", x = 170, y = 230, color = "#3b82f6"})
		append(&joints, Joint{id = "head", name = "Cabeça", parent = "neck", x = 150, y = 200, color = "#3b82f6"})
		append(&joints, Joint{id = "leg_fl", name = "Pata Diant. Esq.", parent = "chest", x = 190, y = 330, color = "#10b981"})
		append(&joints, Joint{id = "paw_fl", name = "Pé Diant. Esq.", parent = "leg_fl", x = 190, y = 380, color = "#10b981"})
		append(&joints, Joint{id = "leg_fr", name = "Pata Diant. Dir.", parent = "chest", x = 210, y = 330, color = "#06b6d4"})
		append(&joints, Joint{id = "paw_fr", name = "Pé Diant. Dir.", parent = "leg_fr", x = 210, y = 380, color = "#06b6d4"})
		append(&joints, Joint{id = "pelvis_rear", name = "Pélvis Traseira", parent = "spine_root", x = 310, y = 280, color = "#f97316"})
		append(&joints, Joint{id = "leg_bl", name = "Pata Tras. Esq.", parent = "pelvis_rear", x = 310, y = 335, color = "#ec4899"})
		append(&joints, Joint{id = "paw_bl", name = "Pé Tras. Esq.", parent = "leg_bl", x = 310, y = 385, color = "#ec4899"})
		append(&joints, Joint{id = "leg_br", name = "Pata Tras. Dir.", parent = "pelvis_rear", x = 330, y = 335, color = "#8b5cf6"})
		append(&joints, Joint{id = "paw_br", name = "Pé Tras. Dir.", parent = "leg_br", x = 330, y = 385, color = "#8b5cf6"})
		append(&joints, Joint{id = "tail", name = "Cauda", parent = "pelvis_rear", x = 360, y = 270, color = "#64748b"})

	case .Prop:
		append(&joints, Joint{id = "root", name = "Pivô Central", parent = "", x = 256, y = 256, color = "#eab308"})
		append(&joints, Joint{id = "grip_socket", name = "Socket / Empunhadura", parent = "root", x = 256, y = 320, color = "#10b981"})

	case .Empty:
		// Sem juntas iniciais
	}

	return joints
}
