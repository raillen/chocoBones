import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=path.dirname(fileURLToPath(import.meta.url));
const C={ink:'#24383e',skin:'#c28d68','skin-shadow':'#a87052','skin-highlight':'#daa881',hair:'#353b38','hair-shadow':'#263331',iris:'#587c72',white:'#f1ede2'};
const palette=(key)=>C[key]||key;
const P=(d,fill,sw=3,stroke=C.ink)=>`<path d="${d}" fill="${palette(fill)}"${C[fill]?` data-palette="${fill}"`:''} stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const L=(d,key='skin-shadow',sw=2)=>`<path d="${d}" fill="none" stroke="${palette(key)}"${C[key]?` data-palette-stroke="${key}"`:''} stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
const E=(x,y,rx,ry,fill,sw=2)=>`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${palette(fill)}"${C[fill]?` data-palette="${fill}"`:''} stroke="${C.ink}" stroke-width="${sw}"/>`;
const mirror=s=>`<g transform="translate(512 0) scale(-1 1)">${s}</g>`;
const wrap=(body,label)=>`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 512 768" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`;
const bodyParts=[],cosmetics=[],underwear=[];
const skeleton=[
  ['pelvis',[256,376],null,20],['torso',[256,276],'pelvis',50],['head',[256,190],'torso',60],
  ['upper_arm_r',[210,224],'torso',40,[181,296]],['upper_arm_l',[302,224],'torso',41,[331,296]],
  ['forearm_r',[180,299],'upper_arm_r',30,[162,374]],['forearm_l',[332,299],'upper_arm_l',31,[350,374]],
  ['hand_r',[162,380],'forearm_r',65],['hand_l',[350,380],'forearm_l',66],
  ['thigh_r',[220,396],'pelvis',10,[220,523]],['thigh_l',[292,396],'pelvis',11,[292,523]],
  ['shin_r',[218,524],'thigh_r',12,[213,640]],['shin_l',[294,524],'thigh_l',13,[299,640]],
  ['foot_r',[213,644],'shin_r',14],['foot_l',[299,644],'shin_l',15]
];
const labels={pelvis:'Quadril',torso:'Tronco',head:'Cabeça base',upper_arm_r:'Braço direito',upper_arm_l:'Braço esquerdo',forearm_r:'Antebraço direito',forearm_l:'Antebraço esquerdo',hand_r:'Mão direita',hand_l:'Mão esquerda',thigh_r:'Coxa direita',thigh_l:'Coxa esquerda',shin_r:'Canela direita',shin_l:'Canela esquerda',foot_r:'Pé direito',foot_l:'Pé esquerdo'};
function addBody(model,id,body){const[,pivot,parent,z,distal]=skeleton.find(p=>p[0]===id);bodyParts.push({id:`${model}_${id}`,slot:id,model,label:labels[id],category:'body',parent,pivot,z,...(distal?{distal}:{}),svg:`svg/body/${model}/${id}.svg`,png:`png/body/${model}/${id}.png`,body})}

