#!/usr/bin/env node
/** Mechanical PNG extraction: isolate alpha components, trim margins, preserve original RGBA. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  const bundled = process.env.CHOCOBONES_SHARP_PATH || '/home/raillen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp';
  sharp = require(bundled);
}

const sheetDefinitions = [
  {
    id: 'humans', path: 'sheets/humans.png', columns: 3, rows: 2,
    items: [
      ['scout', 'Batedor', 'humans'], ['medic', 'Médica', 'humans'],
      ['mechanic', 'Mecânica', 'humans'], ['ranger', 'Patrulheiro', 'humans'],
      ['hazmat-researcher', 'Pesquisadora com traje de proteção', 'humans'],
      ['winter-explorer', 'Explorador polar', 'humans'],
    ],
  },
  {
    id: 'animals', path: 'sheets/animals.png', columns: 3, rows: 2,
    items: [
      ['wolf', 'Lobo', 'animals'], ['boar', 'Javali', 'animals'],
      ['deer', 'Cervo', 'animals'], ['hare', 'Lebre', 'animals'],
      ['fox', 'Raposa', 'animals'], ['plated-lizard', 'Lagarto com placas', 'animals'],
    ],
  },
  {
    id: 'wardrobe-equipment', path: 'sheets/wardrobe-equipment.png', columns: 6, rows: 4,
    items: [
      ['shirt', 'Camisa', 'clothing'], ['medic-jacket', 'Jaqueta médica', 'clothing'],
      ['coverall', 'Macacão', 'clothing'], ['tactical-vest', 'Colete tático', 'clothing'],
      ['cold-parka', 'Parka polar', 'clothing'], ['cargo-trousers', 'Calça cargo', 'clothing'],
      ['boots', 'Botas', 'clothing'], ['gloves', 'Luvas', 'clothing'],
      ['ballistic-helmet', 'Capacete balístico', 'equipment'],
      ['hazard-helmet', 'Capacete de proteção', 'equipment'], ['gas-mask', 'Máscara de gás', 'equipment'],
      ['goggles', 'Óculos de proteção', 'equipment'], ['backpack', 'Mochila', 'equipment'],
      ['satchel', 'Bolsa de campo', 'equipment'], ['utility-belt', 'Cinto utilitário', 'equipment'],
      ['scanner', 'Scanner', 'equipment'], ['canteen', 'Cantil', 'equipment'],
      ['medkit', 'Kit médico', 'equipment'], ['hatchet', 'Machadinha', 'tools'],
      ['pickaxe', 'Picareta', 'tools'], ['knife', 'Faca', 'tools'],
      ['hunting-rifle', 'Rifle de caça', 'weapons'], ['energy-carbine', 'Carabina de energia', 'weapons'],
      ['sidearm', 'Pistola', 'weapons'],
    ],
  },
];

const args = process.argv.slice(2);
const help = args.includes('--help');
let assignmentsPath;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') continue;
  if (args[i] === '--assign' && args[i + 1]) { assignmentsPath = path.resolve(args[++i]); continue; }
  throw new Error(`Argumento desconhecido ou incompleto: ${args[i]}`);
}
if (help) {
  console.log(`Uso: node assets/test-kits/frontier-survival/tools/package-kit.mjs [--assign arquivo.json]

O isolamento usa núcleos alpha >= 16, conectividade 8 e padding transparente de 4 px.
TODOS os pixels alpha > 0 são copiados para o núcleo mais próximo, sem alterar RGBA.
As grades 3×2, 3×2 e 6×4 apenas sugerem IDs pelo centro dos componentes principais.
--assign permite revisar IDs dos componentes sem modificar a arte:
  {"animals":{"1":"wolf"},"wardrobe-equipment":{"7":"gloves"}}
Os IDs de componentes estão no manifest de cada fonte, na ordem de varredura.
O comando recusa alpha ausente, itens vazios e arte visível na borda da fonte.
Halos com alpha 1–2 nas bordas são preservados e registrados como avisos.
As fontes em vector-rig/ são lidas para o catálogo e nunca modificadas.`);
  process.exit(0);
}

function inspectAlpha(data, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  let transparent = 0, translucent = 0, opaque = 0;
  let edgePixels = 0, edgeAlphaMax = 0;
  const contact = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha === 0) { transparent++; continue; }
      if (alpha < 255) translucent++; else opaque++;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      if (x === 0) contact.add('left');
      if (x === width - 1) contact.add('right');
      if (y === 0) contact.add('top');
      if (y === height - 1) contact.add('bottom');
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) { edgePixels++; edgeAlphaMax = Math.max(edgeAlphaMax, alpha); }
    }
  }
  return {
    transparent_pixels: transparent, translucent_pixels: translucent, opaque_pixels: opaque,
    has_alpha_below_255: transparent + translucent > 0,
    has_fully_transparent_pixels: transparent > 0,
    nontransparent_bbox: maxX < 0 ? null : { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    edge_contact: [...contact],
    edge_contact_pixels: edgePixels, edge_alpha_max: edgeAlphaMax,
  };
}

function suggestedAnchor(id, category, size, visibleBbox) {
  const bbox = visibleBbox || { left: 0, top: 0, ...size };
  const w = bbox.width, h = bbox.height;
  let kind = 'center', x = bbox.left + (w - 1) / 2, y = bbox.top + (h - 1) / 2;
  let reason = 'Centro geométrico da arte com alpha >= 16; ajustar à montagem e ao ponto de anexação.';
  if (category === 'humans' || category === 'animals') {
    kind = 'base-center-ground'; y = bbox.top + h - 1;
    reason = 'Centro inferior da arte com alpha >= 16 como âncora de solo; não é um pivô anatômico.';
  } else if (category === 'tools') {
    kind = 'grip-guess'; x = bbox.left + (w - 1) * 0.55; y = bbox.top + (h - 1) * 0.75;
    reason = 'Palpite de empunhadura; posição depende da orientação desenhada e exige calibração manual.';
  } else if (category === 'weapons') {
    kind = 'grip-guess'; x = bbox.left + (w - 1) * 0.6; y = bbox.top + (h - 1) * 0.65;
    reason = 'Palpite de empunhadura; calibrar o cabo/gatilho visualmente antes do rig.';
  }
  return { kind, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, basis: 'visible_bbox_alpha16', calibrated: false, status: 'suggestion-only', note: reason };
}

function components8(raw, width, height, threshold = 16) {
  const labels = new Int32Array(width * height);
  const queue = new Int32Array(width * height);
  const components = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || raw[start * 4 + 3] < threshold) continue;
    const id = components.length + 1;
    let head = 0, tail = 1, area = 0, sumX = 0, sumY = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    queue[0] = start; labels[start] = id;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width, y = Math.floor(pixel / width);
      area++; sumX += x; sumY += y;
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const neighbor = ny * width + nx;
          if (labels[neighbor] || raw[neighbor * 4 + 3] < threshold) continue;
          labels[neighbor] = id; queue[tail++] = neighbor;
        }
      }
    }
    components.push({ id, area, centroid: { x: sumX / area, y: sumY / area }, bbox: { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 } });
  }
  return { labels, components };
}

/** Exact squared Euclidean distance transform; carries the nearest core's asset index. */
function nearestCoreOwners(seedOwners, width, height) {
  const infinity = Number.POSITIVE_INFINITY;
  const rowDistances = new Float64Array(width * height);
  const rowOwners = new Uint16Array(width * height);
  const result = new Uint16Array(width * height);
  function lineTransform(distances, owners) {
    const n = distances.length, sites = new Int32Array(n), breaks = new Float64Array(n + 1);
    const outDistances = new Float64Array(n), outOwners = new Uint16Array(n);
    const valid = [];
    for (let q = 0; q < n; q++) if (Number.isFinite(distances[q])) valid.push(q);
    if (!valid.length) { outDistances.fill(infinity); return { distances: outDistances, owners: outOwners }; }
    let k = 0; sites[0] = valid[0]; breaks[0] = -infinity; breaks[1] = infinity;
    for (let i = 1; i < valid.length; i++) {
      const q = valid[i];
      let s = ((distances[q] + q * q) - (distances[sites[k]] + sites[k] * sites[k])) / (2 * (q - sites[k]));
      while (s <= breaks[k]) {
        k--;
        s = ((distances[q] + q * q) - (distances[sites[k]] + sites[k] * sites[k])) / (2 * (q - sites[k]));
      }
      k++; sites[k] = q; breaks[k] = s; breaks[k + 1] = infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (breaks[k + 1] < q) k++;
      const source = sites[k];
      outDistances[q] = (q - source) ** 2 + distances[source]; outOwners[q] = owners[source];
    }
    return { distances: outDistances, owners: outOwners };
  }
  for (let y = 0; y < height; y++) {
    const distances = new Float64Array(width), owners = new Uint16Array(width);
    for (let x = 0; x < width; x++) { owners[x] = seedOwners[y * width + x]; distances[x] = owners[x] ? 0 : infinity; }
    const transformed = lineTransform(distances, owners);
    rowDistances.set(transformed.distances, y * width); rowOwners.set(transformed.owners, y * width);
  }
  for (let x = 0; x < width; x++) {
    const distances = new Float64Array(height), owners = new Uint16Array(height);
    for (let y = 0; y < height; y++) { distances[y] = rowDistances[y * width + x]; owners[y] = rowOwners[y * width + x]; }
    const transformed = lineTransform(distances, owners);
    for (let y = 0; y < height; y++) result[y * width + x] = transformed.owners[y];
  }
  return result;
}

