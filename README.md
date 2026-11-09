# Reseplaneraren

Reseplanerare för sällskap på 5–15 personer som hittar resmål, områden och boenden utifrån gruppens önskemål. Hela specen finns i [SPEC.md](SPEC.md).

## Öppna sidan

Dubbelklicka på `index.html`, eller kör en enkel server i mappen:

```bash
python3 -m http.server 8000
```

och gå till http://localhost:8000.

## Filer

| Fil | Vad den gör |
| --- | --- |
| `index.html` | Sidans skal: rubrikrad och platsen där allt ritas |
| `css/style.css` | Utseendet. Färgerna ligger överst som variabler, så ett nytt tema är bara att byta dem |
| `js/scoring.js` | Uträkningar: sovrum och sängar, datum, poäng, rankning och kostnadsdelning |
| `js/testdata.js` | Påhittade områden och klimat för Mallorca, Katalonien, Teneriffa och Chamonix |
| `js/links.js` | Länkar till Booking och Airbnb, plus checklistan för det som inte går att skicka med |
| `js/app.js` | Frågeflödet i 7 steg och resultatsidan |
| `tests/scoring.test.js` | Tester för uträkningarna: `node tests/scoring.test.js` |

## Läget i byggordningen

- [x] 1. Grund
- [x] 2. Frågeflödet, med sovrum och sängar
- [x] 3. Resultatsidan med testdata, kartan som platshållare och poängberäkningen
- [x] 4. Kostnadsdelning
- [ ] 5. Google Places (kräver API-nyckel, låsning, kvoter och cache)
- [ ] 6. Ortens storlek och liv och rörelse med riktig data (gränserna för liv och rörelse i `scoring.js` är preliminära)
- [ ] 7. Klimat från Open-Meteo
- [ ] 8. Förslag på resmål med riktig data (logiken finns, men den går på testdata)
- [~] 9. Länkar: Booking och Airbnb byggs med datum, gäster, sovrum och boendetyp, men parametrarna är **inte testade** på sajterna än
- [ ] 10. GitHub Pages, Google-kartan och nytt färgtema
