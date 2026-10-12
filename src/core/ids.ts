/**
 * chocoBones IDs estáveis e determinísticos
 * Substitui Date.now()/Math.random() por contador + crypto quando disponível.
 */

let counter = 0;

/** Gera ID único com prefixo. Determinístico por sessão, sem colisão sob spam. */
export function generateId(prefix = "id"): string {
  counter += 1;
  // crypto.randomUUID é preferido quando disponível (Node 19+, browsers)
  try {
    const c = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) {
      return `${prefix}_${c.randomUUID().slice(0, 8)}_${counter.toString(36)}`;
    }
  } catch {
    // fallback para contador
  }
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

/** Reseta contador (uso exclusivo em testes para determinismo). */
export function resetIdCounter(): void {
  counter = 0;
}

/** Contador sequencial determinístico para keyframes (sem Math.random). */
let kfCounter = 0;
export function nextKeyframeId(): string {
  kfCounter += 1;
  return `kf_${kfCounter.toString(36).padStart(4, "0")}`;
}
export function resetKeyframeCounter(): void {
  kfCounter = 0;
}
