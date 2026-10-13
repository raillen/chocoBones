import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import type { EditorController } from "../../../editor/controller";
import type { SpriteImage } from "../../../assets/image";
import { Button, Icon } from "./Primitives";

type ViewModel = ReturnType<EditorController["getViewModel"]>;

function Thumbnail(props: { image?: SpriteImage }) {
  let canvas!: HTMLCanvasElement;
  const image = createMemo(() => props.image);
  createEffect(() => {
    const sprite = image();
    const context = canvas.getContext("2d");
    if (!sprite || !context) return;
    const source = document.createElement("canvas"); source.width = sprite.width; source.height = sprite.height;
    source.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(sprite.pixels), sprite.width, sprite.height), 0, 0);
    context.clearRect(0, 0, 28, 32);
    const zoom = Math.min(26 / sprite.width, 30 / sprite.height);
    context.drawImage(source, (28 - sprite.width * zoom) / 2, (32 - sprite.height * zoom) / 2, sprite.width * zoom, sprite.height * zoom);
  });
  return <canvas ref={canvas} width={28} height={32} class="asset-thumbnail" aria-hidden="true" />;
}

export function ProjectTree(props: { editor: EditorController; view: () => ViewModel; importImages: () => void; busy: boolean }) {
  const [tab, setTab] = createSignal<"layers" | "joints" | "pins">("layers");
  const [filter, setFilter] = createSignal("");
  const [collapsed, setCollapsed] = createSignal(new Set<string>());
  const state = () => props.view().state;
  let lastPhase = "";
  let lastSelection = "";
  createEffect(() => {
    const document = props.view().state;
    const selection = document.selectedPinId ? `pin:${document.selectedPinId}` : document.selectedJointId ? `joint:${document.selectedJointId}` : document.selectedLayerId ? `layer:${document.selectedLayerId}` : "";
    if (selection && selection !== lastSelection) setTab(document.selectedPinId ? "pins" : document.selectedJointId ? "joints" : "layers");
    lastSelection = selection;
  });
  createEffect(() => { const phase = props.view().phase; if (phase !== lastPhase) { lastPhase = phase; setTab(phase === "prepare" ? "layers" : state().pins.length ? "pins" : "joints"); } });
  const assetLabel = (assetId: string) => state().layers.find(layer => layer.asset === assetId)?.name ?? "Imagem importada";
  const visibleName = (name: string) => name.toLocaleLowerCase().includes(filter().toLocaleLowerCase());
  const jointSignature = createMemo(() => JSON.stringify(state().joints.map(joint => [joint.id, joint.parent, joint.name])));
  const joints = createMemo(() => {
    jointSignature();
    const nodes = props.editor.state.joints;
    const result: { node: typeof nodes[number]; depth: number; children: boolean }[] = [];
    const visited = new Set<string>();
    const visit = (parent: string, depth: number, shown = true) => {
      for (const node of nodes.filter(entry => entry.parent === parent)) {
        if (visited.has(node.id)) continue;
        visited.add(node.id);
        const children = nodes.some(entry => entry.parent === node.id);
        if (shown && (visibleName(node.name) || filter() === "")) result.push({ node, depth, children });
        // Traverse hidden descendants too: the orphan fallback must not mistake
        // children of a collapsed joint for additional roots.
        visit(node.id, depth + 1, shown && (!collapsed().has(node.id) || Boolean(filter())));
      }
    };
    visit("", 0);
    for (const node of nodes) if (!visited.has(node.id) && visibleName(node.name)) result.push({ node, depth: 0, children: false });
    return result;
  });
  const choose = (kind: "select-layer" | "select-joint" | "select-pin", id: string) => props.editor.dispatch({ type: kind, id });
  return <aside class="panel project-panel" aria-label="Projeto, camadas e rig">
    <header class="panel-head"><Icon name="stack" />Projeto<small>{state().layers.length} camadas</small></header>
    <div class="panel-tabs" role="tablist" aria-label="Estrutura do personagem">
      <button type="button" role="tab" aria-selected={tab() === "layers"} class={tab() === "layers" ? "active" : ""} onClick={() => setTab("layers")}>Camadas</button><button type="button" role="tab" aria-selected={tab() === "joints"} class={tab() === "joints" ? "active" : ""} onClick={() => setTab("joints")}>Ossos</button><button type="button" role="tab" aria-selected={tab() === "pins"} class={tab() === "pins" ? "active" : ""} onClick={() => setTab("pins")}>Pinos</button>
    </div>
    <div class="tree-search"><Icon name="magnifying-glass-plus" size={13} /><input aria-label="Buscar no projeto" placeholder="Buscar no projeto" value={filter()} onInput={event => setFilter(event.currentTarget.value)} /><Show when={filter()}><Button icon="x" compact title="Limpar busca" onClick={() => setFilter("")} /></Show></div>
    <div class="panel-scroll">
      <Show when={tab() === "layers"}>
        <div class="tree-section-label"><Icon name="stack" size={12} />Hierarquia<span>{state().layers.length}</span></div>
        <For each={[...state().layers].reverse().filter(layer => visibleName(layer.name)).map(layer => layer.id)}>{id => { const layer = () => state().layers.find(entry => entry.id === id)!; const visible = () => layer().visible && state().currentPose.layers.get(id)?.visible !== false; const hiddenBind = () => props.view().phase === "animate" && !layer().visible; return <div role="button" tabIndex={0} class={`tree-row asset-row ${state().selection.selectedLayerIds.includes(layer().id) ? "selected" : ""} ${visible() ? "" : "hidden"}`} data-testid={`layer-${layer().id}`} onClick={event => props.editor.dispatch({ type: "select-layer", id: layer().id, extend: event.shiftKey })} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); choose("select-layer", layer().id); } }}>
          <Thumbnail image={state().spriteAssets.get(layer().asset)} /><span class="tree-label">{layer().name}<small>{state().spriteAssets.has(layer().asset) ? `${state().spriteAssets.get(layer().asset)!.width} × ${state().spriteAssets.get(layer().asset)!.height} · PNG` : layer().joint ? `Vínculo: ${state().joints.find(joint => joint.id === layer().joint)?.name ?? layer().joint}` : "Camada sem imagem"}</small></span>
          <Button icon={visible() ? "eye" : "eye-slash"} compact disabled={hiddenBind()} title={hiddenBind() ? `Mostre ${layer().name} em Preparar ou Rig antes de animar` : `${visible() ? "Ocultar" : "Mostrar"} ${layer().name}`} onClick={() => props.editor.dispatch({ type: "layer-properties", id: layer().id, visible: !visible() })} />
        </div>; }}</For>
        <Show when={state().layers.length === 0}><div class="empty-state"><Icon name="images" size={28} />Importe uma imagem inteira ou as partes do personagem.<br /><Button icon="plus" primary disabled={props.busy} onClick={props.importImages}>Importar PNG</Button></div></Show>
        <details class="asset-library" open><summary class="tree-section-label"><Icon name="folder-open" size={12} />Biblioteca de imagens<span>{state().spriteAssets.size}</span></summary><For each={[...state().spriteAssets.keys()].filter(name => visibleName(assetLabel(name)))}>{name => { const image = () => state().spriteAssets.get(name)!; return <div class="tree-row asset-row" title={assetLabel(name)}><Thumbnail image={image()} /><span class="tree-label">{assetLabel(name)}<small>{image().width} × {image().height} px</small></span></div>; }}</For></details>
      </Show>
      <Show when={tab() === "joints"}>
        <div class="tree-section-label"><Icon name="tree-structure" size={12} />Esqueleto<span>{state().joints.length}</span></div>
        <For each={joints()}>{entry => <div role="button" tabIndex={0} class={`tree-row ${state().selectedJointId === entry.node.id ? "selected" : ""}`} style={{ "padding-left": `${8 + Math.min(entry.depth, 7) * 11}px` }} data-testid={`joint-${entry.node.id}`} onClick={() => choose("select-joint", entry.node.id)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); choose("select-joint", entry.node.id); } }}>
          <Show when={entry.children} fallback={<span style={{ width: "17px", "flex-shrink": 0 }} />}><Button icon={collapsed().has(entry.node.id) ? "caret-right" : "caret-down"} compact title={`${collapsed().has(entry.node.id) ? "Expandir" : "Recolher"} ${entry.node.name}`} onClick={() => setCollapsed(previous => { const next = new Set(previous); if (next.has(entry.node.id)) next.delete(entry.node.id); else next.add(entry.node.id); return next; })} /></Show><Icon name="bone" size={13} /><span class="tree-label">{entry.node.name}</span>
        </div>}</For>
        <Show when={state().joints.length === 0}><div class="empty-state"><Icon name="bone" size={28} />Para personagens em partes, adicione juntas e vincule as camadas.<br /><Button icon="plus" onClick={() => props.editor.dispatch({ type: "joint-add" })}>Adicionar junta</Button></div></Show>
      </Show>
      <Show when={tab() === "pins"}>
        <div class="tree-section-label"><Icon name="push-pin" size={12} />Controles de deformação<span>{state().pins.length}</span></div>
        <For each={state().pins.filter(pin => visibleName(pin.name)).map(pin => pin.id)}>{id => { const pin = () => state().pins.find(entry => entry.id === id)!; return <div role="button" tabIndex={0} class={`tree-row ${state().selectedPinId === pin().id ? "selected" : ""} ${pin().enabled === false ? "hidden" : ""}`} data-testid={`pin-${pin().id}`} onClick={() => choose("select-pin", pin().id)} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); event.stopPropagation(); choose("select-pin", pin().id); } }}><Icon name={pin().locked ? "lock" : "push-pin"} size={14} /><span class="tree-label">{pin().name}</span><Button icon={pin().locked ? "lock" : "lock-open"} compact title={`${pin().locked ? "Liberar" : "Fixar"} ${pin().name}`} onClick={() => props.editor.dispatch({ type: "pin-lock", id: pin().id })} /></div>; }}</For>
        <Show when={state().pins.length === 0}><div class="empty-state"><Icon name="push-pin" size={28} />Crie controles no palco com a ferramenta Pino ou use a sugestão automática.<br /><Button disabled={!props.view().hasSprite} icon="plus" onClick={() => props.editor.dispatch({ type: "auto-pins" })}>Sugerir pinos</Button></div></Show>
      </Show>
    </div>
    <footer class="panel-footer"><Button icon="plus" title={tab() === "layers" ? "Importar imagens PNG" : tab() === "joints" ? "Adicionar junta" : "Sugerir pinos"} disabled={props.busy || (tab() === "pins" && !props.view().hasSprite)} onClick={() => tab() === "layers" ? props.importImages() : props.editor.dispatch({ type: tab() === "joints" ? "joint-add" : "auto-pins" })} /><Show when={tab() === "layers"}><Button icon="arrow-up" title="Subir camada selecionada" disabled={!state().selectedLayerId} onClick={() => props.editor.dispatch({ type: "layer-order", direction: 1 })} /><Button icon="arrow-down" title="Descer camada selecionada" disabled={!state().selectedLayerId} onClick={() => props.editor.dispatch({ type: "layer-order", direction: -1 })} /></Show><span class="grow" /><Button icon="trash" danger title="Excluir seleção" disabled={tab() === "layers" ? !state().selectedLayerId : tab() === "joints" ? !state().selectedJointId : !state().selectedPinId} onClick={() => props.editor.dispatch({ type: tab() === "layers" ? "layer-delete" : tab() === "joints" ? "joint-delete" : "pin-delete" })} /></footer>
  </aside>;
}
