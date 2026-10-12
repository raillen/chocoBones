/**
 * chocoBones pin tool actions (P1-7)
 * add/move/delete pin, lock, anchor, influence, reset — com histórico.
 */
import { generateId } from "../../core/ids";
import { createPin, movePinRest, Pin, PinAnchorMode, resetPinOffset, setPinOffset } from "../../mesh/mesh";
import type { AppState } from "../store";

export function addPin(state: AppState, meshId: string, x: number, y: number, name?: string): Pin {
  state.history.push("Adicionar Pino", state.joints, state.layers, state.currentPose, state.pins);
  const pin = createPin(generateId("pin"), meshId, x, y, { name: name ?? `Pino ${state.pins.length + 1}` });
  state.pins.push(pin);
  return pin;
}

export function deletePin(state: AppState, id: string): boolean {
  const idx = state.pins.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  state.history.push(`Remover Pino ${id}`, state.joints, state.layers, state.currentPose, state.pins);
  state.pins.splice(idx, 1);
  state.currentPose.pins.delete(id);
  return true;
}

export function movePin(state: AppState, id: string, x: number, y: number, isSetup: boolean): boolean {
  const pin = state.pins.find((p) => p.id === id);
  if (!pin) return false;
  state.history.push(`Mover Pino ${id}`, state.joints, state.layers, state.currentPose, state.pins);
  if (isSetup) {
    return movePinRest(state.pins, id, x, y);
  }
  // Animate: offset relativo ao rest
  setPinOffset(state.currentPose, id, x - pin.x, y - pin.y);
  return true;
}

export function togglePinLock(state: AppState, id: string): boolean {
  const pin = state.pins.find((p) => p.id === id);
  if (!pin) return false;
  state.history.push(`Lock Pino ${id}`, state.joints, state.layers, state.currentPose, state.pins);
  pin.locked = !pin.locked;
  return pin.locked;
}

export function setPinEnabled(state: AppState, id: string, enabled: boolean): boolean {
  const pin = state.pins.find((p) => p.id === id);
  if (!pin) return false;
  pin.enabled = enabled;
  return true;
}

export function setPinAnchor(state: AppState, id: string, mode: PinAnchorMode, jointId = ""): boolean {
  const pin = state.pins.find((p) => p.id === id);
  if (!pin) return false;
  state.history.push(`Anchor Pino ${id}`, state.joints, state.layers, state.currentPose, state.pins);
  pin.anchorMode = mode;
  pin.anchorJoint = jointId;
  return true;
}

export function setPinInfluence(state: AppState, id: string, radius: number, falloff: number, strength: number): boolean {
  const pin = state.pins.find((p) => p.id === id);
  if (!pin) return false;
  pin.radius = Math.max(0, radius);
  pin.falloff = Math.max(0.1, falloff);
  pin.strength = Math.max(0, Math.min(1, strength));
  return true;
}

export function resetPin(state: AppState, id: string): void {
  resetPinOffset(state.currentPose, id);
}
