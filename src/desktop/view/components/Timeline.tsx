import { createMemo, createSignal, For, Show } from "solid-js";
import { Easing } from "../../../animation/timeline";
import type { EditorController, EditorTrack } from "../../../editor/controller";
import { Button, Icon, NumberField, Toggle } from "./Primitives";

type ViewModel = ReturnType<EditorController["getViewModel"]>;
type Track = EditorTrack;
const trackMap = (track: Track) => track.kind === "pin" ? "pins" as const : track.kind === "joint" ? "joints" as const : "layers" as const;

export function Timeline(props: { editor: EditorController; view: () => ViewModel }) {
  const state = () => props.view().state;
  const [scale, setScale] = createSignal(1);
  const [selectedKey, setSelectedKey] = createSignal("");
  const [dragTime, setDragTime] = createSignal<number | null>(null);
  const frames = () => state().activeClip.frames;
  const selectedFrame = () => frames().find(frame => frame.id === selectedKey());
  let labels!: HTMLDivElement;
  let lanes!: HTMLDivElement;
  const duration = () => Math.max(.05, state().timelineDuration);
  const tracks = createMemo(() => props.view().tracks.filter(track => track.kind === "pin" || track.keys.length || (track.kind === "joint" && track.id === state().selectedJointId) || (track.kind === "layer" && track.id === state().selectedLayerId)));
  const trackIds = createMemo(() => tracks().map(track => `${track.kind}:${track.id}`));
  const findTrack = (key: string) => tracks().find(track => `${track.kind}:${track.id}` === key)!;
  const isSelected = (track: Track) => track.kind === "pin" ? state().selectedPinId === track.id : track.kind === "joint" ? state().selectedJointId === track.id : state().selectedLayerId === track.id;
  const selectTrack = (track: Track) => props.editor.dispatch({ type: track.kind === "pin" ? "select-pin" : track.kind === "joint" ? "select-joint" : "select-layer", id: track.id });
  const trackIcon = (track: Track) => track.kind === "pin" ? state().pins.find(pin => pin.id === track.id)?.locked ? "lock" : "push-pin" : track.kind === "joint" ? "bone" : "stack";
  const seekPointer = (event: PointerEvent) => {
    const bounds = lanes.getBoundingClientRect();
    props.editor.dispatch({ type: "seek", time: Math.max(0, Math.min(duration(), (event.clientX - bounds.left) / bounds.width * duration())) });
  };
  const startSeek = (event: PointerEvent & { currentTarget: HTMLDivElement }) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    seekPointer(event);
  };
  const moveKey = (event: PointerEvent, id: string) => {
    event.preventDefault(); event.stopPropagation();
    const target = event.currentTarget as HTMLButtonElement;
    target.setPointerCapture(event.pointerId);
    setSelectedKey(id);
    const bounds = lanes.getBoundingClientRect();
    const next = Math.max(0, Math.min(duration(), (event.clientX - bounds.left) / bounds.width * duration()));
    setDragTime(next);
  };
  return <section class="timeline" aria-label="Timeline de animação">
    <header class="timeline-toolbar">
      <span class="timeline-title"><Icon name="film-strip" />Timeline</span><span class="clip-name">{state().activeClip.name}</span>
      <span class="divider" />
      <Button icon="skip-back" title="Ir ao início (Home)" onClick={() => props.editor.dispatch({ type: "seek", time: 0 })} />
      <Button icon={state().isPlaying ? "pause" : "play"} title={state().isPlaying ? "Pausar (Enter no palco)" : "Reproduzir (Enter no palco)"} active={state().isPlaying} testId="playback" onClick={() => props.editor.dispatch({ type: "play" })} />
      <Button icon="skip-forward" title="Ir ao final" onClick={() => props.editor.dispatch({ type: "seek", time: duration() })} />
      <span class="time-readout">{state().timelineTime.toFixed(2)} <span class="muted">/ {duration().toFixed(2)} s</span></span>
      <Button icon="diamond" title="Inserir keyframe da pose (K)" testId="key-pose" disabled={!props.view().hasSprite && state().joints.length === 0} onClick={() => props.editor.dispatch({ type: "key-pose" })}>Pose</Button>
      <Button icon="crosshair" title="Gravar um gesto ao arrastar um pino" active={props.view().recording} class={props.view().recording ? "recording" : ""} disabled={!props.view().hasSprite || state().pins.length === 0} testId="record-gesture" onClick={() => props.editor.dispatch({ type: "record-gesture" })} />
      <div class="timeline-settings">
        <NumberField label="Duração" value={duration()} min={.1} max={120} step={.1} unit="s" onCommit={value => props.editor.dispatch({ type: "clip-settings", duration: value })} />
        <NumberField label="FPS" value={state().activeClip.fps} min={1} max={120} onCommit={value => props.editor.dispatch({ type: "clip-settings", fps: value })} />
        <Toggle label="Loop" value={state().activeClip.loop} onChange={() => props.editor.dispatch({ type: "clip-settings", loop: !state().activeClip.loop })} />
      </div>
    </header>
    <div class="timeline-body">
      <div class="track-labels" ref={labels}><div class="ruler-spacer">TRILHAS <span class="grow" />{tracks().length}</div>
        <For each={trackIds()}>{id => { const track = () => findTrack(id); return <div role="button" tabIndex={0} class={`track-label ${isSelected(track()) ? "active" : ""}`} onClick={() => selectTrack(track())} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); selectTrack(track()); } }}><Icon name={trackIcon(track())} size={13} /><span>{track().name}</span></div>; }}</For>
        <Show when={tracks().length === 0}><div class="empty-state">Importe uma imagem ou adicione juntas para animar.</div></Show>
      </div>
      <div class="timeline-scroll" onScroll={event => { labels.scrollTop = event.currentTarget.scrollTop; }}>
        <div class="timeline-lanes" ref={lanes} style={{ width: `${scale() * 100}%` }}>
          <div class="timeline-ruler" role="slider" aria-label="Tempo da animação" aria-valuemin={0} aria-valuemax={duration()} aria-valuenow={state().timelineTime} tabIndex={0} data-testid="timeline-slider" onPointerDown={startSeek} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekPointer(event); }} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); props.editor.dispatch({ type: "seek", time: state().timelineTime + (event.key === "ArrowRight" ? 1 : -1) / state().activeClip.fps }); } }}>
            <For each={Array.from({ length: 9 }, (_, index) => index)}>{index => <span class="ruler-tick" style={{ left: `${index * 12.5}%` }}>{(duration() * index / 8).toFixed(2)}</span>}</For>
          </div>
          <For each={trackIds()}>{id => { const track = () => findTrack(id); return <div class={`timeline-lane ${isSelected(track()) ? "active" : ""}`} style={{ "background-size": "12.5% 100%" }} onPointerDown={startSeek} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekPointer(event); }}>
            <For each={frames().filter(frame => frame[trackMap(track())].has(track().id)).map(frame => frame.id)}>{id => { const initial = frames().find(frame => frame.id === id)!; const frame = () => frames().find(entry => entry.id === id) ?? initial; return <button class={`keyframe ${selectedKey() === frame().id ? "selected" : ""}`} style={{ left: `${(selectedKey() === frame().id && dragTime() !== null ? dragTime()! : frame().time) / duration() * 100}%` }} title={`${track().name} · ${frame().time.toFixed(3)} s · ${frame().easing}`} aria-label={`Keyframe ${track().name} em ${frame().time.toFixed(2)} segundos`} onPointerDown={event => moveKey(event, frame().id)} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { const bounds = lanes.getBoundingClientRect(); setDragTime(Math.max(0, Math.min(duration(), (event.clientX - bounds.left) / bounds.width * duration()))); } }} onPointerUp={event => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) { event.currentTarget.releasePointerCapture(event.pointerId); if (dragTime() !== null && Math.abs(dragTime()! - frame().time) > .001) props.editor.dispatch({ type: "key-move", id: frame().id, time: dragTime()! }); else props.editor.dispatch({ type: "seek", time: frame().time }); setDragTime(null); } }} onClick={event => { event.stopPropagation(); setSelectedKey(frame().id); }} />; }}</For>
          </div>; }}</For>
          <div class="playhead" style={{ left: `${state().timelineTime / duration() * 100}%` }} />
        </div>
      </div>
    </div>
    <footer class="timeline-footer"><Icon name="diamond" size={12} /><span>{frames().length} keyframes</span>
      <Show when={selectedFrame()} fallback={<span>Arraste keyframes para ajustar o tempo.</span>}>
        <span>Keyframe selecionado</span><select style={{ width: "92px", height: "20px", "font-size": "9px" }} aria-label="Interpolação do keyframe" value={selectedFrame()?.easing} onChange={event => props.editor.dispatch({ type: "key-easing", id: selectedKey(), value: event.currentTarget.value as Easing })}><option value="Smooth">Suave</option><option value="Linear">Linear</option><option value="Hold">Constante</option><option value="Bezier">Bézier</option></select>
        <Button icon="trash" compact title="Excluir keyframe selecionado" onClick={() => { props.editor.dispatch({ type: "key-delete", id: selectedKey() }); setSelectedKey(""); }} />
      </Show>
      <span class="right">Zoom</span><input aria-label="Zoom da timeline" type="range" min={1} max={4} step={.25} value={scale()} onInput={event => setScale(Number(event.currentTarget.value))} />
    </footer>
  </section>;
}
