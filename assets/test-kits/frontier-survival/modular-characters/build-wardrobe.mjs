import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Original geometry. Every layer remains on the rig's untrimmed 512 × 768 canvas.
const root = path.dirname(fileURLToPath(import.meta.url));
const ink = '#24383e';
const colors = { cloth: '#6f7961', 'cloth-shadow': '#505f51', 'cloth-highlight': '#8d9979', trim: '#c7c29f', metal: '#aab5aa', wood: '#956c4b', leather: '#695448', glass: '#86bdba', amber: '#e4b960', dark: '#354b4e', ivory: '#e0d8b5' };
let palette = { ...colors };
const attr = (role, color) => `fill="${color ?? palette[role] ?? role}"${palette[role] ? ` data-palette="${role}"` : ''}`;
const P = (d, role = 'cloth', sw = 3, color) => `<path d="${d}" ${attr(role, color)} stroke="${sw ? ink : 'none'}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
const L = (d, color = ink, sw = 2) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
const R = (x, y, w, h, r, role, sw = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${attr(role)} stroke="${sw ? ink : 'none'}" stroke-width="${sw}"/>`;
const E = (x, y, rx, ry, role, sw = 2) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" ${attr(role)} stroke="${sw ? ink : 'none'}" stroke-width="${sw}"/>`;
const M = s => `<g transform="translate(512 0) scale(-1 1)">${s}</g>`;
const parts = [], outfits = [];
const joints = { pelvis: [[256, 376], 20], torso: [[256, 276], 50], head: [[256, 190], 60], upper_arm_r: [[210, 224], 40], upper_arm_l: [[302, 224], 41], forearm_r: [[180, 299], 30], forearm_l: [[332, 299], 31], hand_r: [[162, 380], 65], hand_l: [[350, 380], 66], thigh_r: [[220, 396], 10], thigh_l: [[292, 396], 11], shin_r: [[218, 524], 12], shin_l: [[294, 524], 13], foot_r: [[213, 644], 14], foot_l: [[299, 644], 15] };
const add = (id, label, body, parent, z, category, extras = {}) => {
  parts.push({ id, label, body, category, parent, pivot: joints[parent][0], z: z ?? joints[parent][1] + 1, palette: { ...palette }, suppressBody: false, ...extras });
  return id;
};
const garment = (outfit, parent, label, body) => add(`${outfit}--${parent}`, label, body, parent, undefined, 'clothing', { outfit, slot: parent, compatibleCharacters: ['male', 'female'] });
const pair = (outfit, joint, label, body) => [garment(outfit, `${joint}_r`, `${label} direito`, body), garment(outfit, `${joint}_l`, `${label} esquerdo`, M(body))];
const register = (id, label, description, pieces) => outfits.push({ id, label, description, compatibleCharacters: ['male', 'female'], pieces, palette: { ...palette } });

