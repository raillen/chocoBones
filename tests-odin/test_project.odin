package tests

import "core:mem"
import "core:os"
import "core:testing"
import "../src/project"

@(test)
test_project_serialization_roundtrip :: proc(t: ^testing.T) {
	p := project.Project{
		schema  = "survivor-puppet",
		version = 1,
		name    = "Projeto Teste",
		width   = 512,
		height  = 512,
		assets  = make([dynamic]project.ProjectAsset),
		joints  = make([dynamic]project.ProjectJoint),
		layers  = make([dynamic]project.ProjectLayer),
	}
	defer delete(p.assets)
	defer delete(p.joints)
	defer delete(p.layers)

	append(&p.joints, project.ProjectJoint{
		id     = "root",
		name   = "Centro / quadril",
		parent = "",
		x      = 256,
		y      = 300,
		color  = "#eab308",
	})

	append(&p.layers, project.ProjectLayer{
		id        = "torso",
		name      = "Tronco",
		asset     = "asset-torso",
		transform = project.ProjectTransform{x = 256, y = 293, sx = 1, sy = 1, px = 119, py = 225},
		joint     = "root",
		visible   = true,
		opacity   = 1.0,
	})

	mask := project.ProjectSeamMask{
		layer   = "torso",
		enabled = true,
		center  = project.ProjectVec2{x = 55, y = 62},
		radius  = 76,
		feather = 0.6,
	}
	append(&p.layers, project.ProjectLayer{
		id        = "arm-left",
		name      = "Braço esquerdo",
		asset     = "asset-arm",
		transform = project.ProjectTransform{x = 294, y = 216, sx = 1, sy = 1, px = 55, py = 62},
		joint     = "root",
		visible   = true,
		opacity   = 1.0,
		seamMask  = mask,
	})

	test_file := "/tmp/test_chocobones_project.puppet.json"
	defer os.remove(test_file)

	save_ok := project.save_project_to_file(test_file, &p)
	testing.expect(t, save_ok, "Salvar projeto atômico deve ter sucesso")

	// Uso de Arena Allocator para o projeto carregado (DOD standard)
	arena: mem.Arena
	arena_buf := make([]byte, 1024 * 64)
	defer delete(arena_buf)
	mem.arena_init(&arena, arena_buf)
	project_allocator := mem.arena_allocator(&arena)

	loaded, load_ok := project.load_project_from_file(test_file, project_allocator)
	testing.expect(t, load_ok, "Carregar projeto deve ter sucesso")

	testing.expect(t, loaded.schema == "survivor-puppet", "Schema deve ser survivor-puppet")
	testing.expect(t, loaded.version == 1, "Versão deve ser 1")
	testing.expect(t, loaded.name == "Projeto Teste", "Nome deve coincidir")
	testing.expect(t, len(loaded.joints) == 1, "Deve conter 1 junta")
	testing.expect(t, loaded.joints[0].id == "root", "ID da junta deve ser root")
	testing.expect(t, len(loaded.layers) == 2, "Deve conter 2 camadas")
	testing.expect(t, loaded.layers[0].id == "torso", "ID da camada deve ser torso")
	testing.expect(t, loaded.layers[1].id == "arm-left", "ID da segunda camada deve ser arm-left")
	testing.expect(t, loaded.layers[1].seamMask.enabled, "Segunda camada deve conter seamMask habilitada")
	testing.expect(t, loaded.layers[1].seamMask.layer == "torso", "seamMask.layer deve ser torso")
	testing.expect(t, loaded.layers[1].seamMask.radius == 76, "seamMask.radius deve ser 76")
}



@(test)
test_project_invalid_schema :: proc(t: ^testing.T) {
	arena: mem.Arena
	arena_buf := make([]byte, 1024 * 8)
	defer delete(arena_buf)
	mem.arena_init(&arena, arena_buf)
	temp_alloc := mem.arena_allocator(&arena)

	invalid_str := `{"schema": "invalid-schema", "version": 2}`
	invalid_bytes := transmute([]byte)invalid_str
	_, ok := project.load_project_from_memory(invalid_bytes, temp_alloc)
	testing.expect(t, !ok, "Projeto com schema inválido deve falhar na validação")
}
