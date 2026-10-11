package project

import "core:encoding/json"
import "core:fmt"
import "core:os"
import "core:strings"

ProjectAsset :: struct {
	id:       string,
	name:     string,
	w:        int,
	h:        int,
	data:     string,
	material: string,
	color:    int,
}

ProjectJoint :: struct {
	id:     string,
	name:   string,
	parent: string,
	x:      f32,
	y:      f32,
	color:  string,
}

ProjectTransform :: struct {
	x:        f32,
	y:        f32,
	rotation: f32,
	sx:       f32,
	sy:       f32,
	px:       f32,
	py:       f32,
}

ProjectVec2 :: struct {
	x: f32,
	y: f32,
}

ProjectSeamMask :: struct {
	layer:   string,
	enabled: bool,
	center:  ProjectVec2,
	radius:  f32,
	feather: f32,
}

ProjectLayer :: struct {
	id:        string,
	name:      string,
	asset:     string,
	transform: ProjectTransform,
	joint:     string,
	visible:   bool,
	locked:    bool,
	opacity:   f32,
	blend:     string,
	seamMask:  ProjectSeamMask,
}



Project :: struct {
	schema:  string,
	version: int,
	name:    string,
	width:   int,
	height:  int,
	assets:  [dynamic]ProjectAsset,
	joints:  [dynamic]ProjectJoint,
	layers:  [dynamic]ProjectLayer,
}

project_destroy :: proc(p: ^Project, allocator := context.allocator) {
	delete(p.assets)
	delete(p.joints)
	delete(p.layers)
}

load_project_from_memory :: proc(bytes: []byte, allocator := context.allocator) -> (Project, bool) {
	p: Project
	err := json.unmarshal(bytes, &p, json.DEFAULT_SPECIFICATION, allocator)
	if err != nil {
		fmt.eprintln("Falha no unmarshal do JSON do projeto:", err)
		return {}, false
	}

	if p.schema != "survivor-puppet" || p.version != 1 {
		fmt.eprintln("Schema incompatível:", p.schema, p.version)
		project_destroy(&p, allocator)
		return {}, false
	}

	return p, true
}

load_project_from_file :: proc(path: string, allocator := context.allocator) -> (Project, bool) {
	bytes, err := os.read_entire_file(path, allocator)
	if err != nil {
		fmt.eprintln("Não foi possível ler o arquivo:", path, err)
		return {}, false
	}
	defer delete(bytes, allocator)

	return load_project_from_memory(bytes, allocator)
}

save_project_to_file :: proc(path: string, p: ^Project) -> bool {
	json_bytes, err := json.marshal(p^, {pretty = true, use_spaces = true, spaces = 2}, context.temp_allocator)
	if err != nil {
		fmt.eprintln("Falha na serialização JSON:", err)
		return false
	}

	tmp_path := strings.concatenate({path, ".tmp"}, context.temp_allocator)

	// Gravação atômica: grava no temporário e renomeia
	write_err := os.write_entire_file(tmp_path, json_bytes)
	if write_err != nil {
		fmt.eprintln("Falha ao gravar arquivo temporário:", tmp_path, write_err)
		return false
	}

	rename_err := os.rename(tmp_path, path)
	if rename_err != nil {
		fmt.eprintln("Falha na substituição atômica do arquivo:", path, rename_err)
		return false
	}

	return true
}
