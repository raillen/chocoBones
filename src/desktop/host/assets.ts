import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { SpriteImage } from "../../assets/image";
import { validateSpriteImage } from "../../assets/image";
import type { DesktopAsset } from "../shared";

export interface RegisteredAssetInput {
  id?: string;
  name: string;
  image: SpriteImage;
}

interface AssetResource {
  image: SpriteImage;
  bytes: number;
}

/** A session-local registry of immutable image resources; there is no file URL API. */
export class AssetRegistry {
  readonly token = randomBytes(24).toString("hex");
  private baseUrl: string;
  private readonly resources = new Map<string, AssetResource>();
  private readonly aliases = new Map<string, { name: string; hash: string }>();
  private bytes = 0;

  constructor(baseUrl = "http://127.0.0.1:0", readonly maxBytes = 256 * 1024 * 1024) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /** All inputs are validated before publishing any descriptor. Identical PNGs share storage. */
  registerMany(inputs: RegisteredAssetInput[]): DesktopAsset[] {
    const ids = new Set<string>();
    const pendingResources = new Map<string, SpriteImage>();
    const entries = inputs.map(({ id = `asset_${randomUUID()}`, name, image }) => {
      if (!id || ids.has(id)) throw new Error(`Asset duplicado: '${id}'.`);
      ids.add(id);
      validateSpriteImage(image);
      const hash = createHash("sha256").update(image.png).digest("hex");
      if (!this.resources.has(hash)) pendingResources.set(hash, image);
      return { id, name, hash };
    });
    const extraBytes = [...pendingResources.values()].reduce((sum, image) => sum + image.pixels.byteLength + image.png.byteLength, 0);
    if (this.bytes + extraBytes > this.maxBytes) throw new Error("As imagens excedem o limite de memória desta sessão (256 MiB). Reabra o aplicativo para liberar assets antigos.");
    for (const [hash, image] of pendingResources) {
      const stored: SpriteImage = {
        width: image.width, height: image.height,
        png: new Uint8Array(image.png), pixels: new Uint8ClampedArray(image.pixels),
      };
      const bytes = stored.pixels.byteLength + stored.png.byteLength;
      this.resources.set(hash, { image: stored, bytes });
      this.bytes += bytes;
    }
    for (const entry of entries) this.aliases.set(entry.id, { name: entry.name, hash: entry.hash });
    return entries.map((entry) => this.describe(entry.id)!);
  }

  get(id: string): SpriteImage | undefined {
    const alias = this.aliases.get(id);
    return alias ? this.resources.get(alias.hash)?.image : undefined;
  }

  describe(id: string): DesktopAsset | undefined {
    const alias = this.aliases.get(id);
    const image = alias ? this.resources.get(alias.hash)?.image : undefined;
    if (!alias || !image) return undefined;
    const resource = `${this.baseUrl}/${this.token}/${alias.hash}`;
    return { id, name: alias.name, width: image.width, height: image.height, pngUrl: `${resource}/png`, rgbaUrl: `${resource}/rgba` };
  }

  handleRequest(request: Request): Response {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Private-Network": "true",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };
    const url = new URL(request.url);
    const parts = url.pathname.split("/");
    const resource = parts.length === 4 && parts[1] === this.token ? this.resources.get(parts[2]!) : undefined;
    if (!resource || !["png", "rgba"].includes(parts[3]!)) return new Response("Asset não encontrado.", { status: 404 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return new Response("Método não permitido.", { status: 405, headers });
    const png = parts[3] === "png";
    const image = resource.image;
    // Decoders own ArrayBuffer-backed buffers. This assertion avoids incompatible
    // TS DOM/Node ArrayBufferLike overloads without copying the frame-size payload.
    const body = (png ? image.png : image.pixels) as unknown as BodyInit;
    return new Response(body, {
      headers: { ...headers, "Content-Type": png ? "image/png" : "application/octet-stream", "Content-Length": String(png ? image.png.byteLength : image.pixels.byteLength) },
    });
  }
}
