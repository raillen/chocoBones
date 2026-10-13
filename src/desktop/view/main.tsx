import { render } from "solid-js/web";
import { ErrorBoundary } from "solid-js";
import { App } from "./App";
import { FileDialog } from "./FileDialog";
import { createRuntime } from "./runtime";

const root = document.getElementById("root");
if (!root) throw new Error("Elemento raiz do editor indisponível.");
const runtime = createRuntime();
render(() => <ErrorBoundary fallback={(error) => <div role="alert" style={{ padding: "24px", color: "#e7e7e7" }}><h2>Não foi possível abrir o editor</h2><p>{String(error)}</p><button onClick={() => location.reload()}>Reabrir</button></div>}>
  <App editor={runtime.editor} host={runtime.host} />
  <FileDialog runtime={runtime} />
</ErrorBoundary>, root);
if (import.meta.hot) import.meta.hot.dispose(() => runtime.dispose());
window.addEventListener("pagehide", () => runtime.dispose(), { once: true });
