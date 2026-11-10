#!/usr/bin/env node
/*
 * Bygger data/resmal.json (och data/resmal.js) från tools/resmal-lista.json.
 *
 *   node tools/bygg-resmal.mjs
 *
 * För varje resmål hämtas:
 *   - Wikidata: rätt ort (kontrolleras mot landet), koordinater och senaste
 *     invånarantal med årtal.
 *   - Open-Meteo, historiska data: temperatur dagtid och regndagar per månad,
 *     som medel över KLIMAT_AR år.
 *
 * Inget gissas: saknas ett värde sparas null och sidan visar "saknas".
 * Svaren sparas i tools/.cache så att en ny körning inte frågar igen.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const CACHE = path.join(DIR, '.cache');
const UA = 'Reseplaneraren/1.0 (hobbyprojekt; github.com/christopher04bengtsson/Reseplaneraren-)';

const KLIMAT_FRAN = '2019-01-01';
const KLIMAT_TILL = '2024-12-31';
const KLIMAT_AR = 6;
const REGNDAG_MM = 1; // en dag med minst 1 mm räknas som regndag

// Regionerna i SPEC-v2.md, i den ordning de visas.
const REGIONER = {
  Europa: [
    { namn: 'Medelhavet', lander: ['Spanien', 'Frankrike', 'Italien', 'Kroatien', 'Grekland', 'Turkiet', 'Cypern', 'Malta'] },
    { namn: 'Kanarieöarna', lander: ['Spanien'] },
    { namn: 'Alperna', lander: ['Frankrike', 'Schweiz', 'Italien', 'Österrike', 'Tyskland', 'Slovenien'] },
    { namn: 'Atlantkusten', lander: ['Portugal', 'Spanien', 'Frankrike'] },
    { namn: 'Norden', lander: ['Sverige', 'Norge', 'Danmark', 'Finland', 'Island'] },
    { namn: 'Brittiska öarna', lander: ['Storbritannien', 'Irland'] },
    { namn: 'Centraleuropas städer', lander: ['Tyskland', 'Tjeckien', 'Österrike', 'Ungern', 'Nederländerna'] }
  ]
};

fs.mkdirSync(CACHE, { recursive: true });
// Kort, stabil nyckel för cachen utifrån hela texten.
const hash = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.codePointAt(0)) >>> 0; return h.toString(36); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, { cacheKey, pause = 0 } = {}) {
  const file = cacheKey && path.join(CACHE, cacheKey.replace(/[^\w.-]+/g, '_') + '.json');
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let forsok = 1; ; forsok++) {
    let r;
    try {
      r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    } catch (err) {
      if (forsok >= 5) throw err;
      console.warn(`  nätverksfel (${err.cause ? err.cause.code : err.message}) – försöker igen`);
      await sleep(3000 * forsok);
      continue;
    }
    if (r.ok) {
      const j = await r.json();
      if (file) fs.writeFileSync(file, JSON.stringify(j));
      if (pause) await sleep(pause);
      return j;
    }
    if ((r.status === 429 || r.status >= 500) && forsok < 30) {
      const msg = (await r.text()).slice(0, 120).replace(/\s+/g, ' ');
      const vanta = Math.min(90000, 10000 * forsok);
      console.warn(`  ${r.status} från ${new URL(url).host} (${msg}) – väntar ${vanta / 1000} s`);
      await sleep(vanta);
      continue;
    }
    throw new Error(`${r.status} ${url}\n${(await r.text()).slice(0, 300)}`);
  }
}

// ---------- Wikidata ----------

const claimValue = (c) => c && c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value;

function latestPopulation(entity) {
  const claims = (entity.claims.P1082 || []).filter((c) => claimValue(c));
  if (!claims.length) return { invanare: null, ar: null };
  const withYear = claims.map((c) => {
    const t = c.qualifiers && c.qualifiers.P585 && c.qualifiers.P585[0].datavalue;
    return { c, year: t ? Number(t.value.time.slice(1, 5)) : 0 };
  });
  const preferred = withYear.filter((x) => x.c.rank === 'preferred');
  const pool = preferred.length ? preferred : withYear.filter((x) => x.c.rank !== 'deprecated');
  pool.sort((a, b) => b.year - a.year);
  const best = pool[0];
  return { invanare: Math.round(Number(claimValue(best.c).amount)), ar: best.year || null };
}

/**
 * Slår upp alla orter i EN fråga mot Wikidata, med Wikidatas egen sökning
 * (samma som sökrutan på wikidata.org). För varje ort väljs den högst
 * rankade träffen som ligger i rätt land och har koordinater.
 * Sedan hämtas orterna i omgångar om 50 för invånare med årtal.
 */
