import { onCleanup, onMount, createSignal, Show } from "solid-js";
import type { EditorController } from "../../../editor/controller";
import { DeformationQueue } from "../stage/deformation";
import { CpuStageRenderer, GpuStageRenderer } from "../stage/renderer";
import { drawStageBackground, drawStageOverlay } from "../stage/overlay";
import type { StageFrame } from "../stage/protocol";

export function Stage(props: { controller: EditorController }) {
  let container!: HTMLDivElement;
  let background!: HTMLCanvasElement;
  let artwork!: HTMLCanvasElement;
  let overlay!: HTMLCanvasElement;
  let renderer: GpuStageRenderer | CpuStageRenderer | null = null;
  let queue: DeformationQueue | null = null;
  let frame: StageFrame | null = null;
  let width = 1, height = 1;
  let dirty = true;
  let solveDirty = true;
  let space = false;
  let activePointer: number | null = null;
  let rendered = 0;
  const [error, setError] = createSignal("");

  const point = (event: PointerEvent | WheelEvent): [number, number] => {
    const rect = container.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  };
  const render = () => {
    const state = props.controller.state;
    drawStageBackground(background, state, width, height);
    renderer?.render(state, frame, width, height);
    drawStageOverlay(overlay, state, frame, width, height);
    artwork.dataset.renderer = renderer?.mode ?? "";
    artwork.dataset.renderedRevision = String(rendered);
    artwork.dataset.solveMs = String(frame?.elapsedMs ?? 0);
    artwork.dataset.vertexCount = String(frame ? [...frame.packets.values()].reduce((sum, item) => sum + item.vertices.length / 2, 0) : 0);
    dirty = false;
  };

  onMount(() => {
    try { renderer = new GpuStageRenderer(artwork); }
    catch {
      // A failed WebGL context can make that canvas unavailable to Canvas2D.
      // Replace it in place before creating the software renderer.
      const replacement = artwork.cloneNode(false) as HTMLCanvasElement;
      artwork.replaceWith(replacement);
      artwork = replacement;
      renderer = new CpuStageRenderer(artwork);
    }
    queue = new DeformationQueue((ready) => {
      frame = ready;
      rendered++;
      setError("");
      dirty = true;
    }, setError);
    const detachPicking = props.controller.setPickGeometryProvider((layerId) => {
      const packet = frame?.packets.get(layerId);
      if (!packet) return undefined;
      const matrix = frame?.draws.find((draw) => draw.layer === layerId && !draw.ghost)?.matrix;
      return { ...packet, matrix };
    });
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.round(rect.width));
      const nextHeight = Math.max(1, Math.round(rect.height));
      const changed = nextWidth !== width || nextHeight !== height;
      width = nextWidth; height = nextHeight;
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      for (const canvas of [background, artwork, overlay]) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      if (changed) props.controller.resize(width, height);
      dirty = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    window.addEventListener("resize", resize);
    const unsubscribe = props.controller.subscribe(() => { dirty = true; solveDirty = true; });
    let request = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      if (props.controller.state.isPlaying) props.controller.tick(dt);
      if (solveDirty) { queue?.request(props.controller.state); solveDirty = false; }
      if (dirty) render();
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    const snapshot = () => render();
    artwork.addEventListener("stage:snapshot", snapshot);
    const keyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.target instanceof HTMLElement)) return;
      const target = event.target;
      if (target.closest("input,textarea,select,button,[role=button],dialog,[role=dialog],[contenteditable=true]")) return;
      if (target !== document.body && !container.contains(target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        if (event.repeat) return;
        space = true; container.style.cursor = "grab";
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") { space = false; container.style.cursor = ""; }
    };
    const cancel = () => {
      space = false;
      if (activePointer !== null) props.controller.pointerUp();
      activePointer = null;
      container.style.cursor = "";
    };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", cancel);
    // Non-passive wheel ensures browser page zoom/scroll cannot move the desktop editor.
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
      props.controller.zoom(Math.exp(-event.deltaY * units * 0.0015), point(event));
    };
    container.addEventListener("wheel", wheel, { passive: false });
    onCleanup(() => {
      cancelAnimationFrame(request);
      observer.disconnect(); unsubscribe(); queue?.dispose(); renderer?.dispose();
      detachPicking();
      window.removeEventListener("resize", resize);
      artwork.removeEventListener("stage:snapshot", snapshot);
      container.removeEventListener("wheel", wheel);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", cancel);
    });
  });

  return <div ref={container} class="stage-canvas-container" data-testid="stage" tabIndex={0}
    style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", "touch-action": "none", outline: "none" }}
    onContextMenu={(event) => event.preventDefault()}
    onPointerDown={(event) => {
      if (activePointer !== null) return;
      container.focus({ preventScroll: true });
      activePointer = event.pointerId;
      container.setPointerCapture(event.pointerId);
      const pan = space || event.button === 1 || event.button === 2;
      if (pan) container.style.cursor = "grabbing";
      props.controller.pointerDown(...point(event), { pan, button: event.button });
      event.preventDefault();
    }}
    onPointerMove={(event) => { if (activePointer === event.pointerId) props.controller.pointerMove(...point(event)); }}
    onPointerUp={(event) => {
      if (activePointer !== event.pointerId) return;
      props.controller.pointerUp(); activePointer = null;
      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
      container.style.cursor = space ? "grab" : "";
    }}
    onPointerCancel={(event) => { if (activePointer === event.pointerId) { props.controller.pointerUp(); activePointer = null; container.style.cursor = ""; } }}>
    <canvas ref={background} aria-hidden="true" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", "pointer-events": "none" }} />
    <canvas ref={artwork} data-testid="stage-canvas" aria-label="Personagem e malha deformada" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", "pointer-events": "none" }} />
    <canvas ref={overlay} data-testid="stage-overlay" aria-hidden="true" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", "pointer-events": "none" }} />
    <Show when={error()}><div role="alert" class="stage-error" style={{ position: "absolute", bottom: "16px", left: "28px", padding: "10px 14px", background: "#452b27", color: "#f3c1b6", "border-radius": "6px", "max-width": "calc(100% - 56px)" }}>{error()}
      <button type="button" onClick={() => queue?.retry()} style={{ "margin-left": "12px", cursor: "pointer" }}>Tentar novamente</button>
    </div></Show>
  </div>;
}

export default Stage;
