# Spec v2 – Uppgradering av Reseplaneraren

Nov 10, 2026 · @Christopher

## Sammanfattning

Version 2 gör att sidan föreslår riktiga boenden, inte bara en stad, och att förslagen sprids över hela regionen i stället för att alltid hamna i Spanien. Den här specen kompletterar `SPEC.md`. Allt som inte nämns här gäller som tidigare.

| Problem i dag | Hur det ska bli |
| --- | --- |
| Man matchas bara till en stad och får själv lägga in filter på Booking och Airbnb | Under varje stad visas 3–5 riktiga boenden som passar gruppen, med bild, kapacitet och pris där det går |
| Alla förslag hamnar i Spanien | Förslagen sprids över hela regionen, med högst 2 resmål per land bland de bästa |
| Chamonix finns som val bland områdena | Valen är regioner som Alperna. Chamonix blir ett möjligt resmål inom Alperna |

## Problem 1: Riktiga boenden i resultatet

Sidan ska föreslå faktiska boenden under varje stad. Hotell och lägenheter hämtas med pris från LiteAPI. Hus och villor hämtas från Google Places, men utan pris. Booking och Airbnb har inga öppna API:er för ett hobbyprojekt, så de nås fortfarande via länkar, men nu med allt ifyllt automatiskt.

**Vilka källor som går att använda**

