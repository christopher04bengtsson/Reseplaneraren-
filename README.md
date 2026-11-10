# Reseplaneraren

Reseplanerare för sällskap på 5–15 personer som hittar resmål, områden och boenden utifrån gruppens önskemål. Hela specen finns i [SPEC.md](SPEC.md).

## Öppna sidan

Dubbelklicka på `index.html`, eller kör en enkel server i mappen:

```bash
python3 -m http.server 8000
```

och gå till http://localhost:8000.

## Google-nyckeln

Nyckeln ligger inte i repot. Skriv in den på resultatsidan under **Google-nyckel**, så sparas den bara i den webbläsaren (en gång per enhet). Nyckeln är låst i Google Cloud till sidans adresser, så den fungerar bara via `http://localhost:8000` eller GitHub Pages, inte när man dubbelklickar på filen.

## Filer

| Fil | Vad den gör |
| --- | --- |
| `index.html` | Sidans skal: rubrikrad och platsen där allt ritas |
| `css/style.css` | Utseendet. Färgerna ligger överst som variabler, så ett nytt tema är bara att byta dem |
| `js/scoring.js` | Uträkningar: sovrum och sängar, datum, poäng, rankning och kostnadsdelning |
| `js/config.js` | Google-nyckeln, gränsen för anrop per sökning och hur länge cachen sparas |
| `js/places.js` | Hämtar närmaste strand, restaurang, padelbana osv. från Google Places, med cache och anropsgräns |
| `data/resmal.json` | 101 resmål i 7 regioner, med koordinater och invånare från Wikidata och klimat från Open-Meteo (2019–2024). `data/resmal.js` är samma data för sidan |
| `tools/resmal-lista.json` | Listan som bygget utgår från: namn, land, region och typ |
| `tools/bygg-resmal.mjs` | Bygger `data/resmal.json`: `NODE_USE_ENV_PROXY=1 node tools/bygg-resmal.mjs` |
| `js/links.js` | Länkar till Booking och Airbnb, plus checklistan för det som inte går att skicka med |
| `js/app.js` | Frågeflödet i 7 steg och resultatsidan |
| `tests/scoring.test.js` | Tester för uträkningarna: `node tests/scoring.test.js` |

## Läget i SPEC-v2

- [x] 1. Regionerna och `data/resmal.json`
- [ ] 2. Spanien-felet och spridningsregeln
- [ ] 3. Hus och villor från Google Places
- [ ] 4. Smartare länkar
- [ ] 5. LiteAPI
- [ ] 6. Kostnadsdelningen per boende

Havstemperaturen är borttagen (beslut 10 nov 2026). Strand i närheten täcker bad.

## Läget i första specens byggordning

- [x] 1. Grund
- [x] 2. Frågeflödet, med sovrum och sängar
- [x] 3. Resultatsidan med testdata, kartan som platshållare och poängberäkningen
- [x] 4. Kostnadsdelning
- [x] 5. Google Places: avstånd till platser i närheten, med cache och anropsgräns. Nyckeln skrivs in på sidan
- [ ] 6. Ortens storlek och liv och rörelse med riktig data (gränserna för liv och rörelse i `scoring.js` är preliminära)
- [ ] 7. Klimat från Open-Meteo
- [ ] 8. Förslag på resmål med riktig data (logiken finns, men den går på testdata)
- [~] 9. Länkar: Booking och Airbnb byggs med datum, gäster, sovrum och boendetyp, men parametrarna är **inte testade** på sajterna än
- [ ] 10. GitHub Pages, Google-kartan och nytt färgtema