for(const model of ['male','female']){
  const male=model==='male';
  const arm=male
    ?P('M207 204 Q195 208 190 223 L169 278 Q165 294 175 305 Q187 314 197 302 L221 251 Q230 231 227 221 Q225 207 207 204 Z','skin',4)+P('M197 222 Q208 214 216 225 L205 251 L189 290 L178 293 L176 283 Z','skin-highlight',0,'none')+P('M194 255 L189 280 L196 286 L207 263 Z','skin-shadow',0,'none')+L('M191 225 Q198 221 208 227 M175 295 Q185 299 193 296')
    :P('M208 208 Q196 210 191 224 L171 278 Q168 293 177 303 Q185 310 195 300 L218 250 Q227 229 223 218 Q219 209 208 208 Z','skin',4)+P('M198 222 L211 220 L203 248 L183 292 L176 289 L177 279 Z','skin-highlight',0,'none')+P('M197 263 L195 283 L193 299 L185 303 L186 288 Z','skin-shadow',0,'none')+L('M198 225 L205 227 M179 294 L190 296');
  const forearm=P(male?'M179 288 Q192 288 196 302 L178 366 Q175 380 162 382 Q149 380 150 366 L161 308 Q166 290 179 288 Z':'M180 290 Q191 290 193 302 L176 368 Q174 378 162 382 Q152 379 152 368 L162 309 Q166 292 180 290 Z','skin',4)+P('M168 307 L176 298 L182 300 L166 371 L156 372 L157 362 Z','skin-highlight',0,'none')+P('M188 313 L181 353 L173 373 L166 377 L172 349 Z','skin-shadow',0,'none')+L('M172 314 L169 339 M155 367 Q163 372 173 369');
  const hand=P('M156 372 Q168 370 175 379 L172 393 L174 407 Q172 413 168 411 L164 406 L162 418 Q158 424 152 420 L148 414 Q142 414 141 407 L143 387 Q144 376 156 372 Z','skin',4)+P('M148 385 L156 379 L160 381 L155 404 L149 414 L146 407 Z','skin-highlight',0,'none')+L('M164 390 L160 405 M154 407 L152 417 M168 394 L167 405');
  const thigh=male
    ?P('M214 380 Q232 377 243 391 L244 454 L236 522 Q232 538 218 540 Q203 537 200 525 L197 461 L202 404 Q204 388 214 380 Z','skin',4)+P('M207 410 L217 393 L226 393 L218 461 L218 507 L208 523 L202 519 L202 461 Z','skin-highlight',0,'none')+P('M235 406 L238 456 L230 510 L226 529 L218 533 L221 507 L224 457 Z','skin-shadow',0,'none')+L('M212 435 L210 476 M205 518 Q218 508 232 518 M209 530 Q219 534 229 528')
    :P('M211 380 Q229 376 243 390 L244 438 Q243 475 234 519 Q231 537 217 539 Q202 535 201 523 L195 454 L199 412 Q202 390 211 380 Z','skin',4)+P('M205 410 L215 394 L225 393 L216 448 L215 498 L208 521 L203 517 L200 453 Z','skin-highlight',0,'none')+P('M234 406 L239 444 L231 497 L224 530 L217 532 L221 498 L224 449 Z','skin-shadow',0,'none')+L('M204 517 Q217 508 231 517 M208 528 Q217 532 227 527');
  const shin=P(male?'M207 514 Q220 507 233 516 L236 573 L226 648 Q224 657 212 658 Q201 657 198 646 L193 581 Q194 544 207 514 Z':'M207 514 Q220 507 232 516 L234 563 Q232 587 224 649 Q222 657 212 658 Q201 657 199 646 L195 580 Q194 547 207 514 Z','skin',4)+P('M202 541 L211 533 L216 535 L210 580 L210 628 L206 644 L201 644 L199 581 Z','skin-highlight',0,'none')+P('M228 539 L231 573 L221 644 L213 651 L217 625 L220 579 Z','skin-shadow',0,'none')+L('M208 552 L205 578 M207 632 L210 643');
  const foot=P('M200 634 L223 635 L226 652 L225 669 Q222 679 210 684 L182 689 Q174 688 174 681 L184 666 L191 654 L192 643 Q194 636 200 634 Z','skin',4)+P('M194 646 L204 640 L212 643 L208 661 L184 680 L179 681 L192 656 Z','skin-highlight',0,'none')+P('M216 643 L222 647 L221 666 L205 678 L193 683 L183 684 L186 679 L210 664 Z','skin-shadow',0,'none')+L('M184 680 L186 676 M190 677 L192 673 M198 673 L200 669 M207 668 L210 664');
  addBody(model,'upper_arm_r',arm);addBody(model,'upper_arm_l',mirror(arm));
  addBody(model,'forearm_r',forearm);addBody(model,'forearm_l',mirror(forearm));
  addBody(model,'hand_r',hand);addBody(model,'hand_l',mirror(hand));
  addBody(model,'thigh_r',thigh);addBody(model,'thigh_l',mirror(thigh));
  addBody(model,'shin_r',shin);addBody(model,'shin_l',mirror(shin));
  addBody(model,'foot_r',foot);addBody(model,'foot_l',mirror(foot));
  addBody(model,'pelvis',male
    ?P('M218 335 Q256 347 293 335 L306 373 L300 407 L276 421 L256 405 L237 421 L211 407 L204 374 Z','skin',4)+P('M214 351 L237 354 L238 389 L220 408 L210 402 L209 374 Z','skin-highlight',0,'none')+P('M277 351 L293 346 L301 376 L294 404 L277 415 L265 404 L275 386 Z','skin-shadow',0,'none')+L('M218 361 L229 378 M291 361 L281 378')
    :P('M223 334 Q256 346 289 334 Q304 350 309 378 L301 407 L278 423 L256 406 L235 423 L209 408 L203 379 Q209 350 223 334 Z','skin',4)+P('M220 351 L237 357 L237 389 L220 409 L210 403 L208 379 Z','skin-highlight',0,'none')+P('M276 355 L291 345 Q301 361 303 380 L294 407 L277 417 L266 405 L277 387 Z','skin-shadow',0,'none')+L('M217 365 L228 378 M294 365 L283 378'));
  addBody(model,'torso',male
    ?P('M236 190 L276 190 Q296 197 310 212 L307 246 L294 271 L289 312 L296 352 Q256 366 216 352 L224 312 L219 271 L204 247 L202 214 Q215 198 236 190 Z','skin',4)+P('M220 213 L239 203 L249 232 L247 306 L236 346 L222 347 L230 311 L224 269 L212 244 Z','skin-highlight',0,'none')+P('M277 202 L297 215 L297 242 L285 267 L280 311 L288 348 L266 356 L261 306 L265 234 Z','skin-shadow',0,'none')+L('M218 219 Q234 213 247 224 M265 224 Q279 213 297 220 M224 248 Q238 259 249 248 M264 248 Q279 259 291 249 M256 267 L256 305 M241 296 L245 314 M273 296 L269 314', 'skin-shadow',2)+E(256,326,2,3,'skin-shadow',0)
    :P('M236 190 L276 190 Q292 197 306 214 L303 244 Q300 259 289 277 L280 312 L291 352 Q256 367 221 352 L232 312 L222 277 Q211 262 209 244 L206 215 Q221 197 236 190 Z','skin',4)+P('M221 215 L239 205 L250 233 L244 273 L243 313 L233 348 L225 348 L238 312 L229 275 L218 246 Z','skin-highlight',0,'none')+P('M276 203 L295 218 L297 242 L283 276 L273 312 L285 350 L266 357 L260 313 L267 271 L264 234 Z','skin-shadow',0,'none')+L('M219 218 Q236 213 247 225 M265 225 Q279 214 295 219 M256 277 L256 306 M244 316 L241 331 M270 316 L273 331','skin-shadow',2)+E(256,331,2,3,'skin-shadow',0));
  addBody(model,'head',P('M238 168 L274 168 L279 202 Q256 218 233 202 Z','skin',4)+P('M261 173 L274 172 L278 200 L259 207 Z','skin-shadow',0,'none')+E(216,136,9,15,'skin',3)+E(296,136,9,15,'skin',3)+P(male?'M220 112 Q219 82 255 78 Q289 80 293 111 L291 146 Q286 168 268 183 L246 183 Q226 172 220 148 Z':'M221 111 Q223 81 256 78 Q290 81 292 112 L289 145 Q285 168 267 181 L247 181 Q228 168 223 146 Z','skin',4)+P('M225 119 L231 98 L248 89 L257 117 L252 158 L239 169 Q229 157 226 142 Z','skin-highlight',0,'none')+P('M275 98 L289 112 L286 144 Q282 164 267 177 L257 179 L271 155 Z','skin-shadow',0,'none')+L('M215 131 L218 140 M296 131 L293 140','skin-shadow',2));
}

