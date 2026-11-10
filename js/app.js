/*
 * Frågeflödet (7 steg) och resultatsidan. Ritar allt i <main id="app">.
 * Tillståndet ligger i `state` och sparas i webbläsaren medan man fyller i,
 * så att en omladdning inte tappar svaren.
 */
(function () {
  'use strict';

  const S = RP.scoring;
  const L = RP.links;
  const RES = RP.RESMAL;      // data/resmal.js, byggd av tools/bygg-resmal.mjs
  const ALL = RES.resmal;
  const SHORTLIST = 12;       // så många resmål kontrolleras mot Google
  const STORE = 'rp-state-v1';
  const app = document.getElementById('app');

  const STEPS = [
    { title: 'Sällskapet', q: 'Vilka reser?' },
    { title: 'Resmål och datum', q: 'Vart och när?' },
    { title: 'Klimat', q: 'Vilket väder vill ni ha?' },
    { title: 'Typ av boende', q: 'Hur vill ni bo?' },
    { title: 'Typ av ort', q: 'Vilken sorts ort?' },
    { title: 'I närheten', q: 'Vad ska finnas i närheten?' },
    { title: 'Budget', q: 'Vad får det kosta?' }
  ];

  const DISTANCES = [
    ['walk', 5], ['walk', 10], ['walk', 15], ['walk', 20],
    ['car', 10], ['car', 15], ['car', 20], ['car', 30]
  ];

  // ---------- Tillstånd ----------

  function defaultDates() {
    const now = new Date();
    const year = now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
    return { flex: 'exact', from: `${year}-06-12`, to: `${year}-06-19`, month: `${year}-06`, nights: 7 };
  }

  function defaultState() {
    return {
      version: 2,
      view: 'flow',
      step: 0,
      group: { total: 10, couples: 3, children: 0, ownRoom: 0 },
      dest: { known: 'no', place: '', continent: 'Europa', region: 'alla' },
      dates: defaultDates(),
      climate: { temp: [1, 2], tempWeight: 2, avoidRain: false, rainMax: 1 },
      lodging: ['house'],
      amenities: [],
      town: { size: [0, 2], sizeWeight: 1, life: [1, 3], lifeWeight: 1 },
      nearby: S.NEARBY_DEFAULTS.map((n) => ({
        key: n.key, label: n.label, icon: n.icon,
        weight: { beach: 2, restaurant: 2, grocery: 2, padel: 1, sights: 1 }[n.key] || 0,
        mode: ['beach', 'restaurant', 'grocery'].includes(n.key) ? 'walk' : 'car',
        minutes: ['beach', 'restaurant', 'grocery'].includes(n.key) ? 10 : 15
      })),
      budget: { mode: 'pppn', amount: 900, weight: 1 },
      cost: { price: '', mode: 'total' }
    };
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE));
      if (s && s.version === 2) { s.amenities = s.amenities || []; return s; }
    } catch (e) { /* ingen sparad data */ }
    return null;
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* privat läge */ }
  }

  let state = load() || defaultState();

  const get = (path) => path.split('.').reduce((o, k) => o[k], state);
  function set(path, v) {
    const ks = path.split('.');
    const last = ks.pop();
    ks.reduce((o, k) => o[k], state)[last] = v;
  }

  function context() {
    const rooms = S.calcRooms(state.group);
    const dates = S.resolveDates(state.dates);
    return {
      rooms, dates, months: dates.months, lodging: state.lodging, amenities: state.amenities,
      budgetPPN: S.budgetPPN(state.budget, rooms.total, dates.nights)
    };
  }

  // ---------- Små byggklossar ----------

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function stepper(label, path, min, max, hint) {
    const v = get(path);
    return `
      <div class="stepper-field">
        <div>
          <span class="field-label">${label}</span>
          ${hint ? `<small class="muted">${hint}</small>` : ''}
        </div>
        <div class="stepper">
          <button type="button" class="round" data-action="inc" data-path="${path}" data-delta="-1"
            data-min="${min}" data-max="${max}" aria-label="Minska ${label.toLowerCase()}" ${v <= min ? 'disabled' : ''}>−</button>
          <output aria-live="polite">${v}</output>
          <button type="button" class="round" data-action="inc" data-path="${path}" data-delta="1"
            data-min="${min}" data-max="${max}" aria-label="Öka ${label.toLowerCase()}" ${v >= max ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
  }

  function segmented(path, options, opts = {}) {
    const v = get(path);
    return `<div class="segmented ${opts.small ? 'small' : ''}" role="group" ${opts.label ? `aria-label="${esc(opts.label)}"` : ''}>
      ${options.map((o) => `<button type="button" data-action="set" data-path="${path}"
        data-value="${o.value}" ${typeof o.value === 'number' ? 'data-num' : ''}
        aria-pressed="${v === o.value}">${o.label}</button>`).join('')}
    </div>`;
  }

  function weightPicker(path, label, allowMust) {
    const opts = S.WEIGHTS.filter((w) => allowMust || w.w < 3)
      .map((w) => ({ value: w.w, label: w.short }));
    return segmented(path, opts, { small: true, label: 'Vikt för ' + label });
  }

  function spanPicker(path, steps, label, compact) {
    const [a, b] = get(path);
    return `
      <div class="span ${compact ? 'compact' : ''}" role="group" aria-label="${esc(label)}">
        ${steps.map((s, i) => `
          <button type="button" class="span-step ${i >= a && i <= b ? 'on' : ''}"
            data-action="span" data-path="${path}" data-i="${i}" aria-pressed="${i >= a && i <= b}">
            <strong>${s.label}</strong>
            ${s.sub ? `<small>${s.sub}</small>` : ''}
            ${s.ex && !compact ? `<small class="ex">${s.ex}</small>` : ''}
          </button>`).join('')}
      </div>
      ${compact ? '' : `<p class="hint">Valt: <strong>${steps[a].label}${a !== b ? ' – ' + steps[b].label : ''}</strong>.
        Tryck på ett steg för att utöka eller minska spannet.</p>`}`;
  }

  function toggle(path, label) {
    return `<label class="switch">
      <input type="checkbox" data-bind="${path}" data-rerender ${get(path) ? 'checked' : ''}>
      <span class="track" aria-hidden="true"></span>
      <span>${label}</span>
    </label>`;
  }

  // ---------- Levande uträkningar ----------

  const live = {
    rooms() {
      const r = S.calcRooms(state.group);
      if (!r.valid) {
        return `<p class="callout warn"><span class="sym" aria-hidden="true">!</span>
          Par, barn och de som vill ha eget rum blir fler än ${r.total} personer.</p>`;
      }
      return `<p class="callout big"><span aria-hidden="true">🛏️</span>
        <span>Ni behöver <strong>minst ${r.bedrooms} sovrum och ${r.beds} sängar</strong>
        ${r.doubleBeds ? `<small>varav ${r.doubleBeds} dubbelsängar till paren</small>` : ''}</span></p>`;
    },
    nights() {
      const d = S.resolveDates(state.dates);
      if (state.dates.flex !== 'month' && d.nights <= 0) {
        return `<p class="callout warn"><span class="sym" aria-hidden="true">!</span>Hemresan måste vara efter avresan.</p>`;
      }
      return `<p class="muted">${d.nights} nätter${state.dates.flex === 'pm3' ? ', ± 3 dagar' : ''}</p>`;
    },
    rain() {
      const v = state.climate.rainMax;
      return `Högst <strong>${String(v).replace('.', ',')} ${v === 1 ? 'regndag' : 'regndagar'}</strong> per vecka`;
    },
    budget() {
      const c = context();
      const persons = c.rooms.total, nights = c.dates.nights;
      const amt = Number(state.budget.amount) || 0;
      if (!amt) return '<p class="muted">Ingen budget – alla prisnivåer räknas lika.</p>';
      if (state.budget.mode === 'total') {
        return `<p class="callout big"><span aria-hidden="true">💶</span><span>≈ <strong>${S.formatKr(c.budgetPPN)}</strong> per person och natt
          <small>${persons} personer · ${nights} nätter</small></span></p>`;
      }
      return `<p class="callout big"><span aria-hidden="true">💶</span><span>≈ <strong>${S.formatKr(amt * persons * nights)}</strong> totalt för gruppen
        <small>${persons} personer · ${nights} nätter</small></span></p>`;
    },
  };

  function updateLive() {
    app.querySelectorAll('[data-live]').forEach((el) => { el.innerHTML = live[el.dataset.live](); });
    updateNav();
  }

  // Uppdaterar knapparna på plats i stället för att rita om dem, så att ett
  // tryck på Nästa inte går förlorat när ett fält tappar fokus.
  function updateNav() {
    const nav = app.querySelector('.flow-nav');
    if (!nav) return;
    const err = stepError(state.step);
    nav.querySelector('[data-action="next"]').disabled = !!err;
    const msg = app.querySelector('.nav-error');
    msg.textContent = err;
    msg.hidden = !err;
  }

  // ---------- Frågeflödet ----------

  function stepError(i) {
    if (i === 0) {
      const r = S.calcRooms(state.group);
      if (r.total < 1) return 'Minst en person måste resa.';
      if (!r.valid) return 'Kontrollera antalet par, barn och eget rum.';
    }
    if (i === 1) {
      if (state.dest.known === 'yes' && !state.dest.place.trim()) return 'Skriv vart ni vill åka.';
      if (state.dates.flex !== 'month' && S.nightsBetween(state.dates.from, state.dates.to) <= 0) {
        return 'Välj datum där hemresan är efter avresan.';
      }
    }
    if (i === 3 && !state.lodging.length) return 'Välj minst en typ av boende.';
    return '';
  }

  function navHTML() {
    const i = state.step;
    const err = stepError(i);
    return `
      <p class="nav-error" role="status" ${err ? '' : 'hidden'}>${err}</p>
      <div class="flow-nav">
        <button type="button" class="btn secondary" data-action="back" ${i === 0 ? 'disabled' : ''}>Tillbaka</button>
        <button type="button" class="btn primary" data-action="next" ${err ? 'disabled' : ''}>
          ${i === STEPS.length - 1 ? 'Visa förslag' : 'Nästa'}</button>
      </div>`;
  }

  const stepBody = [
    // 1. Sällskapet
    () => `
      ${stepper('Antal personer', 'group.total', 1, 30)}
      ${stepper('Varav par', 'group.couples', 0, 15, 'Delar rum och säng')}
      ${stepper('Varav barn', 'group.children', 0, 20)}
      ${stepper('Vill ha eget rum', 'group.ownRoom', 0, 30, 'Utöver paren')}
      <div data-live="rooms">${live.rooms()}</div>`,

    // 2. Resmål och datum
    () => {
      const d = state.dest;
      const names = [...new Set([...ALL.map((x) => x.namn), ...ALL.map((x) => x.land)])].sort((a, b) => a.localeCompare(b, 'sv'));
      const regions = (RES.regioner[d.continent] || []).map((r) => r.namn);
      const where = d.known === 'yes'
        ? `<label class="field">
            <span class="field-label">Ort, ö eller region</span>
            <input type="text" data-bind="dest.place" value="${esc(d.place)}" list="placeList"
              placeholder="T.ex. Nice eller Kroatien" autocomplete="off">
            <datalist id="placeList">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
          </label>`
        : `<label class="field">
            <span class="field-label">Världsdel</span>
            <select data-bind="dest.continent" data-rerender>
              ${Object.keys(RES.regioner).map((c) => `<option ${c === d.continent ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span class="field-label">Region <small class="muted">(valfritt)</small></span>
            <select data-bind="dest.region">
              <option value="alla" ${d.region === 'alla' ? 'selected' : ''}>Hela ${d.continent}</option>
              ${regions.map((r) => `<option ${r === d.region ? 'selected' : ''}>${r}</option>`).join('')}
            </select>
          </label>`;
      const f = state.dates;
      const dates = f.flex === 'month'
        ? `<div class="row2">
            <label class="field"><span class="field-label">Månad</span>
              <input type="month" data-bind="dates.month" value="${f.month}"></label>
          </div>
          ${stepper('Antal nätter', 'dates.nights', 1, 30)}`
        : `<div class="row2">
            <label class="field"><span class="field-label">Från</span>
              <input type="date" data-bind="dates.from" value="${f.from}"></label>
            <label class="field"><span class="field-label">Till</span>
              <input type="date" data-bind="dates.to" value="${f.to}"></label>
          </div>
          <div data-live="nights">${live.nights()}</div>`;
      return `
        <p class="field-label">Vet ni vart ni vill åka?</p>
        ${segmented('dest.known', [{ value: 'yes', label: 'Ja' }, { value: 'no', label: 'Nej, ge förslag' }])}
        ${where}
        <hr>
        <p class="field-label">När?</p>
        ${segmented('dates.flex', [{ value: 'exact', label: 'Exakta datum' }, { value: 'pm3', label: '± 3 dagar' }, { value: 'month', label: 'En hel månad' }])}
        ${dates}`;
    },

    // 3. Klimat
    () => `
      <p class="field-label">Temperatur dagtid</p>
      ${spanPicker('climate.temp', S.TEMP_STEPS, 'Temperatur dagtid')}
      <div class="toggle-block">
        ${toggle('climate.avoidRain', 'Undvik regn')}
        ${state.climate.avoidRain ? `
          <label class="range">
            <span data-live="rain">${live.rain()}</span>
            <input type="range" min="0" max="4" step="0.5" data-bind="climate.rainMax" value="${state.climate.rainMax}">
          </label>` : ''}
      </div>`,

    // 4. Typ av boende
    () => `
      <p class="muted">Välj ett eller flera.</p>
      <div class="choice-grid">
        ${S.LODGING.map((l) => {
          const on = state.lodging.includes(l.key);
          return `<button type="button" class="choice" data-action="lodging" data-key="${l.key}" aria-pressed="${on}">
            <span class="choice-icon" aria-hidden="true">${l.icon}</span>
            <span>${l.label}</span>
            <span class="check" aria-hidden="true">${on ? '✓' : ''}</span>
          </button>`;
        }).join('')}
      </div>
      <p class="hint">Ni behöver minst ${S.calcRooms(state.group).bedrooms} sovrum.
        Hus och villor brukar passa stora sällskap bäst.</p>
      <hr>
      <p class="field-label">Vad ska boendet ha?</p>
      <p class="muted">Skickas med som filter till Airbnb.</p>
      <div class="chips">
        ${S.AMENITIES.map((a) => {
          const on = state.amenities.includes(a.key);
          return `<button type="button" class="chip" data-action="amenity" data-key="${a.key}" aria-pressed="${on}">
            <span aria-hidden="true">${a.icon}</span> ${a.label}${on ? ' <span aria-hidden="true">✓</span>' : ''}</button>`;
        }).join('')}
      </div>`,

    // 5. Typ av ort
    () => `
      <p class="field-label">Ortens storlek</p>
      ${spanPicker('town.size', S.SIZE_STEPS, 'Ortens storlek')}
      <hr>
      <p class="field-label">Liv och rörelse</p>
      ${spanPicker('town.life', S.LIFE_STEPS, 'Liv och rörelse')}`,

    // 6. Vad ska finnas i närheten
    () => `
      <ul class="nearby-list">
        ${state.nearby.map((n, i) => `
          <li class="nearby-item ${n.weight ? '' : 'off'}">
            <div class="nearby-head">
              <span class="nearby-name"><span aria-hidden="true">${n.icon || '📍'}</span> ${esc(n.label)}</span>
              ${n.custom ? `<button type="button" class="link-btn" data-action="removeItem" data-i="${i}"
                aria-label="Ta bort ${esc(n.label)}">Ta bort</button>` : ''}
            </div>
            ${weightPicker(`nearby.${i}.weight`, n.label, true)}
            ${n.weight ? `<label class="inline-select"><span>Avstånd</span>
              <select data-bind="nearby.${i}.dist" data-i="${i}">
                ${DISTANCES.map(([m, min]) => `<option value="${m}:${min}" ${n.mode === m && n.minutes === min ? 'selected' : ''}>
                  inom ${min} min ${S.MODE_LABEL[m]}</option>`).join('')}
              </select></label>` : ''}
          </li>`).join('')}
      </ul>
      <form class="add-item" data-action-form="addItem">
        <label class="field grow"><span class="field-label">Lägg till egen sak</span>
          <input type="text" id="customItem" placeholder="T.ex. golfbana" autocomplete="off"></label>
        <button type="submit" class="btn secondary">Lägg till</button>
      </form>`,

    // 7. Budget
    () => `
      ${segmented('budget.mode', [{ value: 'pppn', label: 'Per person och natt' }, { value: 'total', label: 'Totalt för gruppen' }])}
      <label class="field">
        <span class="field-label">Ungefärlig budget i kronor</span>
        <input type="number" inputmode="numeric" min="0" step="50" data-bind="budget.amount"
          value="${state.budget.amount}" placeholder="0">
      </label>
      <div data-live="budget">${live.budget()}</div>`
  ];

  function renderFlow() {
    const i = state.step;
    app.innerHTML = `
      <section class="flow">
        <div class="progress" role="progressbar" aria-label="Hur långt du kommit"
          aria-valuemin="1" aria-valuemax="${STEPS.length}" aria-valuenow="${i + 1}">
          <div style="width:${((i + 1) / STEPS.length) * 100}%"></div>
        </div>
        <p class="step-count">Steg ${i + 1} av ${STEPS.length} · ${STEPS[i].title}</p>
        <div class="card">
          <h1 tabindex="-1">${STEPS[i].q}</h1>
          ${stepBody[i]()}
        </div>
        ${navHTML()}
      </section>`;
  }

  // ---------- Resultatsidan ----------

  function dateSummary(d) {
    if (d.flex === 'month') return `${d.nights} nätter i ${S.MONTHS[d.months[0]]}`;
    if (!d.checkin || !d.checkout) return '';
    const a = new Date(d.checkin + 'T00:00:00Z'), b = new Date(d.checkout + 'T00:00:00Z');
    const am = S.MONTHS[a.getUTCMonth()], bm = S.MONTHS[b.getUTCMonth()];
    const txt = am === bm ? `${a.getUTCDate()}–${b.getUTCDate()} ${am}` : `${a.getUTCDate()} ${am} – ${b.getUTCDate()} ${bm}`;
    return txt + (d.flex === 'pm3' ? ' ± 3 dagar' : '');
  }

  function summaryHTML(res, ctx) {
    const top = res.included[0];
    const where = state.dest.known === 'yes'
      ? esc(state.dest.place)
      : (top ? `Föreslaget: ${esc(top.dest.namn)}, ${esc(top.dest.land)}` : 'Inget förslag');
    const parts = [where, dateSummary(ctx.dates), `${ctx.rooms.total} personer`, `minst ${ctx.rooms.bedrooms} sovrum`];
    return `<p class="summary-line">${parts.filter(Boolean).map((p) => `<span>${p}</span>`).join('<span aria-hidden="true"> · </span>')}</p>
      <button type="button" class="btn secondary small" data-action="edit">Ändra svar</button>`;
  }

  function mapHTML(list) {
    if (!list.length) return '';
    const W = 400, H = 240, pad = 34;
    const lats = list.map((r) => r.dest.lat), lngs = list.map((r) => r.dest.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const k = Math.cos((midLat * Math.PI) / 180);
    const xs = lngs.map((l) => l * k);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...lats), maxY = Math.max(...lats);
    const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
    const pins = list.map((r, i) => {
      const x = offX + (xs[i] - minX) * scale;
      const y = offY + (maxY - lats[i]) * scale;
      const anchor = x > W - 120 ? 'end' : 'start';
      const tx = anchor === 'end' ? x - 17 : x + 17;
      return `<a href="#area-${r.dest.id}" class="pin" aria-label="${i + 1}. ${esc(r.dest.namn)}, ${esc(r.dest.land)}">
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="13"></circle>
        <text x="${x.toFixed(1)}" y="${(y + 4.5).toFixed(1)}" text-anchor="middle" class="pin-n">${i + 1}</text>
        <text x="${tx.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}" class="pin-l">${esc(r.dest.namn)}</text>
      </a>`;
    }).join('');
    return `<figure class="map">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Karta över resmålen">
        <rect x="0" y="0" width="${W}" height="${H}" rx="14" class="map-bg"></rect>
        ${pins}
      </svg>
      <figcaption class="muted">Platshållare – Google-kartan kopplas in i steg 10.</figcaption>
    </figure>`;
  }

  function factHTML(c) {
    if (c.unknown) {
      return `<li class="unknown"><span class="sym" aria-hidden="true">?</span>
        <span>${esc(c.text)}<span class="sr-only"> – räknas inte in</span></span></li>`;
    }
    const ok = c.score >= 1;
    return `<li class="${ok ? 'ok' : 'miss'}"><span class="sym" aria-hidden="true">${ok ? '✓' : '!'}</span>
      <span>${esc(c.text)}<span class="sr-only">${ok ? ' – stämmer' : ' – stämmer inte helt'}</span></span></li>`;
  }

  const TYP_LABEL = { strand: 'Strand', stad: 'Stad', berg: 'Berg', 'sjö': 'Sjö' };

  /** Det länkarna behöver: ort och land. */
  const linkArea = (d) => ({ name: d.namn });
  const linkDest = (d) => ({ name: d.land, country: d.land });

  function cardHTML(r, i, ctx) {
    const d = r.dest;
    const facts = r.criteria.filter((c) => c.weight > 0 || c.unknown)
      .sort((a, b) => (a.unknown - b.unknown) || (b.weight - a.weight));
    const counted = facts.filter((c) => !c.unknown);
    const clim = [];
    if (r.climate.tMax !== null) clim.push(`Ca ${Math.round(r.climate.tMax)} °C`);
    const checklist = L.checklist(linkArea(d), linkDest(d), ctx, state);
    const sumW = counted.reduce((s, c) => s + c.weight, 0);
    return `
      <article class="area-card" id="area-${d.id}">
        <header>
          <span class="pin-num" aria-hidden="true">${i + 1}</span>
          <div class="grow">
            <h2>${esc(d.namn)}</h2>
            <p class="country"><span aria-hidden="true">📍</span> <strong>${esc(d.land)}</strong>${d.omrade ? ` · ${esc(d.omrade)}` : ''}</p>
          </div>
          <div class="match" style="--p:${r.percent}">
            <strong>${r.percent}%</strong><small>matchning</small>
          </div>
        </header>
        <ul class="tags">
          <li>${TYP_LABEL[d.typ] || d.typ}</li>
          ${r.sizeStep !== null ? `<li>${S.SIZE_STEPS[r.sizeStep].label}</li>` : ''}
          ${clim.length ? `<li>${clim.join(' · ')}</li>` : ''}
        </ul>
        <ul class="facts">${facts.map(factHTML).join('')}</ul>
        ${staysHTML(d, i, ctx)}
        <div class="actions">
          <a class="btn booking" href="${L.booking(linkArea(d), linkDest(d), ctx)}" target="_blank" rel="noopener">Fler på Booking</a>
          <a class="btn airbnb" href="${L.airbnb(linkArea(d), linkDest(d), ctx)}" target="_blank" rel="noopener">Fler på Airbnb</a>
        </div>
        ${checklist.length ? `<details class="checklist">
          <summary>Att bocka av på sajten (${checklist.length})</summary>
          <ul>${checklist.map((t) => `<li><label><input type="checkbox"> ${esc(t)}</label></li>`).join('')}</ul>
        </details>` : ''}
        <details class="explain">
          <summary>Så räknades poängen</summary>
          <table>
            <thead><tr><th>Kriterium</th><th>Vikt</th><th>Delvärde</th></tr></thead>
            <tbody>${counted.map((c) => `<tr><td>${esc(c.label)}</td><td>${c.weight}</td><td>${c.score.toFixed(2).replace('.', ',')}</td></tr>`).join('')}</tbody>
          </table>
          <p class="muted">Summan av vikt × delvärde delat med summan av vikterna (${sumW}). Rader med ? saknar data och räknas inte.</p>
          <p class="muted">Källor: invånare från <a href="https://www.wikidata.org/wiki/${esc(d.wikidata)}" target="_blank" rel="noopener">Wikidata</a>${d.invanareAr ? ` (${d.invanareAr})` : ''}, klimat från Open-Meteo.</p>
        </details>
      </article>`;
  }

  // ---------- Boenden (riktiga, från Google Places) ----------

  const STAYS_FOR = 6; // boenden hämtas för de 6 bästa resmålen
  const stays = { data: {}, status: 'idle', error: null, sig: '', run: 0 };
  const CAT_LABEL = { hotel: 'Hotell', house: 'Hus/villa', apartment: 'Lägenhet' };

  function fmtDist(m) {
    return m < 1000 ? `${Math.round(m / 50) * 50} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  }

  function stayCardHTML(st, d, ctx) {
    const why = [];
    if (st.typeOk) why.push(CAT_LABEL[st.cat]);
    if (st.rating >= 4.5) why.push('mycket bra betyg'); else if (st.rating >= 4) why.push('bra betyg');
    if (st.dist <= 1500) why.push('nära centrum');
    const linkCtx = { ...ctx, stayCat: st.cat };
    return `<li class="stay">
      ${st.photo ? `<img src="${esc(RP.places.photoUrl(st.photo, 400))}" alt="" loading="lazy" referrerpolicy="no-referrer-when-downgrade">`
        : '<div class="stay-nophoto" aria-hidden="true">🏠</div>'}
      <div class="stay-body">
        <h3>${esc(st.name)}</h3>
        <p class="stay-meta">${esc(st.typeLabel || CAT_LABEL[st.cat])} · ★ ${st.rating.toFixed(1).replace('.', ',')}
          <span class="muted">(${S.formatInt(st.count)})</span> · ${fmtDist(st.dist)} från centrum</p>
        ${why.length ? `<p class="stay-why">Matchar: ${why.join(', ')}</p>` : ''}
        <div class="stay-actions">
          <a class="btn primary small" href="${L.bookingStay(st.name, d.namn, linkCtx)}" target="_blank" rel="noopener">Visa på Booking</a>
          ${st.website ? `<a class="btn secondary small" href="${esc(st.website)}" target="_blank" rel="noopener">Webbplats</a>` : ''}
          ${st.maps ? `<a class="link-btn" href="${esc(st.maps)}" target="_blank" rel="noopener">Karta</a>` : ''}
        </div>
      </div>
    </li>`;
  }

  function staysHTML(d, i, ctx) {
    const head = '<h3 class="stays-head">Boenden här</h3>';
    if (!RP.places.enabled()) {
      return `${head}<p class="muted">Lägg in din Google-nyckel i panelen för att se riktiga boenden.</p>`;
    }
    if (location.protocol === 'file:' || i >= STAYS_FOR) return '';
    const list = stays.data[d.id];
    if (list === 'error') {
      return `${head}<p class="callout warn"><span class="sym" aria-hidden="true">!</span>Kunde inte hämta boenden${stays.error ? ': ' + esc(stays.error) : ''}. Använd länkarna nedan.</p>`;
    }
    if (!list) return `${head}<p class="muted">Hämtar boenden från Google …</p>`;
    if (!list.length) {
      return `${head}<p class="callout">Google hittade inga boenden med tillräckligt många omdömen här. Använd länkarna nedan.</p>`;
    }
    return `${head}
      <ul class="stays">${list.map((st) => stayCardHTML(st, d, ctx)).join('')}</ul>
      <p class="muted small-print">Boenden och betyg från Google. Pris, lediga datum och antal rum ser du på Booking.</p>`;
  }

  async function ensureStays(res) {
    if (!RP.places.enabled() || location.protocol === 'file:') return;
    const sig = state.lodging.join(',');
    if (stays.sig !== sig) { stays.data = {}; stays.sig = sig; }
    const missing = res.included.slice(0, STAYS_FOR).map((r) => r.dest).filter((d) => !stays.data[d.id]);
    if (!missing.length || stays.status === 'loading') return;
    const run = ++stays.run;
    stays.status = 'loading'; stays.error = null;
    const out = await RP.places.fetchStays(missing, state.lodging);
    if (run !== stays.run) return;
    Object.assign(stays.data, out.data);
    stays.status = 'done';
    stays.error = out.error ? out.error.message : null;
    // Misslyckade hämtningar markeras, så att sidan inte försöker om och om igen.
    for (const d of missing) if (!out.data[d.id]) stays.data[d.id] = 'error';
    if (state.view === 'results' && document.getElementById('resultsMain')) refreshResults(false, true);
  }

  function mainHTML(res, ctx) {
    const note = res.note ? `<p class="callout warn"><span class="sym" aria-hidden="true">!</span>${esc(res.note)}</p>` : '';
    const empty = !res.included.length && !res.note
      ? `<p class="callout">Inga resmål klarade alla krav. Sänk något "Måste finnas" i panelen.</p>` : '';
    const excluded = res.excluded.length ? `
      <details class="excluded">
        <summary>${res.excluded.length} resmål sorterades bort</summary>
        <ul>${res.excluded.map((r) => `<li><strong>${esc(r.dest.namn)}, ${esc(r.dest.land)}</strong> – saknar ${r.excludedBy.map(esc).join(', ')} inom valt avstånd</li>`).join('')}</ul>
      </details>` : '';
    const rest = res.rest.length ? `
      <details class="excluded">
        <summary>${res.rest.length} resmål till med lägre matchning på klimat och storlek</summary>
        <ul>${res.rest.map((r) => `<li><strong>${esc(r.dest.namn)}, ${esc(r.dest.land)}</strong> – ${r.percent} %</li>`).join('')}</ul>
      </details>` : '';
    return `${note}
      ${placesStatusHTML()}
      ${mapHTML(res.included)}
      ${empty}
      <div class="cards">${res.included.map((r, i) => cardHTML(r, i, ctx)).join('')}</div>
      ${excluded}
      ${rest}`;
  }

  function controlsHTML() {
    return `
      <div class="ctrl">
        <div class="ctrl-head"><span class="field-label">Temperatur</span></div>
        ${spanPicker('climate.temp', S.TEMP_STEPS, 'Temperatur dagtid', true)}
        ${weightPicker('climate.tempWeight', 'temperatur')}
      </div>
      <div class="ctrl">
        ${toggle('climate.avoidRain', 'Undvik regn')}
        ${state.climate.avoidRain ? `<label class="range"><span data-live="rain">${live.rain()}</span>
          <input type="range" min="0" max="4" step="0.5" data-bind="climate.rainMax" value="${state.climate.rainMax}"></label>` : ''}
      </div>
      <div class="ctrl">
        <div class="ctrl-head"><span class="field-label">Ortens storlek</span></div>
        ${spanPicker('town.size', S.SIZE_STEPS, 'Ortens storlek', true)}
        ${weightPicker('town.sizeWeight', 'ortens storlek')}
      </div>
      <div class="ctrl">
        <div class="ctrl-head"><span class="field-label">Liv och rörelse</span></div>
        ${spanPicker('town.life', S.LIFE_STEPS, 'Liv och rörelse', true)}
        ${weightPicker('town.lifeWeight', 'liv och rörelse')}
      </div>
      <div class="ctrl">
        <div class="ctrl-head"><span class="field-label">I närheten</span></div>
        ${state.nearby.map((n, i) => `<div class="ctrl-row">
          <span>${esc(n.label)} <small class="muted">${n.weight ? `${n.minutes} min ${S.MODE_LABEL[n.mode]}` : ''}</small></span>
          ${weightPicker(`nearby.${i}.weight`, n.label, true)}</div>`).join('')}
      </div>
      <div class="ctrl">
        <div class="ctrl-head"><span class="field-label">Budget</span></div>
        ${weightPicker('budget.weight', 'budget')}
      </div>`;
  }

  function costHTML() {
    return `
      ${segmented('cost.mode', [{ value: 'total', label: 'Pris för hela vistelsen' }, { value: 'night', label: 'Pris per natt' }], { small: true })}
      <label class="field">
        <span class="field-label">Pris för boendet i kronor</span>
        <input type="number" inputmode="numeric" min="0" step="100" data-bind="cost.price" data-cost
          value="${esc(state.cost.price)}" placeholder="T.ex. 42000">
      </label>
      <div id="costOut">${costOutHTML()}</div>`;
  }

  function costOutHTML() {
    const c = context();
    const s = S.splitCost(state.cost.price, state.cost.mode, c.rooms.total, c.dates.nights);
    const row = (label, v) => `<div><dt>${label}</dt><dd>${S.formatKr(v)}</dd></div>`;
    return `<dl class="cost-grid">
      ${row('Totalt', s.total)}
      ${row('Per person', s.perPerson)}
      ${row('Per natt', s.perNight)}
      ${row('Per person och natt', s.perPersonNight)}
    </dl>
    <p class="muted">${c.rooms.total} personer · ${c.dates.nights} nätter</p>`;
  }

  function keyHTML() {
    if (RP.places.enabled()) {
      const k = RP.places.getKey();
      return `<p class="muted">Sparad i den här webbläsaren: <code>${esc(k.slice(0, 6))}…${esc(k.slice(-4))}</code></p>
        <button type="button" class="btn secondary small" data-action="removeKey">Ta bort nyckeln</button>`;
    }
    return `<form class="add-item" data-action-form="saveKey">
        <label class="field grow"><span class="field-label">API-nyckel</span>
          <input type="password" id="apiKey" autocomplete="off" spellcheck="false" placeholder="AIza…"></label>
        <button type="submit" class="btn secondary">Spara</button>
      </form>
      <p class="muted">Sparas bara i den här webbläsaren, inte på GitHub. Behövs en gång per enhet.</p>`;
  }

  function renderResults() {
    const wide = window.matchMedia('(min-width: 900px)').matches;
    app.innerHTML = `
      <section class="results">
        <div class="summary" id="summary"></div>
        <div class="results-grid">
          <aside class="panel">
            <details id="adjust" ${wide ? 'open' : ''}>
              <summary>Justera skalor och vikter</summary>
              <div id="controls">${controlsHTML()}</div>
            </details>
            <details id="costbox" ${wide ? 'open' : ''}>
              <summary>Kostnadsdelning</summary>
              <div id="cost">${costHTML()}</div>
            </details>
            <details id="keybox" ${RP.places.enabled() ? '' : 'open'}>
              <summary>Google-nyckel</summary>
              <div id="keyInner">${keyHTML()}</div>
            </details>
          </aside>
          <div id="resultsMain"></div>
        </div>
      </section>`;
    refreshResults(false);
  }

  // ---------- Riktiga platser från Google (steg 5) ----------

  const places = { data: {}, status: 'idle', calls: 0, limited: false, error: null, sig: '', run: 0 };

  function placesStatusHTML() {
    if (!RP.places.enabled()) {
      return '<p class="test-badge">Avstånd till strand, restauranger m.m. hämtas från Google när du lagt in din nyckel i panelen.</p>';
    }
    if (location.protocol === 'file:') {
      return `<p class="callout warn"><span class="sym" aria-hidden="true">!</span>
        Nyckeln fungerar inte när sidan öppnas som fil. Öppna den via http://localhost:8000 eller GitHub Pages.</p>`;
    }
    if (places.status === 'loading') {
      return `<p class="test-badge">Hämtar platser från Google … ${places.calls} anrop</p>`;
    }
    if (places.error) {
      return `<p class="callout warn"><span class="sym" aria-hidden="true">!</span>
        Kunde inte hämta platser från Google: ${esc(places.error)}. Avstånden räknas inte in.</p>`;
    }
    const note = places.limited
      ? ` Gränsen på ${RP.CONFIG.maxCallsPerSearch} anrop nåddes, så vissa avstånd saknas.` : '';
    return `<p class="test-badge">Avstånd från Google Places · ${places.calls} nya anrop, resten från cache.${note}
</p>`;
  }

  /** Hämtar avstånd för de områden som visas, om något ändrats sedan sist. */
  async function ensurePlaces(res) {
    if (!RP.places.enabled() || location.protocol === 'file:') return;
    const areas = res.shortlist;
    const items = state.nearby.filter((n) => n.weight > 0);
    const sig = JSON.stringify([areas.map((a) => a.id), items.map((n) => [n.label, n.mode, n.minutes])]);
    if (sig === places.sig) return;
    places.sig = sig;
    const run = ++places.run;
    places.status = 'loading'; places.calls = 0; places.error = null; places.limited = false;
    const out = await RP.places.fetchNearby(areas, items, (calls) => {
      if (run !== places.run) return;
      places.calls = calls;
      const badge = document.querySelector('#resultsMain .test-badge');
      if (badge) badge.textContent = `Hämtar platser från Google … ${calls} anrop`;
    });
    if (run !== places.run) return; // en nyare hämtning har startat
    for (const [id, v] of Object.entries(out.data)) places.data[id] = { ...places.data[id], ...v };
    places.status = 'done'; places.calls = out.calls; places.limited = out.limited;
    places.error = out.error ? out.error.message : null;
    if (out.error) places.sig = ''; // försök igen nästa gång
    if (state.view === 'results' && document.getElementById('resultsMain')) refreshResults(false, true);
  }

  function refreshResults(controlsToo, fromPlaces) {
    const ctx = context();
    const res = S.rankDestinations(ALL, state, ctx, RP.places.enabled() ? places.data : null, SHORTLIST);
    if (!fromPlaces) ensurePlaces(res); // sätter status "Hämtar" innan sidan ritas
    ensureStays(res);
    if (controlsToo) {
      document.getElementById('controls').innerHTML = controlsHTML();
      document.getElementById('cost').innerHTML = costHTML();
    }
    document.getElementById('summary').innerHTML = summaryHTML(res, ctx);
    document.getElementById('resultsMain').innerHTML = mainHTML(res, ctx);
  }

  // ---------- Ritning och händelser ----------

  function render(focus) {
    if (state.view === 'results') renderResults();
    else renderFlow();
    if (focus) {
      window.scrollTo(0, 0);
      const h = app.querySelector('h1');
      if (h) h.focus({ preventScroll: true });
    }
  }

  function rerender() {
    if (state.view === 'results') refreshResults(true);
    else render();
  }

  function onAction(btn) {
    const a = btn.dataset.action;
    const path = btn.dataset.path;
    switch (a) {
      case 'next':
        if (stepError(state.step)) return;
        if (state.step < STEPS.length - 1) state.step++;
        else state.view = 'results';
        save(); render(true); return;
      case 'back':
        if (state.step > 0) state.step--;
        save(); render(true); return;
      case 'edit':
        state.view = 'flow'; state.step = 0;
        save(); render(true); return;
      case 'restart':
        if (!window.confirm('Börja om från början? Alla svar rensas.')) return;
        state = defaultState(); save(); render(true); return;
      case 'inc': {
        const v = Number(get(path)) + Number(btn.dataset.delta);
        set(path, Math.max(Number(btn.dataset.min), Math.min(Number(btn.dataset.max), v)));
        break;
      }
      case 'set': {
        const v = btn.dataset.num !== undefined ? Number(btn.dataset.value) : btn.dataset.value;
        set(path, v);
        if (path === 'dest.known' && v === 'no' && !RES.regioner[state.dest.continent]) state.dest.continent = 'Europa';
        break;
      }
      case 'span': {
        const i = Number(btn.dataset.i);
        let [x, y] = get(path);
        if (i < x) x = i;
        else if (i > y) y = i;
        else if (x === y) { /* redan bara detta steg */ }
        else if (i === x) x++;
        else if (i === y) y--;
        else { x = i; y = i; }
        set(path, [x, y]);
        break;
      }
      case 'lodging': {
        const k = btn.dataset.key;
        state.lodging = state.lodging.includes(k) ? state.lodging.filter((x) => x !== k) : [...state.lodging, k];
        break;
      }
      case 'removeKey':
        RP.places.setKey('');
        places.data = {}; places.sig = '';
        renderResults();
        return;
      case 'amenity': {
        const k = btn.dataset.key;
        state.amenities = state.amenities.includes(k) ? state.amenities.filter((x) => x !== k) : [...state.amenities, k];
        break;
      }
      case 'removeItem':
        state.nearby.splice(Number(btn.dataset.i), 1);
        break;
      default:
        return;
    }
    save();
    rerender();
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && !btn.disabled) onAction(btn);
  });

  app.addEventListener('submit', (e) => {
    const keyForm = e.target.closest('[data-action-form="saveKey"]');
    if (keyForm) {
      e.preventDefault();
      const v = keyForm.querySelector('#apiKey').value.trim();
      if (!v) return;
      RP.places.setKey(v);
      places.sig = '';
      renderResults();
      return;
    }
    const form = e.target.closest('[data-action-form="addItem"]');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('#customItem');
    const label = input.value.trim();
    if (!label) { input.focus(); return; }
    const pretty = label.charAt(0).toUpperCase() + label.slice(1);
    state.nearby.push({ key: 'custom-' + Date.now(), label: pretty, icon: '📍', custom: true, weight: 1, mode: 'car', minutes: 15 });
    save(); render();
    const next = app.querySelector('#customItem');
    if (next) next.focus();
  });

  function onInput(e) {
    const el = e.target.closest('[data-bind]');
    if (!el) return;
    const path = el.dataset.bind;
    let v;
    if (el.type === 'checkbox') v = el.checked;
    else if (el.type === 'range') v = Number(el.value);
    else if (el.type === 'number') v = el.value === '' ? '' : Number(el.value);
    else v = el.value;

    if (path.endsWith('.dist')) {
      const [mode, minutes] = el.value.split(':');
      const item = state.nearby[Number(el.dataset.i)];
      item.mode = mode; item.minutes = Number(minutes);
    } else {
      set(path, v);
    }
    if (path === 'dest.continent') state.dest.region = 'alla';
    save();

    if (el.dataset.cost !== undefined) {
      document.getElementById('costOut').innerHTML = costOutHTML();
      return;
    }
    if (el.dataset.rerender !== undefined && e.type === 'change') { rerender(); return; }
    if (state.view === 'results') {
      updateLive();
      refreshResults(false);
    } else {
      updateLive();
    }
  }

  app.addEventListener('input', onInput);
  app.addEventListener('change', onInput);

  render();
})();
