/** Procedural 2D motion baked into ordinary, editable MLS pin channels. */
import type { Vec2 } from "../core/types";
import type { Pin } from "../mesh/mesh";
import { createPose, type Pose } from "../rig/joint";
import { createClip, Easing, sampleClip, sortClipFrames, type Clip, type Keyframe } from "./timeline";

export type PinMotionPreset = "breath" | "sway" | "walk";

export interface PinMotionOptions {
  preset: PinMotionPreset;
  /** Maximum displacement in image/world pixels, independent of viewport zoom. */
  amplitude: number;
  /** Cycles per second. The generated duration contains an integer number of cycles. */
  frequency: number;
  /** Desired duration; rounded to the nearest complete cycle to close the loop. */
  duration: number;
  fps?: number;
  intensity?: number;
}

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function pinValue(id: string, value: Vec2): Vec2 {
  if (!id.trim()) throw new RangeError("Pin IDs must not be empty");
  return [finite(value[0], `pin ${id} x`), finite(value[1], `pin ${id} y`)];
}

function frameAt(time: number, id: string): Keyframe {
  return {
    id, time, joints: new Map(), layers: new Map(), pins: new Map(), params: new Map(),
    easing: Easing.Linear, bezier: [0.25, 0.1, 0.25, 1], channels: [],
  };
}

interface PinGeometry {
  pin: Pin;
  height: number;
  horizontal: number;
  side: number;
}

/** Geometry is derived separately for each mesh, without anatomical IDs or rest edits. */
function geometryFor(pins: readonly Pin[]): PinGeometry[] {
  const groups = new Map<string, Pin[]>();
  const ids = new Set<string>();
  for (const pin of pins) {
    pinValue(pin.id, [pin.x, pin.y]);
    if (ids.has(pin.id)) throw new RangeError(`Duplicate pin ID: ${pin.id}`);
    ids.add(pin.id);
    if (pin.enabled === false) continue;
    const group = groups.get(pin.meshId ?? "") ?? [];
    group.push(pin);
    groups.set(pin.meshId ?? "", group);
  }
  const geometry: PinGeometry[] = [];
  for (const group of groups.values()) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const pin of group) {
      minX = Math.min(minX, pin.x); maxX = Math.max(maxX, pin.x);
      minY = Math.min(minY, pin.y); maxY = Math.max(maxY, pin.y);
    }
    // Scale before subtraction so even finite coordinates near numeric limits stay finite.
    const scaleX = Math.max(1, Math.abs(minX), Math.abs(maxX));
    const scaleY = Math.max(1, Math.abs(minY), Math.abs(maxY));
    const left = minX / scaleX, right = maxX / scaleX;
    const top = minY / scaleY, bottom = maxY / scaleY;
    const middle = left / 2 + right / 2;
    const width = right - left;
    const height = bottom - top;
    const ordered = [...group].sort((a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id));
    for (const pin of group) {
      geometry.push({
        pin,
        height: height > 0 ? clamp((pin.y / scaleY - top) / height, 0, 1) : 0.5,
        horizontal: width > 0 ? clamp((pin.x / scaleX - middle) / (width / 2), -1, 1) : 0,
        side: width > 0 ? (pin.x / scaleX < middle ? 1 : -1) : (ordered.indexOf(pin) % 2 === 0 ? 1 : -1),
      });
    }
  }
  return geometry;
}

function offsetFor(geometry: PinGeometry, preset: PinMotionPreset, phase: number, amplitude: number): Vec2 {
  if (geometry.pin.locked || amplitude === 0 || phase === 0) return [0, 0];
  const upper = 1 - geometry.height;
  const wave = Math.sin(phase);
  if (preset === "breath") {
    const weight = 0.15 + 0.85 * upper;
    return [amplitude * wave * geometry.horizontal * weight * 0.35, -amplitude * wave * weight];
  }
  if (preset === "sway") {
    return [amplitude * wave * upper * upper, -amplitude * (1 - Math.cos(phase)) * upper * 0.1];
  }
  if (geometry.height >= 0.65) {
    const step = wave * geometry.side;
    return [amplitude * step, -amplitude * 0.6 * Math.max(0, step)];
  }
  return [-amplitude * wave * upper * 0.15, -amplitude * wave * wave * upper * 0.12];
}

