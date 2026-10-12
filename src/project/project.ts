/**
 * chocoBones TypeScript Project Serialization & Zod Validation
 * Validação rigorosa em runtime no limite do sistema para arquivos .puppet.json.
 */

import { z } from "zod";

export const ProjectAssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  w: z.number().int(),
  h: z.number().int(),
  data: z.string(),
  material: z.string().default("default"),
  color: z.number().int().default(0),
  uri: z.string().optional(),
  checksum: z.string().optional(),
});

export type ProjectAsset = z.infer<typeof ProjectAssetSchema>;

export const ProjectJointSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent: z.string().default(""),
  x: z.number(),
  y: z.number(),
  color: z.string().default("#ffffff"),
});

export type ProjectJoint = z.infer<typeof ProjectJointSchema>;

export const ProjectTransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  rotation: z.number().default(0),
  sx: z.number().default(1),
  sy: z.number().default(1),
  px: z.number().default(0),
  py: z.number().default(0),
});

export type ProjectTransform = z.infer<typeof ProjectTransformSchema>;

export const ProjectSeamMaskSchema = z.object({
  layer: z.string().default(""),
  enabled: z.boolean().default(false),
  center: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
  }).default({ x: 0, y: 0 }),
  radius: z.number().default(0),
  feather: z.number().default(0),
});

export type ProjectSeamMask = z.infer<typeof ProjectSeamMaskSchema>;

export const ProjectLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  asset: z.string().default(""),
  transform: ProjectTransformSchema.default({}),
  joint: z.string().default(""),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  opacity: z.number().default(1),
  blend: z.string().default("normal"),
  seamMask: ProjectSeamMaskSchema.default({}),
});

export type ProjectLayer = z.infer<typeof ProjectLayerSchema>;

export const ProjectPinSchema = z.object({
  id: z.string(),
  meshId: z.string().default(""),
  x: z.number(),
  y: z.number(),
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  locked: z.boolean().default(false),
  enabled: z.boolean().default(true),
  radius: z.number().default(64),
  falloff: z.number().default(1.5),
  strength: z.number().default(1),
});

export type ProjectPin = z.infer<typeof ProjectPinSchema>;

export const ProjectMeshWeightSchema = z.object({
  joint: z.string(),
  weight: z.number(),
});

export const ProjectMeshSchema = z.object({
  id: z.string(),
  layerId: z.string().default(""),
  density: z.number().int().default(8),
  vertices: z.array(z.tuple([z.number(), z.number()])).default([]),
  triangles: z.array(z.tuple([z.number(), z.number(), z.number()])).default([]),
  uvs: z.array(z.tuple([z.number(), z.number()])).default([]),
  weights: z.array(z.array(ProjectMeshWeightSchema)).default([]),
  mode: z.string().default("Pins"),
  skinning: z.string().default("Linear"),
  strength: z.number().default(1),
});

export type ProjectMesh = z.infer<typeof ProjectMeshSchema>;

export const ProjectJointDeltaSchema = z.object({
  angle: z.number(),
  x: z.number(),
  y: z.number(),
});

export const ProjectLayerDeltaSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  rotation: z.number().default(0),
  sx: z.number().default(1),
  sy: z.number().default(1),
  opacity: z.number().default(1),
  visible: z.boolean().default(true),
  asset: z.string().default(""),
});

export const ProjectKeyframeSchema = z.object({
  id: z.string(),
  time: z.number(),
  joints: z.record(ProjectJointDeltaSchema).default({}),
  layers: z.record(ProjectLayerDeltaSchema).default({}),
  pins: z.record(z.tuple([z.number(), z.number()])).default({}),
  params: z.record(z.number()).default({}),
  easing: z.string().default("Smooth"),
  bezier: z.tuple([z.number(), z.number(), z.number(), z.number()]).default([0.25, 0.1, 0.25, 1.0]),
  channels: z.array(z.string()).default([]),
});

export type ProjectKeyframe = z.infer<typeof ProjectKeyframeSchema>;

export const ProjectClipSchema = z.object({
  id: z.string(),
  name: z.string(),
  duration: z.number().default(2.0),
  fps: z.number().default(60),
  loop: z.boolean().default(true),
  frames: z.array(ProjectKeyframeSchema).default([]),
});

export type ProjectClip = z.infer<typeof ProjectClipSchema>;

export const ProjectConstraintSchema = z.object({
  id: z.string(),
  type: z.enum(["ik", "limit", "aim", "parent"]).default("ik"),
  joints: z.array(z.string()).default([]),
  minAngle: z.number().optional(),
  maxAngle: z.number().optional(),
  poleX: z.number().optional(),
  poleY: z.number().optional(),
  enabled: z.boolean().default(true),
});

export type ProjectConstraint = z.infer<typeof ProjectConstraintSchema>;