| Källa | Ger oss | Går att använda? |
| --- | --- | --- |
| [LiteAPI](https://docs.liteapi.travel/docs/faq) | Hotell och lägenheter med lediga rum och priser för gruppens datum | Ja. Gratis konto och sandbox-nyckel direkt. Riktiga priser kräver produktionsnyckel, villkoren kontrolleras vid registrering |
| Google Places API (New), boendetyper | Alla typer av boenden i området, även hus, villor och gästhus, med bild, betyg och webbplats | Ja, med nyckeln vi redan har. Ger inga priser eller lediga datum |
| [Booking.com Demand API](https://developers.booking.com/demand/docs/getting-started/prerequisites) | Bookings utbud med priser | Nej. Kräver avtal som Managed Affiliate Partner |
| Airbnb | Hus och lägenheter | Nej. Inget öppet API |
| [Amadeus Self-Service](https://www.phocuswire.com/amadeus-shut-down-self-service-apis-portal-developers) | Hotell med priser | Nej. Stängdes i juli 2026 |

**Så hämtas boenden för en grupp**

1. Ta gruppens rumsbehov från steg 1, till exempel 3 dubbelrum och 2 tvåbäddsrum för 10 personer varav 3 par.
2. **Hotell och lägenheter:** fråga LiteAPI efter boenden nära områdets mittpunkt där alla rum finns lediga samtidigt för datumen. Visa bara boenden där hela gruppen får plats.
3. **Hus och villor:** om gruppen valt hus eller villa i steg 4, hämta boenden av typerna för semesterboende och gästhus från Google Places inom området.
4. Räkna fram avstånd från varje boende till det gruppen valt i steg 6, till exempel strand och padel, med platsdata som redan hämtats.
5. Ranka boendena med samma poängmodell som områdena, plus pris mot budget, och visa de 3–5 bästa.

**Hur ett boendekort ser ut**

- Bild, namn, typ (hotell, lägenhet, villa) och betyg
- Hur gruppen får plats, till exempel "5 rum: 3 dubbelrum och 2 tvåbäddsrum"
- Pris totalt och per person för hela vistelsen, med texten "Pris från LiteAPI, kan ändras". Saknas pris står "Pris saknas, se länken"
- Avstånd till det som är viktigt, till exempel "Strand 3 min gång · Padel 9 min bil"
- En rad om varför det matchar, till exempel "Matchar 88 %: nära strand, inom budget"
- Knappen **Visa boendet**, som går till bokningssidan eller boendets egen webbplats
- Knappen **Hitta på Booking**, med boendets namn, datum, antal gäster och rum ifyllda
- Knappen **Lägg i kostnadsdelningen**, som fyller i priset automatiskt

**Under listan**

Knapparna "Fler på Booking" och "Fler på Airbnb" ligger kvar, men med allt ifyllt: område, datum, antal gäster, minsta antal sovrum och de filter sajten stödjer. Användaren ska aldrig behöva fylla i något själv.

**Regler**

- Visa aldrig påhittade boenden eller priser. Saknas data visas det ärligt.
- LiteAPI-nyckeln ligger på samma sätt som Google-nyckeln och får aldrig hamna i en publik commit om den är en produktionsnyckel. Claude Code ska föreslå hur det löses när sidan ligger på GitHub Pages.

## Problem 2: Alla förslag blir Spanien

Orsaken behöver hittas innan något ändras. Claude Code ska först undersöka koden och förklara varför det blir så, och först sedan rätta det.

**Troliga orsaker att kontrollera**

- Listan med möjliga resmål innehåller mest spanska orter, eller ligger hårdkodad från testdatan i steg 3.
- Sökningen mot Google utgår från en fast punkt, till exempel Mallorca, i stället för hela regionen.
- Poängmodellen gynnar något som Spanien råkar ha mycket av, till exempel många restauranger.
- Klimatdatan hämtas fel eller för samma plats för alla resmål.

**Så ska det fungera**

1. **En egen lista med resmål** i filen `data/resmal.json`. Varje resmål har namn, land, världsdel, region, koordinater, ungefärligt invånarantal och typ (strand, stad, berg, sjö). Minst 10 resmål per region, från minst 4 olika länder där regionen spänner över flera länder.
2. **Kandidater från hela regionen:** alla resmål i vald region testas mot klimat och önskemål, inte bara de som ligger nära en punkt.
3. **Spridning i topplistan:** högst 2 resmål från samma land bland de 6 bästa. Landet visas tydligt på varje kort.
4. **Fritt val förblir fritt:** väljer man ett land eller en ort själv gäller inte spridningsregeln.

Invånarantal och koordinater i listan ska hämtas från Wikidata eller GeoNames, inte gissas.

## Problem 3: Regioner i stället för orter

Valen under "Begränsa mer" i steg 2 ska bara vara regioner. Orter som Chamonix är resmål och hör hemma ett steg längre ner.

Sidan använder fyra nivåer, från störst till minst:

1. **Världsdel**, till exempel Europa
2. **Region**, till exempel Alperna. Det är här användaren väljer i steg 2
3. **Resmål**, till exempel Chamonix. Det är här sidan föreslår
4. **Område och boende**, till exempel en stadsdel i Chamonix och ett hotell där

**Regioner för Europa i version 2**

| Region | Länder | Exempel på resmål |
| --- | --- | --- |
| Medelhavet | Spanien, Frankrike, Italien, Kroatien, Grekland, Turkiet, Cypern, Malta | Mallorca, Sicilien, Split, Kreta, Antalya |
| Kanarieöarna | Spanien | Gran Canaria, Teneriffa, Lanzarote |
| Alperna | Frankrike, Schweiz, Italien, Österrike, Tyskland, Slovenien | Chamonix, Zermatt, Dolomiterna, Tyrolen, Bled |
| Atlantkusten | Portugal, Spanien, Frankrike | Algarve, Lissabonkusten, Biarritz |
| Norden | Sverige, Norge, Danmark, Finland, Island | Lofoten, Bornholm, Skärgården |
| Brittiska öarna | Storbritannien, Irland | Cornwall, Skotska höglandet, Kerry |
| Centraleuropas städer | Tyskland, Tjeckien, Österrike, Ungern, Nederländerna | Prag, Wien, Budapest, Amsterdam |

Kanarieöarna är ett undantag från spridningsregeln, eftersom regionen bara ligger i ett land. Motsvarande regioner för övriga världsdelar läggs till på samma sätt i `data/resmal.json`.

## Byggordning och tester

Bygg i den här ordningen och testa efter varje steg. De två första stegen kräver inga nya konton.

- [ ] **1. Regionerna:** byt valen i steg 2 mot regionerna i tabellen ovan och skapa `data/resmal.json`.
- [ ] **2. Spanien-felet:** hitta orsaken, förklara den och inför spridningsregeln.
- [ ] **3. Hus och villor från Google Places:** visa riktiga boenden utan pris under varje stad.
- [ ] **4. Smartare länkar:** "Hitta på Booking" per boende och "Fler på Booking/Airbnb" med allt ifyllt.
- [ ] **5. LiteAPI:** skapa konto, börja med sandbox-nyckeln, och visa hotell och lägenheter med pris för hela gruppen.
- [ ] **6. Kostnadsdelningen:** knappen "Lägg i kostnadsdelningen" på varje boende.

**Så vet vi att det fungerar**

| Test | Förväntat resultat |
| --- | --- |
| Europa, Medelhavet, varmt, 12–19 juni | Topp 6 innehåller resmål från minst 3 länder |
| Europa utan region, behagligt | Topp 6 innehåller resmål från minst 4 länder |
| Europa, Alperna | Chamonix kan dyka upp som resmål, men finns inte bland regionvalen |
| 10 personer varav 3 par, hotell | Varje föreslaget hotell har plats för alla 10 samma nätter |
| 10 personer, hus eller villa | Minst 3 riktiga boenden visas per stad, eller ett tydligt meddelande om att det saknas |
| Klick på "Fler på Airbnb" | Airbnb öppnas med område, datum, 10 gäster och minst 5 sovrum ifyllt |

## Prompt till Claude Code

Exportera dokumentet som Markdown, lägg det i repot som `SPEC-v2.md` och klistra sedan in prompten nedan.

```markdown
Läs SPEC.md och SPEC-v2.md. SPEC-v2.md beskriver tre problem i nuvarande version som ska rättas.

Innan du ändrar något:
1. Gå igenom koden och förklara kort, på svenska och utan facktermer, varför alla förslag hamnar i Spanien.
2. Visa en plan för steg 1 och 2 i byggordningen i SPEC-v2.md: vilka filer du ändrar och varför.
3. Vänta på mitt godkännande.

När vi bygger:
- Ta ett steg i byggordningen i taget och säg till när jag ska testa.
- Kör testerna i tabellen "Så vet vi att det fungerar" som gäller steget och visa resultatet.
- Hitta aldrig på boenden, priser, invånarantal eller koordinater. Saknas data ska sidan säga det.
- Fråga mig innan du lägger till ett nytt konto, en ny nyckel eller en ny tjänst.
```