/** Pure bake: inputs and rest positions remain unchanged; all frames close the loop exactly. */
export function createPinMotionClip(pins: readonly Pin[], options: PinMotionOptions): Clip {
  if (!["breath", "sway", "walk"].includes(options.preset)) throw new RangeError("Unknown pin motion preset");
  const amplitude = clamp(finite(options.amplitude, "amplitude"), 0, 1000)
    * clamp(finite(options.intensity ?? 1, "intensity"), 0, 1);
  const frequency = clamp(finite(options.frequency, "frequency"), 0.1, 6);
  const requestedDuration = finite(options.duration, "duration");
  if (requestedDuration <= 0) throw new RangeError("duration must be positive");
  const fps = clamp(finite(options.fps ?? 60, "fps"), 24, 120);
  const cycles = Math.max(1, Math.round(clamp(requestedDuration, 0.1, 60) * frequency));
  const duration = cycles / frequency;
  const names: Record<PinMotionPreset, string> = { breath: "Respiração", sway: "Balanço", walk: "Caminhada" };
  const clip = createClip(`pin-motion-${options.preset}`, names[options.preset], duration, fps, true);
  const geometry = geometryFor(pins);
  const count = Math.ceil(duration * fps);
  for (let i = 0; i <= count; i++) {
    const time = Math.min(i / fps, duration);
    const frame = frameAt(time, `${clip.id}:${i}`);
    // Pin deltas start at rest; the explicit endpoint avoids floating-point seam noise.
    const phase = i === count ? 0 : time * frequency * Math.PI * 2;
    for (const target of geometry) {
      frame.pins.set(target.pin.id, offsetFor(target, options.preset, phase, amplitude));
      frame.channels.push(`pin:${target.pin.id}`);
    }
    clip.frames.push(frame);
  }
  return clip;
}

/** Split an existing easing curve so inserting pin keys does not retime body/layer motion. */
function splitEasing(previous: Keyframe, next: Keyframe, inserted: Keyframe): void {
  if (previous.easing === Easing.Linear) return;
  if (previous.easing === Easing.Hold) {
    // Non-pin values at the inserted frame equal the held values; linear on the left
    // keeps those values constant and makes the new pin key sampleable at its time.
    previous.easing = Easing.Linear;
    inserted.easing = Easing.Hold;
    return;
  }
  const ratio = (inserted.time - previous.time) / (next.time - previous.time);
  const controls = previous.easing === Easing.Smooth
    ? [1 / 3, 0, 2 / 3, 1] as const : previous.bezier;
  const start: Vec2 = [0, 0], end: Vec2 = [1, 1];
  const first: Vec2 = [controls[0], controls[1]], second: Vec2 = [controls[2], controls[3]];
  const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const pointAt = (t: number): Vec2 => {
    const a = lerp(start, first, t), b = lerp(first, second, t), c = lerp(second, end, t);
    return lerp(lerp(a, b, t), lerp(b, c, t), t);
  };
  let low = 0, high = 1;
  for (let i = 0; i < 32; i++) {
    const middle = (low + high) / 2;
    if (pointAt(middle)[0] < ratio) low = middle; else high = middle;
  }
  const t = (low + high) / 2;
  const a = lerp(start, first, t), b = lerp(first, second, t), c = lerp(second, end, t);
  const d = lerp(a, b, t), e = lerp(b, c, t), point = lerp(d, e, t);
  // Degenerate/overshooting curves can have zero vertical span and cannot be
  // represented by normalized split curves; retain their declared easing.
  if (Math.abs(point[1]) < 1e-10 || Math.abs(1 - point[1]) < 1e-10) {
    inserted.easing = previous.easing;
    inserted.bezier = [...previous.bezier];
    return;
  }
  previous.easing = Easing.Bezier;
  previous.bezier = [a[0] / ratio, a[1] / point[1], d[0] / ratio, d[1] / point[1]];
  inserted.easing = Easing.Bezier;
  inserted.bezier = [(e[0] - ratio) / (1 - ratio), (e[1] - point[1]) / (1 - point[1]),
    (c[0] - ratio) / (1 - ratio), (c[1] - point[1]) / (1 - point[1])];
}

