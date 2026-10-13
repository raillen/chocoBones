import { createEffect, createSignal, JSX, Show } from "solid-js";

export function Icon(props: { name: string; size?: number; class?: string }) {
  return <span aria-hidden="true" class={`icon ${props.class ?? ""}`} style={{ width: `${props.size ?? 16}px`, height: `${props.size ?? 16}px`, "mask-image": `url(./icons/phosphor/svg/regular/${props.name}.svg)`, "-webkit-mask-image": `url(./icons/phosphor/svg/regular/${props.name}.svg)` }} />;
}

export function Button(props: { children?: JSX.Element; icon?: string; title?: string; disabled?: boolean; active?: boolean; primary?: boolean; danger?: boolean; compact?: boolean; onClick?: () => void; class?: string; testId?: string }) {
  return <button type="button" class={`button ${props.children ? "" : "icon-button"} ${props.primary ? "primary" : ""} ${props.active ? "active" : ""} ${props.danger ? "danger" : ""} ${props.compact ? "compact" : ""} ${props.class ?? ""}`} title={props.title} aria-label={props.title} aria-pressed={props.active === undefined ? undefined : props.active} disabled={props.disabled} onClick={props.onClick} data-testid={props.testId}>
    <Show when={props.icon}><Icon name={props.icon!} /></Show>{props.children}
  </button>;
}

export function NumberField(props: { label: string; value: number; min?: number; max?: number; step?: number; unit?: string; disabled?: boolean; onCommit: (value: number) => void; testId?: string }) {
  const [draft, setDraft] = createSignal(String(props.value));
  let input!: HTMLInputElement;
  createEffect(() => { if (document.activeElement !== input) setDraft(String(Math.round(props.value * 1000) / 1000)); });
  const commit = () => {
    const number = Number(draft());
    if (draft().trim() && Number.isFinite(number)) props.onCommit(Math.max(props.min ?? -Infinity, Math.min(props.max ?? Infinity, number)));
    else setDraft(String(props.value));
  };
  return <label class="number-field"><span>{props.label}</span><span class="field-input"><input ref={input} aria-label={props.label} type="number" value={draft()} min={props.min} max={props.max} step={props.step ?? 1} disabled={props.disabled} onInput={event => setDraft(event.currentTarget.value)} onBlur={commit} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} data-testid={props.testId} /><Show when={props.unit}><small>{props.unit}</small></Show></span></label>;
}

export function TextField(props: { label: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = createSignal(props.value);
  createEffect(() => setDraft(props.value));
  return <label class="text-field"><span>{props.label}</span><input aria-label={props.label} value={draft()} onInput={event => setDraft(event.currentTarget.value)} onBlur={() => { if (draft().trim() && draft() !== props.value) props.onCommit(draft().trim()); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
}

export function Toggle(props: { label: string; value: boolean; onChange: () => void; disabled?: boolean; detail?: string; testId?: string }) {
  return <label class="toggle-row" title={props.detail}><input type="checkbox" checked={props.value} disabled={props.disabled} onChange={props.onChange} data-testid={props.testId} /><span>{props.label}</span><Show when={props.detail}><Icon name="info" size={13} /></Show></label>;
}

export function Section(props: { title: string; detail?: string; children: JSX.Element; open?: boolean; collapsible?: boolean; action?: JSX.Element }) {
  const [opened, setOpened] = createSignal(props.open ?? false);
  const content = <><header class="section-header"><span>{props.title}</span><Show when={props.detail}><small>{props.detail}</small></Show>{props.action}</header><div class="section-content">{props.children}</div></>;
  return props.collapsible ? <details class="inspector-section" open={opened()} onToggle={event => setOpened(event.currentTarget.open)}><summary>{props.title}<Icon name="caret-down" size={13} /></summary><div class="section-content">{props.children}</div></details> : <section class="inspector-section">{content}</section>;
}

export function Notice(props: { children: JSX.Element; warning?: boolean }) {
  return <div class={`notice ${props.warning ? "warning" : ""}`}><Icon name={props.warning ? "warning-circle" : "info"} size={14} /><span>{props.children}</span></div>;
}