function pelvis(style = 'cargo') {
  let s = P('M207 338 L304 338 L310 386 L300 420 L276 424 L256 405 L236 424 L210 420 L201 390 Z', 'cloth')
    + P('M257 355 L301 350 L305 387 L294 414 L276 416 L260 396 Z', 'cloth-shadow', 0)
    + P('M207 344 L226 341 L222 382 L232 411 L214 413 L206 387 Z', 'cloth-highlight', 0)
    + P('M204 342 Q256 353 306 342 L307 361 Q256 370 203 360 Z', 'leather')
    + R(244, 345, 26, 22, 3, 'metal') + R(250, 350, 14, 11, 1, 'dark', 1)
    + L('M257 370 L257 398 M220 373 L211 389 M290 374 L300 391', palette['cloth-shadow'], 2)
    + R(216, 347, 7, 19, 2, 'cloth', 1) + R(287, 347, 7, 19, 2, 'cloth', 1);
  if (style === 'coverall') s += P('M237 337 L237 383 L253 395 L272 386 L272 337 Z', 'cloth') + L('M255 342 L255 382', ink, 2) + E(255, 357, 2, 2, 'metal', 1);
  if (style === 'tactical') s += R(212, 371, 18, 32, 3, 'leather') + R(282, 371, 20, 30, 3, 'leather') + R(216, 376, 10, 7, 1, 'metal', 1) + R(287, 376, 11, 7, 1, 'metal', 1);
  return s;
}
function thigh(style = 'cargo') {
  let s = P('M213 381 Q231 376 246 388 L246 458 L238 523 Q234 541 217 542 Q199 542 196 527 L195 464 L201 404 Q202 386 213 381 Z')
    + P('M207 410 L218 396 L225 396 L217 467 L220 515 L209 530 L202 523 L200 465 Z', 'cloth-highlight', 0)
    + P('M237 400 L244 400 L241 463 L234 516 L224 531 L221 520 L229 458 Z', 'cloth-shadow', 0)
    + L('M235 408 L232 473 M200 501 L211 507 M227 495 L238 489', palette['cloth-shadow'], 2);
  if (style === 'cargo' || style === 'tactical' || style === 'coverall') s += P('M195 434 L218 438 L217 476 L194 473 Z', 'cloth-shadow', 2) + P('M194 434 L219 438 L216 450 L196 448 Z', 'cloth', 2) + E(207, 444, 2, 2, 'metal', 1) + L('M200 454 L212 456', palette.trim, 1.5);
  if (style === 'tactical') s += P('M204 506 Q220 500 240 511 L239 530 Q219 546 201 531 Z', 'dark') + P('M209 513 L231 513 L231 529 L219 535 L207 528 Z', 'metal', 2) + L('M213 520 L227 520', ink, 1.5);
  if (style === 'winter') s += P('M197 489 L238 489 L237 506 L198 507 Z', 'cloth-shadow', 0) + L('M203 496 L232 496', palette['cloth-highlight'], 2);
  return s;
}
function shin(style = 'cargo') {
  let s = P('M204 513 Q219 505 235 514 L238 576 L229 650 Q224 663 209 660 Q195 659 192 645 L192 584 Z')
    + P('M201 539 L214 535 L211 586 L207 642 L197 646 L197 584 Z', 'cloth-highlight', 0)
    + P('M228 536 L234 538 L234 578 L226 642 L216 649 L220 582 Z', 'cloth-shadow', 0)
    + L('M216 546 L218 570 M224 614 L220 641', palette['cloth-shadow'], 2);
  if (style === 'tactical') s += P('M196 553 L236 552 L237 570 L195 571 Z', 'leather', 2) + R(201, 556, 27, 10, 2, 'cloth-shadow', 1);
  if (style === 'coverall') s += P('M195 594 L233 597 L231 610 L194 607 Z', 'trim', 2) + L('M202 602 L224 604', palette['cloth-highlight'], 2);
  if (style === 'winter') s += P('M195 616 L231 619 L227 651 Q215 663 196 650 Z', 'cloth-shadow', 2) + L('M199 626 L227 629', palette.trim, 2);
  return s;
}
function boots(style = 'field') {
  const warm = style === 'winter';
  let s = P('M196 620 L229 623 L232 658 Q236 672 227 684 L183 694 Q170 694 173 680 L185 659 L188 635 Q189 624 196 620 Z', 'leather')
    + P('M194 632 L210 635 L209 660 L184 682 L177 682 L190 660 Z', 'cloth-shadow', 0)
    + P('M177 679 Q202 681 232 668 L232 685 L181 699 Q169 699 169 688 Z', 'dark')
    + P('M191 623 L229 626 L229 637 L190 634 Z', warm ? 'trim' : 'leather', 2)
    + R(213, 633, 13, 9, 2, 'metal', 1.5)
    + L('M195 644 L217 647 M192 653 L215 656 M188 664 L211 667', palette.trim, 2)
    + L('M181 688 L191 685 M198 684 L210 681 M217 678 L226 675', palette.metal, 1.5);
  if (warm) s += P('M189 624 L196 619 L202 622 L208 620 L214 624 L222 620 L230 625 L230 635 L222 633 L216 637 L209 633 L203 636 L197 632 L190 635 Z', 'ivory', 2);
  return s;
}
function upperSleeve(short = false, style = 'plain') {
  let s = P(short ? 'M210 202 Q197 202 187 216 L174 251 Q182 264 201 266 L224 247 Q236 226 224 211 Z' : 'M210 202 Q195 202 187 216 L164 281 Q161 296 174 308 Q187 318 202 305 L229 247 Q238 225 224 211 Z')
    + P(short ? 'M199 211 L181 249 L193 256 L219 218 Z' : 'M197 214 L171 281 Q167 292 179 301 L188 300 L219 218 Z', 'cloth-highlight', 0)
    + P(short ? 'M176 248 Q189 251 203 260 L200 270 Q184 269 172 258 Z' : 'M168 281 Q186 280 205 294 L200 310 Q184 320 171 307 Q162 297 168 281 Z', 'cloth-shadow', 2)
    + L(short ? 'M191 229 L184 244' : 'M193 240 L183 267', palette['cloth-shadow'], 2);
  if (style === 'medic') s += P('M183 230 L201 236 L196 251 L179 246 Z', 'trim', 2) + P('M190 235 L194 236 L193 240 L197 241 L196 245 L192 244 L191 248 L187 247 L188 243 L184 242 L185 238 L189 239 Z', 'cloth-shadow', 0);
  if (style === 'tactical') s += P('M194 213 L210 213 L217 226 L209 240 L190 234 Z', 'dark', 2) + L('M193 222 L208 227', palette.metal, 2);
  if (style === 'coverall') s += P('M180 251 L210 263 L205 276 L175 264 Z', 'trim', 2) + L('M179 261 L205 271', palette['cloth-highlight'], 2);
  return s;
}
function foreSleeve(style = 'plain') {
  let s = P('M178 285 Q194 286 202 301 L181 369 Q176 385 161 385 Q143 384 144 368 L158 306 Q163 288 178 285 Z')
    + P('M166 307 Q163 301 173 292 L183 295 L166 373 L153 374 Z', 'cloth-highlight', 0)
    + P('M188 309 L196 308 L178 370 L168 380 L167 368 Z', 'cloth-shadow', 0)
    + P('M145 351 L181 359 L178 377 Q163 387 144 373 Z', 'cloth-shadow', 2)
    + L('M175 321 L169 343', palette['cloth-shadow'], 2)
    + R(153, 358, 18, 9, 2, 'trim', 1.5);
  if (style === 'tactical') s += P('M155 325 L184 332 L179 349 L151 342 Z', 'dark', 2) + L('M158 334 L178 340', palette.metal, 2);
  if (style === 'winter') s += P('M145 360 L153 358 L158 362 L165 361 L170 365 L178 364 L177 376 L169 378 L164 375 L157 378 L151 374 L144 375 Z', 'ivory', 2);
  return s;
}
function gloves() {
  return P('M155 367 Q169 367 179 378 L176 394 L178 407 Q174 417 168 414 L164 425 Q157 430 150 424 L145 415 Q139 415 137 406 L140 385 Q141 371 155 367 Z', 'leather')
    + P('M144 383 Q149 376 158 377 L153 406 L147 414 L141 406 Z', 'cloth-highlight', 0)
    + P('M151 383 L171 387 L168 402 L148 398 Z', 'dark', 2)
    + L('M154 387 L165 390 M156 402 L152 418 M166 396 L163 414 M173 386 L170 403', palette.metal, 1.5);
}
function torso(style) {
  const short = style === 'scout';
  let s = P(style === 'winter' ? 'M224 187 Q256 177 289 189 L315 211 L326 255 L303 282 L313 359 Q256 375 200 359 L209 282 L186 257 L198 212 Z' : 'M227 194 L284 194 Q301 200 314 216 L316 255 L301 278 L307 347 Q256 363 205 347 L210 278 L197 256 L199 216 Q213 200 227 194 Z')
    + P('M206 218 L224 204 L244 225 L244 346 L214 341 L218 277 L204 255 Z', 'cloth-highlight', 0)
    + P('M282 202 L305 220 L305 252 L292 276 L300 341 L265 351 L265 225 Z', 'cloth-shadow', 0);
  if (short) {
    s += P('M228 192 Q255 213 283 192 L285 204 Q256 226 226 204 Z', 'cloth-shadow', 2)
      + L('M218 237 L224 272 M288 234 L288 273 M219 336 Q256 343 297 336', palette['cloth-shadow'], 2)
      + P('M269 239 L287 239 L287 257 L278 263 L269 257 Z', 'trim', 2)
      + P('M274 244 L282 244 L282 251 L278 254 L274 251 Z', 'cloth-shadow', 0)
      + R(218, 282, 27, 33, 3, 'cloth-shadow') + L('M222 288 L241 288', palette.trim, 1.5);
  } else if (style === 'tactical') {
    s += P('M229 193 L255 210 L280 192 L287 206 L273 227 L239 227 L222 207 Z', 'cloth-shadow', 2)
      + P('M216 214 L236 207 L247 235 L264 235 L276 207 L296 215 L292 249 L307 270 L302 341 Q255 357 210 341 L206 272 L221 248 Z', 'dark')
      + P('M224 230 L235 225 L240 247 L238 331 L216 331 L215 276 L226 248 Z', 'cloth-shadow', 0)
      + P('M279 224 L289 231 L284 249 L299 276 L292 332 L270 337 L271 248 Z', 'cloth-shadow', 0)
      + P('M242 245 L269 245 L276 299 L268 309 L242 306 L235 297 Z', 'metal', 2)
      + P('M246 252 L266 252 L270 290 L264 299 L244 297 L241 290 Z', 'dark', 2)
      + R(216, 278, 22, 29, 3, 'cloth') + R(275, 278, 22, 29, 3, 'cloth')
      + R(217, 315, 22, 23, 2, 'leather') + R(246, 315, 21, 23, 2, 'leather') + R(276, 313, 22, 23, 2, 'leather')
      + L('M219 287 L235 287 M278 287 L293 287 M248 276 L264 276 M248 284 L265 284', palette.trim, 2)
      + R(222, 231, 12, 10, 2, 'metal') + R(279, 231, 12, 10, 2, 'metal');
  } else if (style === 'winter') {
    s += P('M224 188 L235 182 L245 187 L255 183 L268 187 L278 182 L289 189 L282 213 L273 211 L268 229 L257 219 L246 230 L239 214 L230 216 Z', 'ivory')
      + P('M239 194 L255 205 L274 193 L265 214 L257 209 L247 217 Z', 'trim', 0)
      + P('M248 225 L263 225 L263 359 L248 363 Z', 'cloth-shadow', 2)
      + L('M255 228 L255 353', palette.trim, 2)
      + R(210, 294, 35, 46, 5, 'cloth') + R(268, 294, 35, 46, 5, 'cloth-shadow')
      + P('M210 294 L245 294 L241 308 L214 308 Z', 'trim', 2) + P('M268 294 L303 294 L299 308 L272 308 Z', 'trim', 2)
      + E(228, 302, 2, 2, 'metal', 1) + E(286, 302, 2, 2, 'metal', 1)
      + L('M218 248 L239 259 M274 259 L298 248', ink, 3)
      + L('M206 352 Q256 366 307 352', palette.trim, 2);
  } else {
    s += P('M226 192 L256 210 L237 232 L219 206 Z', 'trim', 2) + P('M284 192 L256 210 L274 232 L291 205 Z', 'trim', 2)
      + P('M250 215 L262 215 L262 350 L250 350 Z', 'cloth-shadow', 0)
      + L('M256 223 L256 342', ink, 2)
      + R(215, 244, 31, 42, 3, 'cloth-shadow') + R(270, 244, 31, 42, 3, 'cloth-shadow')
      + P('M215 244 L246 244 L243 257 L219 257 Z', 'cloth', 2) + P('M270 244 L301 244 L297 257 L274 257 Z', 'cloth', 2)
      + E(230, 251, 2, 2, 'metal', 1) + E(285, 251, 2, 2, 'metal', 1)
      + R(217, 307, 27, 28, 3, 'cloth') + R(272, 307, 27, 28, 3, 'cloth-shadow')
      + E(256, 247, 2, 2, 'metal', 1) + E(256, 277, 2, 2, 'metal', 1) + E(256, 307, 2, 2, 'metal', 1);
    if (style === 'medic') s += P('M278 220 L292 220 L292 235 L278 235 Z', 'trim', 2) + P('M283 222 L287 222 L287 226 L291 226 L291 230 L287 230 L287 234 L283 234 L283 230 L279 230 L279 226 L283 226 Z', 'cloth-shadow', 0);
    if (style === 'coverall') s += P('M217 219 L242 219 L242 228 L217 228 Z', 'trim', 2) + R(269, 291, 26, 9, 2, 'leather', 1.5) + L('M274 286 L274 296 M285 286 L285 296', palette.metal, 3);
  }
  return s;
}