function cosmetic(id,slot,label,body,z=63){cosmetics.push({id,slot,label,category:'cosmetic',parent:'head',pivot:[256,190],z,models:['male','female'],svg:`svg/cosmetics/${id}.svg`,png:`png/cosmetics/${id}.png`,body})}
const eye=(x,y,shape)=>P(shape,'white',2)+E(x,y,4,4.5,'iris',1)+E(x,y,1.5,2.5,C.ink,0)+E(x-1,y-1,1,1,'white',0);
cosmetic('eyes_calm','eyes','Olhos tranquilos',eye(238,130,'M230 129 Q237 125 246 130 Q237 135 230 129 Z')+eye(274,130,'M266 130 Q274 125 282 129 Q274 135 266 130 Z'));
cosmetic('eyes_round','eyes','Olhos arredondados',eye(238,130,'M229 130 Q237 119 247 130 Q238 140 229 130 Z')+eye(274,130,'M265 130 Q274 119 283 130 Q274 140 265 130 Z'));
cosmetic('eyes_focused','eyes','Olhos atentos',eye(238,131,'M230 128 L246 129 Q238 137 230 128 Z')+eye(274,131,'M266 129 L282 128 Q274 137 266 129 Z'));
cosmetic('eyes_soft','eyes','Olhos suaves',eye(238,131,'M229 131 Q237 123 247 130 Q238 138 229 131 Z')+eye(274,131,'M265 130 Q274 123 283 131 Q274 138 265 130 Z')+L('M230 129 L228 126 M282 129 L284 126','hair',2));
cosmetic('brows_straight','brows','Sobrancelhas retas',P('M229 120 L245 119 L245 123 L230 124 Z','hair',1)+P('M267 119 L283 120 L282 124 L267 123 Z','hair',1));
cosmetic('brows_arched','brows','Sobrancelhas arqueadas',P('M229 122 Q235 114 245 118 L245 121 Q236 118 230 124 Z','hair',1)+P('M267 118 Q277 114 283 122 L282 124 Q276 118 267 121 Z','hair',1));
cosmetic('brows_thick','brows','Sobrancelhas densas',P('M229 117 L245 116 L246 122 L230 124 Z','hair',1)+P('M267 116 L283 117 L282 124 L266 122 Z','hair',1));
cosmetic('brows_slanted','brows','Sobrancelhas inclinadas',P('M230 115 L246 120 L245 124 L229 120 Z','hair',1)+P('M266 120 L282 115 L283 120 L267 124 Z','hair',1));
cosmetic('nose_angular','nose','Nariz angular',P('M256 131 L251 146 L260 149 L264 145 L259 140 Z','skin-shadow',0,'none')+L('M256 132 L251 146 L259 148','skin-shadow',2));
cosmetic('nose_soft','nose','Nariz suave',P('M254 134 L252 145 Q256 152 262 145 L259 139 Z','skin-shadow',0,'none')+L('M251 146 Q256 150 262 146','skin-shadow',2));
cosmetic('nose_broad','nose','Nariz largo',P('M253 133 L248 145 Q248 152 255 152 Q263 154 267 146 L260 133 Z','skin-shadow',0,'none')+P('M254 136 L258 136 L262 146 L253 147 Z','skin-highlight',0,'none')+L('M249 148 L252 149 M262 150 L265 148','skin-shadow',2));
cosmetic('mouth_neutral','mouth','Boca neutra',L('M246 158 Q256 160 266 158','skin-shadow',2.5)+L('M251 163 L261 163','skin-highlight',2));
cosmetic('mouth_smile','mouth','Sorriso discreto',P('M245 156 Q256 162 267 156 Q260 169 251 165 Z','skin-shadow',0,'none')+P('M248 158 Q256 161 264 158 L261 162 L251 162 Z','white',0,'none'));
cosmetic('mouth_full','mouth','Lábios cheios',P('M245 158 L251 154 L256 157 L261 154 L267 158 Q261 166 256 165 Q250 164 245 158 Z','skin-shadow',0,'none')+L('M247 158 L265 158','skin-shadow',2)+L('M252 162 L261 162','skin-highlight',1.5));
cosmetic('mouth_stern','mouth','Boca séria',L('M246 161 Q256 156 266 161','skin-shadow',2.5)+L('M250 165 L262 165','skin-highlight',2));

