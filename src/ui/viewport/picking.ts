/**
 * chocoBones picking com prioridade por ferramenta (P1-8)
 * Tool Pin → pinos primeiro; demais tools → juntas primeiro.
 * Joints nunca sequestram clique quando Pin está ativa.
 */
import { vec2Dist } from "../../core/math";
import { Vec2 } from "../../core/types";
import type { Pin } from "../../mesh/mesh";
import type { Pose } from "../../rig/joint";
import { pickJoint } from "./controller";

export type PickKind = "pin" | "joint" | "none";
export interface PickResult {
  kind: PickKind;
  id: string;
}

export function pickPin(
  pins: readonly Pin[],
  pose: Pose | null,
  worldX: number,
  worldY: number,
  hitRadius: number
): string {
  let best = "";
  let bestDist = Infinity;
  for (const p of pins) {
    if (p.enabled === false) continue;
    const d = pose?.pins.get(p.id) ?? [0, 0];
    const px = p.x + d[0];
    const py = p.y + d[1];
    const dist = vec2Dist([px, py] as Vec2, [worldX, worldY] as Vec2);
    // Respeita raio de influência como área generosa de clique quando pequeno
    if (dist < bestDist && dist <= hitRadius) {
      bestDist = dist;
      best = p.id;
    }
  }
  return best;
}

export function pickEntity(
  joints: Parameters<typeof pickJoint>[0],
  pins: readonly Pin[],
  pose: Pose | null,
  worldX: number,
  worldY: number,
  activeTool: string,
  zoom: number
): PickResult {
  const hitRadius = Math.max(16, 20 / Math.max(0.2, zoom));
  const pinFirst = activeTool === "Pin" || activeTool === "Weight";
  if (pinFirst) {
    const pin = pickPin(pins, pose, worldX, worldY, hitRadius);
    if (pin) return { kind: "pin", id: pin };
    const joint = pickJoint(joints, pose, worldX, worldY, hitRadius);
    if (joint) return { kind: "joint", id: joint };
    return { kind: "none", id: "" };
  }
  const joint = pickJoint(joints, pose, worldX, worldY, hitRadius);
  if (joint) return { kind: "joint", id: joint };
  const pin = pickPin(pins, pose, worldX, worldY, hitRadius);
  if (pin) return { kind: "pin", id: pin };
  return { kind: "none", id: "" };
}