const schemes = {
  scout: { cloth: '#6f7961', 'cloth-shadow': '#505f51', 'cloth-highlight': '#8d9979', trim: '#d6cca8', leather: '#695448' },
  medic: { cloth: '#447c7f', 'cloth-shadow': '#315d64', 'cloth-highlight': '#679b9a', trim: '#e0d8b5', leather: '#54645d' },
  mechanic: { cloth: '#b96c4e', 'cloth-shadow': '#854d3b', 'cloth-highlight': '#d08b65', trim: '#d6cca8', leather: '#625344' },
  tactical: { cloth: '#69745f', 'cloth-shadow': '#47574b', 'cloth-highlight': '#859078', trim: '#c7c29f', leather: '#354b4e', dark: '#293d43' },
  winter: { cloth: '#c7c29f', 'cloth-shadow': '#a49f7e', 'cloth-highlight': '#e0d8b5', trim: '#8d9979', leather: '#4b5c66' }
};
for (const [id, label, description, type] of [
  ['scout', 'Explorador', 'Camiseta oliva, calça cargo e botas de campo.', 'scout'],
  ['medic', 'Socorrista', 'Jaqueta teal, calça marfim e luvas de serviço.', 'medic'],
  ['mechanic', 'Mecânico', 'Macacão ferrugem com faixas de tecido e botas.', 'coverall'],
  ['tactical', 'Guarda', 'Colete de placas escuro, mangas oliva e joelheiras.', 'tactical'],
  ['winter', 'Expedição polar', 'Parka areia com gola macia, calça azul e botas térmicas.', 'winter']
]) {
  palette = { ...colors, ...schemes[id] };
  const list = [garment(id, 'torso', `${label} — tronco`, torso(type)), ...pair(id, 'upper_arm', `${label} — manga`, upperSleeve(id === 'scout', type))];
  if (id !== 'scout') list.push(...pair(id, 'forearm', `${label} — punho`, foreSleeve(type)));
  list.push(garment(id, 'pelvis', `${label} — cintura`, pelvis(type)));
  const pants = id === 'medic' ? { cloth: '#dcd5bb', 'cloth-shadow': '#b6b29d', 'cloth-highlight': '#eee7ce' } : id === 'winter' ? { cloth: '#455d6b', 'cloth-shadow': '#304650', 'cloth-highlight': '#66808b' } : null;
  const jacketPalette = { ...palette };
  if (pants) palette = { ...palette, ...pants };
  list.push(...pair(id, 'thigh', `${label} — coxa`, thigh(type)), ...pair(id, 'shin', `${label} — canela`, shin(type)));
  palette = jacketPalette;
  list.push(...pair(id, 'foot', `${label} — bota`, boots(id)));
  if (id === 'medic' || id === 'tactical' || id === 'winter') list.push(...pair(id, 'hand', `${label} — luva`, gloves()));
  register(id, label, description, list);
}

