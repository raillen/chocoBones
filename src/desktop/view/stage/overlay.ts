import { matApply } from "../../../core/math";
import { mat4Apply, mat4Mul, mat4Perspective } from "../../../core/math3d";
import { boneMatrices } from "../../../rig/fk";
import { pinWorldPoint } from "../../../ui/viewport/pin_space";
import type { AppState } from "../../../ui/store";
import type { StageFrame } from "./protocol";

// Phosphor regular/lock.svg, from the repository's licensed icon set.
const lockShape = "M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z";
let lockPath: Path2D | undefined;

function setup(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
  const context = canvas.getContext("2d")!;
  context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
  context.clearRect(0, 0, width, height);
  return context;
}

function scaleStep(zoom: number): number {
  let step = 32;
  while (step * zoom < 32) step *= 2;
  while (step * zoom > 96) step /= 2;
  return step;
}

export function drawStageBackground(canvas: HTMLCanvasElement, state: AppState, width: number, height: number): void {
  const ctx = setup(canvas, width, height);
  const zoom = state.cameraZoom;
  const pan = state.cameraPan;
  ctx.fillStyle = "#131a1e";
  ctx.fillRect(0, 0, width, height);
  const step = scaleStep(zoom) * zoom;
  ctx.strokeStyle = "#202a30";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ((pan.x % step) + step) % step; x < width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = ((pan.y % step) + step) % step; y < height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  if (state.viewportMode === "3D") return;
  const w = state.canvasWidth * zoom;
  const h = state.canvasHeight * zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(pan.x, pan.y, w, h);
  ctx.clip();
  ctx.fillStyle = "#1c262c";
  ctx.fillRect(pan.x, pan.y, w, h);
  const check = 16;
  const x0 = Math.floor(Math.max(0, -pan.x) / check);
  const y0 = Math.floor(Math.max(0, -pan.y) / check);
  const x1 = Math.ceil(Math.min(w, width - pan.x) / check);
  const y1 = Math.ceil(Math.min(h, height - pan.y) / check);
  ctx.fillStyle = "#222e35";
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if ((x + y) % 2 === 0) ctx.fillRect(pan.x + x * check, pan.y + y * check, check, check);
  }
  ctx.restore();
  ctx.strokeStyle = "#4b5b66";
  ctx.strokeRect(pan.x - 0.5, pan.y - 0.5, w + 1, h + 1);
}

