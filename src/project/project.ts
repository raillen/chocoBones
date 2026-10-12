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

export const ProjectSchema = z.object({
  schema: z.literal("survivor-puppet"),
  version: z.number().int().default(1),
  name: z.string(),
  width: z.number().int().default(512),
  height: z.number().int().default(512),
  assets: z.array(ProjectAssetSchema).default([]),
  joints: z.array(ProjectJointSchema).default([]),
  layers: z.array(ProjectLayerSchema).default([]),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Carrega e valida string JSON de projeto.
 * Lança erro explícito se violar o contrato de esquema Zod.
 */
export function loadProjectFromJson(jsonString: string): Project {
  const parsed: unknown = JSON.parse(jsonString);
  return ProjectSchema.parse(parsed);
}

/**
 * Serializa projeto formatado em JSON.
 */
export function saveProjectToJson(project: Project): string {
  // Valida antes de serializar para garantir conformidade
  const validated = ProjectSchema.parse(project);
  return JSON.stringify(validated, null, 2);
}
