import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildPreview } from './build-preview.mjs';

// Original drawn vector geometry, in shared canvas coordinates.
const root = path.dirname(fileURLToPath(import.meta.url));
const W = 512, H = 768;
const c = { ink: '#24383e', skin: '#c28d68', skinLight: '#daa881', skinDark: '#a87052', hair: '#353b38', sand: '#c7c29f', sandLight: '#e0d8b5', sandDark: '#a49f7e', olive: '#6f7961', oliveLight: '#8d9979', oliveDark: '#505f51', teal: '#447c7f', tealLight: '#679b9a', tealDark: '#315d64', rust: '#b96c4e', rustLight: '#d08b65', metal: '#aab5aa', dark: '#354b4e', amber: '#e4b960' };
const P = (d, fill, stroke = c.ink, sw = 4) => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const L = (d, stroke = c.ink, sw = 3) => P(d, 'none', stroke, sw);
const E = (cx, cy, rx, ry, fill, sw = 3) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${c.ink}" stroke-width="${sw}"/>`;
const R = (x, y, w, h, r, fill, sw = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${c.ink}" stroke-width="${sw}"/>`;
const mirror = s => `<g transform="translate(512 0) scale(-1 1)">${s}</g>`;
const svg = (body, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`;
const parts = [];
const add = (id, label, body, pivot, z, category, parent, extras = {}) => parts.push({ id, label, body, pivot, z, category, parent, ...extras });

const upperArm = P('M210 205 Q197 204 190 217 L169 277 Q164 292 175 304 Q186 313 198 302 L225 246 Q235 226 224 214 Z', c.olive)
  + P('M196 216 L177 276 Q173 286 178 292 L188 297 L215 233 L214 214 Z', c.oliveLight, 'none')
  + P('M176 274 Q188 272 202 284 L198 305 Q184 315 174 303 Q165 292 176 274 Z', c.oliveDark)
  + P('M182 280 L194 285 L189 301 L177 297 Z', c.teal, c.ink, 2)
  + L('M195 235 L185 261', c.sandLight, 2);
const forearm = P('M179 288 Q193 289 197 302 L178 366 Q176 381 162 382 Q147 381 148 368 L161 307 Q165 289 179 288 Z', c.skin)
  + P('M166 308 Q164 300 171 296 L180 298 L164 371 L155 373 Z', c.skinLight, 'none')
  + P('M151 351 L178 357 L175 375 Q163 384 149 373 Z', c.dark)
  + R(154, 358, 18, 10, 2, c.tealLight, 2)
  + L('M180 317 L173 337', c.skinDark, 3);
const hand = P('M157 370 Q169 369 176 378 L173 393 L175 407 Q173 414 168 412 L165 408 L162 420 Q156 425 151 420 L147 413 Q141 413 140 406 L142 386 Q143 374 157 370 Z', c.skin)
  + P('M148 382 Q151 377 159 378 L156 400 L149 411 L145 406 Z', c.skinLight, 'none')
  + L('M164 388 L162 404 M155 405 L153 416 M169 394 L168 405', c.skinDark, 2);
const thigh = P('M214 381 Q231 376 245 388 L245 457 L237 522 Q234 540 218 541 Q200 540 198 526 L197 464 L202 404 Q203 387 214 381 Z', c.sand)
  + P('M207 411 L218 397 L225 397 L217 467 L220 513 L209 525 L202 520 L202 462 Z', c.sandLight, 'none')
  + P('M221 505 Q232 503 240 512 L239 532 Q220 547 203 531 L204 515 Z', c.oliveDark)
  + P('M211 513 L231 512 L232 530 L218 535 L209 528 Z', c.olive, c.ink, 2)
  + P('M197 437 L216 440 L214 475 L196 473 Z', c.olive, c.ink, 3)
  + L('M199 447 L212 449 M234 407 L233 476', c.sandDark, 2)
  + R(197, 441, 16, 8, 2, c.oliveLight, 2);
const shin = P('M205 514 Q219 505 234 515 L236 576 L228 649 Q223 662 209 658 Q196 657 194 644 L194 584 Z', c.sand)
  + P('M202 543 L212 540 L212 587 L208 642 L198 644 L198 584 Z', c.sandLight, 'none')
  + P('M204 578 L233 579 L231 614 L198 612 Z', c.oliveDark)
  + R(201, 586, 27, 16, 3, c.olive, 2)
  + L('M219 622 L217 641', c.sandDark, 2);
const foot = P('M199 628 L228 630 L230 659 Q233 672 225 682 L182 691 Q171 691 174 679 L187 659 L190 639 Q192 630 199 628 Z', c.dark)
  + P('M192 640 L213 643 L210 663 L185 681 L179 681 L190 660 Z', c.olive, 'none')
  + P('M177 678 Q204 679 230 668 L230 683 L180 696 Q169 696 170 688 Z', c.ink)
  + L('M195 648 L216 651 M192 656 L214 659 M188 665 L209 668', c.sand, 2)
  + R(211, 636, 12, 8, 2, c.rust, 2);

add('upper_arm_r', 'Braço direito', upperArm, [210, 224], 40, 'body', 'torso', { distal: [181, 296] });
add('upper_arm_l', 'Braço esquerdo', mirror(upperArm), [302, 224], 41, 'body', 'torso', { distal: [331, 296] });
add('forearm_r', 'Antebraço direito', forearm, [180, 299], 30, 'body', 'upper_arm_r', { distal: [162, 374] });
add('forearm_l', 'Antebraço esquerdo', mirror(forearm), [332, 299], 31, 'body', 'upper_arm_l', { distal: [350, 374] });
add('hand_r', 'Mão direita', hand, [162, 380], 65, 'body', 'forearm_r');
add('hand_l', 'Mão esquerda', mirror(hand), [350, 380], 66, 'body', 'forearm_l');
add('thigh_r', 'Coxa direita', thigh, [220, 396], 10, 'body', 'pelvis', { distal: [220, 523] });
add('thigh_l', 'Coxa esquerda', mirror(thigh), [292, 396], 11, 'body', 'pelvis', { distal: [292, 523] });
add('shin_r', 'Canela direita', shin, [218, 524], 12, 'body', 'thigh_r', { distal: [213, 640] });
add('shin_l', 'Canela esquerda', mirror(shin), [294, 524], 13, 'body', 'thigh_l', { distal: [299, 640] });
add('foot_r', 'Bota direita', foot, [213, 644], 14, 'body', 'shin_r');
add('foot_l', 'Bota esquerda', mirror(foot), [299, 644], 15, 'body', 'shin_l');

add('pelvis', 'Quadril e cinto',
  P('M207 338 L304 338 L309 386 L301 418 L275 423 L256 405 L238 423 L209 417 L201 390 Z', c.sand)
  + P('M255 359 L300 351 L304 388 L293 413 L277 416 L261 395 Z', c.sandDark, 'none')
  + P('M206 343 L305 343 L306 363 Q254 371 204 363 Z', c.dark)
  + R(244, 345, 27, 22, 3, c.metal)
  + R(250, 351, 15, 10, 1, c.ink, 1)
  + L('M258 370 L258 397 M219 373 L210 390 M289 374 L300 391', c.sandDark, 3)
  + R(208, 349, 8, 20, 2, c.olive, 2)
  + R(286, 349, 8, 20, 2, c.olive, 2)
  + P('M298 367 L319 370 L319 404 L298 411 Z', c.rust)
  + P('M296 367 L320 369 L321 379 L297 378 Z', c.rustLight, c.ink, 2)
  + R(305, 374, 8, 7, 1, c.metal, 2),
  [256, 376], 20, 'body', null);

add('torso', 'Camisa de explorador',
  P('M229 196 L282 196 Q297 199 311 215 L314 257 L299 276 L305 346 Q258 360 207 346 L211 277 L198 256 L201 216 Q213 201 229 196 Z', c.olive)
  + P('M206 218 L226 208 L247 227 L247 347 L214 342 L218 278 L207 256 Z', c.oliveLight, 'none')
  + P('M281 204 L302 219 L300 254 L289 273 L296 340 L262 350 L262 229 Z', c.oliveDark, 'none')
  + P('M227 192 L256 209 L239 231 L222 204 Z', c.sand)
  + P('M282 192 L256 209 L273 231 L289 204 Z', c.sand)
  + L('M256 217 L256 340', c.ink, 3)
  + R(215, 247, 30, 41, 3, c.olive, 3)
  + P('M214 247 L246 247 L241 260 L220 260 Z', c.sandDark, c.ink, 2)
  + E(230, 255, 2, 2, c.metal, 1)
  + R(268, 247, 29, 41, 3, c.oliveDark, 3)
  + P('M267 247 L298 247 L293 260 L272 260 Z', c.olive, c.ink, 2)
  + R(217, 224, 23, 8, 2, c.rust, 2)
  + P('M274 224 L286 223 L286 236 L280 239 L274 235 Z', c.teal, c.ink, 2)
  + L('M211 312 L239 314 M273 314 L298 311', c.oliveDark, 2)
  + E(256, 241, 2, 2, c.metal, 1)
  + E(256, 275, 2, 2, c.metal, 1)
  + E(256, 309, 2, 2, c.metal, 1),
  [256, 276], 50, 'body', 'pelvis');

add('head', 'Cabeça de sobrevivente',
  P('M239 168 L274 168 L279 202 Q256 218 232 201 Z', c.skin)
  + P('M260 173 L274 172 L278 200 L259 206 Z', c.skinDark, 'none')
  + E(216, 136, 9, 15, c.skin)
  + E(296, 136, 9, 15, c.skin)
  + P('M220 110 Q221 80 256 77 Q291 79 293 109 L291 146 Q287 169 268 183 L246 183 Q226 172 220 149 Z', c.skin)
  + P('M222 119 L230 103 L251 97 L258 121 L254 160 L239 166 Q228 158 225 143 Z', c.skinLight, 'none')
  + P('M272 102 L291 109 L289 145 Q285 166 268 178 L257 179 L272 157 Z', c.skinDark, 'none')
  + P('M220 129 L213 120 L215 101 Q216 79 238 73 L266 72 Q289 73 298 95 L297 123 L291 130 L286 108 L274 103 L268 87 Q246 111 225 104 Z', c.hair)
  + P('M222 94 Q235 78 258 79 L270 80 Q253 92 236 95 Z', c.oliveDark, 'none')
  + P('M224 146 L232 146 L237 163 L250 168 L263 168 L278 160 L284 145 L290 146 Q285 171 268 185 L247 185 Q229 174 224 146 Z', c.hair, c.ink, 2)
  + P('M243 169 L268 169 L264 176 L249 176 Z', c.skinDark, 'none')
  + L('M230 122 L243 121 M269 121 L282 123', c.hair, 4)
  + P('M232 130 Q238 127 244 130 M268 130 Q274 127 280 130', 'none', c.ink, 2)
  + E(238, 131, 2, 2, c.ink, 1) + E(274, 131, 2, 2, c.ink, 1)
  + L('M257 131 L252 147 L259 149', c.skinDark, 3)
  + L('M247 158 Q256 162 266 158', c.ink, 2)
  + L('M215 133 L217 141 M296 133 L294 141', c.skinDark, 2),
  [256, 190], 60, 'body', 'torso');

add('backpack', 'Mochila de campo',
  P('M218 209 L202 224 L188 241 L182 319 Q186 338 204 344 L310 345 Q328 338 330 320 L323 242 L307 223 L292 209 Z', c.rust)
  + P('M193 247 L207 241 L207 329 L187 320 Z', c.rustLight, 'none')
  + P('M307 241 L319 245 L326 319 L309 329 Z', c.skinDark, 'none')
  + P('M207 220 Q217 205 231 208 L227 217 Q216 216 212 230 Z', c.dark)
  + P('M301 222 Q291 204 280 208 L283 218 Q293 216 296 232 Z', c.dark)
  + R(178, 257, 19, 53, 7, c.sand)
  + L('M181 269 L194 269 M181 284 L194 284', c.sandDark, 2)
  + R(316, 265, 23, 44, 5, c.teal)
  + R(320, 258, 14, 9, 2, c.metal, 2),
  [256, 262], 0, 'equipment', 'torso', { defaultVisible: true });

add('helmet', 'Capacete de prospecção',
  P('M211 121 L211 107 Q216 69 251 65 Q288 63 300 101 L302 119 L287 130 L281 111 Q254 119 228 111 L224 130 Z', c.sand)
  + P('M216 103 Q225 77 249 73 L257 73 L249 101 Z', c.sandLight, 'none')
  + P('M273 74 Q293 85 297 105 L279 109 L269 102 Z', c.sandDark, 'none')
  + P('M211 110 Q256 102 302 111 L303 123 Q256 115 210 123 Z', c.oliveDark)
  + R(245, 84, 24, 20, 4, c.dark, 3)
  + E(257, 94, 7, 6, c.amber, 2)
  + P('M225 119 L230 146 L223 152 L217 130 Z', c.olive, c.ink, 3)
  + P('M289 119 L282 146 L289 152 L298 130 Z', c.olive, c.ink, 3)
  + L('M227 139 L233 175 L253 190 L277 175 L285 141', c.oliveDark, 4)
  + R(249, 182, 13, 8, 2, c.metal, 2),
  [256, 190], 70, 'equipment', 'head', { defaultVisible: false });

add('visor', 'Visor âmbar',
  P('M215 124 L225 123 L224 140 L216 139 Z', c.dark)
  + P('M287 123 L297 124 L296 139 L288 140 Z', c.dark)
  + P('M225 120 Q257 113 289 121 L284 143 Q256 149 229 142 Z', c.tealDark)
  + P('M230 123 Q256 118 284 124 L280 138 Q256 143 234 138 Z', c.amber, c.ink, 2)
  + P('M234 125 L247 122 L239 137 L235 136 Z', c.sandLight, 'none')
  + P('M268 123 L279 125 L274 137 L261 138 Z', c.rustLight, 'none')
  + L('M249 122 L242 138', c.sandLight, 2),
  [256, 190], 75, 'equipment', 'head', { defaultVisible: false });

add('vest', 'Colete utilitário',
  P('M217 214 L238 210 L250 239 L262 239 L274 210 L295 214 L291 251 L305 270 L301 338 Q256 353 211 339 L209 271 L221 250 Z', c.dark)
  + P('M220 225 L233 222 L241 242 L240 331 L217 330 L217 275 L227 251 Z', c.olive, 'none')
  + P('M280 225 L290 227 L286 251 L298 273 L293 330 L269 337 L270 247 Z', c.oliveDark, 'none')
  + R(242, 248, 27, 59, 3, c.olive, 3)
  + R(215, 274, 23, 35, 3, c.sandDark, 3)
  + R(273, 273, 24, 36, 3, c.oliveLight, 3)
  + P('M215 274 L238 274 L237 285 L217 285 Z', c.sand, c.ink, 2)
  + P('M273 273 L297 273 L296 284 L274 284 Z', c.olive, c.ink, 2)
  + R(241, 314, 31, 19, 2, c.rust, 3)
  + R(216, 316, 20, 19, 2, c.olive, 2)
  + R(277, 315, 19, 18, 2, c.olive, 2)
  + R(248, 259, 14, 8, 2, c.tealLight, 2)
  + L('M247 278 L264 278 M247 288 L264 288', c.oliveLight, 2)
  + R(223, 232, 12, 11, 2, c.metal, 2)
  + R(277, 232, 12, 11, 2, c.metal, 2),
  [256, 276], 55, 'clothing', 'torso', { defaultVisible: true });

add('cold_jacket_torso', 'Parka polar — tronco',
  P('M221 189 Q256 178 289 190 L313 210 L326 256 L302 279 L310 350 Q256 365 201 350 L210 279 L187 257 L198 211 Z', c.teal)
  + P('M205 219 L226 199 L245 235 L245 348 L210 344 L219 278 L202 254 Z', c.tealLight, 'none')
  + P('M290 205 L309 220 L318 254 L293 278 L302 344 L266 352 L266 235 Z', c.tealDark, 'none')
  + P('M221 188 L236 183 L256 200 L276 183 L290 189 L274 231 L256 215 L238 231 Z', c.sandLight)
  + P('M237 194 L255 208 L274 194 L266 218 L256 211 L246 219 Z', c.sandDark, 'none')
  + L('M256 222 L256 350', c.sandLight, 4)
  + L('M215 248 L238 257 M273 257 L299 247', c.ink, 4)
  + R(209, 300, 34, 37, 4, c.teal, 3)
  + R(270, 300, 33, 37, 4, c.tealDark, 3)
  + P('M209 300 L243 300 L239 311 L213 311 Z', c.tealLight, c.ink, 2)
  + P('M270 300 L303 300 L299 311 L274 311 Z', c.teal, c.ink, 2)
  + R(251, 234, 11, 14, 2, c.rust, 2)
  + P('M285 218 L300 223 L298 238 L290 241 L282 235 Z', c.rust, c.ink, 2),
  [256, 276], 53, 'clothing', 'torso', { defaultVisible: false, replaces: ['torso'], conflicts: ['vest'] });

const rifle = P('M341 425 L329 423 L330 403 L350 388 L358 372 L374 377 L364 400 L349 403 Z', c.dark)
  + P('M341 413 L335 417 L337 405 L350 397 L354 402 Z', c.olive, 'none')
  + P('M357 383 L374 354 L385 350 L399 326 L410 333 L397 359 L391 379 L378 396 L366 392 Z', c.olive)
  + P('M375 354 L384 355 L370 383 L364 381 Z', c.oliveLight, 'none')
  + P('M392 335 L406 309 L414 313 L400 339 Z', c.ink)
  + P('M405 311 L414 296 L421 301 L413 317 Z', c.dark)
  + P('M370 383 L379 388 L371 413 L363 419 L355 414 Z', c.dark)
  + P('M369 391 L373 393 L365 412 L361 411 Z', c.oliveLight, 'none')
  + P('M358 392 L369 398 L366 409 L357 411 L352 405 Z', c.dark)
  + P('M382 346 L388 335 L395 339 L389 350 Z', c.dark)
  + P('M371 350 L378 339 L388 344 L381 355 Z', c.tealDark)
  + P('M371 350 L376 343 L380 345 L376 352 Z', c.tealLight, 'none')
  + L('M388 356 L396 360 M382 366 L390 370', c.sand, 2)
  + R(372, 374, 7, 7, 1, c.rust, 2);
add('rifle', 'Carabina de exploração', rifle, [350, 388], 80, 'equipment', 'hand_l', { defaultVisible: false, grip: [350, 388] });

fs.mkdirSync(path.join(root, 'svg'), { recursive: true });
fs.mkdirSync(path.join(root, 'png'), { recursive: true });
for (const p of parts) fs.writeFileSync(path.join(root, 'svg', `${p.id}.svg`), svg(p.body, p.label));
const base = parts.filter(p => p.category === 'body').sort((a, b) => a.z - b.z);
const assembled = parts.filter(p => p.category === 'body' || p.defaultVisible).sort((a, b) => a.z - b.z);
const expedition = parts.filter(p => p.category === 'body' || ['backpack','vest','helmet','visor','rifle'].includes(p.id)).sort((a,b) => a.z - b.z);
fs.writeFileSync(path.join(root, 'base-survivor.svg'), svg(base.map(p => `<g id="${p.id}">${p.body}</g>`).join(''), 'Sobrevivente original — peças base'));
fs.writeFileSync(path.join(root, 'assembled-survivor.svg'), svg(assembled.map(p => `<g id="${p.id}">${p.body}</g>`).join(''), 'Sobrevivente original — mochila e colete'));
fs.writeFileSync(path.join(root, 'equipped-survivor.svg'), svg(expedition.map(p => `<g id="${p.id}">${p.body}</g>`).join(''), 'Sobrevivente original — equipamento completo'));
const manifest = {
  schema: 'frontier-survival.vector-rig.v1', character: 'survivor-01', originalArtwork: true,
  canvas: { width: W, height: H, unit: 'px', origin: 'top-left', background: 'transparent' },
  handedness: 'l/r refer to the character; l is viewer right, r is viewer left',
  instructions: 'Stack full-canvas PNG/SVG at (0,0), ascending z. Pivot values use the shared canvas. For trimmed textures, subtract trim offset from pivot.',
  palette: c, preview: 'assembled-survivor.svg',
  parts: parts.map(({ body, ...p }) => ({ ...p, svg: `svg/${p.id}.svg`, png: `png/${p.id}.png`, defaultVisible: p.category === 'body' || Boolean(p.defaultVisible) }))
};
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
buildPreview();
if (process.argv.includes('--png')) {
  for (const p of parts) {
    const result = spawnSync('rsvg-convert', ['--width', String(W), '--height', String(H), '--output', path.join(root, 'png', `${p.id}.png`), path.join(root, 'svg', `${p.id}.svg`)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'rsvg-convert failed');
  }
  for (const name of ['base-survivor','assembled-survivor','equipped-survivor']) {
    const result = spawnSync('rsvg-convert', ['--width', String(W), '--height', String(H), '--output', path.join(root, `${name}.png`), path.join(root, `${name}.svg`)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'rsvg-convert failed');
  }
}
console.log(`${parts.length} vector parts: ${base.length} body + ${parts.length-base.length} overlays. Canvas ${W}×${H}.`);
