/**
 * chocoBones spring angular 2D com passo fixo determinístico (P0-6 / Fase 3 base)
 * Cabelo/orelha/cauda/tecido: cadeia de elos com stiffness/damping/gravity.
 * Semi-implicit Euler a Hz fixo + checkpoints/rewind + bake p/ scrub/export.
 */

export interface SpringParams {
  stiffness: number;
  damping: number;
  gravity: number;
  maxAngle: number;
  inertia: number;
}

export interface SpringChain {
  id: string;
  jointIds: string[]; // elos na ordem raiz→ponta
  rest: number[]; // ângulos de repouso por elo
  angle: number[];
  vel: number[];
  params: SpringParams;
}

export function createSpringChain(
  id: string,
  jointIds: string[],
  params: Partial<SpringParams> = {}
): SpringChain {
  return {
    id,
    jointIds: [...jointIds],
    rest: jointIds.map(() => 0),
    angle: jointIds.map(() => 0),
    vel: jointIds.map(() => 0),
    params: {
      stiffness: params.stiffness ?? 60,
      damping: params.damping ?? 6,
      gravity: params.gravity ?? 0,
      maxAngle: params.maxAngle ?? 0.6,
      inertia: params.inertia ?? 1,
    },
  };
}

/** Um passo fixo dt (ex: 1/120). drive = excitação externa por elo (procedural). */
export function stepSpring(chain: SpringChain, dt: number, drive: number[] = []): void {
  const { stiffness, damping, gravity, maxAngle, inertia } = chain.params;
  for (let i = 0; i < chain.angle.length; i++) {
    const a = chain.angle[i]!;
    const v = chain.vel[i]!;
    const rest = chain.rest[i] ?? 0;
    const ext = drive[i] ?? 0;
    const acc = (-stiffness * (a - rest) - damping * v + gravity + ext) / Math.max(1e-6, inertia);
    const nv = v + acc * dt;
    let na = a + nv * dt;
    if (na > maxAngle) na = maxAngle;
    if (na < -maxAngle) na = -maxAngle;
    chain.vel[i] = nv;
    chain.angle[i] = na;
  }
}

/** Snapshot p/ checkpoint/rewind determinístico. */
export function checkpointSpring(chain: SpringChain): { angle: number[]; vel: number[] } {
  return { angle: [...chain.angle], vel: [...chain.vel] };
}

export function rewindSpring(chain: SpringChain, cp: { angle: number[]; vel: number[] }): void {
  chain.angle = [...cp.angle];
  chain.vel = [...cp.vel];
}

/** Bake: simula duration a Hz fixo, retorna ângulos por frame (scrub determinístico). */
export function bakeSpring(chain: SpringChain, duration: number, hz = 120, driveFn?: (t: number) => number[]): number[][] {
  const src = checkpointSpring(chain);
  const out: number[][] = [];
  const dt = 1 / hz;
  const n = Math.max(1, Math.round(duration * hz));
  for (let f = 0; f < n; f++) {
    stepSpring(chain, dt, driveFn ? driveFn(f * dt) : []);
    out.push([...chain.angle]);
  }
  rewindSpring(chain, src);
  return out;
}
