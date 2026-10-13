import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import type { EditorCommand, EditorController } from "../../editor/controller";
import type { DesktopHost } from "./runtime";
import { Stage } from "./components/Stage";
import { Inspector } from "./components/Inspector";
import { ProjectTree } from "./components/ProjectTree";
import { Timeline } from "./components/Timeline";
import { Button, Icon } from "./components/Primitives";
import "./styles.css";

function readLayout(key: string, fallback: number, min: number, max: number): number {
  try { const value = Number(localStorage.getItem(`chocobones.layout.${key}`)); return value >= min && value <= max ? value : fallback; } catch { return fallback; }
}

export function App(props: { editor: EditorController; host: DesktopHost }) {
  const [view, setView] = createSignal(props.editor.getViewModel());
  const [menu, setMenu] = createSignal<string | null>(null);
  const [error, setError] = createSignal("");
  const [focus, setFocus] = createSignal(false);
  const [inspectorClosed, setInspectorClosed] = createSignal(true);
  const [leftWidth, setLeftWidth] = createSignal(readLayout("left", 224, 160, 340));
  const [rightWidth, setRightWidth] = createSignal(readLayout("right", 292, 250, 390));
  const [timelineHeight, setTimelineHeight] = createSignal(readLayout("timeline", 206, 130, 440));
  let releaseResize: (() => void) | undefined;
  onCleanup(() => releaseResize?.());
  const unsubscribe = props.editor.subscribe(() => setView(props.editor.getViewModel()));
  onCleanup(unsubscribe);
  const state = () => view().state;
  const dispatch = (command: EditorCommand) => { try { props.editor.dispatch(command); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } };
  // UI controls share one error boundary while Stage retains the actual controller.
  const controls = Object.create(props.editor) as EditorController;
  controls.dispatch = dispatch;
  const run = async (action: () => unknown | Promise<unknown>) => { setMenu(null); setError(""); try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); } };
  const resizePanel = (event: PointerEvent, side: "left" | "right" | "timeline") => {
    event.preventDefault();
    releaseResize?.();
    const initial = side === "left" ? leftWidth() : side === "right" ? rightWidth() : timelineHeight();
    const start = side === "timeline" ? event.clientY : event.clientX;
    const move = (current: PointerEvent) => {
      const delta = (side === "timeline" ? current.clientY : current.clientX) - start;
      if (side === "left") setLeftWidth(Math.max(160, Math.min(340, initial + delta)));
      else if (side === "right") setRightWidth(Math.max(250, Math.min(390, initial - delta)));
      else setTimelineHeight(Math.max(130, Math.min(window.innerHeight * .5, initial - delta)));
    };
    const done = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", done); window.removeEventListener("pointercancel", done);
      try { localStorage.setItem(`chocobones.layout.${side}`, String(side === "left" ? leftWidth() : side === "right" ? rightWidth() : timelineHeight())); } catch { /* Ephemeral webviews can refuse storage. */ }
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", done); window.addEventListener("pointercancel", done);
    releaseResize = done;
  };
  onMount(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || event.repeat) return;
      if (target.closest("input,textarea,select,[contenteditable=true],dialog,[role=dialog]")) return;
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (command && key === "s") { event.preventDefault(); void run(() => props.host.saveProject(event.shiftKey)); }
      else if (command && key === "o") { event.preventDefault(); void run(props.host.openProject); }
      else if (command && key === "i") { event.preventDefault(); void run(props.host.importImages); }
      else if (command && key === "n") { event.preventDefault(); void run(props.host.newProject); }
      else if (command && (key === "z" || key === "y")) { event.preventDefault(); dispatch({ type: key === "y" || event.shiftKey ? "redo" : "undo" }); }
      else if (!command && event.key === "Enter" && (target === document.body || target.closest(".stage-area"))) { event.preventDefault(); dispatch({ type: "play" }); }
      else if (!command && key === "k") dispatch({ type: "key-pose" });
      else if (!command && key === "home") { event.preventDefault(); dispatch({ type: "seek", time: 0 }); }
      else if (!command && key === "f") dispatch({ type: "fit" });
      else if (!command && event.key === "Tab") { if (target === document.body) { event.preventDefault(); setFocus(value => !value); } }
      else if (!command && key === "m") dispatch({ type: "overlay", name: "mesh" });
      else if (!command && key === "v") dispatch({ type: "tool", value: "Move" });
      else if (!command && key === "p") dispatch({ type: "tool", value: "Pin" });
      else if (!command && key === "b") dispatch({ type: "tool", value: "Bone" });
      else if (!command && key === "h") dispatch({ type: "tool", value: "Pan" });
      else if (!command && (event.key === "Delete" || event.key === "Backspace")) { event.preventDefault(); dispatch({ type: "delete-selection" }); }
      else if (event.key === "Escape") { setMenu(null); setError(""); setInspectorClosed(true); }
    };
    const outside = (event: PointerEvent) => { if (!(event.target as HTMLElement).closest(".menu-container")) setMenu(null); };
    window.addEventListener("keydown", keydown); window.addEventListener("pointerdown", outside);
    onCleanup(() => { window.removeEventListener("keydown", keydown); window.removeEventListener("pointerdown", outside); });
  });
  const phases = [{ value: "prepare" as const, label: "Preparar", icon: "image", step: "01" }, { value: "rig" as const, label: "Rig", icon: "bone", step: "02" }, { value: "animate" as const, label: "Animar", icon: "film-strip", step: "03" }];
  const menuAction = (label: string, icon: string, action: () => void, shortcut?: string, disabled?: boolean) => <Button icon={icon} disabled={disabled} onClick={() => { setMenu(null); action(); }}>{label}<Show when={shortcut}><kbd>{shortcut}</kbd></Show></Button>;
  return <div class={`studio ${focus() ? "focus-mode" : ""}`} data-theme={state().themeMode} style={{ "--left-width": `${leftWidth()}px`, "--right-width": `${rightWidth()}px`, "--timeline-height": `${timelineHeight()}px` }}>
    <header class="app-header">
      <div class="brand"><Icon name="bone" size={22} /><span>chocoBones</span><small>Estúdio de animação</small></div>
      <nav class="main-menu" aria-label="Menu principal">
        <div class="menu-container"><Button class="menu-button" active={menu() === "file"} onClick={() => setMenu(value => value === "file" ? null : "file")}>Arquivo</Button><Show when={menu() === "file"}><div class="menu-popover" role="menu">
          {menuAction("Novo projeto", "file-plus", () => void run(props.host.newProject), "Ctrl N")}{menuAction("Abrir projeto…", "folder-open", () => void run(props.host.openProject), "Ctrl O")}{menuAction("Importar PNG…", "images", () => void run(props.host.importImages), "Ctrl I")}<div class="menu-rule" />{menuAction("Salvar projeto", "floppy-disk", () => void run(() => props.host.saveProject(false)), "Ctrl S")}{menuAction("Salvar como…", "floppy-disk-back", () => void run(() => props.host.saveProject(true)), "Ctrl Shift S")}<div class="menu-rule" />{menuAction("Exportar PNG…", "image", () => void run(props.host.exportPng))}{menuAction("Exportar spritesheet…", "film-strip", () => void run(props.host.exportSpritesheet))}
        </div></Show></div>
        <div class="menu-container"><Button class="menu-button" active={menu() === "edit"} onClick={() => setMenu(value => value === "edit" ? null : "edit")}>Editar</Button><Show when={menu() === "edit"}><div class="menu-popover" role="menu">{menuAction("Desfazer", "arrow-u-up-left", () => dispatch({ type: "undo" }), "Ctrl Z", !view().canUndo)}{menuAction("Refazer", "arrow-u-up-right", () => dispatch({ type: "redo" }), "Ctrl Shift Z", !view().canRedo)}<div class="menu-rule" />{menuAction("Restaurar pose", "arrows-counter-clockwise", () => dispatch({ type: "reset-pose" }))}{menuAction("Excluir seleção", "trash", () => dispatch({ type: "delete-selection" }), "Delete")}</div></Show></div>
        <div class="menu-container"><Button class="menu-button" active={menu() === "view"} onClick={() => setMenu(value => value === "view" ? null : "view")}>Exibir</Button><Show when={menu() === "view"}><div class="menu-popover" role="menu">{menuAction("Enquadrar canvas", "corners-out", () => dispatch({ type: "fit" }), "F")}{menuAction(focus() ? "Mostrar painéis" : "Focar no palco", "arrows-out-simple", () => setFocus(value => !value))}<div class="menu-rule" />{menuAction(`${state().showMesh ? "Ocultar" : "Mostrar"} malha`, "grid-four", () => dispatch({ type: "overlay", name: "mesh" }), "M")}{menuAction(`${state().showSkeleton ? "Ocultar" : "Mostrar"} ossos`, "bone", () => dispatch({ type: "overlay", name: "skeleton" }))}{menuAction(`${state().onionSkin ? "Ocultar" : "Mostrar"} onion skin`, "copy", () => dispatch({ type: "overlay", name: "onion" }))}</div></Show></div>
      </nav>
      <nav class="workflow-tabs" aria-label="Etapas de trabalho"><For each={phases}>{phase => <Button active={view().phase === phase.value} icon={phase.icon} title={`${phase.label}: ${phase.value === "prepare" ? "imagens, camadas e malha" : phase.value === "rig" ? "controles e estrutura" : "poses, movimento e timeline"}`} testId={`phase-${phase.value}`} onClick={() => { dispatch({ type: "phase", value: phase.value }); setInspectorClosed(false); }}><span class="step">{phase.step}</span>{phase.label}</Button>}</For></nav>
      <div class="header-actions"><Button icon="arrow-u-up-left" title="Desfazer (Ctrl Z)" testId="undo" disabled={!view().canUndo} onClick={() => dispatch({ type: "undo" })} /><Button icon="arrow-u-up-right" title="Refazer (Ctrl Shift Z)" testId="redo" disabled={!view().canRedo} onClick={() => dispatch({ type: "redo" })} /><span class="divider" /><label class="theme-control" title="Tema da interface"><span class="button icon-button" aria-hidden="true"><Icon name="paint-brush" /></span><select class="theme-select" aria-label="Tema da interface" value={state().themeMode} onChange={event => dispatch({ type: "theme", value: event.currentTarget.value as "Dark" | "Dim" | "Light" })}><option value="Dark">Escuro</option><option value="Dim">Cinza</option><option value="Light">Claro</option></select></label><Button icon="floppy-disk" class="header-save" title="Salvar projeto (Ctrl S)" testId="project-save" disabled={props.host.busy()} onClick={() => void run(() => props.host.saveProject(false))} /></div>
    </header>
    <div class="document-bar"><span class="document-tab"><Icon name="file-plus" size={14} /><span>{props.host.documentName()}</span></span><span class="muted" style={{ "font-size": "10px" }}>{state().canvasWidth} × {state().canvasHeight}</span><div class="document-actions"><Button icon="folder-open" title="Abrir projeto" testId="project-open" disabled={props.host.busy()} onClick={() => void run(props.host.openProject)} /><Button icon="images" title="Importar imagens PNG (Ctrl I)" testId="import-images" disabled={props.host.busy()} onClick={() => void run(props.host.importImages)}>Importar</Button><div class="menu-container"><Button icon="arrow-up" class="bordered" disabled={props.host.busy()} onClick={() => setMenu(value => value === "export" ? null : "export")}>Exportar<Icon name="caret-down" size={11} /></Button><Show when={menu() === "export"}><div class="menu-popover export-menu"><Button icon="image" testId="export-png" onClick={() => void run(props.host.exportPng)}>PNG da pose atual</Button><Button icon="film-strip" testId="export-spritesheet" onClick={() => void run(props.host.exportSpritesheet)}>Spritesheet da animação</Button></div></Show></div></div></div>
    <main class="workspace">
      <ProjectTree editor={controls} view={view} importImages={() => void run(props.host.importImages)} busy={props.host.busy()} />
      <div class="splitter left-splitter" role="separator" aria-label="Largura do projeto" aria-orientation="vertical" onPointerDown={event => resizePanel(event, "left")} />
      <section class="stage-shell" aria-label="Palco do personagem"><header class="stage-toolbar">
        <Button icon="cursor" active={state().activeTool === "Move"} title="Selecionar e mover (V)" onClick={() => dispatch({ type: "tool", value: "Move" })} /><Button icon="push-pin" active={state().activeTool === "Pin"} title="Criar ou mover pinos (P)" disabled={!view().hasSprite} onClick={() => dispatch({ type: "tool", value: "Pin" })} /><Button icon="bone" active={state().activeTool === "Bone"} title="Criar e mover juntas (B)" onClick={() => dispatch({ type: "tool", value: "Bone" })} /><Button icon="hand" active={state().activeTool === "Pan"} title="Mover a visão (H)" onClick={() => dispatch({ type: "tool", value: "Pan" })} /><span class="divider" /><div class="choice-group viewport-switch"><Button active={state().viewportMode === "2D"} title="Palco 2D" onClick={() => dispatch({ type: "viewport", value: "2D" })}>2D</Button><Button active={state().viewportMode === "3D"} title="Prévia 3D" onClick={() => dispatch({ type: "viewport", value: "3D" })}>3D</Button></div><span class="tool-title">{view().phase === "animate" ? "Pose" : "Repouso"}</span><span class="spacer" />
        <Button icon="grid-four" active={state().showMesh} title="Mostrar malha (M)" onClick={() => dispatch({ type: "overlay", name: "mesh" })} /><Button icon="bone" active={state().showSkeleton} title="Mostrar ossos" onClick={() => dispatch({ type: "overlay", name: "skeleton" })} /><Button icon="copy" active={state().onionSkin} title="Onion skin do quadro anterior" onClick={() => dispatch({ type: "overlay", name: "onion" })} /><span class="divider" /><Button icon="corners-out" title="Enquadrar canvas (F)" onClick={() => dispatch({ type: "fit" })} /><Button icon="arrows-out-simple" active={focus()} title="Focar no palco" onClick={() => setFocus(value => !value)} /><Button icon="sliders-horizontal" class="compact-panel-toggle" title="Abrir propriedades" active={!inspectorClosed()} onClick={() => setInspectorClosed(value => !value)} />
      </header><div class="stage-area"><Stage controller={props.editor} /></div><footer class="stage-status"><Icon name="cursor" size={12} /><span class="instruction">{view().recording ? "Arraste um pino livre para gravar o gesto" : state().activeTool === "Pin" ? "Clique na imagem para criar um pino; arraste para ajustar" : state().activeTool === "Bone" ? "Clique para adicionar juntas; arraste para editar" : "Arraste para editar · Roda para zoom · H para navegar"}</span><span class="zoom">{state().viewportMode === "3D" ? `Dist. ${state().orbitCamera.distance.toFixed(1)}` : `${Math.round(state().cameraZoom * 100)}%`}</span><Button icon="minus" compact title="Diminuir zoom" onClick={() => dispatch({ type: "zoom", factor: .8 })} /><Button icon="plus" compact title="Aumentar zoom" onClick={() => dispatch({ type: "zoom", factor: 1.25 })} /></footer></section>
      <div class="splitter right-splitter" role="separator" aria-label="Largura das propriedades" aria-orientation="vertical" onPointerDown={event => resizePanel(event, "right")} />
      <Inspector editor={controls} view={view} importImages={() => void run(props.host.importImages)} collapsed={inspectorClosed()} onClose={() => setInspectorClosed(true)} />
    </main>
    <div class="timeline-splitter" role="separator" aria-label="Altura da timeline" aria-orientation="horizontal" onPointerDown={event => resizePanel(event, "timeline")} />
    <Timeline editor={controls} view={view} />
    <footer class="status-bar" role="status"><Icon name={props.host.busy() ? "clock" : "check-circle"} size={12} /><span class="status-message">{props.host.status() || view().status}</span><span class="right">{state().pins.length} pinos · {view().selectedMesh?.vertices.length ?? 0} vértices</span><span class="divider" /><span>{state().activeClip.fps} FPS · {state().activeClip.loop ? "Loop" : "Reprodução única"}</span></footer>
    <Show when={error()}><div class="error-bar" role="alert"><Icon name="warning-circle" /><span>{error()}</span><Button icon="x" title="Fechar aviso" onClick={() => setError("")} /></div></Show>
  </div>;
}
