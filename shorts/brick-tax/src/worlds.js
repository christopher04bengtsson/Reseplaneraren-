import * as THREE from 'three';
import {INK, rng, toon, box, cyl, sign, facade, lampPost, crate, ground, sidewalk, arrow, cloud, paintTex, ink} from './kit.js';
import {character} from './char.js';
import {wordT} from './camera.js';
import {dressStreet} from './dress.js';
import * as P from './props.js';

// location x offsets (must match camera.js)
export const LOC = {yard: 0, street: 300, office: 600, pizza: 800, works: 900, site: 1000, today: 1500};

// smooth 0..1 between a and b (seconds)
export const ease = (t, a, b) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const pop = (t, a, d = 0.35) => { const x = Math.min(1, Math.max(0, (t - a) / d)); return x <= 0 ? 0.001 : x * (1 + 0.35 * Math.sin(x * Math.PI)); };

const BRICK = '#b5523b';
// ---------- brick courses texture (tile = 4 bricks wide x 8 courses tall) ----------
function brickTex(base = BRICK, {seed = 1, mortar = '#e2d3b6', courses = 8} = {}) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = mortar; g.fillRect(0, 0, 512, 512);
  const r = rng(seed); const bc = new THREE.Color(base);
  const ch = 512 / courses, cw = 128, m = 7;
  for (let row = 0; row < courses; row++) {
    const off = row % 2 ? cw / 2 : 0;
    for (let i = -1; i < 5; i++) {
      const x = i * cw + off;
      const col = bc.clone().offsetHSL((r() - 0.5) * 0.03, (r() - 0.5) * 0.1, (r() - 0.5) * 0.12);
      g.fillStyle = col.getStyle(); g.fillRect(x + m / 2, row * ch + m / 2, cw - m, ch - m);
      g.fillStyle = 'rgba(255,240,220,0.18)'; g.fillRect(x + m / 2, row * ch + m / 2, cw - m, 4);
      g.fillStyle = 'rgba(40,10,5,0.22)'; g.fillRect(x + m / 2, row * ch + ch - m / 2 - 5, cw - m, 5);
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
// wall of bricks; course = height of one brick course in metres (normal 0.17, gob 0.34)
function brickWall(w, h, d, {course = 0.17, base = BRICK, seed = 1} = {}) {
  const tex = brickTex(base, {seed});
  tex.repeat.set(w / (course * 2.65 * 4), h / (course * 8));
  const side = brickTex(base, {seed: seed + 1}); side.repeat.set(d / (course * 2.65 * 4), h / (course * 8));
  const top = toon(new THREE.Color(base).multiplyScalar(0.9).getStyle());
  const geo = new THREE.BoxGeometry(w, h, d); geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, [toon('#ffffff', side), toon('#ffffff', side), top, top, toon('#ffffff', tex), toon('#ffffff', tex)]);
  m.castShadow = true; m.receiveShadow = true; ink(m, 0.02, true);
  m.userData.setH = (hh) => { m.scale.y = Math.max(0.001, hh / h); tex.repeat.y = hh / (course * 8); side.repeat.y = hh / (course * 8); };
  return m;
}
const brick = (thick = 0.15, c = BRICK) => box(0.48, thick, 0.23, c, {thick: 0.012});

function room(ox, {w = 14, h = 5, d = 10, wall = '#efe0c4', floor = '#a7764e', seed = 4} = {}) {
  const g = new THREE.Group();
  const wt = paintTex(wall, {seed, stains: 14}); wt.repeat.set(2, 1);
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon('#ffffff', wt, {side: THREE.BackSide}));
  walls.position.set(ox, h / 2, 0); walls.receiveShadow = true; g.add(walls);
  const ft = paintTex(floor, {seed: seed + 1, stripes: (gg, W, H) => { gg.strokeStyle = 'rgba(60,30,15,0.35)'; gg.lineWidth = 2; for (let i = 0; i < 10; i++) { gg.beginPath(); gg.moveTo(0, i * H / 10); gg.lineTo(W, i * H / 10); gg.stroke(); } }});
  ft.repeat.set(3, 2);
  const fl = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.1, d - 0.02), toon('#ffffff', ft)); fl.position.set(ox, 0.0, 0); fl.receiveShadow = true; g.add(fl);
  g.add(box(w, 0.25, 0.15, '#6b4a36', {x: ox, y: 0.12, z: -d / 2 + 0.1, thick: 0.01}));
  g.add(box(w, 0.3, 0.3, '#6b4a36', {x: ox, y: h - 0.15, z: -d / 2 + 0.2, thick: 0.01}));
  return g;
}
function hangLamps(W, xs, y = 5.1, z = -1) {
  for (const x of xs) { W.add(cyl(0.02, 0.02, 0.8, '#2b2b2e', {x, y, z})); W.add(cyl(0.15, 0.45, 0.35, '#2f5d62', {x, y: y - 0.5, z, seg: 14})); const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({color: '#fff1c0'})); b.position.set(x, y - 0.65, z); W.add(b); }
}
function cart(c = '#8a5a3b') {
  const s = new THREE.Group();
  s.add(box(2.0, 0.5, 1.2, c, {y: 0.85}));
  for (const z of [-0.68, 0.68]) { const w = cyl(0.45, 0.45, 0.1, '#5a3a26', {seg: 14, thick: 0.01}); w.rotation.x = Math.PI / 2; w.position.set(0, 0.45, z); s.add(w); }
  for (const z of [-0.4, 0.4]) s.add(box(1.6, 0.07, 0.07, '#6b4430', {x: 1.7, y: 0.75, z, thick: 0.006}));
  return s;
}
function clayHeap(s = 1, c = '#9a5d3f') { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), toon(c)); m.scale.set(1.3 * s, 0.55 * s, 1.0 * s); m.position.y = 0.1; ink(m, 0.02, false); return m; }
function people(W, chars, list) {
  for (const [x, z, pal, hat, seed, glasses = false] of list) { const c = character({palette: pal, hat, glasses, seed}); c.position.set(x, 0.05, z); W.add(c); chars.push(c); }
}
function mould(w, h, d = 0.3) {
  const g = new THREE.Group(); const c = '#a5784b', t = 0.06;
  g.add(box(w, h, t, c, {z: d / 2, y: h / 2, thick: 0.008}), box(w, h, t, c, {z: -d / 2, y: h / 2, thick: 0.008}));
  g.add(box(t, h, d, c, {x: w / 2, y: h / 2, thick: 0.008}), box(t, h, d, c, {x: -w / 2, y: h / 2, thick: 0.008}));
  return g;
}
// canvas helper for animated boards
function canvasBoard(w, h, pw, ph, frame = '#5a3a26') {
  const c = document.createElement('canvas'); c.width = pw; c.height = ph; const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const b = box(w, h, 0.1, '#ffffff', {thick: 0.02});
  b.material = [toon(frame), toon(frame), toon(frame), toon(frame), new THREE.MeshBasicMaterial({map: tex}), toon(frame)];
  return {mesh: b, g, tex, c};
}