function boundsAtAlpha(raw, width, height, threshold) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (raw[(y * width + x) * 4 + 3] < threshold) continue;
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const assignments = assignmentsPath ? JSON.parse(await fs.readFile(assignmentsPath, 'utf8')) : {};
if (!assignments || Array.isArray(assignments) || typeof assignments !== 'object') throw new Error('--assign deve conter um objeto por sheet e ID de componente.');
for (const sheetId of Object.keys(assignments)) if (!sheetDefinitions.some(sheet => sheet.id === sheetId)) throw new Error(`Sheet desconhecido em --assign: ${sheetId}`);

// Complete all validation and extraction in memory before replacing any delivered files.
const assets = [], sources = [], outputs = [], warnings = [];
for (const sheet of sheetDefinitions) {
  const sourcePath = path.join(kitRoot, sheet.path);
  const image = sharp(sourcePath, { failOn: 'error' });
  const metadata = await image.metadata();
  if (metadata.format !== 'png') throw new Error(`${sheet.path}: esperado PNG, recebido ${metadata.format}.`);
  if (!metadata.hasAlpha) throw new Error(`${sheet.path}: não possui canal alpha. Não removeremos fundo.`);
  const { data: raw, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(`${sheet.path}: esperado RGBA de 4 canais, recebido ${info.channels}.`);
  const alpha = inspectAlpha(raw, info.width, info.height);
  if (!alpha.has_alpha_below_255 || !alpha.has_fully_transparent_pixels) {
    throw new Error(`${sheet.path}: canal alpha sem transparência real de fundo. Regere a fonte transparente; nenhum fundo será removido.`);
  }
  if (!alpha.nontransparent_bbox) throw new Error(`${sheet.path}: fonte inteiramente transparente.`);
  if (alpha.edge_alpha_max >= 16) throw new Error(`${sheet.path}: arte visível toca a borda da fonte (${alpha.edge_contact.join(', ')}); possível arte já cortada. Regenere a fonte completa.`);
  if (alpha.edge_contact.length) warnings.push(`${sheet.path}: ${alpha.edge_contact_pixels} pixels de halo com alpha máximo ${alpha.edge_alpha_max} nas bordas; preservados sem descarte.`);
  const { labels, components } = components8(raw, info.width, info.height, 16);
  const main = components.filter(component => component.area > 200);
  const validIds = new Set(sheet.items.map(([id]) => id));
  const override = assignments[sheet.id] || {};
  for (const [componentId, id] of Object.entries(override)) {
    if (!main.some(component => component.id === Number(componentId)) || !validIds.has(id)) throw new Error(`${sheet.id}: assignment de núcleo principal inválido ${componentId} → ${id}.`);
  }
  const nominalCenters = sheet.items.map(([id], index) => ({ id, x: ((index % sheet.columns) + 0.5) * info.width / sheet.columns, y: (Math.floor(index / sheet.columns) + 0.5) * info.height / sheet.rows }));
  for (const component of main) {
    const nearest = nominalCenters.reduce((best, center) => {
      const distance = ((component.centroid.x - center.x) / (info.width / sheet.columns)) ** 2 + ((component.centroid.y - center.y) / (info.height / sheet.rows)) ** 2;
      return distance < best.distance ? { id: center.id, distance } : best;
    }, { id: null, distance: Infinity });
    component.asset_id = override[component.id] || nearest.id;
    component.assignment = override[component.id] ? 'manual-component-id' : 'main-centroid-nearest-nominal-center';
  }
  if (!main.length) throw new Error(`${sheet.path}: nenhum núcleo principal > 200 pixels.`);
  const mainIds = new Map(main.map(component => [component.id, sheet.items.findIndex(([id]) => id === component.asset_id) + 1]));
  const seedOwners = new Uint16Array(labels.length);
  for (let pixel = 0; pixel < labels.length; pixel++) seedOwners[pixel] = mainIds.get(labels[pixel]) || 0;
  const owners = nearestCoreOwners(seedOwners, info.width, info.height);
  const bounds = sheet.items.map(() => ({ left: info.width, top: info.height, right: -1, bottom: -1, count: 0 }));
  for (let pixel = 0; pixel < owners.length; pixel++) {
    if (raw[pixel * 4 + 3] === 0) continue;
    const owner = owners[pixel];
    if (!owner) throw new Error(`${sheet.path}: pixel visível ${pixel} sem núcleo atribuído.`);
    const x = pixel % info.width, y = Math.floor(pixel / info.width), bbox = bounds[owner - 1];
    bbox.left = Math.min(bbox.left, x); bbox.top = Math.min(bbox.top, y);
    bbox.right = Math.max(bbox.right, x); bbox.bottom = Math.max(bbox.bottom, y); bbox.count++;
  }
  let copiedPixels = 0;
  for (let index = 0; index < sheet.items.length; index++) {
    const [id, label, category] = sheet.items[index];
    const selected = main.filter(component => component.asset_id === id);
    if (!selected.some(component => component.area > 200)) {
      console.error(JSON.stringify({ sheet: sheet.id, main_components: main }, null, 2));
      throw new Error(`${sheet.path}/${id}: sem componente principal. Objetos podem estar conectados entre si ou fora dos centros esperados; revisar fonte/assignments.`);
    }
    const { left, top, right: lastX, bottom: lastY } = bounds[index];
    const right = lastX + 1, bottom = lastY + 1;
    const rect = { left, top, width: right - left, height: bottom - top };
    const padding = 4;
    const size = { width: rect.width + padding * 2, height: rect.height + padding * 2 };
    const isolated = Buffer.alloc(size.width * size.height * 4);
    let assetPixels = 0;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const sourceIndex = y * info.width + x;
        if (raw[sourceIndex * 4 + 3] === 0 || owners[sourceIndex] !== index + 1) continue;
        const targetIndex = ((y - top + padding) * size.width + x - left + padding) * 4;
        raw.copy(isolated, targetIndex, sourceIndex * 4, sourceIndex * 4 + 4);
        copiedPixels++; assetPixels++;
      }
    }
    const expectedPixels = bounds[index].count;
    if (assetPixels !== expectedPixels) throw new Error(`${id}: cópia incompleta de pixels (${assetPixels}/${expectedPixels}).`);
    const png = await sharp(isolated, { raw: { ...size, channels: 4 } }).png().toBuffer();
    const decoded = await sharp(png).raw().toBuffer();
    if (!decoded.equals(isolated)) throw new Error(`${id}: PNG não preservou RGBA byte a byte.`);
    const outputPath = `png/${category}/${id}.png`;
    const visibleBbox = boundsAtAlpha(isolated, size.width, size.height, 16);
    assets.push({
      id, label, category, medium: 'raster-png', visual_style: 'vector-like', path: outputPath, size,
      source: { atlas: sheet.path, nominal_grid_index: index, rect, crop_rectangles_may_overlap: true, component_ids: selected.map(component => component.id) },
      isolation_method: 'alpha-core-connected-components-8-and-nearest-core-pixel', core_alpha_threshold: 16, padding_px: padding,
      nontransparent_bbox: { left: padding, top: padding, width: rect.width, height: rect.height },
      atlas_nontransparent_bbox: rect,
      atlas_origin_of_png: { x: left - padding, y: top - padding },
      visible_bbox_alpha16: visibleBbox,
      alpha: inspectAlpha(isolated, size.width, size.height), original_rgba_preserved: true, nontransparent_pixels: assetPixels,
      anchor_suggestion: suggestedAnchor(id, category, size, visibleBbox), rig_ready: false,
    });
    outputs.push({ path: outputPath, bytes: png });
  }
  const originalPixels = alpha.opaque_pixels + alpha.translucent_pixels;
  if (copiedPixels !== originalPixels) throw new Error(`${sheet.path}: ${originalPixels - copiedPixels} pixels visíveis não atribuídos.`);
  sources.push({ id: sheet.id, path: sheet.path, size: { width: info.width, height: info.height }, nominal_grid: { columns: sheet.columns, rows: sheet.rows }, alpha, core_alpha_threshold: 16, distance_metric: 'exact-squared-euclidean-to-nearest-main-core-pixel', component_count: components.length, main_component_count: main.length, main_components: main, minor_component_count: components.length - main.length, verification: { nontransparent_pixels: originalPixels, assigned_pixels: copiedPixels, unassigned_pixels: 0, png_rgba_byte_equality: true } });
  console.log(`${sheet.id}: ${components.length} componentes (${main.length} principais), ${copiedPixels} pixels atribuídos, 0 perdidos.`);
}

