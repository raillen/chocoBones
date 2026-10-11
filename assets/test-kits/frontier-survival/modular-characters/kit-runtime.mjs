/** Shared pure FK renderer used by the local viewer and animation exporter. */
export function colorShift(hex, amount) {
  const value = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#a68164';
  const channels = [1, 3, 5].map(index => Math.max(0, Math.min(255, parseInt(value.slice(index, index + 2), 16) + amount)));
  return '#' + channels.map(value => value.toString(16).padStart(2, '0')).join('');
}

export function multiplyMatrix(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}

export function transformPoint(matrix, point) {
  return [matrix[0] * point[0] + matrix[2] * point[1] + matrix[4], matrix[1] * point[0] + matrix[3] * point[1] + matrix[5]];
}

export function rotationAt(degrees, pivot) {
  const radians = degrees * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  return [cosine, sine, -sine, cosine, pivot[0] - cosine * pivot[0] + sine * pivot[1], pivot[1] - sine * pivot[0] - cosine * pivot[1]];
}

export function skeletalMatrices(kit, angles = {}) {
  const cache = {}, bones = new Map(kit.skeleton.map(bone => [bone.id, bone])), solving = new Set();
  function solve(id) {
    if (!id || !bones.has(id)) return [1, 0, 0, 1, 0, 0];
    if (cache[id]) return cache[id];
    if (solving.has(id)) throw new Error('Hierarquia cíclica: ' + id);
    solving.add(id);
    const bone = bones.get(id);
    cache[id] = multiplyMatrix(solve(bone.parent), rotationAt(angles[id] || 0, bone.pivot));
    solving.delete(id);
    return cache[id];
  }
  for (const bone of kit.skeleton) solve(bone.id);
  return cache;
}

export function sampleAnimation(kit, clipId, seconds) {
  const clip = kit.animations.clips.find(clip => clip.id === clipId) || kit.animations.clips[0];
  const duration = clip.duration_seconds;
  const time = clip.loop ? ((seconds % duration) + duration) % duration : Math.max(0, Math.min(duration, seconds));
  const frames = clip.frames;
  let before = frames[0], after = frames[0], beforeTime = 0, afterTime = 0;
  for (let index = 0; index < frames.length; index++) {
    if (frames[index].time_seconds <= time + 1e-9) {
      before = frames[index]; beforeTime = before.time_seconds;
      if (index + 1 < frames.length) { after = frames[index + 1]; afterTime = after.time_seconds; }
      else if (clip.loop) { after = frames[0]; afterTime = duration; }
      else { after = before; afterTime = beforeTime; }
    }
  }
  const mix = afterTime > beforeTime ? (time - beforeTime) / (afterTime - beforeTime) : 0;
  const angles = {};
  for (const id of new Set([...Object.keys(before.angles_deg), ...Object.keys(after.angles_deg)])) angles[id] = (before.angles_deg[id] || 0) * (1 - mix) + (after.angles_deg[id] || 0) * mix;
  return {
    clip_id: clip.id, time_seconds: time, angles_deg: angles,
    root_offset_px: [0, 1].map(axis => (before.root_offset_px[axis] || 0) * (1 - mix) + (after.root_offset_px[axis] || 0) * mix),
  };
}

export function defaultConfiguration(kit, gender = 'male') {
  const options = kit.options;
  const first = (key, fallback = '') => (options[key] || []).find(item => !item.gender || item.gender === gender)?.id || fallback;
  return {
    schema: 'frontier-survival.modular-configuration.v1', gender,
    skin: kit.skin_presets[gender === 'female' ? 2 : 3]?.color || '#b98664',
    hair: first('hair'), hair_color: gender === 'female' ? '#4c332d' : '#37332d',
    head_shape: first('head_shapes'), eyes: first('eyes'), iris_color: '#567c74',
    brows: first('brows'), nose: first('nose'), mouth: first('mouth'),
    outfit: gender === 'female' ? 'medic' : 'scout', cloth_color: gender === 'female' ? '#447c7f' : '#6f7961',
    accessories: [], weapon: gender === 'female' ? 'pistol' : 'long-sword', shield: gender === 'female' ? '' : 'kite-shield',
    clip: 'idle', auto_loadout: false,
  };
}

export function configurationForGender(kit, config, gender) {
  const result = { ...config, gender };
  for (const key of ['hair', 'head_shapes', 'eyes', 'brows', 'nose', 'mouth']) {
    const configKey = key === 'head_shapes' ? 'head_shape' : key;
    const options = (kit.options[key] || []).filter(item => !item.gender || item.gender === gender);
    if (!options.some(item => item.id === result[configKey])) result[configKey] = options[0]?.id || '';
  }
  return result;
}

export function recommendedConfiguration(kit, config, clip) {
  const result = { ...config, accessories: [...config.accessories] };
  const selectedWeapon = kit.parts.find(part => part.id === result.weapon);
  if (clip.recommended_equipment === 'ranged') {
    if (!selectedWeapon || !kit.firearm_ids.includes(selectedWeapon.id)) result.weapon = 'pistol';
  } else if (clip.recommended_equipment === 'melee') {
    if (!selectedWeapon || kit.firearm_ids.includes(selectedWeapon.id)) result.weapon = 'long-sword';
  } else if (clip.recommended_equipment === 'shield' && !result.shield) result.shield = 'kite-shield';
  return result;
}

