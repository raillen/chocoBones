# Serialização de Projetos (Project)

Módulo responsável pela serialização e desserialização de arquivos de projeto do ChocoBones (`.puppet.json`).

| Arquivo | Responsabilidade |
|---|---|
| `project.odin` | Estruturas de esquema JSON (`ProjectData`, `JointData`, `LayerData`), gravação (`save_project_to_file`) e carregamento (`load_project_from_file`) |