export function buildWorld() {
  const W = new THREE.Group();
  const chars = [];

  // ======== BRICKYARD (hook + count) ========
  const Y = LOC.yard;
  W.add(ground(80, 60, '#c4a477', {x: Y, z: -10, seed: 14, repeat: 10}));
  // moulding table
  const table = new THREE.Group();
  table.add(box(2.6, 0.14, 1.2, '#8a5a3b', {y: 1.0}));
  for (const [x, z] of [[-1.2, -0.5], [1.2, -0.5], [-1.2, 0.5], [1.2, 0.5]]) table.add(box(0.13, 1.0, 0.13, '#6b4430', {x, y: 0.5, z}));
  table.position.set(Y - 2.4, 0, 0.7); W.add(table);
  const nb = brick(0.15); nb.position.set(Y - 3.2, 1.15, 0.9); W.add(nb);
  const gob = brick(0.32); W.add(gob); // drops onto the table on "thick"
  W.add(P.at(mould(0.6, 0.18), Y - 1.6, 1.07, 0.6, 0.2), P.at(clayHeap(0.3), Y - 1.2, 1.07, 1.0));
  // ledger in the officer's hand
  people(W, chars, [[Y - 3.0, -0.3, 'mustard', 'cap', 11]]);
  const officer = character({palette: 'navy', hat: 'top', seed: 12}); officer.position.set(Y - 0.5, 0.05, 0.5); W.add(officer); chars.push(officer);
  const ledger = box(0.34, 0.44, 0.04, '#7a3b33', {thick: 0.01}); ledger.position.set(0.16, -0.42, 0.08); officer.userData.armR.add(ledger);
  const pg = box(0.3, 0.4, 0.01, '#f7f0de', {thick: 0.002, edges: false}); pg.position.set(0.16, -0.42, 0.105); officer.userData.armR.add(pg);
  // drying rows ("hacks") with plank roofs
  const counts = [];
  for (let r = 0; r < 3; r++) {
    const z = -3 - r * 2.2;
    const hk = brickWall(8, 1.0, 0.5, {course: 0.09, base: '#c06a4e', seed: 30 + r}); hk.position.set(Y + 3.5, 0, z); W.add(hk);
    W.add(box(8.4, 0.06, 0.9, '#b98a52', {x: Y + 3.5, y: 1.08, z, thick: 0.01}));
    const s = sign(['1,000', '2,000', '3,000'][r], 1.1, 0.55, {bg: '#f2e6cc', w: 440, h: 220, font: 'bold 120px Arial'});
    s.position.set(Y + 1.2 + r * 2.2, 1.75, -3); W.add(s); counts.push(s);
    W.add(cyl(0.03, 0.03, 0.7, '#3a3a3a', {x: Y + 1.2 + r * 2.2, y: 1.3, z: -3.05}));
  }
  // kiln with glowing mouth + chimney + smoke
  const kiln = brickWall(6, 4, 5, {course: 0.18, base: '#9c4a36', seed: 41}); kiln.position.set(Y + 11, 0, -9); W.add(kiln);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({color: '#ff9a3c'})); glow.position.set(Y + 11, 0.85, -6.47); W.add(glow);
  W.add(cyl(0.7, 0.9, 5, '#8a4434', {x: Y + 12.5, y: 6, z: -10, seg: 14}));
  const smoke = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), toon('#d8d2c8', null, {transparent: true, opacity: 0.85})); W.add(s); smoke.push(s); }
  // sheds, carts, barrels, fence, trees, workers
  const shed = facade({w: 9, h: 5, color: '#a86f5c', cols: 3, rows: 1, door: true, seed: 71}); shed.position.set(Y - 8, 0, -9); W.add(shed);
  W.add(box(9, 5, 6, '#8f6c5e', {x: Y - 8, y: 2.5, z: -12.2, thick: 0.04}));
  W.add(P.at(cart(), Y - 6.5, 0.05, -2.5, 0.5), P.at(cart('#7a4f33'), Y + 7, 0.05, 3.5, -0.3));
  for (let i = 0; i < 3; i++) W.add(P.at(P.barrel(['#8a5a3b', '#6b4430', '#9a6f40'][i]), Y - 5.6 + i * 0.85, 0.05, -5.2));
  W.add(P.at(clayHeap(1.4), Y - 4.5, 0, -6.8), P.at(clayHeap(1.0, '#a8694a'), Y + 15, 0, -4));
  for (let i = 0; i < 4; i++) { const st = brickWall(1.2, 0.8, 0.6, {course: 0.09, seed: 50 + i}); st.position.set(Y - 9.5 + i * 1.5, 0, -2.8); W.add(st); }
  W.add(P.at(P.fence(20), Y - 16, 0.05, -4, Math.PI / 2), P.at(P.fence(20), Y + 18, 0.05, -4, Math.PI / 2));
  for (let i = 0; i < 7; i++) W.add(P.at(P.tree(1.4, 740 + i), Y - 24 + i * 8, 0.05, -18 - (i % 2) * 3));
  people(W, chars, [[Y + 5.6, -1.4, 'welder', 'cap', 13], [Y + 9, -4.6, 'red', 'none', 14], [Y - 5.4, -3.6, 'teal', 'cap', 15], [Y + 13.5, -5.2, 'mustard', 'bowler', 16], [Y - 9.5, -5.5, 'pink', 'none', 17]]);
  for (let i = 0; i < 5; i++) W.add(cloud(Y - 60 + i * 30, 40 + (i % 2) * 8, -110, 6));

  // ======== 1784 STREET + HARBOUR (war) ========
  const ST = LOC.street;
  const cob = paintTex('#a89c8a', {seed: 3, stains: 20, stripes: (gg, Wd, H) => { gg.strokeStyle = 'rgba(60,45,35,0.45)'; gg.lineWidth = 2; for (let i = 0; i < 16; i++) { gg.beginPath(); gg.moveTo(0, i * H / 16); gg.lineTo(Wd, i * H / 16); gg.stroke(); for (let j = 0; j < 16; j++) { gg.beginPath(); gg.moveTo(j * Wd / 16 + (i % 2) * 8, i * H / 16); gg.lineTo(j * Wd / 16 + (i % 2) * 8, (i + 1) * H / 16); gg.stroke(); } } }});
  cob.repeat.set(6, 8);
  const street = new THREE.Mesh(new THREE.BoxGeometry(30, 0.4, 50), toon('#ffffff', cob)); street.position.set(ST, -0.2, -12); street.receiveShadow = true; W.add(street);
  const water = new THREE.Mesh(new THREE.BoxGeometry(220, 0.3, 120), toon('#4f86b8')); water.position.set(ST, -0.6, -97); W.add(water);
  W.add(box(30, 0.6, 1.2, '#8d8578', {x: ST, y: -0.2, z: -37.2}));
  const cols = ['#a5523e', '#b8775e', '#9a5a46', '#c48a68', '#8f4f3c'];
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) {
    const h = 9 + ((i + (side > 0 ? 1 : 0)) % 3) * 1.5;
    const f = facade({w: 8, h, color: cols[(i * 2 + (side > 0 ? 1 : 0)) % 5], cols: 3, rows: 3, seed: 200 + i * 3 + side});
    f.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; f.position.set(ST + side * 6.2, 0, -i * 8.4 + 1); W.add(f);
    W.add(box(5, h, 8, '#7d5a4e', {x: ST + side * 9, y: h / 2, z: -i * 8.4 + 1, thick: 0.04}));
    const sg = sign(['BAKER', 'CHANDLER', 'INN', 'TAILOR', 'COOPER', 'GROCER', 'SMITH', 'BOOKS'][i * 2 + (side > 0 ? 1 : 0)], 3.2, 0.7, {bg: '#f2e6cc', w: 640, h: 140, font: 'bold 88px Georgia, serif'});
    sg.rotation.y = f.rotation.y; sg.position.set(ST + side * 5.6, 3.1, -i * 8.4 + 2.2); W.add(sg);
  }
  for (let i = 0; i < 4; i++) { W.add(lampPost(ST - 4.8, 2 - i * 8.4, 4.2)); W.add(lampPost(ST + 4.4, -2 - i * 8.4, 4.2)); }
  // ship in the harbour
  const ship = new THREE.Group();
  ship.add(box(14, 2.6, 4, '#6b4430', {y: 1.3}), box(14.4, 0.3, 4.3, '#c9a24a', {y: 2.5}));
  for (const [x, h] of [[-4, 11], [0.5, 14], [4.5, 10]]) {
    ship.add(cyl(0.18, 0.22, h, '#5a3a26', {x, y: 2.6 + h / 2}));
    for (let k = 0; k < 3; k++) ship.add(box(3.6 - k * 0.6, 2.1, 0.08, '#f4ecd8', {x, y: 4.6 + k * 2.6, z: 0.3, thick: 0.02}));
  }
  const flagS = box(1.6, 1.0, 0.04, '#c43d32', {thick: 0.01}); flagS.position.set(1.4, 17.2, 0); ship.add(flagS);
  ship.position.set(ST + 3, -0.4, -48); ship.rotation.y = 0.15; W.add(ship);
  // 1784 banner across the street
  const banner = sign('1784', 4.6, 1.6, {bg: '#c43d32', fg: '#fff4dc', font: 'bold 150px Georgia, serif', w: 640, h: 220}); banner.position.set(ST, 5.4, -7); W.add(banner);
  W.add(cyl(0.1, 0.12, 6.4, '#3a3a3a', {x: ST - 2.5, y: 3.2, z: -7}), cyl(0.1, 0.12, 6.4, '#3a3a3a', {x: ST + 2.5, y: 3.2, z: -7}));
  // empty treasury chest on a cart in the foreground
  const chestCart = cart('#7a4f33'); chestCart.position.set(ST - 1.4, 0, 2.2); chestCart.rotation.y = Math.PI / 2 + 0.2; W.add(chestCart);
  const chest = new THREE.Group(); chest.add(box(1.0, 0.55, 0.65, '#6b3f2a', {y: 0.28}));
  chest.add(box(0.9, 0.04, 0.55, '#1e1412', {y: 0.54, thick: 0.002, edges: false}));
  const lid = new THREE.Group(); lid.add(box(1.04, 0.14, 0.68, '#7a4a30', {y: 0.07, z: 0.34})); lid.position.set(0, 0.56, -0.34); chest.add(lid);
  const cl = sign('TREASURY', 0.8, 0.22, {bg: '#e6c45a', w: 400, h: 110, font: 'bold 70px Georgia, serif'}); cl.position.set(0, 0.3, 0.34); chest.add(cl);
  chest.position.set(ST - 1.4, 1.1, 2.3); chest.rotation.y = 0.25; W.add(chest);
  people(W, chars, [[ST - 2.6, 2.0, 'official', 'top', 21, true], [ST + 1.6, 0.5, 'clerk', 'bowler', 22], [ST - 3.4, -4, 'red', 'none', 23], [ST + 3.6, -6, 'teal', 'cap', 24], [ST - 2, -12, 'pink', 'none', 25], [ST + 2.4, -15, 'mustard', 'bowler', 26], [ST - 3.6, -19, 'navy', 'top', 27], [ST + 1, -23, 'student', 'cap', 28], [ST - 1.0, -28, 'red', 'bowler', 29]]);
  W.add(P.at(P.barrel('#8a5a3b'), ST + 4.4, 0.05, 1.2), P.at(P.barrel('#6b4430'), ST + 4.9, 0.05, 0.4), P.at(crate('TEA', {}), ST + 3.6, 0.6, -2.5));
  W.add(P.at(cart(), ST + 2.2, 0.05, -10, 0.1), P.at(crate('GOODS'), ST - 4.2, 0.6, -14));
  for (let i = 0; i < 6; i++) W.add(cloud(ST - 70 + i * 28, 38 + (i % 3) * 6, -120, 7));

  // ======== TAX OFFICE (tax, climb, but, then) ========
  const O = LOC.office;
  W.add(room(O, {w: 16, h: 5.5, d: 11, wall: '#bfe0db', seed: 8}));
  // tax board on the back wall (animated: 2s 6d -> 4s)
  const tb = canvasBoard(3.8, 2.7, 760, 540, '#5a3a26'); tb.mesh.position.set(O + 1.5, 3.0, -5.35); W.add(tb.mesh);
  const drawBoard = (pIn, pUp) => {
    const g = tb.g; g.fillStyle = '#f4ead4'; g.fillRect(0, 0, 760, 540);
    g.strokeStyle = INK; g.lineWidth = 10; g.strokeRect(14, 14, 732, 512);
    g.fillStyle = '#c43d32'; g.fillRect(14, 14, 732, 110);
    g.fillStyle = '#fff4dc'; g.font = 'bold 82px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BRICK TAX', 380, 70);
    g.fillStyle = INK; g.font = 'bold 40px Arial'; g.fillText('PER 1,000 BRICKS', 380, 465);
    g.save(); g.globalAlpha = pIn; g.font = 'bold 150px Georgia, serif'; g.fillStyle = INK; g.fillText('2s 6d', 380, 280); g.restore();
    if (pUp > 0) {
      g.strokeStyle = '#c43d32'; g.lineWidth = 16; g.beginPath(); g.moveTo(170, 300); g.lineTo(170 + 420 * Math.min(1, pUp * 2), 250); g.stroke();
      g.save(); g.globalAlpha = Math.max(0, pUp * 2 - 1); g.translate(560, 370); g.rotate(-0.12); g.fillStyle = '#c43d32'; g.fillRect(-120, -70, 240, 140); g.fillStyle = '#fff4dc'; g.font = 'bold 110px Georgia, serif'; g.fillText('4s', 0, 6); g.restore();
    }
    g.fillStyle = INK; g.font = 'bold 44px Georgia, serif'; g.textAlign = 'left'; g.fillText(pUp > 0.5 ? '1794' : '1784', 40, 175);
    tb.tex.needsUpdate = true;
  };
  drawBoard(0, 0);
  // law book on a lectern table (right)
  const lect = P.desk(2.0, '#7a4f33'); lect.position.set(O + 4.2, 0.05, -1.4); W.add(lect);
  const bk = canvasBoard(1.6, 1.0, 640, 400, '#7a3b33'); bk.mesh.rotation.x = -Math.PI / 2; bk.mesh.position.set(O + 4.2, 1.06, -1.3); W.add(bk.mesh);
  const drawBook = (q) => {
    const g = bk.g; g.fillStyle = '#f7f0de'; g.fillRect(0, 0, 640, 400); g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(320, 0); g.lineTo(320, 400); g.stroke();
    g.fillStyle = INK; g.textAlign = 'center'; g.font = 'bold 40px Georgia, serif'; g.fillText('BRICK', 160, 70); g.fillText('TAX ACT', 160, 115);
    g.fillStyle = '#bcae92'; for (let i = 0; i < 6; i++) g.fillRect(40, 160 + i * 34, 240, 10);
    g.fillStyle = INK; g.font = 'bold 40px Arial'; g.fillText('EVERY BRICK:', 480, 80); g.fillStyle = '#c43d32'; g.fillText('TAXED', 480, 130);
    g.fillStyle = INK; g.fillText('SIZE:', 430, 260); g.strokeStyle = INK; g.lineWidth = 4; g.beginPath(); g.moveTo(480, 275); g.lineTo(600, 275); g.stroke();
    if (q > 0) { g.save(); g.globalAlpha = q; g.fillStyle = '#c43d32'; g.font = 'bold 120px Arial'; g.fillText('?', 540, 270); g.restore(); }
    bk.tex.needsUpdate = true;
  };
  drawBook(0);
  // main desk (left) with decree + stamp
  const d1 = P.desk(2.8, '#8a5a3b'); d1.position.set(O - 2.0, 0.05, 0.1); W.add(d1);
  const dec = canvasBoard(1.1, 0.8, 440, 320, '#e9dfc6'); dec.mesh.rotation.x = -Math.PI / 2; dec.mesh.position.set(O - 1.7, 1.06, 0.45); dec.mesh.rotation.z = 0.08; W.add(dec.mesh);
  const drawDecree = (s) => {
    const g = dec.g; g.fillStyle = '#f7f0de'; g.fillRect(0, 0, 440, 320); g.fillStyle = INK; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 34px Arial'; g.fillText('ANY BRICK OVER', 220, 52); g.font = 'bold 54px Arial'; g.fillText('10 × 5 × 3 in', 220, 115);
    g.fillStyle = '#bcae92'; for (let i = 0; i < 3; i++) g.fillRect(60, 160 + i * 22, 320, 8);
    if (s > 0) { g.save(); g.globalAlpha = s; g.translate(220, 262); g.rotate(-0.1); g.strokeStyle = '#c43d32'; g.lineWidth = 8; g.strokeRect(-170, -42, 340, 84); g.fillStyle = '#c43d32'; g.font = 'bold 58px Arial'; g.fillText('DOUBLE TAX', 0, 4); g.restore(); }
    dec.tex.needsUpdate = true;
  };
  drawDecree(0);
  const stamp = new THREE.Group(); stamp.add(box(0.26, 0.08, 0.18, '#c43d32', {thick: 0.006}), cyl(0.04, 0.05, 0.22, '#6b4430', {y: 0.15})); W.add(stamp);
  W.add(P.at(P.deskLamp(), O - 3.1, 1.0, -0.2), P.at(P.papers(6, 3), O - 2.9, 1.0, 0.35), P.at(P.mug('#2f6db3'), O - 0.9, 1.0, -0.1));
  const quill = box(0.02, 0.02, 0.4, '#f7f0de', {thick: 0.003}); quill.position.set(O - 2.4, 1.08, 0.5); quill.rotation.y = 0.6; W.add(quill);
  W.add(P.at(P.bookshelf(4), O - 5.9, 0.05, -5.15), P.at(P.bookshelf(5), O - 3.4, 0.05, -5.15), P.at(P.filingCabinet('#8f7d6a'), O + 6.6, 0.05, -5.0), P.at(P.filingCabinet(), O + 7.3, 0.05, -5.0));
  W.add(P.at(P.bookshelf(6, 2.0, 2.4), O - 7.75, 0.05, -1.5, Math.PI / 2), P.at(P.wallClock(), O + 4.4, 4.6, -5.4));
  const p1 = P.poster('BY ORDER', 1.1, 1.5, '#e6d39a'); P.at(p1, O + 5.0, 3.2, -5.45); W.add(p1);
  const p2 = P.poster('EXCISE', 1.1, 1.5, '#cfe3f0'); P.at(p2, O - 1.2, 3.3, -5.45); W.add(p2);
  W.add(P.at(P.rug(6, 3.6), O - 1.6, 0, 0.6));
  hangLamps(W, [O - 2.5, O + 2.5]);
  const win = sign('', 2.2, 2.0, {bg: '#bfe3f5', border: true}); win.position.set(O + 7.95, 3.0, -1.2); win.rotation.y = -Math.PI / 2; W.add(win);
  people(W, chars, [[O - 2.7, -0.9, 'official', 'top', 31, true], [O - 0.1, -3.4, 'navy', 'bowler', 32], [O + 5.4, -2.7, 'clerk', 'none', 33, true], [O + 3.0, -3.8, 'mustard', 'top', 34]]);
  const plantO = new THREE.Group(); plantO.add(cyl(0.35, 0.28, 0.7, '#b35a3a', {y: 0.35})); for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), toon('#4f8a4a')); l.position.set(Math.cos(i) * 0.3, 0.9 + (i % 3) * 0.25, Math.sin(i) * 0.3); ink(l, 0.02, false); plantO.add(l); }
  plantO.position.set(O + 6.6, 0.05, 2.6); W.add(plantO);

  // ======== PIZZA COUNTER (yousee) ========
  const PZ = LOC.pizza;
  W.add(room(PZ, {w: 14, h: 5, d: 10, wall: '#9fd3c7', floor: '#9a6a48', seed: 61}));
  W.add(box(6.4, 1.0, 1.1, '#8a5a3b', {x: PZ, y: 0.5, z: -1.0}), box(6.6, 0.08, 1.25, '#e9dcc3', {x: PZ, y: 1.02, z: -1.0, thick: 0.01}));
  const pizza = (n, x) => {
    const g = new THREE.Group(); const sl = [];
    for (let i = 0; i < n; i++) {
      const a0 = i * Math.PI * 2 / n, da = Math.PI * 2 / n;
      const s = new THREE.Group();
      const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 20, 1, false, a0, da), toon('#e0b062')); ink(crust, 0.01, true, 40); s.add(crust);
      const sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 20, 1, false, a0 + 0.02, da - 0.04), toon('#d2553b')); sauce.position.y = 0.035; s.add(sauce);
      for (let k = 0; k < 2; k++) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10), toon('#f5d77a')); const am = a0 + da * (0.3 + k * 0.4), rr = 0.25 + k * 0.15; ch.position.set(Math.sin(am) * rr, 0.05, Math.cos(am) * rr); s.add(ch); }
      s.userData.mid = a0 + da / 2; g.add(s); sl.push(s);
    }
    g.add(cyl(0.82, 0.82, 0.04, '#b98a52', {y: -0.04, seg: 24, thick: 0.01}));
    g.position.set(x, 1.1, -0.95); W.add(g); return sl;
  };
  const slSmall = pizza(8, PZ - 1.15), slBig = pizza(4, PZ + 1.15);
  const lab1 = sign('SMALL SLICES', 1.2, 0.3, {bg: '#f2e6cc', w: 480, h: 120, font: 'bold 64px Arial'}); lab1.position.set(PZ - 1.15, 0.78, -0.4); W.add(lab1);
  const lab2 = sign('BIG SLICES', 1.2, 0.3, {bg: '#f2c12e', w: 480, h: 120, font: 'bold 64px Arial'}); lab2.position.set(PZ + 1.15, 0.78, -0.4); W.add(lab2);
  const coins = []; const mkCoins = (n, x) => { for (let i = 0; i < n; i++) { const c = cyl(0.07, 0.07, 0.025, '#e8b23a', {seg: 14, thick: 0.004}); c.position.set(x + (i % 4) * 0.17 - 0.25, 1.08, -0.15 - Math.floor(i / 4) * 0.17); W.add(c); coins.push({c, i}); } };
  mkCoins(8, PZ - 1.15); mkCoins(4, PZ + 1.15);
  const menu = sign('PAY BY THE SLICE', 3.6, 1.4, {bg: '#2f4a3a', fg: '#f2ead6', w: 900, h: 350, font: 'bold 96px Arial', sub: '1 SLICE = 1 COIN'}); menu.position.set(PZ, 3.3, -4.85); W.add(menu);
  const oven = brickWall(2.4, 2.4, 1.6, {course: 0.12, seed: 63}); oven.position.set(PZ + 4.6, 0, -3.9); W.add(oven);
  const om = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({color: '#ff9a3c'})); om.position.set(PZ + 4.6, 1.1, -3.09); W.add(om);
  W.add(P.at(P.bookshelf(7, 2.2, 2.4), PZ - 4.6, 0.05, -4.7), P.at(P.chair('#c43d32'), PZ - 3.2, 0.05, 1.2, 0.4), P.at(P.chair('#2f6db3'), PZ + 3.3, 0.05, 1.4, -0.4));
  W.add(P.at(P.wallClock(), PZ + 2.4, 4.0, -4.9), P.at(P.poster('HOT!', 0.9, 1.2, '#e0533d'), PZ - 2.6, 3.3, -4.95));
  hangLamps(W, [PZ - 2, PZ + 2], 4.6, -0.8);
  people(W, chars, [[PZ + 0.1, -2.5, 'red', 'cap', 61], [PZ - 3.6, 0.4, 'pink', 'none', 62, true], [PZ + 3.7, 0.6, 'student', 'cap', 63], [PZ - 5.2, -2.2, 'teal', 'none', 64]]);

  // ======== WILKES' WORKSHOP, MEASHAM (wilkes + so) ========
  const M = LOC.works;
  W.add(room(M, {w: 16, h: 5.5, d: 11, wall: '#8fb3c9', floor: '#a7764e', seed: 71}));
  const bench = new THREE.Group(); bench.add(box(3.6, 0.15, 1.2, '#8a5a3b', {y: 1.0}));
  for (const [x, z] of [[-1.7, -0.5], [1.7, -0.5], [-1.7, 0.5], [1.7, 0.5]]) bench.add(box(0.13, 1.0, 0.13, '#6b4430', {x, y: 0.5, z}));
  bench.position.set(M - 0.8, 0, 0.4); W.add(bench);
  const wNorm = brick(0.15); wNorm.position.set(M - 1.9, 1.15, 0.6); W.add(wNorm);
  const wGob = brick(0.15); W.add(wGob); // grows to double thickness
  const wMould = mould(0.62, 0.36); wMould.position.set(M + 0.3, 1.07, 0.55); wMould.rotation.y = -0.2; W.add(wMould);
  const twice = sign('2× THICK', 0.9, 0.32, {bg: '#f2c12e', w: 450, h: 160, font: 'bold 86px Arial'}); twice.position.set(M - 0.75, 1.95, 0.4); W.add(twice);
  W.add(P.at(clayHeap(0.35), M - 2.4, 1.07, 0.3));
  const msign = sign('MEASHAM', 3.0, 0.8, {bg: '#f2e6cc', w: 750, h: 200, font: 'bold 130px Georgia, serif'}); msign.position.set(M - 2.6, 3.6, -5.4); W.add(msign);
  const wsign = sign('BRICKWORKS', 2.6, 0.6, {bg: '#c43d32', fg: '#fff4dc', w: 750, h: 170, font: 'bold 100px Georgia, serif'}); wsign.position.set(M + 2.4, 3.8, -5.4); W.add(wsign);
  W.add(P.at(P.toolRack(3), M + 2.4, 0, -5.45), P.at(P.toolRack(4), M - 5.6, 0, -5.45));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const b = brick(0.3); b.position.set(M + 4.0 + i * 0.52, 0.32 + j * 0.31, 0.6); W.add(b); }
  W.add(P.at(P.pallet(), M + 4.5, 0.05, 0.6), P.at(clayHeap(1.0), M + 5.6, 0, -3.2), P.at(P.barrel('#8a5a3b'), M - 5.8, 0.05, -2.8), P.at(P.barrel('#6b4430'), M - 6.6, 0.05, -2.0));
  for (let i = 0; i < 4; i++) W.add(P.at(mould(0.6, 0.18), M - 6.8, 1.0 + i * 0.4, -4.6 + i * 0.1));
  W.add(box(1.4, 0.06, 1.0, '#7a4f33', {x: M - 6.8, y: 0.95, z: -4.4}));
  const winM = sign('', 2.4, 1.8, {bg: '#cfe9f7', border: true}); winM.position.set(M - 7.95, 3.0, 0.5); winM.rotation.y = Math.PI / 2; W.add(winM);
  hangLamps(W, [M - 2.2, M + 2.2]);
  const wilkes = character({palette: 'red', hat: 'top', seed: 81}); wilkes.position.set(M - 1.1, 0.05, -0.9); W.add(wilkes); chars.push(wilkes);
  people(W, chars, [[M + 3.4, -2.2, 'mustard', 'cap', 82], [M + 6.2, -1.2, 'welder', 'cap', 83], [M - 4.6, -3.4, 'teal', 'none', 84]]);

  // ======== BUILDING SITE (gobs) ========
  const SI = LOC.site;
  W.add(ground(70, 60, '#c9ad80', {x: SI, z: -10, seed: 91, repeat: 10}));
  const wallN = brickWall(3.0, 2.6, 0.5, {course: 0.12, seed: 92}); wallN.position.set(SI - 1.8, 0, -1.5); W.add(wallN);
  const wallG = brickWall(3.0, 2.6, 0.5, {course: 0.24, seed: 93}); wallG.position.set(SI + 1.8, 0, -1.5); W.add(wallG);
  const sN = sign('NORMAL BRICKS', 2.4, 0.5, {bg: '#f2e6cc', w: 720, h: 150, font: 'bold 84px Arial'}); sN.position.set(SI - 1.8, 3.4, -1.7); W.add(sN);
  const sG = sign("WILKES' GOBS", 2.4, 0.5, {bg: '#f2c12e', w: 720, h: 150, font: 'bold 84px Arial'}); sG.position.set(SI + 1.8, 3.4, -1.7); W.add(sG);
  for (const x of [SI - 3.0, SI - 0.6, SI + 0.6, SI + 3.0]) W.add(cyl(0.05, 0.05, 3.4, '#5a3a26', {x, y: 1.7, z: -1.85}));
  const fewer = sign('FEWER BRICKS', 1.8, 0.45, {bg: '#c43d32', fg: '#fff4dc', w: 640, h: 160, font: 'bold 84px Arial'}); fewer.position.set(SI + 1.8, 2.95, -1.1); W.add(fewer);
  for (let i = 0; i < 6; i++) { const b = brick(0.15); b.position.set(SI - 2.6 + (i % 3) * 0.5, 0.1 + Math.floor(i / 3) * 0.16, 0.6); W.add(b); }
  for (let i = 0; i < 3; i++) { const b = brick(0.3); b.position.set(SI + 1.4 + i * 0.5, 0.18, 0.6); W.add(b); }
  people(W, chars, [[SI - 3.8, -0.5, 'welder', 'cap', 94], [SI + 3.9, -0.4, 'mustard', 'cap', 95], [SI - 7, -4, 'teal', 'bowler', 96], [SI + 7.5, -5, 'red', 'none', 97], [SI + 0.2, -6, 'navy', 'top', 98]]);
  // half-built house with scaffold behind
  const hb = brickWall(9, 3.6, 0.5, {course: 0.12, seed: 99}); hb.position.set(SI - 2, 0, -9); W.add(hb);
  for (let i = 0; i < 5; i++) W.add(cyl(0.06, 0.06, 5, '#b98a52', {x: SI - 6 + i * 2, y: 2.5, z: -8.2}));
  W.add(box(9, 0.08, 0.8, '#b98a52', {x: SI - 2, y: 2.4, z: -8.2}), P.at(P.ladder(3.4), SI + 3.2, 0.05, -8));
  W.add(P.at(cart(), SI + 6, 0.05, 0.5, -0.4), P.at(P.barrel('#8a5a3b'), SI - 5.4, 0.05, 0.2), P.at(clayHeap(0.6, '#d8cdb8'), SI - 6.2, 0, -1.6));
  for (let i = 0; i < 4; i++) { const f = facade({w: 8, h: 9, color: cols[i % 5], cols: 3, rows: 2, seed: 300 + i}); f.position.set(SI - 14 + i * 9, 0, -18); W.add(f); }
  for (let i = 0; i < 5; i++) W.add(P.at(P.tree(1.3, 900 + i), SI - 20 + i * 10, 0.05, -13));
  for (let i = 0; i < 5; i++) W.add(cloud(SI - 60 + i * 30, 40 + (i % 2) * 8, -110, 6));

  // ======== TODAY: old building on a modern street (close) ========
  const T = LOC.today;
  W.add(ground(260, 200, '#9c958a', {x: T, z: -30, seed: 2, repeat: 20}));
  const road = new THREE.Mesh(new THREE.BoxGeometry(260, 0.05, 9), toon('#6e6670')); road.position.set(T, 0.03, 12); W.add(road);
  for (let i = -12; i < 12; i++) W.add(box(3, 0.06, 0.35, '#e8d28a', {x: T + i * 10, y: 0.08, z: 12, edges: false, thick: 0.001}));
  W.add(sidewalk(260, {x: T, z: 5.5, w: 4}), sidewalk(260, {x: T, z: 18.5, w: 4}));
  const r = rng(5);
  for (let i = 0; i < 7; i++) for (const side of [-1, 1]) {
    const w = 9 + r() * 3, h = 9 + r() * 8;
    const f = facade({w, h, color: ['#c98f6b', '#b8775e', '#d1a47a', '#a86f5c', '#c4a27c', '#9e7b66'][(i + (side > 0 ? 2 : 0)) % 6], cols: 3, rows: Math.floor(h / 3.6), seed: 400 + i * 7 + side});
    f.position.set(T + side * (12 + i * 12.5), 0, 3); W.add(f);
    W.add(box(w, h, 8, '#8f6c5e', {x: T + side * (12 + i * 12.5), y: h / 2, z: -1.4, thick: 0.04}));
  }
  for (let i = -6; i < 7; i++) { const h = 8 + r() * 9; const f = facade({w: 11, h, color: '#b8775e', cols: 3, rows: Math.floor(h / 3.6), seed: 500 + i}); f.position.set(T + i * 13, 0, 22); f.rotation.y = Math.PI; W.add(f); }
  const old = brickWall(14, 11, 8, {course: 0.3, base: '#a9563f', seed: 7}); old.position.set(T, 0, -2.5); W.add(old);
  for (let rr = 0; rr < 3; rr++) for (let c = 0; c < 4; c++) { if (rr === 0 && (c === 1 || c === 2)) continue; W.add(box(1.4, 2.0, 0.12, '#2f3e4a', {x: T - 5 + c * 3.33, y: 2.0 + rr * 3.2, z: 1.55, thick: 0.02})); W.add(box(1.7, 0.2, 0.3, '#e9dcc3', {x: T - 5 + c * 3.33, y: 0.95 + rr * 3.2, z: 1.6, thick: 0.01})); }
  W.add(box(1.8, 2.8, 0.15, '#2f5d62', {x: T, y: 1.4, z: 1.56, thick: 0.02}));
  const plaque = sign('BRICK TAX ENDED 1850', 2.6, 0.9, {bg: '#2f5d62', fg: '#f2ead6', w: 780, h: 270, font: 'bold 74px Georgia, serif'}); plaque.position.set(T + 1.6, 1.7, 4.4); W.add(plaque);
  W.add(cyl(0.05, 0.05, 1.3, '#2b2b2e', {x: T + 1.6, y: 0.85, z: 4.35}));
  const ptr = arrow('#e0533d', 1.2); ptr.position.set(T - 3.4, 6.0, 3.2); ptr.rotation.y = Math.PI / 2; ptr.rotation.z = -0.4; W.add(ptr);
  const trafficT = dressStreet(W, T, {seed: 23, chars, avoid: [T + 2.6, T, T - 4]});
  people(W, chars, [[T + 3.0, 5.4, 'student', 'cap', 101, true], [T - 1.0, 5.0, 'pink', 'none', 102]]);
  for (let i = 0; i < 7; i++) W.add(cloud(T - 80 + i * 28, 70 + (i % 3) * 10, -130, 7));

  // ======== per-frame update ========
  const update = (t, cam, shot) => {
    for (const c of chars) c.userData.update(t, cam.position);
    trafficT(t, cam);
    // hook: giant brick drops on "thick"
    const tg = wordT('hook', 6), dropP = ease(t, tg - 0.25, tg);
    gob.position.set(Y - 2.2, 1.23 + (1 - dropP) * 2.2, 0.85); gob.rotation.y = -0.15;
    // count: officer walks the rows, numbers pop
    if (shot === 'count') { officer.position.set(Y + 0.3 + 4.6 * ease(t, wordT('count', 0), wordT('count', 14)), 0.05, -1.6); }
    else officer.position.set(Y - 0.5, 0.05, 0.5);
    counts.forEach((s, i) => s.scale.setScalar(pop(t, wordT('count', [6, 9, 12][i]))));
    glow.material.color.setHSL(0.07, 1, 0.55 + Math.sin(t * 5) * 0.04 + 0.08 * ease(t, wordT('count', 13), wordT('count', 15)));
    smoke.forEach((s, i) => { const l = (t * 0.25 + i / smoke.length) % 1; s.position.set(Y + 12.5 + l * 3, 8.6 + l * 9, -10 - l * 2); s.scale.setScalar(0.6 + l * 1.6); s.material.opacity = 0.85 * (1 - l); });
    // war: chest lid opens on "money" (it's empty)
    lid.rotation.x = -1.6 * ease(t, wordT('war', 5) - 0.1, wordT('war', 5) + 0.4);
    // office board
    if (shot === 'tax' || shot === 'climb') drawBoard(ease(t, wordT('tax', 8), wordT('tax', 9)), shot === 'climb' ? ease(t, wordT('climb', 5), wordT('climb', 8)) : 0);
    if (shot === 'but') drawBook(ease(t, wordT('but', 9), wordT('but', 10)));
    if (shot === 'then') {
      const sd = ease(t, wordT('then', 3), wordT('then', 4)) * (1 - ease(t, wordT('then', 15), wordT('then', 15.5))) ;
      const hit = ease(t, wordT('then', 15.5), wordT('then', 16.2));
      const lift = ease(t, wordT('then', 16.4), wordT('then', 16.9));
      stamp.position.set(O - 1.25 + 0.7 * lift, 1.5 - 0.42 * hit + 0.45 * lift, 0.75 + 0.3 * lift);
      drawDecree(hit);
    } else stamp.position.set(O - 0.9, 1.1, 0.7);
    // pizza: big slices pull apart on "Cut bigger slices", coins on "pay"
    const cut = ease(t, wordT('yousee', 10), wordT('yousee', 12));
    slBig.forEach((s) => { const d = 0.04 + 0.1 * cut; s.position.set(Math.sin(s.userData.mid) * d, 0, Math.cos(s.userData.mid) * d); });
    slSmall.forEach((s) => { s.position.set(Math.sin(s.userData.mid) * 0.03, 0, Math.cos(s.userData.mid) * 0.03); });
    coins.forEach(({c, i}) => c.scale.setScalar(pop(t, wordT('yousee', 15) + i * 0.08, 0.25)));
    // Measham: gob grows to 2x on "twice as thick"; mould + gob shrink on "shrank"
    const grow = ease(t, wordT('wilkes', 8), wordT('wilkes', 11));
    const shrink = ease(t, wordT('so', 2), wordT('so', 4));
    const gh = 1 + grow - shrink;
    wGob.scale.y = gh; wGob.position.set(M - 0.75, 1.08 + 0.075 * gh, 0.6);
    twice.scale.setScalar(Math.max(0.001, pop(t, wordT('wilkes', 9)) * (1 - shrink)));
    twice.position.y = 1.35 + 0.15 * gh;
    wMould.scale.y = 1 - 0.5 * shrink;
    wilkes.userData.armR.rotation.z = shot === 'wilkes' ? 1.2 * grow : 0;
    // building site: walls rise, gobs faster
    const gp = shot === 'gobs' ? ease(t, wordT('gobs', 0), wordT('gobs', 13)) : (t > wordT('gobs', 13) ? 1 : 0);
    wallN.userData.setH(0.25 + 1.0 * gp); wallG.userData.setH(0.25 + 2.1 * gp);
    fewer.scale.setScalar(pop(t, wordT('gobs', 10)));
    // close: plaque + pointer
    plaque.scale.setScalar(pop(t, wordT('close', 4)));
    ptr.scale.setScalar(pop(t, wordT('close', 9)));
  };
  return {group: W, update};
}
