# Spec – Reseplaneraren för sällskap

Nov 9, 2026 · @Christopher

## Mål och avgränsning

Reseplaneraren hjälper ett sällskap på 5–15 personer att hitta rätt resmål, rätt område och rätt typ av boende utifrån gruppens önskemål, utan timmar av egen research. Sidan är för eget bruk.

Sidan bokar ingenting själv. Den räknar fram vad gruppen behöver, rankar områden med kartdata och skickar vidare till Booking och Airbnb med rätt filter ifyllda.

**Ingår i version 1**

- Frågeflöde i 7 steg som startar direkt när sidan öppnas
- Uträkning av antal sovrum och sängar utifrån gruppen
- Förslag på resmål om gruppen inte vet vart den vill, utifrån världsdel, region och klimat
- Rankning av områden utifrån typ av ort, liv och rörelse samt vad som finns i närheten
- Länkar till Booking och Airbnb per område
- Enkel kostnadsdelning: totalt, per person, per natt och per person och natt

**Ingår inte i version 1**

- Röstning eller inbjudan av övriga i gruppen
- Visning av enskilda boenden och priser direkt på sidan
- Inloggning och sparade resor

## Användarflödet

Sidan öppnar direkt på steg 1, utan menyer eller inloggning. En fråga i taget visas i ett stort kort med en stapel för hur långt man kommit, och knapparna Tillbaka och Nästa. Alla fält har rimliga standardval så att man kan klicka sig igenom snabbt.

1. **Sällskapet:** antal personer, varav par, barn och om någon vill ha eget rum. Sidan visar direkt hur många sovrum och sängar som behövs, till exempel "minst 5 sovrum och 7 sängar".
2. **Resmål och datum:** "Vet ni vart ni vill åka?"
   - Ja: man skriver in en ort, ö eller region.
   - Nej: man väljer världsdel och kan begränsa till en region, till exempel Medelhavet, Kanarieöarna eller Alperna.
   - Datum från och till, med valen exakta datum, ± 3 dagar eller en hel månad.
3. **Klimat:** en skala för temperatur dagtid där man väljer ett spann, plus reglagen "Vi vill bada" (lägsta havstemperatur) och "Undvik regn" (högsta antal regndagar per vecka).
4. **Typ av boende:** hotell, hus eller villa, lägenhet, ett eller flera val.
5. **Typ av ort:** två skalor, ortens storlek och liv och rörelse (se nästa avsnitt).
6. **Vad ska finnas i närheten:** strand, restauranger, padelbana, tennisbana, gym, sevärdheter och mataffär. Varje sak får en viktnivå och ett avstånd, till exempel "inom 10 min gång" eller "inom 15 min bil". Man kan lägga till egna saker, till exempel golfbana.
7. **Budget:** ungefärlig budget per person och natt, eller totalt.

**Resultatsidan**

- Överst en rad med valen som sammanfattning, till exempel "Föreslaget: Mallorca · 12–19 juni · 10 personer · minst 5 sovrum".
- En karta med områdena numrerade, och en lista med ett kort per område.
- Varje kort visar matchningsprocent, typ av ort, klimat och fakta: gröna markeringar för det som stämmer och gula för det som saknas, till exempel "Strand 4 min gång" och "Tennis 20 min bil".
- Varje kort har knapparna "Sök på Booking" och "Sök på Airbnb".
- I en sidopanel kan man justera skalorna och viktnivåerna, och listan sorteras om direkt utan att man behöver börja om.
- Kostnadsdelningen ligger i sidopanelen: man fyller i priset för ett boende och ser totalen, pris per person, per natt och per person och natt.

## Matchning och poäng

Sidan rankar områden, inte enskilda boenden. Ett område är en ort eller stadsdel med en mittpunkt. Varje område får en matchningsprocent från 0 till 100.

**Viktnivåer**

| Nivå | Vikt i poängen | Effekt |
| --- | --- | --- |
| Spelar ingen roll | 0 | Räknas inte |
| Trevligt | 1 | Påverkar poängen lite |
| Viktigt | 2 | Påverkar poängen mycket |
| Måste finnas | 3 | Områden som saknar det inom avståndet sorteras bort |

**Ortens storlek**, utifrån invånarantal. Användaren väljer ett spann av steg.

| Steg | Invånare | Exempel |
| --- | --- | --- |
| By | under 5 000 | Deià |
| Småstad | 5 000–50 000 | Sóller |
| Mellanstor stad | 50 000–300 000 | Girona |
| Storstad | 300 000–1 miljon | Palma |
| Metropol | över 1 miljon | Barcelona |

**Liv och rörelse** är en skala i 5 steg från "Lugnt och tyst" till "Mycket folk och liv". Den räknas fram från antalet restauranger, barer och butiker inom 1 km från områdets mittpunkt. Gränserna mellan stegen bestäms när vi ser riktiga siffror.

**Klimat:** temperaturen dagtid jämförs med normalvärden för gruppens datum.

| Steg | Temperatur dagtid |
| --- | --- |
| Svalt | under 18 °C |
| Behagligt | 18–24 °C |
| Varmt | 24–30 °C |
| Hett | över 30 °C |

Havstemperatur och regndagar räknas bara med när reglagen för dem är påslagna. När gruppen inte har valt resmål används klimatet först för att välja ut resmål i regionen, och sedan rankas områdena i dem.

**Så räknas poängen**

1. Sortera bort områden som saknar något som är "Måste finnas" inom valt avstånd.
2. Ge varje kriterium ett delvärde mellan 0 och 1. Inom valt avstånd eller spann ger 1, och värdet sjunker jämnt till 0 vid dubbla avståndet eller ett steg utanför spannet.
3. Matchningsprocent = summan av vikt × delvärde delat med summan av vikterna, gånger 100.
4. Visa de bästa områdena först, med förklaringen bakom poängen på kortet.