cosmetic('hair_crop','hair','Cabelo curto',P('M220 128 L214 119 L215 101 Q216 79 240 73 L268 72 Q290 76 297 97 L298 123 L290 129 L286 109 L274 102 L268 86 Q249 108 225 104 Z','hair',4)+P('M225 95 Q236 80 260 80 L270 80 Q252 94 236 99 Z','hair-shadow',0,'none'),61);
cosmetic('hair_undercut','hair','Undercut',P('M220 122 L215 112 L217 94 Q225 71 251 70 Q287 68 296 93 L293 114 L286 115 L282 101 Q250 115 226 103 L226 119 Z','hair',4)+P('M218 104 L225 102 L227 126 L220 132 L216 121 Z','hair-shadow',0,'none')+P('M287 102 L295 100 L297 121 L290 132 L286 117 Z','hair-shadow',0,'none')+L('M233 91 Q255 76 282 85','hair-shadow',3),61);
cosmetic('hair_curls','hair','Cabelo cacheado',P('M214 127 Q202 117 209 103 Q198 91 210 81 Q207 69 223 66 Q228 52 242 61 Q254 50 265 60 Q282 52 289 66 Q308 67 305 82 Q316 94 305 106 Q311 121 299 129 L288 128 L285 107 Q273 113 264 103 Q254 112 245 103 Q233 112 225 106 L224 127 Z','hair',4)+L('M218 82 Q229 71 236 84 M242 74 Q253 64 260 79 M272 80 Q285 72 291 87 M213 100 Q223 91 229 101 M241 96 Q251 86 259 98 M279 98 Q291 91 296 103','hair-shadow',4),61);
cosmetic('hair_long','hair','Cabelo longo',P('M211 112 Q208 77 237 68 Q269 57 290 78 Q304 91 302 120 L310 196 Q313 230 301 263 L279 260 L284 210 L285 147 L279 112 Q254 121 230 103 L225 141 L225 210 L232 259 L211 264 Q198 234 204 204 Z','hair',4)+P('M214 135 L220 116 L218 203 L224 252 L214 254 L209 218 Z','hair-shadow',0,'none')+P('M291 110 L297 123 L304 202 L301 251 L290 256 L293 211 Z','hair-shadow',0,'none')+L('M231 88 Q253 72 274 85 M214 163 L212 207 M294 159 L300 207','hair-shadow',3),61);
cosmetic('hair_bob','hair','Cabelo bob',P('M209 113 Q208 77 237 69 Q272 60 293 83 Q305 97 303 125 L306 172 L288 184 L281 159 L287 128 L284 109 Q261 119 244 109 L230 98 L225 133 L232 158 L225 183 L207 170 Z','hair',4)+P('M212 132 L220 112 L216 160 L224 174 L216 173 L210 159 Z','hair-shadow',0,'none')+P('M292 110 L300 121 L302 166 L293 176 L287 161 Z','hair-shadow',0,'none')+L('M229 87 Q252 74 275 84','hair-shadow',3),61);
cosmetic('hair_ponytail','hair','Rabo de cavalo',P('M285 97 Q312 85 324 108 Q329 122 318 140 Q310 157 321 178 Q328 197 316 218 L301 228 Q308 204 299 185 Q288 165 303 142 Q313 124 296 120 Z','hair',4)+P('M315 110 Q327 125 311 146 Q301 161 315 183 Q323 199 308 218 Q314 199 303 181 Q294 163 305 144 Q318 123 307 115 Z','hair-shadow',0,'none')+P('M219 128 L213 116 L215 98 Q224 70 256 69 Q288 70 299 96 L299 117 L288 128 L283 108 Q253 122 225 105 L226 125 Z','hair',4)+L('M229 94 Q254 76 284 92','hair-shadow',3)+P('M294 104 L305 105 L307 117 L296 121 Z','#b96c4e',2),61);
cosmetic('hair_bun','hair','Coque',E(268,64,22,18,'hair',4)+L('M257 55 Q278 53 283 68 M255 66 Q268 59 281 73','hair-shadow',3)+P('M220 128 L214 116 L216 100 Q224 74 255 73 Q288 72 297 100 L296 118 L288 129 L284 110 Q254 122 225 107 L225 126 Z','hair',4)+P('M224 97 Q250 80 284 95 L289 104 Q255 94 229 108 Z','hair-shadow',0,'none'),61);
cosmetic('hair_braids','hair','Tranças',P('M219 122 L210 109 Q211 78 240 69 Q273 60 293 81 L303 108 L295 123 L286 107 L279 91 Q260 111 230 103 L226 122 Z','hair',4)+L('M222 89 Q245 78 255 75 M231 99 Q254 83 264 77 M247 104 Q269 88 276 81','hair-shadow',3)+P('M218 120 L211 132 L221 147 L209 161 L220 176 L210 192 L221 210 L217 232 L231 233 L230 211 L234 194 L227 178 L236 162 L228 146 L233 128 Z','hair',3)+P('M290 120 L300 132 L290 147 L302 162 L291 177 L301 193 L290 210 L295 233 L281 235 L281 211 L278 193 L285 177 L276 161 L284 146 L278 129 Z','hair',3)+L('M214 133 L228 143 M214 164 L230 174 M214 193 L230 203 M294 134 L282 144 M297 164 L281 174 M297 194 L283 203','hair-shadow',3)+P('M216 225 L232 224 L232 235 L218 237 Z','#b96c4e',2)+P('M280 225 L295 224 L297 235 L282 237 Z','#b96c4e',2),61);