palette = { ...colors };
const accessory = (id, label, body, parent, z, extras = {}) => add(id, label, body, parent, z, 'accessory', extras);
accessory('backpack', 'Mochila de expedição',
  P('M217 208 L203 222 L188 245 L182 319 Q184 338 204 346 L309 346 Q329 338 331 319 L324 244 L306 222 L291 208 Z', 'leather')
  + P('M193 247 L207 239 L207 329 L187 319 Z', 'wood', 0)
  + P('M307 240 L320 246 L327 319 L309 330 Z', 'cloth-shadow', 0)
  + R(176, 259, 22, 57, 6, 'trim') + L('M180 271 L193 271 M180 282 L193 282 M180 293 L193 293', palette['cloth-shadow'], 2)
  + R(317, 263, 24, 47, 5, 'cloth') + R(322, 256, 14, 11, 3, 'metal')
  + P('M204 223 Q213 204 231 207 L226 218 Q216 216 211 234 Z', 'dark')
  + P('M306 222 Q295 204 280 207 L285 218 Q295 216 299 234 Z', 'dark')
  + R(202, 315, 108, 17, 5, 'dark') + R(227, 318, 57, 9, 3, 'trim', 1), 'torso', 4, { slot: 'back', includesFrontStraps: false });
accessory('utility-belt', 'Cinto utilitário',
  P('M204 340 Q256 349 307 340 L308 364 Q256 376 203 364 Z', 'leather')
  + L('M211 346 Q256 355 300 346', palette.trim, 2)
  + R(244, 346, 26, 22, 3, 'metal') + R(250, 351, 14, 11, 1, 'dark', 1)
  + P('M210 365 L233 368 L231 399 L207 396 Z', 'cloth-shadow') + P('M209 365 L234 368 L232 379 L209 377 Z', 'cloth', 2)
  + P('M277 368 L300 365 L302 396 L279 399 Z', 'leather') + P('M276 368 L301 365 L302 376 L278 379 Z', 'wood', 2)
  + E(221, 374, 2, 2, 'metal', 1) + E(289, 374, 2, 2, 'metal', 1)
  + R(214, 342, 7, 23, 1, 'trim', 1) + R(289, 341, 7, 23, 1, 'trim', 1), 'pelvis', 56, { slot: 'belt' });
accessory('helmet', 'Capacete de campo',
  P('M210 118 L211 104 Q216 68 252 64 Q289 64 301 102 L304 120 L289 132 L281 114 Q255 122 229 113 L222 132 Z', 'cloth')
  + P('M219 101 Q226 76 251 73 L262 73 L254 104 Z', 'cloth-highlight', 0)
  + P('M278 76 Q294 88 299 108 L281 113 L270 101 Z', 'cloth-shadow', 0)
  + P('M210 108 Q256 99 303 109 L304 123 Q256 115 208 123 Z', 'dark')
  + L('M222 103 Q253 95 286 104', palette.trim, 2)
  + P('M220 124 L229 142 L222 153 L214 132 Z', 'leather', 2) + P('M292 123 L283 143 L290 153 L300 130 Z', 'leather', 2)
  + L('M225 148 L234 175 L254 188 L276 175 L286 148', palette.leather, 4) + R(250, 180, 12, 8, 2, 'metal', 1), 'head', 80, { slot: 'headwear', occludes: ['hair'] });
