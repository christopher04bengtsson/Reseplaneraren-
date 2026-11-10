/*
 * Google Places API (New) – närmaste plats av varje typ runt ett område.
 * Steg 5 i SPEC.md.
 *
 * - Varje svar sparas i webbläsaren i RP.CONFIG.cacheDays dagar.
 * - Varje sökning får göra högst RP.CONFIG.maxCallsPerSearch anrop.
 * - Typer som Places känner till söks med Nearby Search. Övrigt (padel,
 *   tennis, egna saker) söks med Text Search, sorterat på avstånd.
 */
(function (root) {
  'use strict';

  const API = 'https://places.googleapis.com/v1/places:';
  const FIELDS = 'places.location,places.displayName';
  const CACHE_PREFIX = 'rp-places:';
  // Sökradier i meter. Ett svar för en större radie kan återanvändas för en mindre.
  const RADII = [2000, 5000, 10000, 20000, 50000];

  // Platstyper i Places API (New). Okända typer faller tillbaka på textsökning.
  const TYPES = {
    beach: ['beach'],
    restaurant: ['restaurant'],
    gym: ['gym', 'fitness_center'],
    sights: ['tourist_attraction'],
    grocery: ['supermarket', 'grocery_store']
  };
  const TEXT = {
    padel: 'padel', tennis: 'tennis court', golf: 'golf course', beach: 'beach',
    restaurant: 'restaurant', gym: 'gym', sights: 'tourist attraction', grocery: 'supermarket'
  };
  const badTypes = new Set(); // typer som Google svarat 400 på, så vi inte frågar igen

  const cfg = () => root.RP.CONFIG || {};
  const KEY_STORE = 'rp-google-key';
  // Nyckeln sparas bara i den här webbläsaren, aldrig i repot.
  function getKey() {
    let k = '';
    try { k = localStorage.getItem(KEY_STORE) || ''; } catch (e) { /* privat läge */ }
    return (k || cfg().googleApiKey || '').trim();
  }
  function setKey(k) {
    try {
      if (k) localStorage.setItem(KEY_STORE, k.trim()); else localStorage.removeItem(KEY_STORE);
    } catch (e) { /* privat läge */ }
  }
  const enabled = () => !!getKey();

  // ---------- Cache ----------

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return undefined;
      const { t, v } = JSON.parse(raw);
      if (Date.now() - t > (cfg().cacheDays || 5) * 86400000) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return undefined;
      }
      return v;
    } catch (e) { return undefined; }
  }
  function cacheSet(key, v) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* fullt */ }
  }

  // ---------- Anrop ----------

  class LimitError extends Error {}

  function makeBudget() {
    return { calls: 0, max: cfg().maxCallsPerSearch || 80 };
  }

  async function post(endpoint, body, budget, fields) {
    if (budget.calls >= budget.max) throw new LimitError('Gränsen för anrop nåddes');
    budget.calls++;
    const r = await fetch(API + endpoint, {
      method: 'POST',
      // Skicka hela sidans adress, så att nyckelns låsning till
      // .../Reseplaneraren-/* känner igen den (annars skickas bara domänen).
      referrerPolicy: 'no-referrer-when-downgrade',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': getKey(),
        'X-Goog-FieldMask': fields || FIELDS
      },
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = new Error((j.error && j.error.message) || 'HTTP ' + r.status);
      err.status = r.status;
      throw err;
    }
    return j.places || [];
  }

  function distance(lat1, lng1, lat2, lng2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }

  function nearestFrom(places, area, radius) {
    let best = null;
    for (const p of places) {
      if (!p.location) continue;
      const d = distance(area.lat, area.lng, p.location.latitude, p.location.longitude);
      if (d <= radius && (best === null || d < best)) best = d;
    }
    return best;
  }

  function circle(area, radius) {
    return { circle: { center: { latitude: area.lat, longitude: area.lng }, radius } };
  }

  async function searchText(area, text, radius, budget) {
    const places = await post('searchText', {
      textQuery: text, pageSize: 5, rankPreference: 'DISTANCE', locationBias: circle(area, radius)
    }, budget);
    return nearestFrom(places, area, radius);
  }

  async function searchNearby(area, types, radius, budget) {
    const places = await post('searchNearby', {
      includedTypes: types, maxResultCount: 1, rankPreference: 'DISTANCE',
      locationRestriction: circle(area, radius)
    }, budget);
    return nearestFrom(places, area, radius);
  }

  function radiusFor(item) {
    // Delvärdet blir 0 vid dubbla avståndet, så längre bort än så behövs inte.
    const need = item.minutes * root.RP.scoring.SPEED[item.mode] * 2;
    return RADII.find((r) => r >= need) || RADII[RADII.length - 1];
  }

  /**
   * Svar från cachen om det finns. undefined = måste hämtas,
   * null = inget inom radien, tal = avstånd i meter.
   */
  function cached(area, key, radius) {
    const base = `${area.lat.toFixed(4)},${area.lng.toFixed(4)}|${key}|`;
    for (const r of RADII) {
      const v = cacheGet(base + r);
      if (v === undefined) continue;
      if (v !== null) return v <= radius ? v : null; // närmaste är detsamma oavsett radie
      if (r >= radius) return null;                   // inget hittat i en större cirkel
    }
    return undefined;
  }

  async function nearest(area, item, budget) {
    const S = root.RP.scoring;
    const key = S.nearbyKey(item);
    const radius = radiusFor(item);
    const hit = cached(area, key, radius);
    if (hit !== undefined) return hit;

    let d;
    const types = TYPES[key];
    const text = TEXT[key] || item.label;
    if (types && !badTypes.has(key)) {
      try {
        d = await searchNearby(area, types, radius, budget);
      } catch (e) {
        if (e.status !== 400) throw e;
        badTypes.add(key); // okänd typ – textsök i stället
        d = await searchText(area, text, radius, budget);
      }
    } else {
      d = await searchText(area, text, radius, budget);
    }
    cacheSet(`${area.lat.toFixed(4)},${area.lng.toFixed(4)}|${key}|${radius}`, d);
    return d;
  }

  /**
   * Hämtar avstånd för alla områden och saker med vikt.
   * Returnerar { data: {areaId: {nyckel: meter|null}}, calls, limited, error }.
   */
  async function fetchNearby(areas, items, onProgress) {
    const budget = makeBudget();
    const data = {};
    const active = items.filter((i) => i.weight > 0);
    let limited = false, error = null;
    outer:
    for (const area of areas) {
      data[area.id] = {};
      for (const item of active) {
        try {
          data[area.id][root.RP.scoring.nearbyKey(item)] = await nearest(area, item, budget);
          if (onProgress) onProgress(budget.calls);
        } catch (e) {
          if (e instanceof LimitError) { limited = true; break outer; }
          error = e;
          break outer;
        }
      }
    }
    return { data, calls: budget.calls, limited, error };
  }

  // ---------- Boenden ----------

  const STAY_FIELDS = [
    'places.id', 'places.displayName', 'places.primaryType', 'places.primaryTypeDisplayName',
    'places.rating', 'places.userRatingCount', 'places.location', 'places.websiteUri',
    'places.googleMapsUri', 'places.photos'
  ].join(',');
  const SKIP_TYPES = ['hostel', 'campground', 'rv_park', 'mobile_home_park', 'camping_cabin', 'motel'];
  const HOTEL_TYPES = ['hotel', 'resort_hotel', 'inn', 'bed_and_breakfast', 'extended_stay_hotel', 'japanese_inn'];
  const HOUSE_TYPES = ['cottage', 'farmstay', 'guest_house', 'private_guest_room'];
  const HOUSE_WORDS = /\b(villa|vila|casa|finca|chalet|house|house|haus|maison|cottage|holiday home|hus)\b/i;
  const APT_WORDS = /\b(apartment|apartments|apartamentos?|appartamenti?|appartements?|suites?|residence|residenz|apartmány|flat|loft|studios?)\b/i;

  /** hotel, house eller apartment, utifrån Googles typ och boendets namn. */
  function category(p, fromVillaSearch) {
    const name = (p.displayName && p.displayName.text) || '';
    if (HOUSE_TYPES.includes(p.primaryType) || HOUSE_WORDS.test(name) || fromVillaSearch) return 'house';
    if (APT_WORDS.test(name)) return 'apartment';
    if (HOTEL_TYPES.includes(p.primaryType)) return 'hotel';
    return 'hotel';
  }

  /**
   * Hämtar riktiga boenden runt ett resmål från Google Places och rankar dem:
   * rätt typ av boende, betyg, antal omdömen och närhet till centrum.
   * Google vet inte priser, lediga datum eller antal rum.
   */
  async function staysFor(dest, wanted, budget) {
    const key = `stays|${dest.lat.toFixed(4)},${dest.lng.toFixed(4)}|${wanted.slice().sort().join(',')}`;
    let raw = cacheGet(key);
    if (raw === undefined) {
      const circle = (r) => ({ circle: { center: { latitude: dest.lat, longitude: dest.lng }, radius: r } });
      const found = await post('searchNearby', {
        includedTypes: ['lodging'], maxResultCount: 20, rankPreference: 'POPULARITY',
        languageCode: 'sv', locationRestriction: circle(5000)
      }, budget, STAY_FIELDS);
      let villas = [];
      if (wanted.includes('house')) {
        villas = await post('searchText', {
          textQuery: 'villa holiday rental', pageSize: 10, languageCode: 'sv', locationBias: circle(8000)
        }, budget, STAY_FIELDS);
      }
      raw = [];
      const seen = new Set();
      for (const [list, isVilla] of [[found, false], [villas, true]]) {
        for (const p of list) {
          if (!p.location || seen.has(p.id) || SKIP_TYPES.includes(p.primaryType)) continue;
          seen.add(p.id);
          raw.push({
            id: p.id,
            name: (p.displayName && p.displayName.text) || 'Okänt namn',
            cat: category(p, isVilla && !HOTEL_TYPES.includes(p.primaryType)),
            typeLabel: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || null,
            rating: p.rating || null,
            count: p.userRatingCount || 0,
            dist: distance(dest.lat, dest.lng, p.location.latitude, p.location.longitude),
            website: p.websiteUri || null,
            maps: p.googleMapsUri || null,
            photo: p.photos && p.photos[0] ? p.photos[0].name : null
          });
        }
      }
      cacheSet(key, raw);
    }
    return rankStays(raw, wanted);
  }

  function rankStays(raw, wanted) {
    return raw
      .filter((s) => s.count >= 5 && s.rating !== null)
      .map((s) => {
        const typeOk = wanted.includes(s.cat);
        const score =
          (typeOk ? 0.4 : 0.1) +
          0.35 * (s.rating / 5) +
          0.15 * Math.min(1, Math.log10(s.count + 1) / 3) +
          0.1 * Math.max(0, 1 - s.dist / 5000);
        return { ...s, typeOk, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }

  function photoUrl(name, width) {
    return `${API.replace('/places:', '/')}${name}/media?maxWidthPx=${width || 480}&key=${encodeURIComponent(getKey())}`;
  }

  /** Boenden för flera resmål. Returnerar { data: {destId: [boenden]}, calls, limited, error }. */
  async function fetchStays(dests, wanted, onProgress) {
    const budget = { calls: 0, max: Math.max(4, dests.length * 2) };
    const data = {};
    let limited = false, error = null;
    for (const d of dests) {
      try {
        data[d.id] = await staysFor(d, wanted, budget);
        if (onProgress) onProgress(budget.calls);
      } catch (e) {
        if (e instanceof LimitError) { limited = true; break; }
        error = e; break;
      }
    }
    return { data, calls: budget.calls, limited, error };
  }

  root.RP = root.RP || {};
  root.RP.places = { enabled, getKey, setKey, fetchNearby, fetchStays, photoUrl, radiusFor, distance };
})(window);
