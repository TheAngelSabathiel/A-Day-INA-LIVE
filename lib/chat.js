const HANDLES = [
  'mommy_lyn', 'tita_bebs', 'marites.ph', 'ina_ng_lahat', 'kuya_jun88', 'momshie_kat',
  'titoboy_live', 'beshy.ina', 'lola_cora', 'juicyfan_01', 'mamshie.rose', 'anon_ina',
  'batang90s', 'fur.mama', 'pinay_mom24', 'nanay_ni_jun', 'ate.girl', 'tsismis.hub',
];

export function randomHandle() {
  return HANDLES[Math.floor(Math.random() * HANDLES.length)];
}

// "name|message" sets the handle. Plain lines get a random handle.
export function parseChatLine(raw = '', randomize = false) {
  const i = raw.indexOf('|');
  if (i > 0) {
    return { name: randomize ? randomHandle() : raw.slice(0, i).trim(), text: raw.slice(i + 1).trim() };
  }
  return { name: randomHandle(), text: raw.trim() };
}