accessory('hazard-helmet', 'Capacete de mineração',
  P('M211 116 L212 102 Q218 67 255 65 Q289 67 300 103 L302 118 Z', 'trim')
  + P('M220 101 Q228 77 250 74 L250 106 L219 106 Z', 'ivory', 0)
  + P('M273 74 Q292 84 296 106 L278 109 L269 102 Z', 'cloth-shadow', 0)
  + P('M207 108 Q254 102 305 108 L308 123 Q256 116 205 123 Z', 'trim')
  + P('M239 71 L251 67 L261 68 L273 73 L267 107 L243 107 Z', 'cloth', 2)
  + R(242, 83, 28, 25, 4, 'dark') + E(256, 95, 9, 8, 'amber', 2) + E(253, 92, 3, 3, 'ivory', 0)
  + P('M220 124 L228 150 L221 156 L214 132 Z', 'dark', 2) + P('M291 124 L284 150 L291 156 L298 132 Z', 'dark', 2)
  + L('M225 149 L234 174 L255 188 L276 174 L286 149', palette.leather, 4) + R(250, 181, 12, 8, 2, 'metal', 1), 'head', 80, { slot: 'headwear', occludes: ['hair'] });
accessory('goggles', 'Óculos de proteção',
  P('M215 120 L298 120 L297 139 L215 139 Z', 'leather', 2)
  + P('M226 118 L245 117 L254 124 L258 124 L267 117 L287 118 L286 141 L268 145 L256 137 L244 145 L226 141 Z', 'dark')
  + P('M230 122 L244 121 L250 127 L248 138 L244 140 L230 137 Z', 'glass', 2) + P('M270 121 L283 122 L283 137 L270 140 L264 136 L263 127 Z', 'glass', 2)
  + P('M233 124 L239 123 L233 135 Z', 'ivory', 0) + P('M273 123 L279 124 L272 137 L268 136 Z', 'ivory', 0)
  + R(216, 125, 9, 8, 2, 'metal', 1) + R(288, 125, 9, 8, 2, 'metal', 1), 'head', 86, { slot: 'eyewear' });
accessory('gas-mask', 'Máscara de filtragem',
  P('M217 135 L230 126 L244 145 L269 145 L283 126 L296 135 L287 153 L280 169 L267 186 L246 186 L230 169 L224 153 Z', 'dark')
  + P('M235 143 L248 140 L256 149 L265 140 L279 145 L278 161 L269 177 L245 177 L235 161 Z', 'cloth-shadow', 2)
  + P('M245 148 L255 146 L266 148 L270 163 L257 172 L241 162 Z', 'metal', 2)
  + R(243, 156, 26, 10, 3, 'dark', 1) + L('M247 158 L247 164 M252 158 L252 165 M258 158 L258 165 M263 158 L263 164', palette.metal, 1.5)
  + E(224, 163, 13, 16, 'cloth') + E(288, 163, 13, 16, 'cloth')
  + E(224, 162, 8, 10, 'metal', 1.5) + E(288, 162, 8, 10, 'metal', 1.5)
  + L('M220 155 L227 168 M226 155 L220 169 M284 155 L291 168 M290 155 L284 169', ink, 1.5), 'head', 87, { slot: 'facewear', occludes: ['mouth', 'beard'] });

const grip = () => P('M344 349 L357 349 L357 407 Q350 414 343 407 Z', 'leather', 2)
  + L('M345 359 L356 355 M345 370 L356 366 M345 382 L356 378 M345 393 L356 389', palette.trim, 1.5)
  + E(350, 409, 9, 5, 'metal', 2);
const guard = () => P('M325 342 Q348 349 375 341 L376 351 Q351 357 324 352 Z', 'metal', 2);
const weapon = (id, label, body, extras = {}) => add(id, label, body, 'hand_l', 64, 'weapon', { slot: 'main-hand', attachment: { parent: 'hand_l', pivot: [350, 380], grip: [350, 380], offset: [0, 0], forward: [0, -1] }, ...extras });
weapon('short-sword', 'Espada curta',
  P('M341 345 L340 229 L350 202 L361 229 L360 345 Z', 'metal')
  + P('M350 212 L351 340 L357 341 L358 230 Z', 'cloth-shadow', 0)
  + L('M347 237 L347 328', palette.ivory, 2) + guard() + grip(), { family: 'blade', tip: [350, 202] });
weapon('long-sword', 'Espada longa',
  P('M340 344 L337 138 L350 103 L364 138 L361 344 Z', 'metal')
  + P('M350 115 L352 340 L358 341 L360 139 Z', 'cloth-shadow', 0)
  + L('M344 145 L345 326', palette.ivory, 2)
  + P('M320 339 L338 345 L350 341 L363 345 L382 337 L382 348 L363 354 L349 350 L337 353 L319 350 Z', 'metal', 2) + grip(), { family: 'blade', tip: [350, 103] });
weapon('katana', 'Sabre curvo',
  P('M344 345 Q352 247 363 180 Q369 131 386 104 Q376 171 371 221 L359 346 Z', 'metal')
  + P('M352 342 Q361 231 370 177 Q377 133 385 110 Q377 177 371 222 L358 344 Z', 'ivory', 0)
  + E(350, 348, 24, 5, 'dark', 2) + grip() + R(341, 407, 18, 8, 3, 'metal', 2), { family: 'blade', tip: [386, 104] });