function xmlEscape(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function paletteFor(config) {
  const skin = config.skin, hair = config.hair_color, cloth = config.cloth_color;
  return {
    skin, skinLight: colorShift(skin, 26), skinDark: colorShift(skin, -28), skin_light: colorShift(skin, 26), skin_shadow: colorShift(skin, -28), skinShade: colorShift(skin, -28),
    hair, hairLight: colorShift(hair, 22), hairDark: colorShift(hair, -18), hair_light: colorShift(hair, 22), hair_shadow: colorShift(hair, -18),
    iris: config.iris_color, irisLight: colorShift(config.iris_color, 28), irisDark: colorShift(config.iris_color, -30),
    cloth, clothLight: colorShift(cloth, 25), clothDark: colorShift(cloth, -30), cloth_light: colorShift(cloth, 25), cloth_shadow: colorShift(cloth, -30),
    brows: hair, brow: hair,
  };
}

function recolorMarkup(markup, palette) {
  return markup.replace(/<([a-z][\w:-]*)(\s[^<>]*?)?>/gi, (tag, name, attributes = '') => {
    const role = attributes.match(/data-palette=["']([^"']+)["']/i)?.[1];
    if (!role || !palette[role]) return tag;
    const fill = palette[role];
    if (/\sfill=["'][^"']*["']/i.test(tag)) return tag.replace(/\sfill=["'][^"']*["']/i, ' fill="' + fill + '"');
    return tag.replace(/\s*\/?>$/, match => ' fill="' + fill + '"' + match);
  });
}

export function selectedParts(kit, config) {
  const body = kit.bodies.find(body => body.id === config.gender) || kit.bodies[0];
  const byId = new Map(kit.parts.map(part => [part.id, part]));
  const parts = body.parts.map(id => byId.get(id)).filter(Boolean);
  if (config.head_shape && byId.has(config.head_shape)) {
    for (let index = parts.length - 1; index >= 0; index--) if ((parts[index].bone || parts[index].id) === 'head') parts.splice(index, 1);
    parts.push(byId.get(config.head_shape));
  }
  for (const key of ['hair', 'eyes', 'brows', 'nose', 'mouth']) if (config[key] && byId.has(config[key])) parts.push(byId.get(config[key]));
  const outfit = kit.outfits.find(outfit => outfit.id === config.outfit);
  for (const id of outfit?.pieces || []) if (byId.has(id)) parts.push(byId.get(id));
  for (const id of [...config.accessories, config.weapon, config.shield]) if (id && byId.has(id)) parts.push(byId.get(id));
  const suppressed = new Set(parts.flatMap(part => Array.isArray(part.suppressBody) ? part.suppressBody : []));
  return parts.filter(part => !suppressed.has(part.id) && !suppressed.has(part.bone)).sort((a, b) => a.z - b.z);
}

export function composePoseSvg(kit, config, pose, showBones = false) {
  const clip = kit.animations.clips.find(clip => clip.id === pose.clip_id);
  const selected = config.auto_loadout && clip ? recommendedConfiguration(kit, config, clip) : config;
  const matrices = skeletalMatrices(kit, pose.angles_deg);
  const palette = paletteFor(selected), layers = [];
  for (const part of selectedParts(kit, selected)) {
    const matrix = part.bone && matrices[part.bone] ? matrices[part.bone] : multiplyMatrix(matrices[part.parent] || [1, 0, 0, 1, 0, 0], rotationAt(pose.angles_deg[part.id] || 0, part.pivot));
    const values = matrix.map(value => Number(value.toFixed(6))).join(' ');
    layers.push('<g data-part="' + xmlEscape(part.id) + '" transform="matrix(' + values + ')">' + recolorMarkup(part.markup, palette) + '</g>');
  }
  if (showBones) {
    const bones = new Map(kit.skeleton.map(bone => [bone.id, bone]));
    const shapes = [];
    for (const bone of kit.skeleton) {
      const at = transformPoint(matrices[bone.id], bone.pivot);
      const parent = bones.get(bone.parent);
      if (parent) {
        const from = transformPoint(matrices[parent.id], parent.pivot);
        shapes.push('<line x1="' + from[0] + '" y1="' + from[1] + '" x2="' + at[0] + '" y2="' + at[1] + '"/>');
      }
      shapes.push('<circle cx="' + at[0] + '" cy="' + at[1] + '" r="5"/>');
    }
    layers.push('<g fill="#e9bb61" stroke="#f4de8b" stroke-width="2.5" opacity=".9">' + shapes.join('') + '</g>');
  }
  const offset = kit.canvas.character_offset_px || [0, 0], root = pose.root_offset_px || [0, 0];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + kit.canvas.width + '" height="' + kit.canvas.height + '" viewBox="0 0 ' + kit.canvas.width + ' ' + kit.canvas.height + '"><title>' + xmlEscape('Frontier Survival — ' + selected.gender + ' — ' + pose.clip_id) + '</title><g transform="translate(' + (offset[0] + root[0]) + ' ' + (offset[1] + root[1]) + ')">' + layers.join('') + '</g></svg>';
}
