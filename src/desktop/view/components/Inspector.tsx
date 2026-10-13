import { For, Match, Show, Switch } from "solid-js";
import type { EditorController } from "../../../editor/controller";
import { Button, Icon, Notice, NumberField, Section, TextField, Toggle } from "./Primitives";

type ViewModel = ReturnType<EditorController["getViewModel"]>;
const degrees = (radians: number) => radians * 180 / Math.PI;
const radians = (angle: number) => angle * Math.PI / 180;

export function Inspector(props: { editor: EditorController; view: () => ViewModel; importImages: () => void; onClose: () => void; collapsed: boolean }) {
  const view = props.view;
  const state = () => view().state;
  const layer = () => view().selectedLayer;
  const layerDelta = () => layer() ? state().currentPose.layers.get(layer()!.id) : undefined;
  const pin = () => view().selectedPin;
  const joint = () => view().selectedJoint;
  const mesh = () => view().selectedMesh;
  const phase = () => view().phase;
  const pinDelta = () => pin() ? state().currentPose.pins.get(pin()!.id) ?? [0, 0] : [0, 0];
  const jointDelta = () => joint() ? state().currentPose.joints.get(joint()!.id) ?? { x: 0, y: 0, angle: 0 } : { x: 0, y: 0, angle: 0 };
  const pinProperties = () => <Show when={pin()}>{_selected => <>
    <Section title={phase() === "animate" ? "Controle da pose" : "Pino selecionado"}>
      <TextField label="Nome do pino" value={pin()!.name} onCommit={name => props.editor.dispatch({ type: "pin-properties", name })} />
      <div class="fields"><NumberField label={phase() === "animate" ? "Deslocamento X" : "Repouso X"} value={phase() === "animate" ? pinDelta()[0]! : pin()!.x} unit="px" disabled={phase() === "animate" && pin()!.locked} onCommit={x => props.editor.dispatch({ type: "pin-properties", x: phase() === "animate" ? pin()!.x + x : x })} /><NumberField label={phase() === "animate" ? "Deslocamento Y" : "Repouso Y"} value={phase() === "animate" ? pinDelta()[1]! : pin()!.y} unit="px" disabled={phase() === "animate" && pin()!.locked} onCommit={y => props.editor.dispatch({ type: "pin-properties", y: phase() === "animate" ? pin()!.y + y : y })} /></div>
      <Toggle label="Âncora fixa" value={pin()!.locked} onChange={() => props.editor.dispatch({ type: "pin-lock" })} detail="Mantém este pino na posição de repouso local." />
      <Toggle label="Participa da deformação" value={pin()!.enabled !== false} onChange={() => props.editor.dispatch({ type: "pin-properties", enabled: pin()!.enabled === false })} />
      <Show when={(mesh()?.deformation ?? "MLS") === "MLS"} fallback={<Notice>ARAP usa posições exatas. Raio e influência são controles do MLS.</Notice>}>
        <div class="fields"><NumberField label="Raio de influência" value={pin()!.radius ?? 0} min={0} max={4096} unit="px" onCommit={radius => props.editor.dispatch({ type: "pin-properties", radius })} /><NumberField label="Influência" value={pin()!.strength ?? 1} min={0} max={1} step={.05} onCommit={strength => props.editor.dispatch({ type: "pin-properties", strength })} /></div>
      </Show>
      <Show when={(mesh()?.deformation ?? "MLS") === "MLS"}><details class="pin-advanced"><summary>Influência avançada</summary><NumberField label="Queda da influência" value={pin()!.falloff ?? 1} min={.1} max={8} step={.1} onCommit={falloff => props.editor.dispatch({ type: "pin-properties", falloff })} /></details></Show><div class="row"><Button icon="arrows-counter-clockwise" title="Voltar o pino ao repouso" onClick={() => props.editor.dispatch({ type: "pin-reset" })}>Restaurar</Button><span class="grow" /><Button icon="trash" danger title="Excluir pino selecionado" onClick={() => props.editor.dispatch({ type: "pin-delete" })} /></div>
    </Section>
  </>}</Show>;
  const layerProperties = () => <Show when={layer()}>{_selected => <Section title="Transformação da camada" collapsible open={phase() === "prepare" || (phase() === "animate" && !pin() && !joint())}>
    <TextField label="Nome da camada" value={layer()!.name} onCommit={name => props.editor.dispatch({ type: "layer-properties", name })} />
    <div class="fields"><NumberField label={phase() === "animate" ? "Deslocamento X" : "Posição X"} value={phase() === "animate" ? layerDelta()?.x ?? 0 : layer()!.transform.pos[0]} unit="px" onCommit={x => props.editor.dispatch({ type: "layer-properties", x })} /><NumberField label={phase() === "animate" ? "Deslocamento Y" : "Posição Y"} value={phase() === "animate" ? layerDelta()?.y ?? 0 : layer()!.transform.pos[1]} unit="px" onCommit={y => props.editor.dispatch({ type: "layer-properties", y })} /><NumberField label="Escala X" value={phase() === "animate" ? layerDelta()?.sx ?? 1 : layer()!.transform.scale[0]} min={.01} max={20} step={.05} onCommit={sx => props.editor.dispatch({ type: "layer-properties", sx })} /><NumberField label="Escala Y" value={phase() === "animate" ? layerDelta()?.sy ?? 1 : layer()!.transform.scale[1]} min={.01} max={20} step={.05} onCommit={sy => props.editor.dispatch({ type: "layer-properties", sy })} /><NumberField label="Rotação" value={degrees(phase() === "animate" ? layerDelta()?.rotation ?? 0 : layer()!.transform.rotation)} step={1} unit="°" onCommit={value => props.editor.dispatch({ type: "layer-properties", rotation: radians(value) })} /><NumberField label="Opacidade" value={(phase() === "animate" ? layerDelta()?.opacity ?? 1 : layer()!.opacity) * 100} min={0} max={100} unit="%" onCommit={value => props.editor.dispatch({ type: "layer-properties", opacity: value / 100 })} /></div>
    <Toggle label="Visível" value={phase() === "animate" ? layerDelta()?.visible ?? true : layer()!.visible} onChange={() => props.editor.dispatch({ type: "layer-properties", visible: !(phase() === "animate" ? layerDelta()?.visible ?? true : layer()!.visible) })} /><Toggle label="Bloquear edição" value={layer()!.locked} onChange={() => props.editor.dispatch({ type: "layer-properties", locked: !layer()!.locked })} />
    <label><span class="field-label">Vincular à junta</span><select aria-label="Vincular camada à junta" value={layer()!.joint} onChange={event => props.editor.dispatch({ type: "layer-properties", joint: event.currentTarget.value })}><option value="">Sem vínculo</option><For each={state().joints.map(entry => entry.id)}>{id => <option value={id}>{state().joints.find(entry => entry.id === id)?.name}</option>}</For></select></label>
    <div class="row"><Button icon="arrow-up" title="Subir camada" onClick={() => props.editor.dispatch({ type: "layer-order", direction: 1 })} /><Button icon="arrow-down" title="Descer camada" onClick={() => props.editor.dispatch({ type: "layer-order", direction: -1 })} /><span class="grow" /><Button icon="trash" danger title="Excluir camada selecionada" onClick={() => props.editor.dispatch({ type: "layer-delete" })} /></div>
  </Section>}</Show>;
  const jointProperties = () => <Show when={joint()}>{_selected => <Section title={phase() === "animate" ? "Pose da junta" : "Junta selecionada"}>
    <TextField label="Nome da junta" value={joint()!.name} onCommit={name => props.editor.dispatch({ type: "joint-properties", name })} />
    <div class="fields"><NumberField label="Posição X" value={phase() === "animate" ? jointDelta().x : joint()!.x} unit="px" onCommit={x => props.editor.dispatch({ type: "joint-properties", x })} /><NumberField label="Posição Y" value={phase() === "animate" ? jointDelta().y : joint()!.y} unit="px" onCommit={y => props.editor.dispatch({ type: "joint-properties", y })} /><NumberField label="Rotação" value={degrees(jointDelta().angle)} unit="°" onCommit={value => props.editor.dispatch({ type: "joint-properties", angle: radians(value) })} /></div>
    <Show when={phase() !== "animate"}><label><span class="field-label">Junta pai</span><select aria-label="Junta pai" value={joint()!.parent} onChange={event => props.editor.dispatch({ type: "joint-properties", parent: event.currentTarget.value })}><option value="">Raiz</option><For each={state().joints.filter(entry => entry.id !== joint()!.id).map(entry => entry.id)}>{id => <option value={id}>{state().joints.find(entry => entry.id === id)?.name}</option>}</For></select></label></Show>
    <Toggle label="Cinemática inversa (IK)" value={state().ikEnabled} onChange={() => props.editor.dispatch({ type: "overlay", name: "ik" })} />
    <div class="row"><Button icon="bone" onClick={() => props.editor.dispatch({ type: "joint-add" })}>Adicionar filho</Button><span class="grow" /><Button icon="trash" danger title="Excluir junta selecionada" onClick={() => props.editor.dispatch({ type: "joint-delete" })} /></div>
  </Section>}</Show>;
  const meshProperties = () => <>
    <Section title="Deformação" detail={mesh() ? `${mesh()!.vertices.length} vértices` : "Sem malha"}>
      <div class="choice-group"><Button active={(mesh()?.deformation ?? "MLS") === "MLS"} disabled={!mesh()} testId="deformation-mls" onClick={() => props.editor.dispatch({ type: "deformation", value: "MLS" })}>MLS</Button><Button active={mesh()?.deformation === "ARAP"} disabled={!mesh()} testId="deformation-arap" onClick={() => props.editor.dispatch({ type: "deformation", value: "ARAP" })}>ARAP</Button></div>
      <Notice>{mesh()?.deformation === "ARAP" ? "Preserva a forma local entre controles. Malhas densas aumentam o custo de cálculo." : "Distribui a deformação pelo raio e pela influência de cada pino."}</Notice>
      <div class="row"><Button icon="push-pin" class="bordered grow" disabled={!mesh()} testId="auto-pins" onClick={() => props.editor.dispatch({ type: "auto-pins" })}>Sugerir pinos</Button><Button icon="magnet" active={state().snapPins} title="Ajustar pinos aos pixels opacos" onClick={() => props.editor.dispatch({ type: "overlay", name: "snap" })} /></div>
    </Section>
    <Section title="Construção da malha" collapsible open={phase() === "prepare" || (phase() === "animate" && !pin() && !joint())}>
      <div class="fields"><NumberField label="Linhas" value={state().meshRows} min={4} max={48} testId="mesh-rows" onCommit={rows => props.editor.dispatch({ type: "mesh-settings", rows })} /><NumberField label="Colunas" value={state().meshCols} min={4} max={48} testId="mesh-cols" onCommit={cols => props.editor.dispatch({ type: "mesh-settings", cols })} /></div>
      <Toggle label="Refinar a silhueta" value={state().refineEdges} testId="refine-edges" onChange={() => props.editor.dispatch({ type: "mesh-settings", refineEdges: !state().refineEdges })} />
      <div class="fields"><NumberField label="Célula no contorno" value={state().edgeSize} min={2} max={32} unit="px" testId="edge-size" disabled={!state().refineEdges} onCommit={edgeSize => props.editor.dispatch({ type: "mesh-settings", edgeSize })} /><NumberField label="Limiar alfa" value={state().alphaThreshold} min={1} max={255} onCommit={alphaThreshold => props.editor.dispatch({ type: "mesh-settings", alphaThreshold })} /></div>
      <NumberField label="Intensidade da deformação" disabled={!mesh()} value={mesh()?.strength ?? 1} min={0} max={1} step={.05} onCommit={strength => props.editor.dispatch({ type: "mesh-settings", strength })} /><Button icon="grid-four" class="bordered full-width" testId="rebuild-mesh" disabled={!mesh()} onClick={() => props.editor.dispatch({ type: "rebuild-mesh" })}>Reconstruir malha</Button>
      <Show when={mesh()?.buildStats?.budgetLimited}><Notice warning>Parte do contorno usa células maiores para respeitar o limite da malha.</Notice></Show>
      <span class="muted" style={{ "font-size": "9px" }}>{mesh()?.triangles.length ?? 0} triângulos · Pinos e animação preservados</span>
    </Section>
  </>;
  const motionProperties = () => <>
    <Section title="Movimento assistido" detail="Keyframes editáveis">
      <div class="preset-grid"><Button icon="pulse" active={state().motionPreset === "breath"} disabled={!view().hasSprite || !state().pins.length} testId="preset-breath" onClick={() => props.editor.dispatch({ type: "motion-preset", value: "breath" })}>Respirar</Button><Button icon="arrows-out-cardinal" active={state().motionPreset === "sway"} disabled={!view().hasSprite || !state().pins.length} testId="preset-sway" onClick={() => props.editor.dispatch({ type: "motion-preset", value: "sway" })}>Balançar</Button><Button icon="person-simple-walk" active={state().motionPreset === "walk"} disabled={!view().hasSprite || !state().pins.length} testId="preset-walk" onClick={() => props.editor.dispatch({ type: "motion-preset", value: "walk" })}>Caminhar</Button></div>
      <div class="fields"><NumberField label="Amplitude" value={state().motionAmplitude} min={0} max={200} unit="px" onCommit={amplitude => props.editor.dispatch({ type: "motion-settings", amplitude })} /><NumberField label="Frequência" value={state().motionFrequency} min={.1} max={6} step={.05} unit="Hz" onCommit={frequency => props.editor.dispatch({ type: "motion-settings", frequency })} /></div>
      <Notice>Escolha um preset após ajustar os parâmetros. A aplicação substitui o clipe atual e pode ser desfeita.</Notice>
    </Section>
    <Section title="Clipe" collapsible open>
      <TextField label="Nome do clipe" value={state().activeClip.name} onCommit={name => props.editor.dispatch({ type: "clip-settings", name })} />
      <div class="fields"><NumberField label="Duração" value={state().timelineDuration} min={.1} max={120} step={.1} unit="s" onCommit={duration => props.editor.dispatch({ type: "clip-settings", duration })} /><NumberField label="FPS" value={state().activeClip.fps} min={1} max={120} onCommit={fps => props.editor.dispatch({ type: "clip-settings", fps })} /></div>
      <Toggle label="Repetir animação" value={state().activeClip.loop} onChange={() => props.editor.dispatch({ type: "clip-settings", loop: !state().activeClip.loop })} />
      <div class="row"><Button icon="diamond" class="bordered grow" onClick={() => props.editor.dispatch({ type: "key-pose" })}>Inserir pose</Button><Button icon="crosshair" active={view().recording} disabled={!state().pins.length} title="Gravar movimento de um pino" onClick={() => props.editor.dispatch({ type: "record-gesture" })} /></div>
      <Show when={view().recording}><Notice warning>Gravação armada. Arraste um pino no palco para registrar o gesto.</Notice></Show>
    </Section>
  </>;
  return <aside class="panel inspector-panel" data-collapsed={props.collapsed} aria-label="Propriedades e ferramentas">
    <header class="panel-head"><Icon name="sliders-horizontal" />{phase() === "prepare" ? "Preparação" : phase() === "rig" ? "Rig e deformação" : "Animação"}<Button icon="x" class="compact-panel-toggle" title="Fechar propriedades" onClick={props.onClose} /></header>
    <div class="panel-scroll">
      <div class="inspector-heading"><div class="inspector-kind"><Icon name={pin() ? "push-pin" : joint() ? "bone" : layer() ? "image" : "bounding-box"} size={12} />{pin() ? "Pino" : joint() ? "Junta" : layer() ? "Camada" : "Documento"}</div><div class="inspector-name">{pin()?.name ?? joint()?.name ?? layer()?.name ?? "Canvas e personagem"}</div><div class="inspector-subtitle">{phase() === "animate" ? "Edite a pose; use keyframes para guardar o movimento." : "Prepare a estrutura e a posição de repouso."}</div></div>
      <Switch>
        <Match when={phase() === "prepare"}>
          <Section title="Imagem e canvas" detail={`${state().canvasWidth} × ${state().canvasHeight} px`}><Button icon="image" primary class="full-width" onClick={props.importImages}>Importar imagens PNG</Button><div class="fields"><NumberField label="Largura do canvas" value={state().canvasWidth} min={1} max={4096} unit="px" onCommit={width => props.editor.dispatch({ type: "canvas-settings", width })} /><NumberField label="Altura do canvas" value={state().canvasHeight} min={1} max={4096} unit="px" onCommit={height => props.editor.dispatch({ type: "canvas-settings", height })} /></div><Notice>As imagens entram como camadas independentes. A transparência define a malha.</Notice><Button icon="corners-out" class="bordered" onClick={() => props.editor.dispatch({ type: "fit" })}>Enquadrar canvas</Button></Section>
          <Show when={pin()}>{pinProperties()}</Show>{layerProperties()}{meshProperties()}
        </Match>
        <Match when={phase() === "rig"}>
          <Show when={pin()} fallback={<Show when={joint()}>{jointProperties()}</Show>}>{pinProperties()}</Show>
          {meshProperties()}{layerProperties()}
          <Section title="Estrutura de ossos" collapsible><div class="row"><Button icon="bone" class="bordered grow" onClick={() => props.editor.dispatch({ type: "joint-add" })}>Adicionar junta</Button><Button icon="tree-structure" title="Mostrar ossos no palco" active={state().showSkeleton} onClick={() => props.editor.dispatch({ type: "overlay", name: "skeleton" })} /></div><label><span class="field-label">Substituir estrutura por preset</span><select aria-label="Preset de esqueleto" value="" onChange={event => { if (event.currentTarget.value) props.editor.dispatch({ type: "rig-preset", value: event.currentTarget.value }); event.currentTarget.value = ""; }}><option value="">Escolher estrutura…</option><option value="Humanoid">Humanoide</option><option value="BipedSimple">Bípede simples</option><option value="Quadruped">Quadrúpede</option><option value="Prop">Objeto</option></select></label><Notice>Use vínculos de camada para associar as partes às juntas.</Notice></Section>
        </Match>
        <Match when={phase() === "animate"}>
          <Show when={pin()}>{pinProperties()}</Show><Show when={joint() && !pin()}>{jointProperties()}</Show>{layerProperties()}{motionProperties()}
          <Section title="Mais ferramentas" collapsible><Notice>Curvas gráficas, mistura de clipes e pintura de pesos ainda precisam de integração ao editor.</Notice><Button disabled title="Editor gráfico de curvas ainda não integrado" icon="pulse">Editor de curvas</Button><Button disabled title="Mistura de clipes ainda não integrada" icon="stack">Misturar movimentos</Button></Section>
        </Match>
      </Switch>
    </div>
  </aside>;
}
