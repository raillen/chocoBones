/**
 * chocoBones clock com delta_time real + fixed-step para física determinística.
 */

/** Avança tempo com delta real medido (segundos). Retorna novo tempo com loop. */
export function advanceTime(current: number, deltaSeconds: number, duration: number, loop: boolean): number {
  const dt = Math.max(0, Math.min(deltaSeconds, 0.25)); // clamp anti-spike
  let t = current + dt;
  if (loop && duration > 0) {
    t = t % duration;
  } else if (duration > 0) {
    t = Math.min(t, duration);
  }
  return t;
}

/** Acumulador fixed-step (ex: física a 120Hz) determinístico sob scrub/export. */
export class FixedStepAccumulator {
  private acc = 0;
  constructor(public stepHz = 120) {}
  /** Retorna nº de steps a simular para este delta. */
  public stepsFor(deltaSeconds: number): number {
    this.acc += Math.max(0, Math.min(deltaSeconds, 0.25));
    const step = 1 / this.stepHz;
    let n = 0;
    while (this.acc >= step && n < 8) {
      this.acc -= step;
      n++;
    }
    return n;
  }
  public reset(): void {
    this.acc = 0;
  }
}
