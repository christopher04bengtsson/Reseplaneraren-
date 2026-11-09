/*
 * Inställningar för riktiga data.
 *
 * googleApiKey: klistra in din Google-nyckel mellan citattecknen.
 *   Nyckeln syns i koden på GitHub, men det gör inget eftersom den är
 *   låst i Google Cloud till sidans adresser och till Places API (New)
 *   och Maps JavaScript API. Lämnas den tom används testdata.
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