export function drawStageOverlay(canvas: HTMLCanvasElement, state: AppState, frame: StageFrame | null, width: number, height: number): void {
  const ctx = setup(canvas, width, height);
  const pan = state.cameraPan;
  const zoom = state.cameraZoom;
  const screen = (x: number, y: number): [number, number] => [x * zoom + pan.x, y * zoom + pan.y];
  if (state.viewportMode === "3D") {
    const projection = mat4Perspective(Math.PI / 4, width / height, 0.1, 100);
    const transform = mat4Mul(state.orbitCamera.getViewMatrix(), projection);
    const points = state.mesh3D.vertices.map((vertex) => {
      const p = mat4Apply(transform, vertex.pos);
      return p[2] < -1 || p[2] > 1 ? null : [(p[0] * 0.5 + 0.5) * width, (-p[1] * 0.5 + 0.5) * height] as [number, number];
    });
    ctx.strokeStyle = "#52cdbf"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < state.mesh3D.indices.length; i += 3) {
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const p = points[state.mesh3D.indices[i + a!]!], q = points[state.mesh3D.indices[i + b!]!];
        if (p && q) { ctx.moveTo(...p); ctx.lineTo(...q); }
      }
    }
    ctx.stroke();
    ctx.fillStyle = "#8fa5af"; ctx.font = "11px Inter, system-ui, sans-serif";
    ctx.fillText(`${state.mesh3D.name} · ${state.mesh3D.vertices.length} vértices`, 24, height - 20);
    return;
  }
  if (frame) for (const draw of frame.draws) {
    if (draw.ghost || draw.layer !== state.selectedLayerId) continue;
    const layer = state.layers.find((item) => item.id === draw.layer);
    const packet = frame.packets.get(draw.key);
    if (!layer?.visible || !packet) continue;
    const positions: [number, number][] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < packet.vertices.length; i += 2) {
      const world = matApply(draw.matrix, [packet.vertices[i]!, packet.vertices[i + 1]!]);
      const point = screen(...world);
      positions.push(point);
      minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]);
      maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]);
    }
    if (state.showMesh) {
      ctx.strokeStyle = "rgba(65,201,193,.32)";
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      const edges = new Set<string>();
      for (let i = 0; i < packet.triangles.length; i += 3) for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const ia = packet.triangles[i + a!]!, ib = packet.triangles[i + b!]!;
        const edge = ia < ib ? `${ia}:${ib}` : `${ib}:${ia}`;
        if (edges.has(edge)) continue;
        edges.add(edge);
        const p = positions[ia], q = positions[ib];
        if (!p || !q) continue;
        ctx.moveTo(...p); ctx.lineTo(...q);
      }
      ctx.stroke();
    }
    if (Number.isFinite(minX)) {
      ctx.save();
      ctx.strokeStyle = "rgba(67,211,193,.7)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12);
      ctx.restore();
    }
  }
  if (state.showSkeleton) {
    const bones = boneMatrices(state.joints, state.currentPose);
    ctx.strokeStyle = "rgba(242,190,91,.8)";
    ctx.lineWidth = 2;
    for (const joint of state.joints) {
      const transform = bones.get(joint.id);
      const parent = bones.get(joint.parent);
      if (!transform) continue;
      const point = screen(transform.tx, transform.ty);
      if (parent) { ctx.beginPath(); ctx.moveTo(...screen(parent.tx, parent.ty)); ctx.lineTo(...point); ctx.stroke(); }
      const selected = joint.id === state.selectedJointId;
      ctx.beginPath(); ctx.arc(...point, selected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#f6dca6" : "#e7b868"; ctx.fill();
      ctx.strokeStyle = "#182329"; ctx.stroke(); ctx.strokeStyle = "rgba(242,190,91,.8)";
    }
  }
  for (const pin of state.pins) {
    const layer = state.layers.find((item) => state.meshLayer.get(item.id) === pin.meshId);
    if (pin.enabled === false || !layer?.visible || state.currentPose.layers.get(layer.id)?.visible === false || !state.spriteAssets.has(layer.asset)) continue;
    const selected = pin.id === state.selectedPinId;
    const [x, y] = screen(...pinWorldPoint(state, pin));
    if (selected && !pin.locked) {
      const mesh = state.meshes[Number(pin.meshId)];
      if (mesh?.deformation !== "ARAP" && (pin.radius ?? 0) > 0) {
        ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = "rgba(67,211,193,.22)";
        ctx.beginPath(); ctx.arc(x, y, pin.radius! * zoom, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    if (selected) {
      ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = "rgba(60,206,188,.18)"; ctx.fill();
      ctx.strokeStyle = "#68e2cf"; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(x, y, selected ? 6 : 5, 0, Math.PI * 2);
    ctx.fillStyle = pin.locked ? "#e8b767" : "#5bd6c4"; ctx.fill();
    ctx.strokeStyle = "#17252a"; ctx.lineWidth = 2; ctx.stroke();
    if (pin.locked) {
      lockPath ??= new Path2D(lockShape);
      ctx.save(); ctx.translate(x - 3.5, y - 3.5); ctx.scale(7 / 256, 7 / 256);
      ctx.fillStyle = "#372712"; ctx.fill(lockPath); ctx.restore();
    }
    if (selected) {
      ctx.font = "11px Inter, system-ui, sans-serif";
      const label = pin.name || pin.id;
      const textWidth = ctx.measureText(label).width;
      const labelX = Math.min(width - textWidth - 20, Math.max(4, x + 15));
      const labelY = Math.min(height - 20, Math.max(4, y - 11));
      ctx.fillStyle = "#24353d"; ctx.fillRect(labelX, labelY, textWidth + 14, 22);
      ctx.fillStyle = "#e1f2ed"; ctx.fillText(label, labelX + 7, labelY + 15);
    }
  }
  // Rulers have stable screen size and world-space marks as the view pans and zooms.
  ctx.fillStyle = "rgba(23,30,35,.94)"; ctx.fillRect(0, 0, width, 19); ctx.fillRect(0, 0, 19, height);
  ctx.strokeStyle = "#35434b"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(19, 19); ctx.lineTo(width, 19); ctx.moveTo(19, 19); ctx.lineTo(19, height); ctx.stroke();
  const worldStep = scaleStep(zoom);
  ctx.font = "9px ui-monospace, monospace"; ctx.fillStyle = "#778a94";
  for (let world = Math.ceil((19 - pan.x) / zoom / worldStep) * worldStep; world * zoom + pan.x < width; world += worldStep) {
    const x = world * zoom + pan.x;
    ctx.fillText(String(Math.round(world)), x + 3, 11); ctx.fillRect(x, 14, 1, 5);
  }
  for (let world = Math.ceil((19 - pan.y) / zoom / worldStep) * worldStep; world * zoom + pan.y < height; world += worldStep) {
    const y = world * zoom + pan.y;
    ctx.save(); ctx.translate(11, y - 3); ctx.rotate(-Math.PI / 2); ctx.fillText(String(Math.round(world)), 0, 0); ctx.restore();
    ctx.fillRect(14, y, 5, 1);
  }
}
