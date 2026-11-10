import * as THREE from 'three';
import timing from './timing.json';

// monotone cubic time warp: beat times per path key -> path position 0..1 (ease in/out)
export function warpU(T, t) {
  const n = T.length; if (t <= T[0]) return 0; if (t >= T[n - 1]) return 1;
  const sec = []; for (let i = 0; i < n - 1; i++) sec.push((1 / (n - 1)) / (T[i + 1] - T[i]));
  const m = [0]; for (let i = 1; i < n - 1; i++) m.push(2 * sec[i - 1] * sec[i] / (sec[i - 1] + sec[i])); m.push(0);
  let i = 0; while (t > T[i + 1]) i++;
  const h = T[i + 1] - T[i], x = (t - T[i]) / h, x2 = x * x, x3 = x2 * x;
  return (2 * x3 - 3 * x2 + 1) * (i / (n - 1)) + (x3 - 2 * x2 + x) * h * m[i] + (-2 * x3 + 3 * x2) * ((i + 1) / (n - 1)) + (x3 - x2) * h * m[i + 1];
}

const S = Object.fromEntries(timing.shots.map((s) => [s.key, s]));
const keys = timing.shots.map((s) => s.key);
// cut = midway between the end of one sentence and the start of the next
export const CUTS = keys.map((k, i) => (i === 0 ? 0 : (timing.shots[i - 1].end + timing.shots[i].start) / 2));
export const END = timing.duration;
// word time: proportional position of word index (0-based) inside a sentence
export const wordT = (key, idx) => S[key].start + (S[key].end - S[key].start) * idx / S[key].words;

// light presets
export const LIGHTS = {
  night: {sun: '#a9b8ff', si: 1.0, sky: '#4a50a0', gnd: '#2a2030', hi: 1.0, fog: '#232856', near: 120, far: 420, sunOff: [-40, 90, 50], shadow: 70, top: '#0b1030', hor: '#3e3f86', pt: null},
  day: {sun: '#fff0cf', si: 2.6, sky: '#a9d8ff', gnd: '#d9a878', hi: 1.15, fog: '#cfe7f7', near: 160, far: 650, sunOff: [-50, 90, 60], shadow: 80, top: '#3d8fe0', hor: '#cde9f8', pt: null},
  storm: {sun: '#cdd3de', si: 1.1, sky: '#8a95a6', gnd: '#4a4f58', hi: 1.0, fog: '#66738a', near: 45, far: 260, sunOff: [-40, 80, 40], shadow: 80, top: '#3c4454', hor: '#7d889a', pt: null},
  office: {sun: '#fff4e4', si: 1.6, sky: '#f4fbff', gnd: '#b48a62', hi: 1.05, fog: '#efe2cb', near: 30, far: 90, sunOff: [-6, 9, 7], shadow: 10, top: '#7fb7e6', hor: '#d6ecf6', pt: {c: '#ffc77a', i: 7, p: [-2.5, 3.6, 0.5], d: 14}},
  yard: {sun: '#ffe7bd', si: 2.5, sky: '#b5dcff', gnd: '#d1ad7c', hi: 1.15, fog: '#e2e3d4', near: 70, far: 260, sunOff: [-14, 22, 14], shadow: 20, top: '#3d8fe0', hor: '#d9ecf5', pt: null},
  joint: {sun: '#ffe0b0', si: 2.3, sky: '#c4c8dc', gnd: '#5a5662', hi: 1.3, fog: '#4a4a58', near: 30, far: 80, sunOff: [-7, 12, 9], shadow: 12, top: '#222', hor: '#333', pt: {c: '#ffb066', i: 16, p: [-3.2, 4.6, -1.5], d: 12}},
  weather: {sun: '#eef2ff', si: 1.4, sky: '#eef3f6', gnd: '#8f7b66', hi: 1.1, fog: '#e3e7e1', near: 30, far: 90, sunOff: [-6, 9, 7], shadow: 10, top: '#56606e', hor: '#9aa4b0', pt: {c: '#ffd58a', i: 5, p: [0, 3.8, 0], d: 14}},
  shop: {sun: '#fff4e4', si: 1.6, sky: '#f4fbff', gnd: '#b48a62', hi: 1.1, fog: '#efe2cb', near: 30, far: 90, sunOff: [-6, 9, 7], shadow: 10, top: '#7fb7e6', hor: '#d6ecf6', pt: {c: '#ffb066', i: 8, p: [2.5, 3.4, -1], d: 12}},
  works: {sun: '#ffe7c4', si: 1.7, sky: '#e6f2ff', gnd: '#a87a52', hi: 1.1, fog: '#e8dcc6', near: 30, far: 90, sunOff: [-6, 9, 7], shadow: 10, top: '#7fb7e6', hor: '#d6ecf6', pt: {c: '#ffc77a', i: 8, p: [-1.5, 3.6, 0.5], d: 14}},
  morning: {sun: '#ffbf7a', si: 2.5, sky: '#ffe0bd', gnd: '#c08a5a', hi: 1.0, fog: '#f6d9b8', near: 160, far: 650, sunOff: [-60, 40, 50], shadow: 80, top: '#6fa6dd', hor: '#ffd3a1', pt: null},
};

