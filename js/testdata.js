/*
 * Testdata – påhittade men rimliga värden för att bygga och testa
 * resultatsidan innan riktiga datakällor kopplas in (steg 5–8 i SPEC.md).
 *
 * climate: normalvärden per månad (jan–dec)
 *   tMax  = medeltemperatur dagtid, °C
 *   sea   = havstemperatur, °C (null = inget hav)
 *   rain  = regndagar per vecka
 *
 * areas.nearby: avstånd i meter från områdets mittpunkt till närmaste
 *   plats av varje typ. Saknas nyckeln finns platsen inte i närheten.
 * areas.venues1km: antal restauranger, barer och butiker inom 1 km
 *   (används för "liv och rörelse").
 * areas.pricePPN: typiskt pris per person och natt i kronor för ett
 *   gruppboende.
 */
var RP = window.RP = window.RP || {};

RP.CONTINENTS = {
  'Europa': ['Medelhavet', 'Kanarieöarna', 'Alperna', 'Norden'],
  'Asien': ['Sydostasien', 'Japan'],
  'Nordamerika': ['Karibien', 'USA:s västkust'],
  'Afrika': ['Nordafrika', 'Södra Afrika']
};

RP.TESTDATA = {
  destinations: [
    {
      id: 'mallorca', name: 'Mallorca', country: 'Spanien',
      continent: 'Europa', region: 'Medelhavet',
      climate: {
        tMax: [15, 15, 17, 20, 23, 28, 31, 31, 28, 24, 19, 16],
        sea:  [14, 14, 14, 16, 18, 22, 25, 26, 25, 22, 19, 16],
        rain: [1.4, 1.3, 1.2, 1.2, 0.9, 0.5, 0.3, 0.6, 1.2, 1.5, 1.6, 1.6]
      }
    },
    {
      id: 'katalonien', name: 'Katalonien', country: 'Spanien',
      continent: 'Europa', region: 'Medelhavet',
      climate: {
        tMax: [14, 15, 17, 19, 22, 26, 29, 29, 26, 22, 17, 14],
        sea:  [13, 13, 13, 14, 17, 21, 24, 25, 23, 20, 17, 14],
        rain: [1.0, 0.9, 1.0, 1.4, 1.4, 1.0, 0.6, 1.0, 1.3, 1.5, 1.2, 1.1]
      }
    },
    {
      id: 'teneriffa', name: 'Teneriffa', country: 'Spanien',
      continent: 'Europa', region: 'Kanarieöarna',
      climate: {
        tMax: [21, 21, 22, 23, 24, 26, 28, 29, 28, 26, 24, 22],
        sea:  [19, 18, 18, 19, 20, 21, 22, 23, 24, 23, 21, 20],
        rain: [1.0, 0.9, 0.8, 0.5, 0.2, 0.1, 0.0, 0.1, 0.3, 0.8, 1.1, 1.2]
      }
    },
    {
      id: 'chamonix', name: 'Chamonix-dalen', country: 'Frankrike',
      continent: 'Europa', region: 'Alperna',
      climate: {
        tMax: [2, 4, 8, 12, 16, 20, 23, 22, 18, 13, 7, 3],
        sea:  null,
        rain: [2.6, 2.3, 2.5, 2.6, 3.0, 2.8, 2.4, 2.4, 2.1, 2.3, 2.6, 2.7]
      }
    }
  ],

  areas: [
    // Mallorca
    { id: 'palma', dest: 'mallorca', name: 'Palma – Santa Catalina', lat: 39.572, lng: 2.637,
      population: 420000, venues1km: 620, tempOffset: 0, pricePPN: 950,
      lodging: { hotel: true, house: false, apartment: true },
      nearby: { beach: 1400, restaurant: 80, padel: 2500, tennis: 2800, gym: 300, sights: 1200, grocery: 150, golf: 9000 } },
    { id: 'soller', dest: 'mallorca', name: 'Sóller', lat: 39.766, lng: 2.715,
      population: 14000, venues1km: 115, tempOffset: -1, pricePPN: 850,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 2600, restaurant: 120, padel: 1800, tennis: 1500, gym: 900, sights: 300, grocery: 250 } },
    { id: 'deia', dest: 'mallorca', name: 'Deià', lat: 39.748, lng: 2.649,
      population: 700, venues1km: 22, tempOffset: -1, pricePPN: 1300,
      lodging: { hotel: true, house: true, apartment: false },
      nearby: { beach: 1700, restaurant: 150, tennis: 7000, sights: 400, grocery: 350 } },
    { id: 'pollenca', dest: 'mallorca', name: 'Port de Pollença', lat: 39.906, lng: 3.084,
      population: 6500, venues1km: 95, tempOffset: 0, pricePPN: 780,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 300, restaurant: 150, padel: 2200, tennis: 1300, gym: 1100, sights: 6500, grocery: 400, golf: 6000 } },
    { id: 'alcudia', dest: 'mallorca', name: 'Alcúdia', lat: 39.853, lng: 3.121,
      population: 20000, venues1km: 150, tempOffset: 1, pricePPN: 700,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 900, restaurant: 100, padel: 1200, tennis: 1600, gym: 800, sights: 200, grocery: 300, golf: 4500 } },
    { id: 'calador', dest: 'mallorca', name: "Cala d'Or", lat: 39.372, lng: 3.232,
      population: 4000, venues1km: 85, tempOffset: 1, pricePPN: 740,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 250, restaurant: 200, padel: 3500, tennis: 1400, gym: 1600, sights: 9000, grocery: 350, golf: 2500 } },
    { id: 'santanyi', dest: 'mallorca', name: 'Santanyí', lat: 39.354, lng: 3.128,
      population: 12000, venues1km: 60, tempOffset: 1, pricePPN: 820,
      lodging: { hotel: true, house: true, apartment: false },
      nearby: { beach: 4500, restaurant: 120, padel: 2800, tennis: 3200, sights: 250, grocery: 200 } },
    { id: 'andratx', dest: 'mallorca', name: "Port d'Andratx", lat: 39.543, lng: 2.389,
      population: 3500, venues1km: 55, tempOffset: 0, pricePPN: 1200,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 1600, restaurant: 100, tennis: 3500, gym: 2500, sights: 8000, grocery: 300, golf: 7500 } },

    // Katalonien
    { id: 'barcelona', dest: 'katalonien', name: 'Barcelona – Gràcia', lat: 41.402, lng: 2.157,
      population: 1600000, venues1km: 950, tempOffset: 0, pricePPN: 1050,
      lodging: { hotel: true, house: false, apartment: true },
      nearby: { beach: 4200, restaurant: 50, padel: 1500, tennis: 1800, gym: 250, sights: 700, grocery: 100 } },
    { id: 'girona', dest: 'katalonien', name: 'Girona', lat: 41.979, lng: 2.821,
      population: 103000, venues1km: 390, tempOffset: 1, pricePPN: 720,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 38000, restaurant: 90, padel: 2000, tennis: 1700, gym: 500, sights: 150, grocery: 200, golf: 9000 } },
    { id: 'begur', dest: 'katalonien', name: 'Begur', lat: 41.954, lng: 3.207,
      population: 4000, venues1km: 45, tempOffset: -1, pricePPN: 980,
      lodging: { hotel: true, house: true, apartment: false },
      nearby: { beach: 1900, restaurant: 120, padel: 5000, tennis: 2500, sights: 400, grocery: 300, golf: 6500 } },
    { id: 'tossa', dest: 'katalonien', name: 'Tossa de Mar', lat: 41.720, lng: 2.932,
      population: 5600, venues1km: 130, tempOffset: 0, pricePPN: 690,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 200, restaurant: 100, padel: 3000, tennis: 1500, gym: 1200, sights: 300, grocery: 250 } },

    // Teneriffa
    { id: 'santacruz', dest: 'teneriffa', name: 'Santa Cruz de Tenerife', lat: 28.468, lng: -16.254,
      population: 210000, venues1km: 470, tempOffset: 0, pricePPN: 650,
      lodging: { hotel: true, house: false, apartment: true },
      nearby: { beach: 6500, restaurant: 80, padel: 1800, tennis: 2000, gym: 400, sights: 500, grocery: 150 } },
    { id: 'puertocruz', dest: 'teneriffa', name: 'Puerto de la Cruz', lat: 28.414, lng: -16.548,
      population: 30000, venues1km: 270, tempOffset: -1, pricePPN: 600,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 600, restaurant: 70, padel: 1400, tennis: 1100, gym: 700, sights: 900, grocery: 200, golf: 8000 } },
    { id: 'adeje', dest: 'teneriffa', name: 'Costa Adeje', lat: 28.084, lng: -16.731,
      population: 47000, venues1km: 230, tempOffset: 1, pricePPN: 780,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 350, restaurant: 90, padel: 900, tennis: 1200, gym: 500, sights: 5000, grocery: 250, golf: 3000 } },
    { id: 'gigantes', dest: 'teneriffa', name: 'Los Gigantes', lat: 28.244, lng: -16.841,
      population: 3000, venues1km: 48, tempOffset: 1, pricePPN: 620,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { beach: 800, restaurant: 150, tennis: 4000, gym: 2500, sights: 1000, grocery: 300 } },

    // Alperna
    { id: 'chamonix', dest: 'chamonix', name: 'Chamonix', lat: 45.924, lng: 6.869,
      population: 8700, venues1km: 170, tempOffset: 0, pricePPN: 1100,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { restaurant: 60, padel: 2500, tennis: 900, gym: 500, sights: 300, grocery: 200, golf: 3000 } },
    { id: 'leshouches', dest: 'chamonix', name: 'Les Houches', lat: 45.890, lng: 6.799,
      population: 3000, venues1km: 20, tempOffset: 0, pricePPN: 850,
      lodging: { hotel: true, house: true, apartment: true },
      nearby: { restaurant: 200, tennis: 600, gym: 7000, sights: 2500, grocery: 400, golf: 9000 } }
  ]
};