## Datakällor

Google Places står för platserna i närheten. Öppna gratiskällor står för invånare och klimat. Bokningssajterna nås bara via länkar.

| Behov | Källa | Kostnad | Att lösa när vi bygger |
| --- | --- | --- | --- |
| Restauranger, gym, padel, tennis, strand, sevärdheter, mataffär | [Google Places API](https://developers.google.com/maps/documentation/places/web-service/overview), Nearby Search | Gratis inom månadens gratisnivå, kräver betalkort i Google Cloud | Vilka platstyper som motsvarar padel och strand, och hur många anrop en sökning kostar |
| Karta på resultatsidan | Google Maps JavaScript API | Gratis inom gratisnivån | Visa områden som numrerade nålar |
| Invånarantal för ortens storlek | Wikidata eller GeoNames | Gratis | Vilken källa som täcker små orter bäst |
| Temperatur, havstemperatur och regn för gruppens datum | Open-Meteo (historiska data och normalvärden) | Gratis för eget bruk, ingen nyckel | Hur många års data som ska bilda normalvärdet |
| Lista över möjliga resmål i en region | GeoNames eller Google Places | Gratis | Hur många kandidater som ska testas per region |
| Boenden | Booking och Airbnb, via länkar | Gratis | Vilka filter som går att skicka med i länken |

**Länkar till bokningssajterna.** Länken skickar med område, datum, antal gäster och minsta antal sovrum, plus de filter sajten stödjer, till exempel frukost eller pool. Claude Code ska testa vilka parametrar som faktiskt fungerar på varje sajt. Det som inte går att skicka med visas som en checklista på kortet, så att man kan bocka av själv.

**Cache.** Svar från Google och Open-Meteo sparas lokalt i några dagar. Då kostar det inga nya anrop att justera skalorna eller göra om samma sökning.

## Teknik och säkerhet

Sidan byggs som en ren webbsida i HTML, CSS och JavaScript, utan egen server. Claude Code skriver all kod. Du beskriver vad du vill ha, testar och ber om ändringar.

- **Webbsida:** vanlig HTML, CSS och JavaScript, utan ramverk i version 1. Den ska fungera både på dator och i mobilen.
- **Data:** sidan hämtar data direkt från Google och de öppna källorna och räknar poängen själv.
- **Publicering:** gratis via GitHub Pages, så att sidan nås från mobilen.
- **Kod och versioner:** projektet ligger i ett eget GitHub-repo.

**Säkerhet och kostnad**

- [ ] API-nyckeln är låst i Google Cloud till sidans egen adress, så att den inte fungerar från andra sidor
- [ ] Nyckeln är begränsad till de API:er sidan använder
- [ ] Kvoter per API är satta i Google Cloud, så att en bugg inte kan skicka obegränsat med anrop
- [ ] En budgetvarning är satt, som extra koll
- [ ] Sidan har en egen gräns för hur många anrop en sökning får göra

## Design och utseende

Layouten följer skissen [Reseplanerare för sällskap – skiss](https://claude.ai/artifact/HX1gjpFgZXT4X9SToxvcHR). Färger och typsnitt är inte bestämda än, eftersom skissens färger kändes för tråkiga.

- **Lätt att förstå:** en fråga per skärm, stora knappar och korta texter. Man ska aldrig behöva läsa en instruktion.
- **Skalor i stället för ja och nej:** reglage där man väljer ett spann, med exempel under varje steg.
- **Svar direkt:** uträkningar som antal sovrum och pris per person uppdateras medan man fyller i.
- **Mobil först:** allt ska gå att använda med tummen på en telefon. Knappar är minst 44 px höga.
- **Färg med betydelse:** grönt för det som stämmer, gult för det som saknas. Inget ska bara sägas med färg, så markeringarna har också symboler.

Ett nytt färgtema tas fram innan bygget börjar, eller i ett eget steg när allt fungerar.

## Byggordning för Claude Code

Bygg i små steg och testa sidan efter varje steg innan nästa börjar. Exportera den här specen som Markdown och lägg den i repot som `SPEC.md`, så att Claude Code kan läsa den.

- [ ] **1. Grund:** skapa GitHub-repot och en tom webbsida som går att öppna i webbläsaren.
- [ ] **2. Frågeflödet:** alla 7 steg med Tillbaka och Nästa, och uträkningen av sovrum och sängar. Ingen extern data än.
- [ ] **3. Resultatsidan med testdata:** kort, karta som platshållare och poängberäkningen, med några påhittade områden.
- [ ] **4. Kostnadsdelning:** priset in, totalt, per person, per natt och per person och natt ut.
- [ ] **5. Google Places:** hämta riktiga platser runt ett område, med låst nyckel, kvoter och cache på plats först.
- [ ] **6. Ortens storlek och liv och rörelse:** invånardata och täthet av restauranger och butiker.
- [ ] **7. Klimat:** normalvärden från Open-Meteo för gruppens datum.
- [ ] **8. Förslag på resmål:** "Vet inte än" med världsdel och region.
- [ ] **9. Länkar:** Booking och Airbnb med så många filter som går, plus checklistan för resten.
- [ ] **10. Publicering och nytt utseende:** lägg ut sidan på GitHub Pages, koppla in Google-kartan och ta fram ett nytt färgtema.

**Första instruktionen till Claude Code**

> Läs SPEC.md. Vi bygger steg 1 i byggordningen. Visa vilka filer du tänker skapa innan du börjar, och förklara kort vad varje fil gör.