const v = (a) => new THREE.Vector3(...a);
// location x offsets (must match worlds.js LOC)
const Y = 0, ST = 300, O = 600, PZ = 800, M = 900, SI = 1000, T = 1500;
// camera plan: per shot, location light, anchor (for the light), path keys {p, l}, optional beat times
export const PLAN = {
  hook: {light: 'yard', anchor: [Y, 0, 0], keys: [{p: [Y - 0.6, 1.95, 5.2], l: [Y - 2.3, 1.25, 0.4]}, {p: [Y - 1.3, 1.65, 4.1], l: [Y - 2.3, 1.2, 0.6]}, {p: [Y - 1.8, 1.5, 3.4], l: [Y - 2.3, 1.15, 0.7]}], beats: 'words:hook:0,6,13'},
  war: {light: 'day', anchor: [ST, 0, -10], keys: [{p: [ST - 0.2, 1.5, 6.4], l: [ST - 1.3, 1.0, 2.4]}, {p: [ST + 0.6, 2.2, 7.0], l: [ST, 3.0, -10]}, {p: [ST + 0.8, 3.0, 8.0], l: [ST, 4.5, -40]}], beats: 'words:war:0,5,13'},
  tax: {light: 'office', anchor: [O, 0, 0], keys: [{p: [O - 1.4, 1.8, 3.8], l: [O + 1.0, 2.5, -5]}, {p: [O + 0.2, 1.9, 2.6], l: [O + 1.5, 2.9, -5.3]}, {p: [O + 0.9, 2.2, 1.2], l: [O + 1.5, 3.0, -5.3]}], beats: 'words:tax:0,3,14'},
  count: {light: 'yard', anchor: [Y + 3, 0, -3], keys: [{p: [Y - 0.6, 1.8, 2.8], l: [Y + 1.0, 1.1, -3]}, {p: [Y + 2.6, 1.8, 2.5], l: [Y + 3.6, 1.1, -3.5]}, {p: [Y + 5.4, 2.1, 2.8], l: [Y + 7.5, 1.5, -6]}], beats: 'words:count:0,9,15'},
  climb: {light: 'office', anchor: [O, 0, 0], keys: [{p: [O - 0.6, 1.9, 2.4], l: [O + 1.5, 2.9, -5.3]}, {p: [O + 1.0, 2.3, 0.3], l: [O + 1.5, 3.0, -5.3]}, {p: [O + 1.5, 2.6, -0.7], l: [O + 1.5, 3.0, -5.3]}], beats: 'words:climb:0,6,13'},
  but: {light: 'office', anchor: [O, 0, 0], keys: [{p: [O + 2.6, 2.0, 1.6], l: [O + 4.2, 1.2, -1.3]}, {p: [O + 3.4, 2.2, 0.6], l: [O + 4.2, 1.2, -1.3]}, {p: [O + 4.0, 2.35, 0.2], l: [O + 4.2, 1.25, -1.35]}], beats: 'words:but:0,9,15'},
  yousee: {light: 'shop', anchor: [PZ, 0, 0], keys: [{p: [PZ - 1.6, 2.3, 2.5], l: [PZ - 1.0, 1.1, -0.9]}, {p: [PZ, 2.5, 2.7], l: [PZ, 1.2, -1.0]}, {p: [PZ + 1.4, 2.3, 2.3], l: [PZ + 1.0, 1.1, -0.9]}], beats: 'words:yousee:0,9,18'},
  wilkes: {light: 'works', anchor: [M, 0, 0], keys: [{p: [M + 0.8, 1.9, 3.3], l: [M - 1.0, 1.4, -0.6]}, {p: [M + 0.0, 1.75, 2.7], l: [M - 0.9, 1.3, 0.0]}, {p: [M - 0.5, 1.65, 2.1], l: [M - 0.9, 1.25, 0.3]}], beats: 'words:wilkes:0,4,13'},
  gobs: {light: 'yard', anchor: [SI, 0, 0], keys: [{p: [SI - 2.6, 1.8, 4.8], l: [SI - 1.6, 1.3, -1.5]}, {p: [SI, 2.0, 5.4], l: [SI, 1.5, -1.5]}, {p: [SI + 1.6, 2.2, 4.6], l: [SI + 1.8, 1.8, -1.5]}], beats: 'words:gobs:0,5,14'},
  then: {light: 'office', anchor: [O, 0, 0], keys: [{p: [O - 0.5, 1.9, 2.7], l: [O - 2.0, 1.3, -0.4]}, {p: [O - 1.2, 2.1, 1.8], l: [O - 1.8, 1.2, 0.2]}, {p: [O - 1.6, 2.3, 1.45], l: [O - 1.7, 1.15, 0.45]}], beats: 'words:then:0,3,17'},
  so: {light: 'works', anchor: [M, 0, 0], keys: [{p: [M + 1.6, 1.8, 2.5], l: [M + 0.4, 1.2, 0.3]}, {p: [M + 0.6, 1.7, 2.1], l: [M + 0.0, 1.15, 0.4]}, {p: [M - 0.4, 1.9, 2.7], l: [M - 0.8, 1.2, 0.2]}], beats: 'words:so:0,4,11'},
  close: {light: 'morning', anchor: [T, 0, 0], keys: [{p: [T + 2.2, 2.0, 10.0], l: [T + 1.6, 1.5, 4.8]}, {p: [T + 0.8, 2.6, 11.2], l: [T, 4, -2]}, {p: [T, 4.5, 13.8], l: [T, 6, -2]}], beats: 'words:close:0,6,16'},
};

