import { AssetRegistry } from "./assets";

/** Binary image transport bound only to loopback, with an unguessable session token. */
export function startAssetServer(registry = new AssetRegistry()) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => registry.handleRequest(request),
  });
  registry.setBaseUrl(`http://127.0.0.1:${server.port}`);
  return { registry, stop: () => server.stop(true) };
}
