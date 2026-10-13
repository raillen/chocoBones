import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import type { EditorRuntime } from "./runtime";
import { Button } from "./components/Primitives";
import "./FileDialog.css";

export function FileDialog(props: { runtime: EditorRuntime }) {
  const [name, setName] = createSignal(""), [directory, setDirectory] = createSignal("");
  const [frames, setFrames] = createSignal(8), [columns, setColumns] = createSignal(4);
  const [overwrite, setOverwrite] = createSignal(false), [error, setError] = createSignal("");
  let input: HTMLInputElement | undefined;
  let modal: HTMLDialogElement | undefined;
  let unsavedModal: HTMLDialogElement | undefined;
  createEffect(() => {
    const dialog = props.runtime.fileDialog();
    if (dialog) { setName(dialog.name); setDirectory(dialog.directory); setError(""); setOverwrite(false); queueMicrotask(() => { if (modal && !modal.open) modal.showModal(); input?.focus(); input?.select(); }); }
  });
  createEffect(() => {
    if (props.runtime.unsavedDialog()) queueMicrotask(() => { if (unsavedModal && !unsavedModal.open) unsavedModal.showModal(); });
  });
  const decide = (choice: "save" | "discard" | "cancel") => { unsavedModal?.close(); props.runtime.closeUnsavedDialog(choice); };
  const cancel = () => { modal?.close(); props.runtime.closeFileDialog(null); };
  const keydown = (event: KeyboardEvent) => { if (props.runtime.fileDialog() && event.key === "Escape") { event.preventDefault(); cancel(); } };
  window.addEventListener("keydown", keydown); onCleanup(() => window.removeEventListener("keydown", keydown));
  const submit = () => {
    const dialog = props.runtime.fileDialog(); if (!dialog) return;
    if (!name().trim() || /[\\/\0]/.test(name())) { setError("Informe um nome de arquivo sem separadores de caminho."); return; }
    if (dialog.native && !directory().trim()) { setError("Escolha a pasta de destino."); return; }
    const filename = name().endsWith(dialog.extension) ? name() : name() + dialog.extension;
    modal?.close();
    props.runtime.closeFileDialog({ name: filename, directory: directory(), frames: Math.max(1, Math.min(120, Math.round(frames()))), columns: Math.max(1, Math.min(16, Math.round(columns()))), overwrite: overwrite() });
  };
  return <><Show when={props.runtime.unsavedDialog()}>{dialog => <div class="file-dialog-backdrop" data-theme={props.runtime.editor.state.themeMode}><dialog ref={unsavedModal} class="file-dialog" aria-labelledby="unsaved-dialog-title" onCancel={event => { event.preventDefault(); decide("cancel"); }}>
    <h2 id="unsaved-dialog-title">Salvar alterações?</h2><p>Este projeto tem alterações não salvas. Salve antes de {dialog().action}.</p>
    <footer><Button testId="unsaved-cancel" onClick={() => decide("cancel")}>Cancelar</Button><Button testId="unsaved-discard" onClick={() => decide("discard")}>Descartar</Button><Button class="primary" testId="unsaved-save" onClick={() => decide("save")}>Salvar</Button></footer>
  </dialog></div>}</Show><Show when={props.runtime.fileDialog()}>{dialog => <div class="file-dialog-backdrop" data-theme={props.runtime.editor.state.themeMode}><dialog ref={modal} class="file-dialog" aria-labelledby="file-dialog-title" onCancel={event => { event.preventDefault(); cancel(); }}><form onSubmit={event => { event.preventDefault(); submit(); }}>
    <header><h2 id="file-dialog-title">{dialog().title}</h2><Button icon="x" title="Cancelar" onClick={cancel} /></header>
    <label>Nome do arquivo<input ref={input} data-testid="file-dialog-name" value={name()} onInput={event => setName(event.currentTarget.value)} /></label>
    <Show when={dialog().native}><label>Pasta de destino<div class="file-directory"><input value={directory()} onInput={event => setDirectory(event.currentTarget.value)} placeholder="Escolha uma pasta" /><Button icon="folder-open" title="Escolher pasta" onClick={() => void props.runtime.chooseDirectory().then(value => { if (value) setDirectory(value); }).catch(reason => setError(String(reason)))} /></div></label>
      <label class="file-overwrite"><input type="checkbox" checked={overwrite()} onChange={event => setOverwrite(event.currentTarget.checked)} />Permitir substituir um arquivo existente</label>
    </Show>
    <Show when={dialog().spritesheet}><div class="file-export-settings"><label>Quadros<input type="number" min="1" max="120" value={frames()} onInput={event => setFrames(Number(event.currentTarget.value))} /></label><label>Colunas<input type="number" min="1" max="16" value={columns()} onInput={event => setColumns(Number(event.currentTarget.value))} /></label></div></Show>
    <Show when={!dialog().native}><p>O arquivo será baixado pelo navegador.</p></Show><Show when={error()}><p role="alert">{error()}</p></Show>
    <footer><Button onClick={cancel}>Cancelar</Button><button class="button primary" type="submit" data-testid="file-dialog-confirm">{dialog().exporting ? "Exportar" : "Salvar"}</button></footer>
  </form></dialog></div>}</Show></>;
}