for(const model of ['male','female']){
  const body=model==='male'?P('M208 350 Q256 366 304 350 L307 389 L300 423 L273 425 L256 409 L239 425 L211 422 L204 388 Z','#505f51',4)+P('M207 351 Q256 365 305 351 L306 363 Q256 378 206 363 Z','#8d9979',2)+L('M255 371 L255 400','#aab5aa',2)+L('M216 414 L238 416 M277 416 L296 414','#6f7961',3)
    :P('M226 218 L231 247 L251 249 L256 241 L261 249 L282 247 L288 218 L296 224 L288 259 Q271 270 256 258 Q242 270 224 258 L218 225 Z','#505f51',4)+P('M226 237 Q241 226 250 239 L251 253 Q236 260 226 251 Z','#6f7961',0,'none')+P('M263 239 Q275 226 286 236 L283 251 Q272 261 261 253 Z','#6f7961',0,'none')+P('M208 355 Q256 370 305 355 L299 381 L278 410 L257 416 L235 410 L213 381 Z','#505f51',4)+P('M208 355 Q256 369 305 355 L302 367 Q256 382 212 366 Z','#8d9979',2)+L('M236 405 Q257 411 278 405','#6f7961',3);
  underwear.push({id:`underwear_${model}`,slot:'underwear',model,label:model==='male'?'Roupa base masculina':'Roupa base feminina',category:'underwear',parent:'pelvis',pivot:[256,376],z:52,defaultVisible:true,svg:`svg/underwear/${model}.svg`,png:`png/underwear/${model}.png`,body});
}