weapon('battle-axe', 'Machado de combate',
  P('M344 176 L357 176 L357 410 Q350 415 343 410 Z', 'wood')
  + L('M348 181 L348 398', palette.trim, 2)
  + P('M340 191 L319 186 Q290 172 287 141 L300 123 L325 149 L343 154 L355 150 L372 127 L397 136 Q394 168 373 185 L358 192 Z', 'metal')
  + P('M290 143 Q297 170 319 180 L336 187 L336 178 L318 171 L299 137 Z', 'ivory', 0)
  + P('M361 155 L375 136 L391 140 Q386 165 371 177 L361 181 Z', 'cloth-shadow', 0)
  + R(337, 153, 26, 47, 3, 'dark') + E(350, 163, 3, 3, 'metal', 1) + E(350, 190, 3, 3, 'metal', 1)
  + P('M342 354 L358 354 L358 399 L342 399 Z', 'leather', 2) + L('M345 362 L356 362 M345 373 L356 373 M345 384 L356 384', palette.trim, 1.5), { family: 'axe', tip: [350, 127] });
weapon('spear', 'Lança de campo',
  P('M345 107 L355 107 L355 434 Q350 440 345 434 Z', 'wood', 2)
  + P('M349 119 L352 119 L352 423 L349 426 Z', 'trim', 0)
  + P('M340 107 L350 29 L361 107 L350 131 Z', 'metal')
  + P('M350 36 L351 118 L358 105 Z', 'cloth-shadow', 0)
  + L('M346 105 L350 57', palette.ivory, 1.5)
  + R(342, 111, 16, 15, 2, 'dark')
  + P('M342 357 L358 357 L358 398 L342 398 Z', 'leather', 2)
  + L('M344 364 L357 362 M344 374 L357 372 M344 384 L357 382 M344 394 L357 392', palette.trim, 1.5), { family: 'spear', tip: [350, 29], supportGrip: { parent: 'hand_r', point: [350, 309], offset: [0, -71], required: false } });
const shield = (id, label, body, tip) => add(id, label, body, 'hand_r', 69, 'weapon', { family: 'shield', slot: 'off-hand', attachment: { parent: 'hand_r', pivot: [162, 380], grip: [162, 380], offset: [0, 0], forward: [-1, 0] }, outlineTop: tip });
shield('round-shield', 'Escudo redondo',
  E(162, 380, 66, 70, 'metal', 3) + E(162, 380, 58, 62, 'wood', 2)
  + P('M110 343 Q113 329 125 323 L131 437 L116 427 Z', 'leather', 0)
  + L('M132 322 L132 437 M154 319 L154 440 M176 320 L176 439 M197 330 L197 429', ink, 2)
  + P('M105 374 L219 374 L220 386 L103 386 Z', 'metal', 2)
  + E(162, 380, 22, 24, 'dark', 2) + E(162, 380, 15, 17, 'metal', 2)
  + P('M152 374 Q161 365 171 372 L169 381 L159 386 Z', 'ivory', 0)
  + E(162, 319, 2, 2, 'dark', 1) + E(162, 441, 2, 2, 'dark', 1) + E(103, 380, 2, 2, 'dark', 1) + E(221, 380, 2, 2, 'dark', 1), [162, 310]);
shield('kite-shield', 'Escudo gota',
  P('M106 305 Q162 277 218 305 L213 381 Q197 421 162 462 Q127 422 111 381 Z', 'metal')
  + P('M116 313 Q162 291 209 313 L204 379 Q190 414 162 449 Q133 414 120 379 Z', 'cloth')
  + P('M162 297 Q188 301 209 313 L204 379 Q190 414 162 449 Z', 'cloth-shadow', 0)
  + P('M154 302 L171 302 L172 369 L204 369 L202 386 L171 386 L166 436 L156 436 L152 386 L121 386 L119 369 L153 369 Z', 'trim', 2)
  + E(162, 380, 16, 18, 'metal', 2) + E(162, 380, 6, 7, 'dark', 1)
  + E(121, 317, 2, 2, 'metal', 1) + E(202, 317, 2, 2, 'metal', 1), [162, 289]);
shield('tower-shield', 'Escudo torre',
  P('M106 289 Q160 275 217 289 L225 435 L203 456 L119 456 L98 435 Z', 'dark')
  + P('M114 299 Q161 286 209 299 L215 429 L198 444 L124 444 L108 428 Z', 'metal', 2)
  + P('M115 316 L148 310 L148 435 L125 435 L116 425 Z', 'cloth-shadow', 0)
  + P('M173 309 L207 316 L213 425 L198 435 L173 435 Z', 'cloth-shadow', 0)
  + P('M148 298 L174 298 L177 442 L147 442 Z', 'dark', 2)
  + P('M122 330 L200 330 L201 353 L121 353 Z', 'dark', 2)
  + R(148, 334, 29, 15, 3, 'glass', 1.5) + L('M153 337 L162 337 L157 346', palette.ivory, 1.5)
  + R(145, 374, 34, 36, 5, 'trim', 2) + L('M152 384 L172 384 M153 399 L173 399', ink, 2)
  + E(120, 303, 3, 3, 'dark', 1) + E(202, 303, 3, 3, 'dark', 1) + E(121, 436, 3, 3, 'dark', 1) + E(201, 436, 3, 3, 'dark', 1), [162, 282]);