// precompute curves + beat times
const CURVES = {};
keys.forEach((k, i) => {
  const P = PLAN[k];
  const a = CUTS[i], b = i + 1 < keys.length ? CUTS[i + 1] : END;
  let T;
  if (P.beats && P.beats.startsWith('words:')) {
    const [, key, idx] = P.beats.split(':');
    T = idx.split(',').map(Number).map((n) => wordT(key, n));
    T[0] = a; T[T.length - 1] = b;
  } else T = P.keys.map((_, j) => a + (b - a) * j / (P.keys.length - 1));
  CURVES[k] = {
    p: new THREE.CatmullRomCurve3(P.keys.map((q) => v(q.p)), false, 'centripetal'),
    l: new THREE.CatmullRomCurve3(P.keys.map((q) => v(q.l)), false, 'centripetal'),
    T, a, b,
  };
});

export function shotAt(t) {
  let i = 0; while (i + 1 < CUTS.length && t >= CUTS[i + 1]) i++;
  return keys[i];
}
export function cameraAt(t) {
  const k = shotAt(t); const C = CURVES[k];
  const u = warpU(C.T, t);
  return {key: k, pos: C.p.getPointAt(u), look: C.l.getPointAt(u), plan: PLAN[k], a: C.a, b: C.b};
}
// dip-to-cream opacity around location changes (0.4 s total)
const CONT = new Set([]); // these shots continue the previous camera move
export function dipAt(t) {
  let o = 0;
  keys.forEach((k, i) => {
    if (i === 0 || CONT.has(k)) return;
    const c = CUTS[i]; const d = Math.abs(t - c);
    if (d < 0.2) o = Math.max(o, 1 - d / 0.2);
  });
  return o;
}