let vectorRig = null;
try {
  const data = JSON.parse(await fs.readFile(path.join(kitRoot, 'vector-rig/manifest.json'), 'utf8'));
  vectorRig = {
    path: 'vector-rig/manifest.json', preview: 'vector-rig/assembled-survivor.svg',
    canvas: data.canvas,
    compositions: [
      { label: 'Humano base', path: 'vector-rig/base-survivor.svg', png: 'vector-rig/base-survivor.png' },
      { label: 'Montagem com mochila e colete', path: 'vector-rig/assembled-survivor.svg', png: 'vector-rig/assembled-survivor.png' },
      { label: 'Montagem equipada', path: 'vector-rig/equipped-survivor.svg', png: 'vector-rig/equipped-survivor.png' },
    ],
    parts: data.parts.map(part => ({ ...part, svg: `vector-rig/${part.svg}`, png: `vector-rig/${part.png}` })),
  };
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  warnings.push('vector-rig/manifest.json ainda não disponível; regenere o catálogo depois de criar as fontes vetoriais.');
}

const manifest = {
  schema: 'frontier-survival.test-kit.v1', name: 'Frontier Survival — kit de teste',
  reference: { title: 'CryoFall — página oficial de imprensa', url: 'https://press.atomictorch.com/cryofall.html', relationship: 'Inspiração temática e de leitura visual; arte original, sem extração de sprites do jogo.' },
  coordinates: { unit: 'px', origin: 'top-left', x: 'right', y: 'down', anchors: 'local to trimmed PNG; suggestions are not calibrated rig pivots' },
  processing: { operations: ['alpha-core-connected-components-8', 'nearest-core-pixel-assignment', 'isolated-bbox-crop', 'transparent-padding-4px'], core_alpha_threshold: 16, copied_alpha_threshold: 'all alpha > 0', main_component_minimum_area_exclusive: 200, nominal_grids_used_for_assignment_only: true, source_crop_rectangles_may_overlap: true, background_removal: false, inpainting: false, asset_resampling: false, recoloring: false, visible_rgba_modified: false },
  compatibility: { png: 'RGBA PNG', svg: 'Fontes vetoriais reais em vector-rig/; PNGs dos sheets têm apenas aparência vetorial.', native_app_import_validated: false, note: 'O editor nativo ainda não resolve imagens próprias de assets ao abrir .puppet.json; este kit não altera o aplicativo.' },
  counts: { raster_sprites: assets.length, svg_parts: vectorRig?.parts.length || 0 },
  preview: 'previews/contact-sheet.png',
  warnings, sources, assets, vector_rig: vectorRig,
};

