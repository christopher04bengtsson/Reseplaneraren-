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

// En rankning med testdata
global.window = {};
require('../js/testdata.js');
const DATA = global.window.RP.TESTDATA;
const prefs = {
  group: { total: 10, couples: 3, children: 0, ownRoom: 0 },
  dest: { known: 'yes', place: 'Mallorca' },
  climate: { temp: [1, 2], tempWeight: 2, swim: false, seaMin: 21, avoidRain: false, rainMax: 1 },
  lodging: ['house'],
  town: { size: [0, 2], sizeWeight: 1, life: [1, 3], lifeWeight: 1 },
  nearby: [{ key: 'beach', label: 'Strand', weight: 3, mode: 'walk', minutes: 10 }],
  budget: { mode: 'pppn', amount: 900, weight: 1 }
};
const ctx = { months: [5], budgetPPN: 900 };

test('måste finnas sorterar bort områden', () => {
  const res = S.rankAreas(DATA, prefs, ctx);
  assert.ok(res.included.length > 0);
  for (const r of res.included) assert.ok(r.area.dest === 'mallorca');
  assert.ok(res.excluded.some((r) => r.area.id === 'soller')); // strand 2,6 km
  assert.ok(res.included.every((r) => r.area.nearby.beach <= 800));
});

test('procent är sorterade och mellan 0 och 100', () => {
  const res = S.rankAreas(DATA, { ...prefs, nearby: [] }, ctx);
  const p = res.included.map((r) => r.percent);
  assert.deepStrictEqual(p, [...p].sort((a, b) => b - a));
  assert.ok(p.every((x) => x >= 0 && x <= 100));
});

test('vet inte: klimatet väljer resmål i regionen', () => {
  const res = S.rankAreas(DATA, {
    ...prefs, nearby: [],
    dest: { known: 'no', continent: 'Europa', region: 'alla' },
    climate: { ...prefs.climate, temp: [2, 3], swim: true }
  }, { months: [6], budgetPPN: 0 });
  assert.ok(res.suggested);
  assert.ok(!res.included.some((r) => r.dest.id === 'chamonix'));
});

console.log(`\n${n} tester gick igenom.`);
