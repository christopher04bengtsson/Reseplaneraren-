/*
 * Länkar till Booking och Airbnb (SPEC.md, "Länkar till bokningssajterna").
 *
 * OBS: parametrarna nedan är kända från sajternas egna sökadresser men är
 * INTE verifierade ännu. Steg 9 i byggordningen är att testa dem en och en
 * i webbläsaren och flytta det som inte fungerar till checklistan.
 */
(function (root) {
  'use strict';

  // Booking: boendetyp via nflt=ht_id=… (204 hotell, 220 semesterhus, 201 lägenhet)
  const BOOKING_HT = { hotel: 204, house: 220, apartment: 201 };
  const CHILD_AGE = 8; // Booking kräver ålder per barn; standardval tills vi frågar

  /** De önskemål om boendet som gruppen valt i steg 4. */
  function chosen(ctx) {
    return root.RP.scoring.AMENITIES.filter((a) => (ctx.amenities || []).includes(a.key));
  }

  function query(area, dest) {
    const name = area.name.split(' – ')[0];
    return `${name}, ${dest.name}`;
  }

  function booking(area, dest, ctx) {
    const p = new URLSearchParams();
    p.set('ss', [area.name.split(' – ')[0], area.region, dest.name].filter(Boolean).join(', '));
    if (ctx.dates.checkin) p.set('checkin', ctx.dates.checkin);
    if (ctx.dates.checkout) p.set('checkout', ctx.dates.checkout);
    p.set('group_adults', String(ctx.rooms.adults));
    p.set('group_children', String(ctx.rooms.children));
    for (let i = 0; i < ctx.rooms.children; i++) p.append('age', String(CHILD_AGE));
    const onlyHotel = ctx.lodging.length === 1 && ctx.lodging[0] === 'hotel';
    p.set('no_rooms', String(onlyHotel ? ctx.rooms.bedrooms : 1));
    p.set('selected_currency', 'SEK');
    const nflt = ctx.lodging.map((k) => `ht_id=${BOOKING_HT[k]}`);
    for (const a of chosen(ctx)) if (a.booking) nflt.push(a.booking);
    if (ctx.budgetPPN > 0) {
      // Bookings budgetfilter: pris per natt för hela bokningen, i SEK.
      // Formatet är price=VALUTA-min-max-1 (1 = per natt).
      nflt.push(`price=SEK-0-${Math.round(ctx.budgetPPN * ctx.rooms.total)}-1`);
    }
    if (!onlyHotel) nflt.push(`entire_place_bedroom_count=${ctx.rooms.bedrooms}`);
    if (nflt.length) p.set('nflt', nflt.join(';'));
    return 'https://www.booking.com/searchresults.sv.html?' + p.toString();
  }

  /**
   * Sökruta runt orten i kilometer. Små orter får en tät ruta, storstäder en större,
   * så att Airbnb inte visar hela ön eller regionen.
   */
  function radiusKm(area) {
    const inv = area.population || 0;
    if (inv > 300000) return 5;
    if (inv > 50000) return 3.5;
    return 2.5;
  }

  function airbnb(area, dest, ctx) {
    const label = [area.name.split(' – ')[0], area.region, dest.name].filter(Boolean).join(', ');
    const slug = encodeURIComponent(label.replace(/, /g, '--').replace(/ /g, '-'));
    const p = new URLSearchParams();
    if (typeof area.lat === 'number') {
      // Kartruta runt ortens mittpunkt: Airbnb söker då bara inom den.
      const km = radiusKm(area);
      const dLat = km / 111;
      const dLng = km / (111 * Math.cos((area.lat * Math.PI) / 180));
      p.set('ne_lat', (area.lat + dLat).toFixed(5));
      p.set('ne_lng', (area.lng + dLng).toFixed(5));
      p.set('sw_lat', (area.lat - dLat).toFixed(5));
      p.set('sw_lng', (area.lng - dLng).toFixed(5));
      p.set('search_by_map', 'true');
      p.set('search_type', 'user_map_move');
    }
    if (ctx.dates.checkin) p.set('checkin', ctx.dates.checkin);
    if (ctx.dates.checkout) p.set('checkout', ctx.dates.checkout);
    p.set('adults', String(ctx.rooms.adults));
    if (ctx.rooms.children) p.set('children', String(ctx.rooms.children));
    p.set('min_bedrooms', String(ctx.rooms.bedrooms));
    p.set('min_beds', String(ctx.rooms.beds));
    const types = [];
    if (ctx.lodging.includes('house') || ctx.lodging.includes('apartment')) types.push('Entire home/apt');
    if (ctx.lodging.includes('hotel')) types.push('Hotel room');
    types.forEach((t) => p.append('room_types[]', t));
    for (const a of chosen(ctx)) {
      if (a.airbnb) p.append('amenities[]', String(a.airbnb));
      if (a.airbnbParam) p.set(a.airbnbParam[0], a.airbnbParam[1]);
    }
    if (ctx.budgetPPN > 0 && ctx.dates.nights) {
      // Airbnb filtrerar på pris per natt för hela boendet
      p.set('price_max', String(Math.round(ctx.budgetPPN * ctx.rooms.total)));
    }
    return `https://www.airbnb.se/s/${slug}/homes?` + p.toString();
  }

  /**
   * Booking-sökning på ett specifikt boendes namn, med datum, gäster och rum.
   * Boendet hamnar oftast överst, och Booking visar pris och om det är ledigt.
   */
  function bookingStay(stayName, place, ctx) {
    const p = new URLSearchParams();
    p.set('ss', `${stayName}, ${place}`);
    if (ctx.dates.checkin) p.set('checkin', ctx.dates.checkin);
    if (ctx.dates.checkout) p.set('checkout', ctx.dates.checkout);
    p.set('group_adults', String(ctx.rooms.adults));
    p.set('group_children', String(ctx.rooms.children));
    for (let i = 0; i < ctx.rooms.children; i++) p.append('age', String(CHILD_AGE));
    p.set('no_rooms', String(ctx.stayCat === 'hotel' ? ctx.rooms.bedrooms : 1));
    p.set('selected_currency', 'SEK');
    return 'https://www.booking.com/searchresults.sv.html?' + p.toString();
  }

  /** Det som inte går att skicka med i länken – bockas av för hand. */
  function checklist(area, dest, ctx, prefs) {
    const S = root.RP.scoring;
    const list = [];
    if (ctx.dates.flex === 'pm3') list.push('Välj flexibla datum ± 3 dagar på sajten');
    if (ctx.dates.flex === 'month') {
      list.push(`Välj ${ctx.dates.nights} nätter någon gång i ${S.MONTHS[ctx.dates.months[0]]}`);
    }
    if (ctx.rooms.doubleBeds) list.push(`Minst ${ctx.rooms.doubleBeds} dubbelsängar för paren`);
    if (Number(prefs.group.ownRoom)) list.push(`${prefs.group.ownRoom} st vill ha eget rum`);
    const noBooking = chosen(ctx).filter((a) => !a.booking);
    if (noBooking.length) list.push(`Booking: välj ${noBooking.map((a) => a.label.toLowerCase()).join(', ')} bland filtren`);
    const noAirbnb = chosen(ctx).filter((a) => !a.airbnb && !a.airbnbParam);
    if (noAirbnb.length) list.push(`Airbnb: håll utkik efter ${noAirbnb.map((a) => a.label.toLowerCase()).join(', ')}`);
    if (ctx.budgetPPN > 0) {
      list.push(`Budget ca ${S.formatKr(ctx.budgetPPN)} per person och natt (${S.formatKr(ctx.budgetPPN * ctx.rooms.total)} per natt för hela gruppen)`);
    }
    for (const item of prefs.nearby) {
      if (item.weight >= 2) {
        list.push(`${item.label} inom ${item.minutes} min ${S.MODE_LABEL[item.mode]}`);
      }
    }
    return list;
  }

  root.RP = root.RP || {};
  root.RP.links = { booking, airbnb, bookingStay, checklist };
})(window);
