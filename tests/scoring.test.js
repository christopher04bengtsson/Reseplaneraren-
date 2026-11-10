// Kör med: node tests/scoring.test.js
const assert = require('assert');
const S = require('../js/scoring.js');

let n = 0;
function test(name, fn) { fn(); n++; console.log('✓', name); }

test('sovrum och sängar enligt specens exempel', () => {
  const r = S.calcRooms({ total: 10, couples: 3, children: 0, ownRoom: 0 });
  assert.strictEqual(r.bedrooms, 5);
  assert.strictEqual(r.beds, 7);
  assert.ok(r.valid);
});

test('eget rum och barn', () => {
  const r = S.calcRooms({ total: 8, couples: 2, children: 3, ownRoom: 1 });
  // 2 par + 1 eget + 2 rum för 3 barn + 0 övriga
  assert.strictEqual(r.bedrooms, 5);
  assert.strictEqual(r.beds, 2 + 1 + 3);
  assert.strictEqual(r.adults, 5);
});

test('för många par ger ogiltigt', () => {
  assert.ok(!S.calcRooms({ total: 4, couples: 3, children: 0, ownRoom: 0 }).valid);
});

test('avstånd: 1 inom gränsen, 0 vid dubbla', () => {
  assert.strictEqual(S.distanceScore(500, 800), 1);
  assert.strictEqual(S.distanceScore(1200, 800), 0.5);
  assert.strictEqual(S.distanceScore(1600, 800), 0);
  assert.strictEqual(S.distanceScore(undefined, 800), 0);
});

test('spann: 1 inne, 0 ett steg utanför', () => {
  assert.strictEqual(S.spanScore(1.5, [1, 2]), 1);
  assert.strictEqual(S.spanScore(0.5, [1, 2]), 0.5);
  assert.strictEqual(S.spanScore(0, [2, 3]), 0);
});

test('ortens storlek från invånare', () => {
  assert.strictEqual(Math.floor(S.stepPosition(700, S.SIZE_BOUNDS, true)), 0);
  assert.strictEqual(Math.floor(S.stepPosition(14000, S.SIZE_BOUNDS, true)), 1);
  assert.strictEqual(Math.floor(S.stepPosition(103000, S.SIZE_BOUNDS, true)), 2);
  assert.strictEqual(Math.floor(S.stepPosition(420000, S.SIZE_BOUNDS, true)), 3);
  assert.strictEqual(Math.floor(S.stepPosition(1600000, S.SIZE_BOUNDS, true)), 4);
});

test('kostnadsdelning', () => {
  const c = S.splitCost(42000, 'total', 10, 7);
  assert.strictEqual(c.perPerson, 4200);
  assert.strictEqual(c.perNight, 6000);
  assert.strictEqual(c.perPersonNight, 600);
  const n2 = S.splitCost(6000, 'night', 10, 7);
  assert.strictEqual(n2.total, 42000);
});

test('budget totalt räknas om till per person och natt', () => {
  assert.strictEqual(S.budgetPPN({ mode: 'total', amount: 70000 }, 10, 7), 1000);
});

test('datum: nätter och månad', () => {
  const d = S.resolveDates({ flex: 'exact', from: '2027-06-28', to: '2027-07-02' });
  assert.strictEqual(d.nights, 4);
  assert.deepStrictEqual(d.months, [5, 5, 5, 6]);
  const m = S.resolveDates({ flex: 'month', month: '2027-08', nights: 5 });
  assert.strictEqual(m.checkin, '2027-08-01');
  assert.strictEqual(m.checkout, '2027-08-06');
});

// ---------- Resmålslistan (SPEC-v2, steg 1) ----------

const RES = require('../data/resmal.json');
const ALL = RES.resmal;

test('regionerna i Europa är de sju i SPEC-v2', () => {
  assert.deepStrictEqual(RES.regioner.Europa.map((r) => r.namn), [
    'Medelhavet', 'Kanarieöarna', 'Alperna', 'Atlantkusten', 'Norden', 'Brittiska öarna', 'Centraleuropas städer'
  ]);
});

test('minst 10 resmål per region, från minst 4 länder (eller alla regionens länder)', () => {
  for (const reg of RES.regioner.Europa) {
    const list = ALL.filter((x) => x.region === reg.namn);
    const lander = new Set(list.map((x) => x.land));
    assert.ok(list.length >= 10, `${reg.namn}: ${list.length} resmål`);
    assert.ok(lander.size >= Math.min(4, reg.lander.length), `${reg.namn}: ${lander.size} länder`);
    for (const x of list) assert.ok(reg.lander.includes(x.land), `${x.namn} ligger i ${x.land}, inte i ${reg.namn}`);
  }
});

test('varje resmål har koordinater och Wikidata-källa', () => {
  for (const x of ALL) {
    assert.ok(typeof x.lat === 'number' && typeof x.lng === 'number', x.namn);
    assert.match(x.wikidata, /^Q\d+$/, x.namn);
    assert.strictEqual(x.klimat.tMax.length, 12, x.namn);
  }
});

test('Chamonix är ett resmål i Alperna men inte ett regionval', () => {
  const regionNamn = Object.values(RES.regioner).flat().map((r) => r.namn);
  assert.ok(!regionNamn.some((n) => /chamonix/i.test(n)));
  const c = ALL.find((x) => /chamonix/i.test(x.namn));
  assert.ok(c && c.region === 'Alperna');
});

const basePrefs = {
  group: { total: 10, couples: 3, children: 0, ownRoom: 0 },
  dest: { known: 'no', place: '', continent: 'Europa', region: 'Alperna' },
  climate: { temp: [1, 2], tempWeight: 2 },
  lodging: ['house'],
  town: { size: [0, 2], sizeWeight: 1, life: [1, 3], lifeWeight: 1 },
  nearby: [{ key: 'beach', label: 'Strand', weight: 2, mode: 'walk', minutes: 10 }],
  budget: { mode: 'pppn', amount: 900, weight: 1 }
};
const juni = S.resolveDates({ flex: 'exact', from: '2027-06-12', to: '2027-06-19' });
const ctxJuni = { months: juni.months, budgetPPN: 900 };

test('Europa, Alperna: Chamonix kan dyka upp som resmål', () => {
  const res = S.rankDestinations(ALL, basePrefs, ctxJuni, null, 12);
  const alla = [...res.included, ...res.excluded, ...res.rest].map((r) => r.dest.namn);
  assert.ok(alla.some((n) => /chamonix/i.test(n)));
  assert.ok([...res.included, ...res.rest].every((r) => r.dest.region === 'Alperna'));
});

test('saknade avstånd räknas inte in i procenten', () => {
  const res = S.rankDestinations(ALL, basePrefs, ctxJuni, null, 12);
  const top = res.included[0];
  assert.ok(top.criteria.some((c) => c.unknown && c.id === 'near:beach'));
  assert.ok(top.percent >= 0 && top.percent <= 100);
});

test('eget val av ort: bara den orten', () => {
  const res = S.rankDestinations(ALL, { ...basePrefs, dest: { known: 'yes', place: 'Chamonix' } }, ctxJuni, null, 12);
  assert.strictEqual(res.included.length, 1);
  assert.ok(res.free);
});

test('okänd ort ger ett ärligt meddelande, inga påhittade förslag', () => {
  const res = S.rankDestinations(ALL, { ...basePrefs, dest: { known: 'yes', place: 'Atlantis' } }, ctxJuni, null, 12);
  assert.strictEqual(res.included.length, 0);
  assert.match(res.note, /finns inte i listan/);
});

console.log(`\n${n} tester gick igenom.`);