/**
 * Record a complete pin snapshot at a frame-quantized time, preserving other tracks.
 * Neutral boundaries are added when absent, so an edit does not become a constant pose.
 */
export function upsertPinKeyframe(clip: Clip, pose: Pose, time: number): void {
  const duration = finite(clip.duration, "clip duration");
  const fps = finite(clip.fps, "clip fps");
  if (duration <= 0 || fps <= 0) throw new RangeError("clip duration and fps must be positive");
  const quantize = (value: number): number => {
    const clamped = clamp(value, 0, duration);
    // A complete cycle need not end on the FPS grid. Preserve that explicit endpoint
    // instead of merging it with the preceding frame and breaking a recorded loop.
    if (clamped === 0 || clamped === duration) return clamped;
    return clamp(Math.round(clamped * fps) / fps, 0, duration);
  };
  const at = quantize(finite(time, "time"));
  const snapshot = new Map<string, Vec2>();
  for (const [id, value] of pose.pins) snapshot.set(id, pinValue(id, value));
  const ids = new Set(snapshot.keys());
  for (const frame of clip.frames) {
    finite(frame.time, "keyframe time");
    for (const [id, value] of frame.pins) {
      pinValue(id, value);
      ids.add(id);
    }
  }
  if (ids.size === 0) return;

  const sampledFrame = (targetTime: number): Keyframe => {
    const base = createPose();
    // The endpoint must sample the last key rather than wrap to the first.
    sampleClip({ ...clip, loop: false }, targetTime, base);
    const frame = frameAt(targetTime, `pin-edit:${targetTime}`);
    frame.joints = base.joints;
    frame.layers = base.layers;
    frame.params = base.params;
    for (const id of ids) frame.pins.set(id, base.pins.get(id) ?? [0, 0]);
    return frame;
  };

  const matching = clip.frames.filter((frame) => Math.abs(quantize(frame.time) - at) < 1e-8);
  const edited = matching[0] ?? sampledFrame(at);
  // Build missing boundaries before adding the edit, retaining the original base animation.
  const boundaries: Keyframe[] = [];
  for (const boundary of [0, duration]) {
    if (!clip.frames.some((frame) => Math.abs(frame.time - boundary) < 1e-8) && Math.abs(at - boundary) >= 1e-8) {
      const frame = sampledFrame(boundary);
      for (const id of ids) frame.pins.set(id, [0, 0]);
      boundaries.push(frame);
    }
  }
  if (matching.length === 0) {
    const previous = [...clip.frames].filter((frame) => frame.time < at).sort((a, b) => b.time - a.time)[0];
    const next = [...clip.frames].filter((frame) => frame.time > at).sort((a, b) => a.time - b.time)[0];
    if (previous && next) splitEasing(previous, next, edited);
  }
  edited.time = at;
  edited.pins = new Map([...ids].map((id) => [id, snapshot.get(id) ?? [0, 0]]));
  // Drop duplicate keys in the same quantized frame; preserve other tracks on the retained key.
  clip.frames = clip.frames.filter((frame) => !matching.includes(frame) || frame === edited);
  if (matching.length === 0) clip.frames.push(edited);
  clip.frames.push(...boundaries);
  if (clip.loop && (at === 0 || at === duration)) {
    const otherEnd = clip.frames.find((frame) => frame.time === (at === 0 ? duration : 0));
    if (otherEnd) otherEnd.pins = new Map([...edited.pins].map(([id, value]) => [id, [...value] as Vec2]));
  }
  for (const frame of clip.frames) {
    for (const id of ids) {
      if (!frame.pins.has(id)) frame.pins.set(id, [0, 0]);
      if (frame.channels.length > 0 && !frame.channels.includes(`pin:${id}`) && !frame.channels.includes(id)) {
        frame.channels.push(`pin:${id}`);
      }
    }
  }
  sortClipFrames(clip);
}
