/**
 * chocoBones player runtime independente (Fase 4)
 * Avalia manifest + clips sem editor: mesmo evaluate(t) do palco/export.
 * Integração com engines via spritesheet + dados documentados.
 */
import { evaluateClipInto } from "../animation/evaluator";
import { Clip } from "../animation/timeline";
import { createPose, Pose } from "../rig/joint";
import { applyOperatorStack, ProceduralOperator } from "../procedural/operators";

export interface RuntimeClipData {
  clip: Clip;
  operators: ProceduralOperator[];
}

export class PuppetPlayer {
  private pose: Pose = createPose();
  constructor(
    public clips: Map<string, RuntimeClipData> = new Map(),
    public activeId = ""
  ) {}

  public addClip(id: string, clip: Clip, operators: ProceduralOperator[] = []): void {
    this.clips.set(id, { clip, operators });
    if (!this.activeId) this.activeId = id;
  }

  /** Amostra tempo t com pipeline completo: clip → operadores. Determinístico. */
  public sample(time: number): Pose {
    const entry = this.clips.get(this.activeId);
    this.pose = createPose();
    if (!entry) return this.pose;
    evaluateClipInto(entry.clip, time, this.pose);
    applyOperatorStack(entry.operators, time, this.pose);
    return this.pose;
  }

  public getPose(): Pose {
    return this.pose;
  }
}

/** Track 3D separada (dossiê: não misturar requisitos 2D/3D). */
export const TRACK_3D_NOTE = "3D viewer/orbit mantido como trilha própria; roadmap 2D não força migração de renderizador.";