// The upper garment follows torso independently; bottoms follow pelvis.
const femaleUnderwear=underwear.find(p=>p.model==='female');
const split=femaleUnderwear.body.indexOf('<path d="M208 355');
underwear.push({...femaleUnderwear,id:'underwear_female_top',slot:'underwear_top',label:'Top base feminino',parent:'torso',pivot:[256,276],svg:'svg/underwear/female_top.svg',png:'png/underwear/female_top.png',body:femaleUnderwear.body.slice(0,split)});
femaleUnderwear.body=femaleUnderwear.body.slice(split);femaleUnderwear.label='Roupa base inferior feminina';femaleUnderwear.slot='underwear_bottom';
underwear.find(p=>p.model==='male').slot='underwear_bottom';

const headShapes={male:[],female:[]};
const shapeNames={oval:'Oval',square:'Quadrado',round:'Arredondado'};
for(const model of ['male','female'])for(const shape of ['oval','square','round']){
  const male=model==='male';
  const outlines={
    oval:male?'M220 112 Q219 82 255 78 Q289 80 293 111 L291 146 Q286 168 268 183 L246 183 Q226 172 220 148 Z':'M221 111 Q223 81 256 78 Q290 81 292 112 L289 145 Q285 168 267 181 L247 181 Q228 168 223 146 Z',
    square:male?'M219 111 Q221 81 255 78 Q290 79 293 110 L292 151 L283 174 L271 186 L242 186 L228 175 L219 152 Z':'M221 111 Q223 82 256 78 Q289 81 292 111 L289 150 L281 169 L269 182 L244 182 L231 170 L223 150 Z',
    round:male?'M218 111 Q218 79 256 76 Q294 80 294 112 L295 144 Q291 175 267 185 L246 185 Q222 177 217 147 Z':'M220 111 Q221 79 256 77 Q291 79 294 112 L293 143 Q289 171 269 180 L245 180 Q223 171 219 145 Z'
  };
  const body=P('M238 168 L274 168 L279 202 Q256 218 233 202 Z','skin',4)+P('M261 173 L274 172 L278 200 L259 207 Z','skin-shadow',0,'none')+E(216,136,9,15,'skin',3)+E(296,136,9,15,'skin',3)+P(outlines[shape],'skin',4)+P('M225 119 L231 98 L248 89 L257 117 L252 158 L239 169 Q229 157 226 142 Z','skin-highlight',0,'none')+P('M275 98 L289 112 L286 144 Q282 164 267 177 L257 179 L271 155 Z','skin-shadow',0,'none')+L('M215 131 L218 140 M296 131 L293 140','skin-shadow',2);
  const id=`head_${model}_${shape}`;
  cosmetics.push({id,slot:'head',model,label:`Rosto ${shapeNames[shape].toLowerCase()} ${male?'masculino':'feminino'}`,category:'head-shape',parent:'torso',pivot:[256,190],z:60,models:[model],replacesBody:'head',svg:`svg/cosmetics/${id}.svg`,png:`png/cosmetics/${id}.png`,body});
  headShapes[model].push(id);
}