function firearmBase(kind) {
  // Main grip is located exactly at [350, 380]; muzzle points right in the rest pose.
  const pistol = kind === 'pistol' || kind === 'revolver';
  let s = P('M344 356 L366 356 L367 369 L361 407 L343 407 L338 397 L344 378 Z', 'leather')
    + P('M348 374 L359 374 L353 400 L345 400 Z', 'cloth-highlight', 0)
    + L('M347 382 L356 383 M345 392 L354 393', palette.trim, 1.5)
    + P('M365 358 L386 359 L386 377 Q375 387 362 377 L363 371 Q375 378 380 371 L379 363 L365 363 Z', 'dark', 2)
    + P('M369 362 L370 370 L374 371', 'metal', 1.5);
  if (pistol) return s;
  s += P('M313 347 L337 349 L348 359 L341 372 L323 361 L307 356 Z', 'wood', 2)
    + P('M333 349 L342 346 L350 352 L343 365 L334 361 Z', 'leather', 2)
    + P('M379 356 L399 356 L409 395 L397 400 L383 376 Z', 'dark', 2)
    + L('M386 368 L399 392', palette.metal, 2);
  return s;
}
weapon('pistol', 'Pistola de campo',
  firearmBase('pistol')
  + P('M341 337 L419 337 L423 346 L417 360 L343 360 L337 351 Z', 'dark')
  + P('M346 339 L411 339 L411 346 L348 349 Z', 'metal', 0)
  + P('M400 342 L427 342 L427 352 L399 352 Z', 'metal', 2)
  + L('M349 342 L349 356 M355 342 L355 356 M361 342 L361 356', palette['cloth-shadow'], 2)
  + R(376, 339, 16, 9, 1, 'dark', 1) + R(348, 332, 7, 6, 1, 'metal', 1) + R(411, 332, 6, 6, 1, 'metal', 1),
  { family: 'firearm', attachment: { parent: 'hand_l', pivot: [350, 380], grip: [350, 380], offset: [0, 0], forward: [1, 0] }, muzzle: [427, 347] });
weapon('revolver', 'Revólver de campo',
  firearmBase('revolver')
  + P('M343 342 L372 334 L395 339 L432 338 L434 350 L394 354 L374 364 L342 358 Z', 'metal')
  + R(356, 334, 34, 29, 7, 'dark', 2) + R(360, 337, 26, 23, 5, 'metal', 1.5)
  + L('M366 339 L366 357 M376 339 L376 357', ink, 2)
  + R(390, 340, 49, 9, 2, 'dark', 2) + L('M398 343 L433 343', palette.metal, 1.5)
  + P('M341 341 L336 331 L344 328 L352 341 Z', 'metal', 2) + R(425, 332, 5, 7, 1, 'metal', 1),
  { family: 'firearm', attachment: { parent: 'hand_l', pivot: [350, 380], grip: [350, 380], offset: [0, 0], forward: [1, 0] }, muzzle: [439, 345] });
weapon('shotgun', 'Espingarda de expedição',
  firearmBase('shotgun')
  + P('M276 328 L333 336 L351 351 L341 366 L318 354 L281 361 L271 349 Z', 'wood')
  + P('M286 336 L324 341 L334 350 L324 349 L286 354 Z', 'leather', 0)
  + P('M335 338 L386 338 L397 347 L388 360 L338 360 Z', 'dark')
  + R(382, 340, 113, 9, 2, 'metal', 2) + R(382, 351, 100, 8, 2, 'dark', 2)
  + P('M396 349 L438 349 L443 367 L399 367 L392 359 Z', 'wood', 2)
  + L('M400 352 L400 363 M408 351 L408 364 M416 351 L416 364 M424 351 L424 364 M432 351 L432 364', ink, 1.5)
  + R(356, 343, 18, 8, 2, 'metal', 1.5) + R(481, 335, 6, 6, 1, 'dark', 1),
  { family: 'firearm', attachment: { parent: 'hand_l', pivot: [350, 380], grip: [350, 380], offset: [0, 0], forward: [1, 0] }, muzzle: [495, 345], supportGrip: { parent: 'hand_r', point: [418, 361], offset: [68, -19], required: true } });
weapon('assault-rifle', 'Rifle automático',
  firearmBase('rifle')
  + P('M280 332 L323 334 L343 347 L338 363 L320 351 L286 359 L275 350 Z', 'dark')
  + P('M289 337 L317 338 L321 344 L288 350 Z', 'cloth-shadow', 2)
  + P('M335 337 L395 333 L412 340 L405 361 L340 365 L333 354 Z', 'dark')
  + P('M343 338 L389 337 L389 349 L342 352 Z', 'metal', 0)
  + P('M404 338 L459 338 L465 350 L458 365 L403 361 Z', 'cloth-shadow', 2)
  + L('M411 345 L454 345 M412 354 L453 354', ink, 2)
  + R(461, 341, 30, 8, 2, 'metal', 2) + R(490, 339, 12, 12, 2, 'dark', 2)
  + R(344, 331, 99, 5, 1, 'dark', 1)
  + P('M365 332 L365 316 L382 307 L404 307 L415 317 L415 331 L407 331 L407 319 L382 319 L373 322 L373 332 Z', 'dark', 2)
  + R(360, 343, 23, 8, 1, 'dark', 1) + E(394, 351, 3, 3, 'metal', 1)
  + L('M389 368 L401 391 M395 368 L407 388', palette.metal, 1.5),
  { family: 'firearm', attachment: { parent: 'hand_l', pivot: [350, 380], grip: [350, 380], offset: [0, 0], forward: [1, 0] }, muzzle: [502, 345], supportGrip: { parent: 'hand_r', point: [431, 357], offset: [81, -23], required: true } });
