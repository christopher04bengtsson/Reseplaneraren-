/*
 * Inställningar för riktiga data.
 *
 * googleApiKey: lämna TOM. Repot är publikt, så nyckeln ska inte ligga här.
 *   Skriv i stället in den på resultatsidan under "Google-nyckel". Den
 *   sparas då bara i den webbläsaren, en gång per enhet.
 *
 *   OBS: en låst nyckel fungerar inte när sidan öppnas som fil
 *   (dubbelklick). Testa via http://localhost:8000 eller GitHub Pages.
 */
var RP = window.RP = window.RP || {};

RP.CONFIG = {
  googleApiKey: '',

  // Högst så här många anrop till Google per sökning (specens säkerhetslista).
  maxCallsPerSearch: 80,

  // Hur många dagar svar från Google sparas i webbläsaren.
  cacheDays: 5
};