export const ProjectSchema = z.object({
  schema: z.literal("survivor-puppet"),
  version: z.number().int().default(1),
  name: z.string(),
  width: z.number().int().default(512),
  height: z.number().int().default(512),
  assets: z.array(ProjectAssetSchema).default([]),
  joints: z.array(ProjectJointSchema).default([]),
  layers: z.array(ProjectLayerSchema).default([]),
  meshes: z.array(ProjectMeshSchema).optional(),
  pins: z.array(ProjectPinSchema).optional(),
  clips: z.array(ProjectClipSchema).optional(),
  constraints: z.array(ProjectConstraintSchema).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const MAX_PROJECT_BYTES = 20 * 1024 * 1024;

/**
 * Carrega e valida string JSON de projeto.
 * Lança erro explícito se violar o contrato de esquema Zod.
 * Rejeita ciclos hierárquicos e entradas acima do limite de tamanho.
 */
export function loadProjectFromJson(jsonString: string): Project {
  if (jsonString.length > MAX_PROJECT_BYTES) {
    throw new Error(`Projeto excede limite de ${MAX_PROJECT_BYTES} bytes`);
  }
  const parsed: unknown = JSON.parse(jsonString);
  const project = ProjectSchema.parse(parsed);
  // Validação de ciclos: percorre pais sem recursão infinita
  const indexById = new Map(project.joints.map((j) => [j.id, j]));
  for (const j of project.joints) {
    let curr = j.parent;
    let steps = 0;
    while (curr !== "" && steps <= project.joints.length) {
      if (curr === j.id) throw new Error(`Ciclo hierárquico detectado na junta ${j.id}`);
      const parent = indexById.get(curr);
      if (!parent) break;
      curr = parent.parent;
      steps++;
    }
    if (steps > project.joints.length) throw new Error(`Cadeia hierárquica muito profunda em ${j.id}`);
  }
  return project;
}

/**
 * Serializa projeto formatado em JSON.
 */
export function saveProjectToJson(project: Project): string {
  // Valida antes de serializar para garantir conformidade
  const validated = ProjectSchema.parse(project);
  return JSON.stringify(validated, null, 2);
}

/** Migra projeto v1 (só joints/layers) para v2 com coleções vazias explícitas. */
export function migrateV1ToV2(project: Project): Required<Pick<Project, "meshes" | "pins" | "clips" | "constraints">> & Project {
  return {
    ...project,
    version: 2,
    meshes: project.meshes ?? [],
    pins: project.pins ?? [],
    clips: project.clips ?? [],
    constraints: project.constraints ?? [],
  };
}

/** Retorna true se projeto já possui todas as coleções v2. */
export function isProjectV2(project: Project): boolean {
  return (
    project.version >= 2 &&
    Array.isArray(project.meshes) &&
    Array.isArray(project.pins) &&
    Array.isArray(project.clips) &&
    Array.isArray(project.constraints)
  );
}

// ---------------------------------------------------------------------------
// P0-5 — Asset manifest portátil + bindings/materiais + roundtrip
// ---------------------------------------------------------------------------

/** Converte caminho absoluto em portable (relativo POSIX ao dir do projeto). */
export function toPortablePath(absPath: string, projectDir: string): string {
  const path = require("node:path") as typeof import("node:path");
  const rel = path.relative(projectDir, absPath);
  return rel.split(path.sep).join("/");
}

/**
 * Resolve path portátil contra dir do projeto. Rejeita traversal que escapa.
 * Permite subpaths e basename simples; bloqueia `..` que sai da raiz e absolutos.
 */
export function resolvePortablePath(portable: string, projectDir: string): string {
  const path = require("node:path") as typeof import("node:path");
  if (portable.includes("\0")) throw new Error("Path inválido");
  const normalized = portable.replace(/\\/g, "/");
  const resolved = path.resolve(projectDir, normalized);
  const rel = path.relative(projectDir, resolved);
  if (rel.startsWith("..") || path.isAbsolute(normalized) && !resolved.startsWith(projectDir)) {
    throw new Error(`Asset path escapa do projeto: ${portable}`);
  }
  return resolved;
}

/** Normaliza manifest: preenche uri portátil quando ausente (basename). */
export function normalizeAssetManifest(assets: ProjectAsset[], projectDir: string): ProjectAsset[] {
  void projectDir;
  return assets.map((a) => {
    if (a.uri && a.uri.length > 0) return a;
    return { ...a, uri: `assets/${a.name}` };
  });
}

/**
 * Valida referências cruzadas (bindings/materiais):
 * layers[].asset → assets, layers[].joint → joints, pins[].meshId → meshes.
 * Retorna lista de erros (vazia = válido).
 */
export function validateAssetReferences(project: Project): string[] {
  const errors: string[] = [];
  const assetIds = new Set(project.assets.map((a) => a.id));
  const assetNames = new Set(project.assets.map((a) => a.name));
  const jointIds = new Set(project.joints.map((j) => j.id));
  const meshIds = new Set((project.meshes ?? []).map((m) => m.id));
  for (const l of project.layers) {
    if (l.asset && !assetIds.has(l.asset) && !assetNames.has(l.asset)) {
      errors.push(`layer ${l.id}: asset '${l.asset}' não existe no manifest`);
    }
    if (l.joint && !jointIds.has(l.joint)) errors.push(`layer ${l.id}: joint '${l.joint}' inexistente`);
  }
  for (const p of project.pins ?? []) {
    if (p.meshId && !meshIds.has(p.meshId)) errors.push(`pin ${p.id}: mesh '${p.meshId}' inexistente`);
  }
  for (const c of project.constraints ?? []) {
    for (const j of c.joints) {
      if (!jointIds.has(j)) errors.push(`constraint ${c.id}: joint '${j}' inexistente`);
    }
  }
  return errors;
}

/** Roundtrip lossless p/ campos conhecidos: save→load preserva igualdade. */
export function projectRoundtrip(project: Project): Project {
  return loadProjectFromJson(saveProjectToJson(project));
}