async function findEntities(items, lander) {
  const sok = [...new Set(items.filter((i) => !i.qid).map((i) => i.sok))];
  const query = `SELECT ?name ?item ?ordinal ?country WHERE {
    VALUES ?name { ${sok.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(' ')} }
    SERVICE wikibase:mwapi {
      bd:serviceParam wikibase:endpoint "www.wikidata.org"; wikibase:api "EntitySearch";
        mwapi:search ?name; mwapi:language "en".
      ?item wikibase:apiOutputItem mwapi:item.
      ?ordinal wikibase:apiOrdinal true.
    }
    ?item wdt:P625 ?coord; wdt:P17 ?country.
  }`;
  const j = await getJSON('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query),
    { cacheKey: 'mwapi-' + sok.length + '-' + sok.join('').length });
  const best = {};
  for (const b of j.results.bindings) {
    const key = b.name.value + '|' + b.country.value.split('/').pop();
    const ord = Number(b.ordinal.value);
    if (!best[key] || ord < best[key].ord) best[key] = { id: b.item.value.split('/').pop(), ord };
  }
  const ids = items.map((i) => i.qid || (best[i.sok + '|' + lander[i.land]] || {}).id);
  const want = [...new Set(ids.filter(Boolean))];
  const entities = {};
  for (let k = 0; k < want.length; k += 50) {
    const chunk = want.slice(k, k + 50);
    const data = await getJSON(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels|descriptions&languages=sv|en&ids=${chunk.join('|')}`,
      { cacheKey: 'ents-' + hash(chunk.join('-')) + '-' + chunk.length, pause: 2000 }
    );
    Object.assign(entities, data.entities);
  }
  return ids.map((id, n) => {
    const e = id && entities[id];
    if (!e || !e.claims || !e.claims.P625) return null;
    const lander2 = (e.claims.P17 || []).map((c) => claimValue(c) && claimValue(c).id);
    return lander2.includes(lander[items[n].land]) ? e : null;
  });
}

// ---------- Open-Meteo ----------

function monthly(times, values, reducer) {
  const buckets = Array.from({ length: 12 }, () => []);
  times.forEach((t, i) => {
    if (values[i] !== null && values[i] !== undefined) buckets[Number(t.slice(5, 7)) - 1].push(values[i]);
  });
  return buckets.map((b) => (b.length ? reducer(b) : null));
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const round1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

async function climate(lat, lng) {
  const j = await getJSON(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}` +
    `&start_date=${KLIMAT_FRAN}&end_date=${KLIMAT_TILL}&daily=temperature_2m_max,precipitation_sum&timezone=GMT`,
    { cacheKey: `klimat-${lat}-${lng}`, pause: 4000 }
  );
  const d = j.daily;
  const tMax = monthly(d.time, d.temperature_2m_max, mean).map(round1);
  // Regndagar per vecka = andelen dagar med regn × 7
  const rain = monthly(d.time, d.precipitation_sum, (b) => (b.filter((x) => x >= REGNDAG_MM).length / b.length) * 7).map(round1);
  return { tMax, rain };
}

// ---------- Huvudprogram ----------

const lista = JSON.parse(fs.readFileSync(path.join(DIR, 'resmal-lista.json'), 'utf8'));
const out = [];
const problem = [];

const hittade = await findEntities(lista.resmal, lista.lander);

for (const [n, item] of lista.resmal.entries()) {
  process.stdout.write(`${item.region.padEnd(22)} ${item.namn.padEnd(40)} `);
  const e = hittade[n];
  if (!e) {
    console.log('HITTADES INTE');
    problem.push(`${item.namn}: hittades inte i Wikidata med rätt land`);
    continue;
  }
  const coord = claimValue(e.claims.P625[0]);
  const lat = Math.round(coord.latitude * 10000) / 10000;
  const lng = Math.round(coord.longitude * 10000) / 10000;
  // Är ortens eget invånartal orimligt i Wikidata används kommunens, och det märks ut.
  let pop = latestPopulation(e);
  let popKommun = false;
  if (item.befolkningQid) {
    const k = await getJSON(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${item.befolkningQid}`,
      { cacheKey: 'pop-' + item.befolkningQid, pause: 1000 });
    pop = latestPopulation(k.entities[item.befolkningQid]);
    popKommun = true;
  }
  const kl = await climate(lat, lng);
  const desc = (e.descriptions.en || e.descriptions.sv || {}).value || '';
  console.log(`${e.id}  ${pop.invanare ?? 'invånare saknas'}  ${desc}`);
  if (pop.invanare === null) problem.push(`${item.namn}: invånarantal saknas i Wikidata`);
  if (!kl.tMax.every((x) => x !== null)) problem.push(`${item.namn}: klimatdata saknas för någon månad`);

  out.push({
    id: item.namn.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    namn: item.namn,
    land: item.land,
    varldsdel: item.varldsdel,
    region: item.region,
    omrade: item.omrade || null,
    typ: item.typ,
    lat, lng,
    invanare: pop.invanare,
    invanareAr: pop.ar,
    invanareKommun: popKommun || undefined,
    wikidata: e.id,
    wikidataNamn: (e.labels.sv || e.labels.en || {}).value || null,
    klimat: { tMax: kl.tMax, rain: kl.rain }
  });
}

const resultat = {
  skapad: new Date().toISOString().slice(0, 10),
  kallor: {
    orter: 'Wikidata (koordinater P625, invånare P1082)',
    klimat: `Open-Meteo historiska data ${KLIMAT_FRAN.slice(0, 4)}–${KLIMAT_TILL.slice(0, 4)} (${KLIMAT_AR} år): medel av högsta dagstemperatur, regndagar per vecka (minst ${REGNDAG_MM} mm)`,
  },
  regioner: REGIONER,
  resmal: out
};

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/resmal.json'), JSON.stringify(resultat, null, 1) + '\n');
fs.writeFileSync(path.join(ROOT, 'data/resmal.js'),
  '// Skapad av tools/bygg-resmal.mjs från data/resmal.json – ändra inte för hand.\n' +
  'window.RP = window.RP || {};\nwindow.RP.RESMAL = ' + JSON.stringify(resultat) + ';\n');

console.log(`\n${out.length} resmål sparade i data/resmal.json`);
if (problem.length) console.log('\nAtt kontrollera:\n- ' + problem.join('\n- '));
