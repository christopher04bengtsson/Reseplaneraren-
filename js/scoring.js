/*
 * Uträkningar och poäng enligt SPEC.md, avsnittet "Matchning och poäng".
 * Rena funktioner utan DOM, så att de kan testas i Node (tests/).
 */
(function (root) {
  'use strict';

  // ---------- Skalor ----------

  const WEIGHTS = [
    { w: 0, label: 'Spelar ingen roll', short: 'Ingen roll' },
    { w: 1, label: 'Trevligt', short: 'Trevligt' },
    { w: 2, label: 'Viktigt', short: 'Viktigt' },
    { w: 3, label: 'Måste finnas', short: 'Måste' }
  ];

  const SIZE_STEPS = [
    { label: 'By', sub: 'under 5 000', ex: 'Deià' },
    { label: 'Småstad', sub: '5 000–50 000', ex: 'Sóller' },
    { label: 'Mellanstor stad', sub: '50 000–300 000', ex: 'Girona' },
    { label: 'Storstad', sub: '300 000–1 milj.', ex: 'Palma' },
    { label: 'Metropol', sub: 'över 1 milj.', ex: 'Barcelona' }
  ];
  // Gränser i invånare. Första och sista är bara ändpunkter för interpolering.
  const SIZE_BOUNDS = [300, 5000, 50000, 300000, 1000000, 10000000];

  const LIFE_STEPS = [
    { label: 'Lugnt och tyst', ex: 'Fåglar och kyrkklockor' },
    { label: 'Lugnt', ex: 'Några kaféer' },
    { label: 'Lagom', ex: 'Torg med restauranger' },
    { label: 'Livligt', ex: 'Barer och butiker' },
    { label: 'Mycket folk och liv', ex: 'Storstadspuls' }
  ];
  // Restauranger, barer och butiker inom 1 km. PRELIMINÄRA gränser –
  // enligt specen bestäms de när vi ser riktiga siffror från Google Places.
  const LIFE_BOUNDS = [0, 30, 80, 180, 400, 1000];

  const TEMP_STEPS = [
    { label: 'Svalt', sub: 'under 18 °C', ex: 'Fjäll, vandring' },
    { label: 'Behagligt', sub: '18–24 °C', ex: 'Stad, försommar' },
    { label: 'Varmt', sub: '24–30 °C', ex: 'Strandsemester' },
    { label: 'Hett', sub: 'över 30 °C', ex: 'Högsommar i söder' }
  ];
  const TEMP_BOUNDS = [-Infinity, 18, 24, 30, Infinity];
  const TEMP_FALLOFF = 6; // °C – ett steg utanför spannet ger 0

  const NEARBY_DEFAULTS = [
    { key: 'beach', label: 'Strand', icon: '🏖️' },
    { key: 'restaurant', label: 'Restauranger', icon: '🍽️' },
    { key: 'padel', label: 'Padelbana', icon: '🎾' },
    { key: 'tennis', label: 'Tennisbana', icon: '🎾' },
    { key: 'gym', label: 'Gym', icon: '🏋️' },
    { key: 'sights', label: 'Sevärdheter', icon: '🏛️' },
    { key: 'grocery', label: 'Mataffär', icon: '🛒' }
  ];

  // Ungefärlig hastighet i meter per minut, för att räkna om avstånd till tid.
  const SPEED = { walk: 80, car: 600 };
  const MODE_LABEL = { walk: 'gång', car: 'bil' };

  const LODGING = [
    { key: 'hotel', label: 'Hotell', icon: '🏨' },
    { key: 'house', label: 'Hus eller villa', icon: '🏡' },
    { key: 'apartment', label: 'Lägenhet', icon: '🏢' }
  ];

  const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
    'augusti', 'september', 'oktober', 'november', 'december'];

  // ---------- Hjälpfunktioner ----------

  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  /** Position på en stegskala som decimaltal, t.ex. 1.4 = 40 % in i steg 2. */
  function stepPosition(value, bounds, log) {
    const n = bounds.length - 1;
    if (value <= bounds[0]) return 0;
    for (let i = 0; i < n; i++) {
      const lo = bounds[i], hi = bounds[i + 1];
      if (value < hi) {
        const frac = log ? Math.log(value / lo) / Math.log(hi / lo) : (value - lo) / (hi - lo);
        return i + clamp01(frac);
      }
    }
    return n - 0.001;
  }

  /** Delvärde för en position mot ett valt spann av steg [a, b]. */
  function spanScore(pos, span) {
    const a = span[0], b = span[1] + 1;
    if (pos < a) return clamp01(1 - (a - pos));
    if (pos > b) return clamp01(1 - (pos - b));
    return 1;
  }

  /** Inom spann ger 1, sjunker jämnt till 0 vid `falloff` utanför. */
  function rangeScore(value, lo, hi, falloff) {
    if (value < lo) return clamp01(1 - (lo - value) / falloff);
    if (value > hi) return clamp01(1 - (value - hi) / falloff);
    return 1;
  }

  /** Inom gränsen ger 1, sjunker jämnt till 0 vid dubbla gränsen. */
  function distanceScore(dist, limit) {
    if (dist == null) return 0;
    if (dist <= limit) return 1;
    return clamp01(2 - dist / limit);
  }

  function parseDate(s) {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  }
  function formatISO(d) { return d.toISOString().slice(0, 10); }

  function nightsBetween(from, to) {
    const n = Math.round((parseDate(to) - parseDate(from)) / 86400000);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Gör om datumvalen till konkreta datum, nätter och månader. */
  function resolveDates(dates) {
    let checkin, checkout, nights;
    if (dates.flex === 'month') {
      nights = Math.max(1, Number(dates.nights) || 7);
      const start = parseDate(dates.month + '-01');
      checkin = formatISO(start);
      checkout = formatISO(new Date(start.getTime() + nights * 86400000));
    } else {
      checkin = dates.from;
      checkout = dates.to;
      nights = nightsBetween(checkin, checkout);
    }
    const months = [];
    if (dates.flex === 'month') {
      months.push(parseDate(checkin).getUTCMonth());
    } else if (nights > 0) {
      // Månaderna som resan går över, en gång per natt för att vikta rätt
      const start = parseDate(checkin).getTime();
      for (let i = 0; i < nights; i++) months.push(new Date(start + i * 86400000).getUTCMonth());
    } else if (checkin) {
      months.push(parseDate(checkin).getUTCMonth());
    }
    return { checkin, checkout, nights, months, flex: dates.flex };
  }

  // ---------- Sällskapet ----------

  /**
   * Sovrum och sängar:
   * - varje par delar rum och dubbelsäng
   * - den som vill ha eget rum får ett eget rum
   * - barn delar två och två, en säng var
   * - övriga vuxna delar två och två, en säng var
   */
  function calcRooms(group) {
    const total = Math.max(0, Number(group.total) || 0);
    const couples = Math.max(0, Number(group.couples) || 0);
    const children = Math.max(0, Number(group.children) || 0);
    const ownRoom = Math.max(0, Number(group.ownRoom) || 0);
    const others = total - couples * 2 - children - ownRoom;
    const valid = others >= 0;
    const singles = Math.max(0, others);
    const bedrooms = couples + ownRoom + Math.ceil(children / 2) + Math.ceil(singles / 2);
    const beds = couples + ownRoom + children + singles;
    return {
      valid, bedrooms, beds, doubleBeds: couples,
      adults: Math.max(0, total - children), children, total
    };
  }

  /** Budget per person och natt, oavsett hur den angavs. */
  function budgetPPN(budget, persons, nights) {
    const amount = Number(budget.amount) || 0;
    if (!amount) return 0;
    if (budget.mode === 'total') return persons && nights ? amount / (persons * nights) : 0;
    return amount;
  }

  /** Kostnadsdelning: pris in, fyra summor ut. */
  function splitCost(price, mode, persons, nights) {
    const p = Number(price) || 0;
    const total = mode === 'night' ? p * nights : p;
    const perNight = nights ? total / nights : 0;
    return {
      total,
      perPerson: persons ? total / persons : 0,
      perNight,
      perPersonNight: persons && nights ? total / persons / nights : 0
    };
  }

  // ---------- Klimat ----------

  function climateFor(dest, area, months) {
    const c = dest.climate;
    const ms = months.length ? months : [5];
    const avg = (arr) => ms.reduce((s, m) => s + arr[m], 0) / ms.length;
    return {
      tMax: avg(c.tMax) + (area ? area.tempOffset || 0 : 0),
      sea: c.sea ? avg(c.sea) : null,
      rain: avg(c.rain)
    };
  }

  function climateCriteria(climate, prefs) {
    const out = [];
    const t = prefs.climate;
    const lo = TEMP_BOUNDS[t.temp[0]], hi = TEMP_BOUNDS[t.temp[1] + 1];
    const tempScore = rangeScore(climate.tMax, lo, hi, TEMP_FALLOFF);
    out.push({
      id: 'temp', label: 'Temperatur', weight: t.tempWeight, score: tempScore,
      text: `Ca ${Math.round(climate.tMax)} °C dagtid`
    });
    if (t.swim) {
      const s = climate.sea == null ? 0 : rangeScore(climate.sea, t.seaMin, Infinity, 3);
      out.push({
        id: 'sea', label: 'Bad', weight: 2, score: s,
        text: climate.sea == null ? 'Inget hav' : `Havet ca ${Math.round(climate.sea)} °C`
      });
    }
    if (t.avoidRain) {
      const s = rangeScore(climate.rain, 0, t.rainMax, Math.max(1, t.rainMax));
      out.push({
        id: 'rain', label: 'Regn', weight: 2, score: s,
        text: `${climate.rain.toFixed(1).replace('.', ',')} regndagar/vecka`
      });
    }
    return out;
  }

  function weightedPercent(criteria) {
    let sw = 0, sum = 0;
    for (const c of criteria) { sw += c.weight; sum += c.weight * c.score; }
    return sw ? Math.round((sum / sw) * 100) : 100;
  }

  // ---------- Närhet ----------

  /** Nyckeln i testdatan för en sak i närheten, även för egna saker. */
  function nearbyKey(item) {
    if (!item.custom) return item.key;
    const l = item.label.toLowerCase();
    if (l.includes('golf')) return 'golf';
    if (l.includes('strand') || l.includes('bad')) return 'beach';
    if (l.includes('gym')) return 'gym';
    if (l.includes('padel')) return 'padel';
    if (l.includes('tennis')) return 'tennis';
    return 'custom:' + l;
  }

  function formatMinutes(dist, mode) {
    // Långt att gå? Visa bilavstånd i stället, det säger mer.
    if (mode === 'walk' && dist / SPEED.walk > 45) mode = 'car';
    const min = Math.max(1, Math.round(dist / SPEED[mode]));
    return `${min} min ${MODE_LABEL[mode]}`;
  }

  // ---------- Poäng per område ----------

  function scoreArea(area, dest, prefs, ctx) {
    const criteria = [];
    const excludedBy = [];

    // 1. Närhet, inklusive "Måste finnas"
    for (const item of prefs.nearby) {
      if (!item.weight) continue;
      const dist = area.nearby[nearbyKey(item)];
      const limit = item.minutes * SPEED[item.mode];
      const score = distanceScore(dist, limit);
      const must = item.weight === 3;
      if (must && (dist == null || dist > limit)) excludedBy.push(item.label);
      criteria.push({
        id: 'near:' + item.key, label: item.label, weight: item.weight, score, must,
        text: dist == null ? `${item.label} saknas i närheten` : `${item.label} ${formatMinutes(dist, item.mode)}`
      });
    }

    // Klimat
    const climate = climateFor(dest, area, ctx.months);
    criteria.push(...climateCriteria(climate, prefs));

    // Ortens storlek
    const sizePos = stepPosition(area.population, SIZE_BOUNDS, true);
    const sizeStep = Math.min(SIZE_STEPS.length - 1, Math.floor(sizePos));
    criteria.push({
      id: 'size', label: 'Ortens storlek', weight: prefs.town.sizeWeight,
      score: spanScore(sizePos, prefs.town.size), text: SIZE_STEPS[sizeStep].label
    });

    // Liv och rörelse
    const lifePos = stepPosition(area.venues1km, LIFE_BOUNDS, false);
    const lifeStep = Math.min(LIFE_STEPS.length - 1, Math.floor(lifePos));
    criteria.push({
      id: 'life', label: 'Liv och rörelse', weight: prefs.town.lifeWeight,
      score: spanScore(lifePos, prefs.town.life), text: LIFE_STEPS[lifeStep].label
    });

    // Typ av boende
    if (prefs.lodging.length) {
      const found = LODGING.filter((l) => prefs.lodging.includes(l.key) && area.lodging[l.key]);
      criteria.push({
        id: 'lodging', label: 'Boende', weight: 2, score: found.length ? 1 : 0,
        text: found.length ? found.map((l) => l.label).join(', ') + ' finns'
          : 'Valt boende finns inte här'
      });
    }

    // Budget
    if (ctx.budgetPPN > 0 && prefs.budget.weight) {
      criteria.push({
        id: 'budget', label: 'Budget', weight: prefs.budget.weight,
        score: rangeScore(area.pricePPN, 0, ctx.budgetPPN, ctx.budgetPPN),
        text: `Ca ${formatKr(area.pricePPN)}/pers/natt`
      });
    }

    return {
      area, dest, climate, sizeStep, lifeStep, criteria,
      excluded: excludedBy.length > 0, excludedBy,
      percent: weightedPercent(criteria)
    };
  }

  // ---------- Urval och rankning ----------

  /** Vilka resmål som ska rankas, utifrån "Vet ni vart ni vill åka?". */
  function pickDestinations(data, prefs, ctx) {
    const d = prefs.dest;
    if (d.known === 'yes') {
      const q = (d.place || '').trim().toLowerCase();
      if (!q) return { dests: data.destinations, note: 'Inget resmål angivet – visar alla testresmål.' };
      const hit = (s) => s && (s.toLowerCase().includes(q) || q.includes(s.toLowerCase()));
      const areaDests = data.areas.filter((a) => hit(a.name)).map((a) => a.dest);
      const dests = data.destinations.filter((x) =>
        hit(x.name) || hit(x.region) || hit(x.country) || areaDests.includes(x.id));
      if (dests.length) return { dests, note: '' };
      return {
        dests: data.destinations,
        note: `Det finns ingen testdata för "${d.place}" än – visar alla testresmål.`
      };
    }

    // Vet inte: filtrera på världsdel och region, välj sedan ut på klimat.
    let pool = data.destinations.filter((x) => x.continent === d.continent &&
      (!d.region || d.region === 'alla' || x.region === d.region));
    if (!pool.length) {
      return { dests: [], note: `Det finns ingen testdata för ${d.region && d.region !== 'alla' ? d.region : d.continent} än.` };
    }
    const ranked = pool.map((dest) => {
      const crit = climateCriteria(climateFor(dest, null, ctx.months), prefs);
      return { dest, score: weightedPercent(crit) };
    }).sort((a, b) => b.score - a.score);
    let keep = ranked.filter((r) => r.score >= 50);
    if (!keep.length) keep = ranked.slice(0, 1);
    return { dests: keep.map((r) => r.dest), note: '', suggested: true };
  }

  function rankAreas(data, prefs, ctx) {
    const pick = pickDestinations(data, prefs, ctx);
    const ids = pick.dests.map((x) => x.id);
    const results = data.areas
      .filter((a) => ids.includes(a.dest))
      .map((a) => scoreArea(a, data.destinations.find((x) => x.id === a.dest), prefs, ctx));
    const included = results.filter((r) => !r.excluded).sort((a, b) => b.percent - a.percent);
    const excluded = results.filter((r) => r.excluded);
    return { included, excluded, note: pick.note, suggested: !!pick.suggested };
  }

  // ---------- Format ----------

  function formatKr(n) {
    return Math.round(n).toLocaleString('sv-SE').replace(/,/g, ' ') + ' kr';
  }

  const api = {
    WEIGHTS, SIZE_STEPS, SIZE_BOUNDS, LIFE_STEPS, LIFE_BOUNDS, TEMP_STEPS, TEMP_BOUNDS,
    NEARBY_DEFAULTS, SPEED, MODE_LABEL, LODGING, MONTHS,
    stepPosition, spanScore, rangeScore, distanceScore,
    nightsBetween, resolveDates, calcRooms, budgetPPN, splitCost,
    climateFor, scoreArea, pickDestinations, rankAreas, nearbyKey, formatKr, formatMinutes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.RP = root.RP || {}; root.RP.scoring = api; }
})(typeof window !== 'undefined' ? window : globalThis);
