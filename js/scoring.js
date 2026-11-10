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

  /*
   * Önskemål om boendet, och hur de skickas till bokningssajterna.
   *   airbnb:      Airbnbs filter-id (amenities[]=…)
   *   airbnbParam: annan parameter i Airbnb-länken
   *   booking:     Bookings filter i nflt=… (t.ex. hotelfacility=433)
   * Saknas en kod för en sajt hamnar önskemålet i checklistan i stället.
   * Koderna är kända från sajternas egna sökadresser men behöver testas en gång var.
   */
  const AMENITIES = [
    { key: 'pool', label: 'Pool', icon: '🏊', group: 'facility', airbnb: 7, booking: 'hotelfacility=433' },
    { key: 'gym', label: 'Gym', icon: '🏋️', group: 'facility', airbnb: 15, booking: 'hotelfacility=11' },
    { key: 'wifi', label: 'Wifi', icon: '📶', group: 'facility', airbnb: 4, booking: 'hotelfacility=107' },
    { key: 'ac', label: 'Luftkonditionering', icon: '❄️', group: 'facility', airbnb: 5, booking: 'roomfacility=11' },
    { key: 'parking', label: 'Parkering', icon: '🅿️', group: 'facility', airbnb: 9, booking: 'hotelfacility=2' },
    { key: 'kitchen', label: 'Kök', icon: '🍳', group: 'facility', airbnb: 8 },
    { key: 'washer', label: 'Tvättmaskin', icon: '🧺', group: 'facility', airbnb: 33 },
    { key: 'hottub', label: 'Bubbelpool', icon: '♨️', group: 'facility', airbnb: 25 },
    { key: 'breakfast', label: 'Frukost ingår', icon: '🥐', group: 'terms', airbnb: 16, booking: 'mealplan=1' },
    { key: 'freecancel', label: 'Gratis avbokning', icon: '↩️', group: 'terms', airbnbParam: ['flexible_cancellation', 'true'], booking: 'fc=2' },
    { key: 'rating8', label: 'Betyg minst 8 av 10', icon: '⭐', group: 'terms', booking: 'review_score=80', minGoogleRating: 4.0 }
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

  /** Medel över resans månader. null om data saknas för någon månad. */
  function avgMonths(arr, months) {
    if (!arr) return null;
    const ms = months.length ? months : [5];
    let sum = 0;
    for (const m of ms) {
      if (arr[m] === null || arr[m] === undefined) return null;
      sum += arr[m];
    }
    return sum / ms.length;
  }

  function climateFor(dest, months) {
    const c = dest.klimat || {};
    return { tMax: avgMonths(c.tMax, months), rain: avgMonths(c.rain, months) };
  }

  function unknown(id, label, text) {
    return { id, label, weight: 0, score: 0, unknown: true, text };
  }

  function climateCriteria(climate, prefs, dest) {
    const out = [];
    const t = prefs.climate;
    if (climate.tMax === null) {
      out.push(unknown('temp', 'Temperatur', 'Temperatur saknas'));
    } else {
      const lo = TEMP_BOUNDS[t.temp[0]], hi = TEMP_BOUNDS[t.temp[1] + 1];
      out.push({
        id: 'temp', label: 'Temperatur', weight: t.tempWeight,
        score: rangeScore(climate.tMax, lo, hi, TEMP_FALLOFF),
        text: `Ca ${Math.round(climate.tMax)} °C dagtid`
      });
    }
    if (t.avoidRain) {
      if (climate.rain === null) {
        out.push(unknown('rain', 'Regn', 'Regndata saknas'));
      } else {
        out.push({
          id: 'rain', label: 'Regn', weight: 2,
          score: rangeScore(climate.rain, 0, t.rainMax, Math.max(1, t.rainMax)),
          text: `${climate.rain.toFixed(1).replace('.', ',')} regndagar/vecka`
        });
      }
    }
    return out;
  }

  function weightedPercent(criteria) {
    let sw = 0, sum = 0;
    for (const c of criteria) {
      if (c.unknown) continue;
      sw += c.weight; sum += c.weight * c.score;
    }
    return sw ? Math.round((sum / sw) * 100) : 100;
  }

  // ---------- Närhet ----------

  /** Nyckeln för en sak i närheten, även för egna saker. */
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

  // ---------- Poäng per resmål ----------

  /**
   * dest: ett resmål från data/resmal.json.
   * nearby: { nyckel: meter | null } från Google, eller undefined om det inte hämtats.
   * Det som saknas räknas inte in i poängen, men visas på kortet.
   */
  function scoreDestination(dest, nearby, prefs, ctx) {
    const criteria = [];
    const excludedBy = [];

    for (const item of prefs.nearby) {
      if (!item.weight) continue;
      const key = nearbyKey(item);
      if (!nearby || !(key in nearby)) {
        criteria.push(unknown('near:' + item.key, item.label, `${item.label}: avstånd inte hämtat`));
        continue;
      }
      const dist = nearby[key];
      const limit = item.minutes * SPEED[item.mode];
      const must = item.weight === 3;
      if (must && (dist === null || dist > limit)) excludedBy.push(item.label);
      criteria.push({
        id: 'near:' + item.key, label: item.label, weight: item.weight, must,
        score: distanceScore(dist, limit),
        text: dist === null ? `${item.label} saknas i närheten` : `${item.label} ${formatMinutes(dist, item.mode)}`
      });
    }

    const climate = climateFor(dest, ctx.months);
    criteria.push(...climateCriteria(climate, prefs, dest));

    let sizeStep = null;
    if (dest.invanare) {
      const sizePos = stepPosition(dest.invanare, SIZE_BOUNDS, true);
      sizeStep = Math.min(SIZE_STEPS.length - 1, Math.floor(sizePos));
      criteria.push({
        id: 'size', label: 'Ortens storlek', weight: prefs.town.sizeWeight,
        score: spanScore(sizePos, prefs.town.size),
        text: `${SIZE_STEPS[sizeStep].label} (${formatInt(dest.invanare)} inv.${dest.invanareKommun ? ' i kommunen' : ''})`
      });
    } else {
      criteria.push(unknown('size', 'Ortens storlek', 'Invånarantal saknas'));
    }

    if (prefs.town.lifeWeight) criteria.push(unknown('life', 'Liv och rörelse', 'Liv och rörelse: kommer senare'));
    if (ctx.budgetPPN > 0 && prefs.budget.weight) criteria.push(unknown('budget', 'Budget', 'Pris: kommer med boendena'));

    return {
      dest, climate, sizeStep, criteria,
      excluded: excludedBy.length > 0, excludedBy,
      percent: weightedPercent(criteria)
    };
  }

  // ---------- Urval och rankning ----------

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  /** Vilka resmål som ska rankas, utifrån "Vet ni vart ni vill åka?". */
  function pickDestinations(all, prefs) {
    const d = prefs.dest;
    if (d.known === 'yes') {
      const q = norm(d.place);
      if (!q) return { list: [], note: 'Skriv vart ni vill åka, eller välj "Nej, ge förslag".', free: true };
      const hit = (s) => s && (norm(s).includes(q) || q.includes(norm(s)));
      const list = all.filter((x) => hit(x.namn) || hit(x.wikidataNamn) || hit(x.omrade) || hit(x.land) || hit(x.region));
      if (list.length) return { list, note: '', free: true };
      return { list: [], free: true, note: `"${d.place}" finns inte i listan över resmål än. Välj "Nej, ge förslag" för att se resmål i en region.` };
    }
    const list = all.filter((x) => x.varldsdel === d.continent && (!d.region || d.region === 'alla' || x.region === d.region));
    if (!list.length) {
      return { list: [], note: `Det finns inga resmål för ${d.region && d.region !== 'alla' ? d.region : d.continent} än.` };
    }
    return { list, note: '' };
  }

  /**
   * Rankar i två steg, så att Google bara behöver frågas om de bästa:
   * 1. Alla resmål poängsätts på det som inte kräver anrop (klimat, storlek).
   * 2. De `shortlistSize` bästa poängsätts igen med avstånd från Google.
   * Resultatet: shortlist (sorterad), övriga (sorterade på steg 1) och bortsorterade.
   */
  function rankDestinations(all, prefs, ctx, nearbyById, shortlistSize) {
    const pick = pickDestinations(all, prefs);
    const stage1 = pick.list
      .map((dest) => scoreDestination(dest, undefined, prefs, ctx))
      .sort((a, b) => b.percent - a.percent);
    const n = shortlistSize || 12;
    const top = stage1.slice(0, n).map((r) => scoreDestination(r.dest, nearbyById && nearbyById[r.dest.id], prefs, ctx));
    const included = top.filter((r) => !r.excluded).sort((a, b) => b.percent - a.percent);
    const excluded = top.filter((r) => r.excluded);
    return { included, excluded, rest: stage1.slice(n), shortlist: top.map((r) => r.dest), note: pick.note, free: !!pick.free };
  }

  // ---------- Format ----------

  function formatInt(n) {
    return Math.round(n).toLocaleString('sv-SE').replace(/,/g, ' ');
  }

  function formatKr(n) {
    return Math.round(n).toLocaleString('sv-SE').replace(/,/g, ' ') + ' kr';
  }

  const api = {
    WEIGHTS, SIZE_STEPS, SIZE_BOUNDS, LIFE_STEPS, LIFE_BOUNDS, TEMP_STEPS, TEMP_BOUNDS,
    NEARBY_DEFAULTS, SPEED, MODE_LABEL, LODGING, AMENITIES, MONTHS,
    stepPosition, spanScore, rangeScore, distanceScore,
    nightsBetween, resolveDates, calcRooms, budgetPPN, splitCost,
    climateFor, scoreDestination, pickDestinations, rankDestinations, nearbyKey, formatKr, formatInt, formatMinutes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.RP = root.RP || {}; root.RP.scoring = api; }
})(typeof window !== 'undefined' ? window : globalThis);