const skinPresets=[
  {id:'porcelain',label:'Claro rosado',values:{skin:'#efc7b0','skin-shadow':'#d19c86','skin-highlight':'#ffe1ca'}},
  {id:'sand',label:'Claro dourado',values:{skin:'#deb48c','skin-shadow':'#bc8c68','skin-highlight':'#f4cfaa'}},
  {id:'bronze',label:'Bronze',values:{skin:'#c28d68','skin-shadow':'#a87052','skin-highlight':'#daa881'}},
  {id:'warm_umber',label:'Marrom quente',values:{skin:'#986b4f','skin-shadow':'#79523e','skin-highlight':'#bb8965'}},
  {id:'deep_brown',label:'Marrom profundo',values:{skin:'#704b3b','skin-shadow':'#50382f','skin-highlight':'#956a50'}},
  {id:'ebony',label:'Escuro neutro',values:{skin:'#513c35','skin-shadow':'#392d2a','skin-highlight':'#77594a'}}
];
const hairPresets=[{id:'charcoal',label:'Carvão',values:{hair:'#353b38','hair-shadow':'#263331'}},{id:'brown',label:'Castanho',values:{hair:'#624637','hair-shadow':'#45352e'}},{id:'auburn',label:'Ruivo',values:{hair:'#a45e42','hair-shadow':'#743f32'}},{id:'blonde',label:'Loiro',values:{hair:'#d2b16d','hair-shadow':'#a68449'}},{id:'silver',label:'Grisalho',values:{hair:'#b9c1b5','hair-shadow':'#8a9891'}},{id:'teal',label:'Teal',values:{hair:'#5a8c86','hair-shadow':'#3f6665'}}];
const irisPresets=[{id:'teal',label:'Verde',values:{iris:'#587c72'}},{id:'brown',label:'Castanho',values:{iris:'#785442'}},{id:'amber',label:'Âmbar',values:{iris:'#ae873d'}},{id:'blue',label:'Azul',values:{iris:'#7096ad'}},{id:'gray',label:'Cinza',values:{iris:'#767e83'}}];
const all=[...bodyParts,...cosmetics,...underwear];
for(const part of all){fs.mkdirSync(path.dirname(path.join(root,part.svg)),{recursive:true});fs.writeFileSync(path.join(root,part.svg),wrap(part.body,part.label))}
const withoutMarkup=({body,...part})=>part;
const characterDefaults={male:{hair:'hair_crop',eyes:'eyes_calm',brows:'brows_straight',nose:'nose_angular',mouth:'mouth_neutral',headShape:'head_male_oval'},female:{hair:'hair_bob',eyes:'eyes_soft',brows:'brows_arched',nose:'nose_soft',mouth:'mouth_full',headShape:'head_female_oval'}};
const manifest={schema:'frontier-survival.modular-characters.v1',originalArtwork:true,canvas:{width:512,height:768,unit:'px',origin:'top-left',background:'transparent'},handedness:'l/r are anatomical; l appears at viewer right',models:['male','female'],characters:['male','female'].map(id=>({id,label:id==='male'?'Homem':'Mulher',parts:bodyParts.filter(p=>p.model===id).map(p=>p.id),underwear:underwear.filter(p=>p.model===id).map(p=>p.id),defaults:characterDefaults[id]})),skeleton:skeleton.map(([id,pivot,parent,z,distal])=>({id,pivot,parent,z,...(distal?{distal}:{})})),faceAnchors:{headCenter:[256,132],eye_r:[238,130],eye_l:[274,130],brows:[256,121],nose:[256,141],mouth:[256,158]},palette:{defaults:C,skinPresets,hairPresets,irisPresets,fillAttribute:'data-palette',strokeAttribute:'data-palette-stroke'},defaults:{model:'male',...characterDefaults.male,skin:'bronze',hairColor:'charcoal',iris:'teal',underwear:true},bodyParts:bodyParts.map(withoutMarkup),cosmetics:cosmetics.map(withoutMarkup),head_shapes:headShapes,cosmetic_groups:Object.fromEntries(['hair','eyes','brows','nose','mouth'].map(slot=>[slot,cosmetics.filter(p=>p.slot===slot).map(p=>p.id)])),underwear:underwear.map(withoutMarkup),parts:all.map(withoutMarkup),instructions:'All layers share 512×768 coordinates. Stack ascending z. Resolve body parent by slot, not model-prefixed id. Cosmetics attach to head. Head-shape variants replace the head body slot and use its matrix. Underwear is a separate overlay; keep enabled for base previews. Palette changes replace tagged fills/strokes only. No animation or native integration is claimed.'};
fs.writeFileSync(path.join(root,'manifest-body.json'),JSON.stringify(manifest,null,2)+'\n');
for(const model of ['male','female']){
  const defaultCosmetics=characterDefaults[model];
  const preview=[...bodyParts.filter(p=>p.model===model),...underwear.filter(p=>p.model===model),...['hair','eyes','brows','nose','mouth'].map(slot=>cosmetics.find(p=>p.id===defaultCosmetics[slot]))].sort((a,b)=>a.z-b.z);
  fs.writeFileSync(path.join(root,`${model}-base.svg`),wrap(preview.map(p=>`<g data-part="${p.id}">${p.body}</g>`).join(''),`Base modular ${model}`));
}
if(process.argv.includes('--png')){
  for(const part of all){fs.mkdirSync(path.dirname(path.join(root,part.png)),{recursive:true});const result=spawnSync('rsvg-convert',['-w','512','-h','768','-o',path.join(root,part.png),path.join(root,part.svg)],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr)}
  for(const model of ['male','female']){const result=spawnSync('rsvg-convert',['-w','512','-h','768','-o',path.join(root,`${model}-base.png`),path.join(root,`${model}-base.svg`)],{encoding:'utf8'});if(result.status!==0)throw new Error(result.stderr)}
}
console.log(`${bodyParts.length} body parts, ${cosmetics.length} cosmetics, ${underwear.length} underwear overlays. Shared skeleton 512×768.`);