weapon('sniper-rifle', 'Rifle de precisão',
  firearmBase('rifle')
  + P('M274 330 L321 334 L339 347 L336 365 L321 355 L284 362 L269 350 Z', 'wood')
  + P('M282 336 L315 339 L323 346 L283 352 Z', 'leather', 0)
  + P('M333 338 L395 336 L419 343 L453 343 L459 354 L448 365 L380 358 L338 364 Z', 'dark')
  + P('M338 341 L388 340 L390 351 L340 354 Z', 'metal', 0)
  + R(407, 343, 91, 8, 2, 'metal', 2) + R(489, 341, 15, 12, 2, 'dark', 2)
  + R(358, 326, 7, 14, 1, 'metal', 1) + R(392, 326, 7, 13, 1, 'metal', 1)
  + P('M344 309 L356 305 L397 305 L410 309 L410 322 L397 326 L356 326 L344 322 Z', 'dark', 2)
  + R(356, 308, 42, 15, 3, 'metal', 1.5) + R(369, 302, 15, 9, 2, 'dark', 1.5)
  + E(411, 315, 3, 8, 'glass', 1) + L('M363 311 L389 311', palette.ivory, 1.5)
  + P('M391 342 L397 342 L401 357 L395 360 L390 349 Z', 'metal', 1.5)
  + L('M441 358 L452 380 M443 358 L432 379', palette.metal, 3),
  { family: 'firearm', attachment: { parent: 'hand_l', pivot: [350, 380], grip: [350, 380], offset: [0, 0], forward: [1, 0] }, muzzle: [504, 347], supportGrip: { parent: 'hand_r', point: [422, 359], offset: [72, -21], required: true } });
weapon('energy-carbine', 'Carabina de energia',
  firearmBase('rifle')
  + P('M288 328 L317 331 L339 345 L334 362 L313 348 L290 355 L282 347 Z', 'dark')
  + P('M293 333 L312 335 L323 342 L319 345 L294 348 Z', 'cloth', 2)
  + P('M334 338 L388 330 L411 334 L431 340 L473 340 L484 350 L471 365 L414 365 L393 371 L338 364 L330 351 Z', 'dark')
  + P('M340 341 L385 335 L397 340 L392 354 L341 358 Z', 'metal', 2)
  + P('M347 343 L380 339 L385 343 L381 350 L346 353 Z', 'glass', 2)
  + P('M407 340 L424 340 L424 361 L408 361 L399 352 Z', 'cloth', 2)
  + L('M412 345 L412 356 M419 345 L419 356', palette.glass, 2)
  + R(432, 343, 37, 16, 3, 'metal', 2) + R(437, 347, 26, 7, 2, 'glass', 1)
  + P('M475 341 L493 337 L500 343 L500 357 L493 363 L475 359 Z', 'dark', 2)
  + R(491, 344, 9, 12, 2, 'glass', 1)
  + R(354, 329, 37, 6, 1, 'dark', 1) + P('M360 328 L363 317 L381 317 L386 328 Z', 'dark', 2)
  + P('M384 368 L397 367 L407 395 L395 402 L388 389 Z', 'cloth', 2) + R(395, 381, 6, 9, 1, 'glass', 1),
  { family: 'energy', attachment: { parent: 'hand_l', pivot: [350, 380], grip: [350, 380], offset: [0, 0], forward: [1, 0] }, muzzle: [500, 350], supportGrip: { parent: 'hand_r', point: [444, 359], offset: [94, -21], required: true } });

const xml = s => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const svg = part => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768" role="img" aria-label="${xml(part.label)}" data-layer="${part.id}" data-parent="${part.parent}" data-pivot="${part.pivot.join(',')}"><title>${xml(part.label)}</title>${part.body}</svg>\n`;
for (const part of parts) {
  const group = part.category === 'clothing' ? 'clothing' : 'equipment';
  part.svg = `svg/${group}/${part.id}.svg`;
  part.png = `png/${group}/${part.id}.png`;
  fs.mkdirSync(path.join(root, 'svg', group), { recursive: true });
  fs.mkdirSync(path.join(root, 'png', group), { recursive: true });
  fs.writeFileSync(path.join(root, part.svg), svg(part));
  if (!process.argv.includes('--svg-only')) {
    const result = spawnSync('rsvg-convert', ['--width', '512', '--height', '768', '-o', path.join(root, part.png), path.join(root, part.svg)], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Cannot rasterize ${part.id}: ${result.stderr || result.error}`);
  }
}
const manifest = {
  schema: 'frontier-survival.modular-wardrobe.v1', originalArtwork: true,
  canvas: { width: 512, height: 768, unit: 'px', origin: 'top-left', background: 'transparent' },
  handedness: 'l/r refer to the character: l is viewer right, r is viewer left.',
  instructions: 'Stack all untrimmed layers at (0,0), ascending z. Apply each clothing/equipment layer with its parent body joint transform. SVG data-palette attributes name recolorable fill roles. Main-hand weapons point up (blades) or right (firearms) in rest pose; supportGrip is an optional IK target in canvas coordinates. Clothing overlays body without suppressing the parent skin layer.',
  paletteRoles: ['cloth', 'cloth-shadow', 'cloth-highlight', 'trim', 'metal', 'wood', 'leather', 'glass', 'amber', 'dark', 'ivory'],
  outfits,
  accessories: parts.filter(p => p.category === 'accessory').map(p => p.id),
  weapons: parts.filter(p => p.category === 'weapon').map(p => p.id),
  parts: parts.map(({ body, ...metadata }) => metadata),
  counts: { outfits: outfits.length, clothing: parts.filter(p => p.category === 'clothing').length, accessories: 6, weapons: 14, totalLayers: parts.length },
};
fs.writeFileSync(path.join(root, 'manifest-wardrobe.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Generated ${parts.length} original SVG layers (${manifest.counts.clothing} clothing, 6 accessories, 14 weapons)${process.argv.includes('--svg-only') ? '' : ' and matching transparent PNGs'}.`);
