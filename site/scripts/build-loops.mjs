// Turn frame-by-frame recordings of the live site's looping cards (tests/capture/tape.mjs) into
// src/scripts/loops.json: one repeating cycle per card, as numeric tracks the browser replays.
// Usage: node scripts/build-loops.mjs <tapes dir>
// Only style-level properties are kept (transform, gradient glow, stroke dash); layout values that
// merely follow from them (x, y, w, h) are dropped.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2];
const CARDS = ['Discovery card', 'Maintenence card', 'Business chatbot card', 'Content creation card', 'Lead Card', 'Data analystic card', 'AI consulting card'];
const PROPS = { tr: 'transform', bi: 'backgroundImage', sd: 'strokeDasharray' };
const GRID = 16; // ms between resampled points while searching for the period
const KEEP = 33; // ms between stored points

const $ = cheerio.load(readFileSync(join(root, 'src/snapshot/index.body.html'), 'utf8'), { decodeEntities: false });
const NUM = /-?\d*\.?\d+(?:e-?\d+)?/g;
const split = (s) => (s = s === 'none' ? 'matrix(1, 0, 0, 1, 0, 0)' : s, { tpl: s.replace(NUM, '\u0000'), nums: (s.match(NUM) || []).map(Number) });

const out = {};
for (const card of CARDS) {
  const file = join(dir, card.replace(/ /g, '_') + '.json');
  if (!existsSync(file)) continue;
  const tape = JSON.parse(readFileSync(file, 'utf8'));
  const dur = tape.frames.at(-1)[0];

  // verify the recorded elements line up with the snapshot markup (document order, tag, name)
  const cardEl = $(`[data-framer-name="${card}"]`).first();
  const local = [cardEl.get(0), ...cardEl.find('*').toArray()];
  const bad = tape.elements.filter((e, i) => !local[i] || local[i].name !== e.tag || (e.cls && !(local[i].attribs.class || '').split(' ').includes(e.cls) && !/^(first|second|third)/.test(e.name)));
  if (bad.length) console.warn(`${card}: ${bad.length} elements differ from the markup (first: ${JSON.stringify(bad[0])})`);

  // per element+property step functions of time
  const series = new Map(); // key "i:prop" -> [[t, string]]
  for (const [t, diff] of tape.frames)
    for (const [i, props] of Object.entries(diff))
      if (+i > 0) for (const [k, v] of Object.entries(props)) if (PROPS[k]) {
        const key = `${i}:${k}`;
        (series.get(key) ?? series.set(key, []).get(key)).push([t, v]);
      }
  // drop series that never change after the first frames
  for (const [k, s] of series) if (new Set(s.map((x) => x[1])).size < 3) series.delete(k);
  if (!series.size) continue;

  // numeric sample vectors on a regular grid
  const keys = [...series.keys()];
  const parsed = keys.map((k) => series.get(k).map(([t, v]) => [t, split(v)]));
  const at = (pi, t) => { // value of series pi at time t (last change before t)
    let lo = 0;
    const s = parsed[pi];
    for (let j = 0; j < s.length && s[j][0] <= t; j++) lo = j;
    return s[lo][1];
  };
  const scale = parsed.map((s) => {
    const n = s[0][1].nums.length, sc = new Array(n).fill(1e-6);
    for (let j = 0; j < n; j++) { const vals = s.map((x) => x[1].nums[j]); sc[j] = Math.max(1e-6, Math.max(...vals) - Math.min(...vals)); }
    return sc;
  });
  const dist = (idx, t1, t2) => {
    let e = 0, c = 0;
    idx.forEach((pi) => { const a = at(pi, t1).nums, b = at(pi, t2).nums; a.forEach((x, j) => { e += Math.abs(x - b[j]) / scale[pi][j]; c++; }); });
    return e / c;
  };
  // best period for a set of tracks: smallest P whose mismatch is close to the global minimum
  const findPeriod = (idx) => {
    const cands = [];
    for (let P = 1500; P <= dur - 3000; P += 10) {
      let e = 0, n = 0;
      for (let t = 300; t + P <= dur; t += 80) { e += dist(idx, t, t + P); n++; }
      cands.push([e / n, P]);
    }
    const min = Math.min(...cands.map((c) => c[0]));
    return cands.find((c) => c[0] <= min * 1.25 + 0.002);
  };
  // tracks with near-equal periods share a clock (their jitter is shared too); others loop alone
  const meanDist = (idx, P) => { let e = 0, n = 0; for (let t = 300; t + P <= dur; t += 80) { e += dist(idx, t, t + P); n++; } return e / n; };
  const best = keys.map((_, pi) => findPeriod([pi]));
  const clusters = [];
  keys.forEach((_, pi) => {
    // join a cluster when the periods agree, or one is a whole multiple of the other and the
    // shorter period still repeats this track about as well
    const c = clusters.find((c) => {
      const lead = best[c[0]][1], mine = best[pi][1], P = Math.min(lead, mine);
      const r = Math.max(lead, mine) / P;
      if (Math.abs(r - Math.round(r)) / r > 0.04 || Math.round(r) > 4) return false;
      return meanDist([pi], P) <= best[pi][0] * 1.6 + 0.003 && meanDist([c[0]], P) <= best[c[0]][0] * 1.6 + 0.003;
    });
    c ? c.push(pi) : clusters.push([pi]);
  });
  out[card] = clusters.map((idx) => {
    const P = Math.min(...idx.map((i) => best[i][1])), err = meanDist(idx, P);
    let t0 = 300, seam = Infinity;
    for (let t = 300; t + P <= dur; t += 16) { const s = dist(idx, t, t + P); if (s < seam) { seam = s; t0 = t; } }
    console.log(`${card}: ${idx.length} tracks (${idx.map((i) => keys[i]).join(' ')}), period ${P}ms (mismatch ${err.toFixed(4)}, seam ${seam.toFixed(4)}) start ${t0}ms`);
    const tracks = idx.map((pi) => {
      const [i, prop] = keys[pi].split(':');
      const pts = [];
      for (let t = t0; t < t0 + P; t += KEEP) pts.push([Math.round(t - t0), ...at(pi, t).nums.map((n) => Math.round(n * 100) / 100)]);
      pts.push([P, ...at(pi, t0).nums.map((n) => Math.round(n * 100) / 100)]); // close the loop on its start value
      return { el: +i, prop: PROPS[prop], tpl: parsed[pi][0][1].tpl, pts };
    });
    return { period: P, tracks };
  });
}
writeFileSync(join(root, 'src/scripts/loops.json'), JSON.stringify(out));
console.log('wrote loops.json', JSON.stringify(out).length, 'bytes');