const html = makeCatalog(manifest);
const contactSheet = await makeContactSheet(assets, outputs);
outputs.push({ path: 'previews/contact-sheet.png', bytes: contactSheet });
for (const output of outputs) {
  const target = path.join(kitRoot, output.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(`${target}.tmp`, output.bytes);
  await fs.rename(`${target}.tmp`, target);
}
for (const [name, content] of [['manifest.json', `${JSON.stringify(manifest, null, 2)}\n`], ['index.html', html]]) {
  const target = path.join(kitRoot, name);
  await fs.writeFile(`${target}.tmp`, content);
  await fs.rename(`${target}.tmp`, target);
}
console.log(`Empacotado: ${assets.length} PNGs transparentes; ${vectorRig?.parts.length || 0} partes SVG catalogadas.`);
console.log(`Catálogo: ${path.join(kitRoot, 'index.html')}`);
for (const warning of warnings) console.warn(`AVISO: ${warning}`);

async function makeContactSheet(items, images) {
  const tileW = 210, tileH = 245, columns = 6;
  const width = tileW * columns, height = tileH * Math.ceil(items.length / columns);
  const layers = [];
  const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  for (let i = 0; i < items.length; i++) {
    const item = items[i], column = i % columns, row = Math.floor(i / columns);
    const image = images.find(output => output.path === item.path).bytes;
    const thumbnail = await sharp(image).resize(190, 200, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    const metadata = await sharp(thumbnail).metadata();
    layers.push({ input: thumbnail, left: column * tileW + Math.floor((tileW - metadata.width) / 2), top: row * tileH + 8 + Math.floor((200 - metadata.height) / 2) });
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="210" height="34"><text x="105" y="14" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#eef1e8">${xml(item.id)}</text><text x="105" y="29" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#b7c5bd">${item.size.width} × ${item.size.height} px</text></svg>`);
    layers.push({ input: label, left: column * tileW, top: row * tileH + 209 });
  }
  return sharp({ create: { width, height, channels: 4, background: '#1b282b' } }).composite(layers).png().toBuffer();
}

function makeCatalog(data) {
  const embedded = JSON.stringify(data).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Frontier Survival — asset kit</title>
<style>
:root{color-scheme:dark;--page:#111b1d;--surface:#1b282b;--text:#eef1e8;--muted:#b7c5bd;--line:#34494a;--accent:#d6b477;--image:#172326}
*{box-sizing:border-box}body{margin:0;font:16px/1.5 system-ui,sans-serif;background:var(--page);color:var(--text)}body.light{color-scheme:light;--page:#eeeee5;--surface:#fffdf4;--text:#24383e;--muted:#4f645e;--line:#becbc0;--accent:#715629}
main{max-width:1400px;margin:auto;padding:42px 28px}header{display:flex;gap:24px;justify-content:space-between;align-items:start;border-bottom:1px solid var(--line);padding-bottom:28px}.eyebrow{letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-size:12px;font-weight:700}h1{font-size:clamp(32px,5vw,54px);line-height:1.1;letter-spacing:-.04em;margin:12px 0}h2{font-size:26px;letter-spacing:-.025em;margin:40px 0 12px}p{max-width:76ch;color:var(--muted)}a{color:var(--accent);text-underline-offset:3px}button,input{font:inherit}button,.link-button{background:var(--surface);color:var(--text);border:1px solid var(--line);padding:9px 13px;border-radius:7px;cursor:pointer}button[aria-pressed=true]{border-color:var(--accent);color:var(--accent)}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.controls{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:24px 0 10px}.search{width:250px;max-width:100%;background:var(--surface);color:var(--text);border:1px solid var(--line);border-radius:7px;padding:10px 12px}.control-label{font-size:13px;color:var(--muted)}.count{color:var(--muted);font-size:14px;margin:12px 0 22px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}.card{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface)}.preview{height:240px;display:flex;align-items:center;justify-content:center;background-color:#172326}.preview img{width:100%;height:100%;object-fit:contain;padding:16px}.checker .preview{background-color:#c9d2cc;background-image:linear-gradient(45deg,#aebbb5 25%,transparent 25%),linear-gradient(-45deg,#aebbb5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#aebbb5 75%),linear-gradient(-45deg,transparent 75%,#aebbb5 75%);background-size:24px 24px;background-position:0 0,0 12px,12px -12px,-12px 0}.bg-light .preview{background:#f3f0e4}.bg-dark .preview{background:#172326}.card-info{padding:14px}.card h3{font-size:16px;line-height:1.3;margin:0 0 7px}.card small{color:var(--muted);display:block}.card-links{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:14px}.compositions{grid-template-columns:repeat(auto-fit,minmax(240px,1fr))}.compositions .preview{height:400px}.vector-parts .preview{height:180px}.note{border-left:3px solid var(--accent);padding:4px 0 4px 16px}.warning{color:var(--accent)}footer{margin-top:42px;border-top:1px solid var(--line);padding-top:22px;color:var(--muted);font-size:14px}.empty{padding:24px;border:1px dashed var(--line);grid-column:1/-1;color:var(--muted)}[hidden]{display:none!important}@media(max-width:600px){main{padding:26px 16px}header{flex-direction:column}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.preview{height:190px}.card-info{padding:11px}.card h3{font-size:14px}.compositions{grid-template-columns:1fr}.search{width:100%}}
</style></head><body class="checker"><main>
<header><div><span class="eyebrow">chocoBones · kit de teste</span><h1>Frontier Survival</h1><p>Sobreviventes, fauna, roupas e equipamentos originais para explorar montagem, escala e anexos. Arte raster com leitura vetorial e um humano modular em SVG real.</p><p><a href="manifest.json">Manifesto de assets</a> · <a href="README.md">Guia de uso</a> · <a href="../frontier-survival.zip" download>Baixar ZIP</a> · <a href="previews/contact-sheet.png">Prancha de sprites</a> · <a href="https://press.atomictorch.com/cryofall.html" target="_blank" rel="noreferrer">Referência oficial de CryoFall</a></p></div><button id="theme-toggle" type="button" aria-pressed="false">Interface clara</button></header>
<section aria-labelledby="raster-title"><h2 id="raster-title">Sprites transparentes</h2><p class="note">Os personagens e animais desta seção são sprites inteiros. Os pontos de anexo no manifesto são sugestões sem calibração; a seção vetorial abaixo reúne as partes separadas para rig.</p>
<div class="controls" id="categories" aria-label="Filtrar categoria"></div>
<div class="controls"><input class="search" id="search" type="search" placeholder="Buscar sprite..." aria-label="Buscar sprite"><span class="control-label">Fundo da prévia</span><button data-bg="checker" aria-pressed="true">Quadriculado</button><button data-bg="bg-dark" aria-pressed="false">Escuro</button><button data-bg="bg-light" aria-pressed="false">Claro</button></div>
<p class="count" id="count" role="status" aria-live="polite"></p><div class="grid" id="sprites"></div></section>
<section aria-labelledby="vector-title" id="vector-section"><h2 id="vector-title">Humano modular · fontes SVG</h2><p>Geometria vetorial editável com peças de corpo e overlays independentes. As peças usam o mesmo canvas; consulte o manifesto vetorial para hierarquia, ordem de desenho e pivôs. Esta arte é separada dos sheets raster; as roupas dos sheets não têm alinhamento automático com este humano.</p><p><a href="vector-rig/rig-preview.html">Abrir demonstração de pose e marcha</a> · <a href="vector-rig/assembled-survivor.svg">Montagem SVG</a> · <a href="vector-rig/manifest.json">Manifesto vetorial</a> · <a href="vector-rig/README.md">Guia do rig</a></p><div class="grid compositions" id="compositions"></div><h2>Partes vetoriais</h2><div class="grid vector-parts" id="vector-parts"></div></section>
<section aria-labelledby="sheets-title"><h2 id="sheets-title">Folhas originais</h2><p id="sheet-links"></p><p id="warnings" class="warning"></p></section>
<footer>Conteúdo original inspirado em sobrevivência e exploração sci-fi de CryoFall. PNG com aparência vetorial não é SVG. Kit independente: importação e animação no editor nativo ainda não foram validadas.</footer>
</main><script type="application/json" id="kit-data">${embedded}</script><script>
const kit=JSON.parse(document.getElementById('kit-data').textContent);
const names={all:'Todos',humans:'Humanos',animals:'Animais',clothing:'Roupas',equipment:'Equipamentos',tools:'Ferramentas',weapons:'Armas'};
let category='all';
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
function link(label,target){const a=el('a','',label);a.href=target;return a}
function card(label,src,detail,links,bbox,size){const article=el('article','card');const preview=el('div','preview');if(bbox&&size){const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',[bbox.left,bbox.top,bbox.width,bbox.height].join(' '));svg.setAttribute('role','img');svg.setAttribute('aria-label',label);svg.style.cssText='width:100%;height:100%;padding:16px';const img=document.createElementNS(ns,'image');img.setAttribute('href',src);img.setAttribute('width',size.width);img.setAttribute('height',size.height);svg.append(img);preview.append(svg)}else{const img=el('img');img.src=src;img.alt=label;img.loading='lazy';preview.append(img)}const info=el('div','card-info');info.append(el('h3','',label),el('small','',detail));const anchors=el('div','card-links');for(const item of links)anchors.append(link(item[0],item[1]));info.append(anchors);article.append(preview,info);return article}
for(const value of ['all',...new Set(kit.assets.map(asset=>asset.category))]){const b=el('button','',names[value]||value);b.type='button';b.dataset.category=value;b.setAttribute('aria-pressed',String(value===category));b.onclick=()=>{category=value;for(const item of document.querySelectorAll('[data-category]'))item.setAttribute('aria-pressed',String(item.dataset.category===category));renderSprites()};document.getElementById('categories').append(b)}
function renderSprites(){const query=document.getElementById('search').value.toLocaleLowerCase('pt-BR');const shown=kit.assets.filter(asset=>(category==='all'||asset.category===category)&&(asset.label+' '+asset.id).toLocaleLowerCase('pt-BR').includes(query));const grid=document.getElementById('sprites');grid.replaceChildren();for(const asset of shown)grid.append(card(asset.label,asset.path,names[asset.category]+' · '+asset.size.width+' × '+asset.size.height+' px',[['PNG',asset.path],['Folha',asset.source.atlas]],asset.visible_bbox_alpha16,asset.size));if(!shown.length)grid.append(el('p','empty','Nenhum sprite corresponde à busca.'));document.getElementById('count').textContent=shown.length+' de '+kit.assets.length+' sprites · alpha transparente · pivôs a calibrar'}
document.getElementById('search').addEventListener('input',renderSprites);
document.getElementById('theme-toggle').onclick=event=>{const light=document.body.classList.toggle('light');event.currentTarget.textContent=light?'Interface escura':'Interface clara';event.currentTarget.setAttribute('aria-pressed',String(light))};
for(const button of document.querySelectorAll('[data-bg]'))button.onclick=()=>{document.body.classList.remove('checker','bg-dark','bg-light');document.body.classList.add(button.dataset.bg);for(const b of document.querySelectorAll('[data-bg]'))b.setAttribute('aria-pressed',String(b===button))};
if(kit.vector_rig){for(const item of kit.vector_rig.compositions)document.getElementById('compositions').append(card(item.label,item.path,'Composição estática · SVG editável',[['SVG',item.path],['PNG',item.png]]));for(const part of kit.vector_rig.parts)document.getElementById('vector-parts').append(card(part.label,part.svg,part.id+' · ordem '+part.z,[['SVG',part.svg],['PNG',part.png]]))}else{document.getElementById('vector-section').hidden=true}
for(const source of kit.sources){const row=el('span');row.append(link(source.id,source.path),document.createTextNode(' · '+source.size.width+' × '+source.size.height+' px  '));document.getElementById('sheet-links').append(row)}
document.getElementById('warnings').textContent=kit.warnings.join(' ');
renderSprites();
</script></body></html>\n`;
}
