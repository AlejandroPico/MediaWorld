import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countries } from "./europe-countries.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDirectory = process.env.RADIO_BROWSER_CACHE_DIR || "";
const servers = ["https://de1.api.radio-browser.info", "https://at1.api.radio-browser.info", "https://fi1.api.radio-browser.info"];

const places = [
  ["madrid", "Madrid", 40.4168, -3.7038], ["barcelona", "Barcelona", 41.3874, 2.1686],
  ["andalucia", "Andalucía", 37.3891, -5.9845], ["sevilla", "Sevilla", 37.3891, -5.9845],
  ["malaga", "Málaga", 36.7213, -4.4214], ["granada", "Granada", 37.1773, -3.5986],
  ["guadix", "Guadix", 37.2993, -3.1392],
  ["cordoba", "Córdoba", 37.8882, -4.7794], ["almeria", "Almería", 36.834, -2.4637],
  ["cadiz", "Cádiz", 36.5271, -6.2886], ["huelva", "Huelva", 37.2614, -6.9447],
  ["jaen", "Jaén", 37.7796, -3.7849], ["marbella", "Marbella", 36.5101, -4.8824],
  ["catalunya", "Catalunya", 41.5912, 1.5209], ["cataluna", "Catalunya", 41.5912, 1.5209],
  ["catalonia", "Catalunya", 41.5912, 1.5209], ["girona", "Girona", 41.9794, 2.8214],
  ["lleida", "Lleida", 41.6176, 0.6200], ["tarragona", "Tarragona", 41.1189, 1.2445],
  ["valencia", "València", 39.4699, -0.3763], ["alicante", "Alicante", 38.3452, -0.481],
  ["castellon", "Castellón", 39.9864, -0.0513], ["murcia", "Murcia", 37.9922, -1.1307],
  ["aragon", "Aragón", 41.6488, -0.8891], ["zaragoza", "Zaragoza", 41.6488, -0.8891],
  ["huesca", "Huesca", 42.1401, -0.4089], ["teruel", "Teruel", 40.3456, -1.1065],
  ["galicia", "Galicia", 42.8782, -8.5448], ["a coruna", "A Coruña", 43.3623, -8.4115],
  ["la coruna", "A Coruña", 43.3623, -8.4115], ["vigo", "Vigo", 42.2406, -8.7207],
  ["pontevedra", "Pontevedra", 42.4299, -8.6446], ["ourense", "Ourense", 42.3358, -7.8639],
  ["asturias", "Asturias", 43.3619, -5.8494], ["oviedo", "Oviedo", 43.3619, -5.8494],
  ["cantabria", "Cantabria", 43.4623, -3.8099], ["santander", "Santander", 43.4623, -3.8099],
  ["pais vasco", "País Vasco", 43.263, -2.935], ["basque country", "País Vasco", 43.263, -2.935],
  ["euskadi", "País Vasco", 43.263, -2.935], ["bilbao", "Bilbao", 43.263, -2.935],
  ["bizkaia", "Bizkaia", 43.263, -2.935], ["gipuzkoa", "Gipuzkoa", 43.3183, -1.9812],
  ["navarra", "Navarra", 42.8125, -1.6458], ["pamplona", "Pamplona", 42.8125, -1.6458],
  ["la rioja", "La Rioja", 42.4627, -2.4449], ["logrono", "Logroño", 42.4627, -2.4449],
  ["castilla y leon", "Castilla y León", 41.6523, -4.7245], ["valladolid", "Valladolid", 41.6523, -4.7245],
  ["leon", "León", 42.5987, -5.5671], ["burgos", "Burgos", 42.3439, -3.6969],
  ["salamanca", "Salamanca", 40.9701, -5.6635], ["avila", "Ávila", 40.6565, -4.6818],
  ["segovia", "Segovia", 40.9429, -4.1088], ["palencia", "Palencia", 42.0096, -4.5288],
  ["zamora", "Zamora", 41.5035, -5.7446], ["soria", "Soria", 41.7666, -2.479],
  ["castilla la mancha", "Castilla-La Mancha", 39.8628, -4.0273], ["toledo", "Toledo", 39.8628, -4.0273],
  ["albacete", "Albacete", 38.9943, -1.8585], ["ciudad real", "Ciudad Real", 38.9861, -3.9273],
  ["cuenca", "Cuenca", 40.0704, -2.1374], ["guadalajara", "Guadalajara", 40.6333, -3.1669],
  ["extremadura", "Extremadura", 39.4753, -6.3724], ["badajoz", "Badajoz", 38.8794, -6.9707],
  ["caceres", "Cáceres", 39.4753, -6.3724], ["islas baleares", "Islas Baleares", 39.5696, 2.6502],
  ["illes balears", "Islas Baleares", 39.5696, 2.6502], ["mallorca", "Mallorca", 39.5696, 2.6502],
  ["palma", "Palma", 39.5696, 2.6502], ["ibiza", "Ibiza", 38.9067, 1.4206],
  ["menorca", "Menorca", 39.9496, 4.1104], ["islas canarias", "Islas Canarias", 28.2916, -16.6291],
  ["canary islands", "Islas Canarias", 28.2916, -16.6291], ["tenerife", "Tenerife", 28.4636, -16.2518],
  ["gran canaria", "Gran Canaria", 28.1235, -15.4363], ["las palmas", "Las Palmas", 28.1235, -15.4363],
  ["lanzarote", "Lanzarote", 28.998, -13.548], ["fuerteventura", "Fuerteventura", 28.3587, -14.0537],
  ["la palma", "La Palma", 28.6835, -17.7642], ["lisbon", "Lisboa", 38.7223, -9.1393],
  ["lisboa", "Lisboa", 38.7223, -9.1393], ["porto", "Porto", 41.1579, -8.6291],
  ["braga", "Braga", 41.5454, -8.4265], ["aveiro", "Aveiro", 40.6405, -8.6538],
  ["coimbra", "Coimbra", 40.2033, -8.4103], ["leiria", "Leiria", 39.7436, -8.8071],
  ["santarem", "Santarém", 39.2369, -8.685], ["setubal", "Setúbal", 38.5244, -8.8882],
  ["faro", "Faro", 37.0194, -7.9304], ["algarve", "Algarve", 37.0194, -7.9304],
  ["beja", "Beja", 38.0151, -7.8632], ["evora", "Évora", 38.5714, -7.9135],
  ["portalegre", "Portalegre", 39.2967, -7.4285], ["castelo branco", "Castelo Branco", 39.8222, -7.4919],
  ["guarda", "Guarda", 40.5373, -7.2676], ["viseu", "Viseu", 40.6566, -7.9125],
  ["vila real", "Vila Real", 41.301, -7.7422], ["braganca", "Bragança", 41.8061, -6.7567],
  ["viana do castelo", "Viana do Castelo", 41.6918, -8.8344], ["madeira", "Madeira", 32.6669, -16.9241],
  ["funchal", "Funchal", 32.6669, -16.9241], ["azores", "Açores", 37.7412, -25.6756],
  ["acores", "Açores", 37.7412, -25.6756], ["andorra", "Andorra", 42.5063, 1.5218],
  ["gibraltar", "Gibraltar", 36.1408, -5.3536],
  ["paris", "París", 48.8566, 2.3522], ["lyon", "Lyon", 45.764, 4.8357],
  ["marseille", "Marsella", 43.2965, 5.3698], ["marseille", "Marsella", 43.2965, 5.3698],
  ["toulouse", "Toulouse", 43.6047, 1.4442], ["bordeaux", "Burdeos", 44.8378, -0.5792],
  ["lille", "Lille", 50.6292, 3.0573], ["nantes", "Nantes", 47.2184, -1.5536],
  ["strasbourg", "Estrasburgo", 48.5734, 7.7521], ["nice", "Niza", 43.7102, 7.262],
  ["rennes", "Rennes", 48.1173, -1.6778], ["montpellier", "Montpellier", 43.6108, 3.8767],
  ["ajaccio", "Ajaccio", 41.9192, 8.7386], ["corsica", "Córcega", 42.0396, 9.0129],
  ["sardegna", "Cerdeña", 40.1209, 9.0129], ["sardinia", "Cerdeña", 40.1209, 9.0129], ["cagliari", "Cagliari", 39.2238, 9.1217],
  ["bruxelles", "Bruselas", 50.8503, 4.3517], ["brussels", "Bruselas", 50.8503, 4.3517],
  ["antwerpen", "Amberes", 51.2194, 4.4025], ["antwerp", "Amberes", 51.2194, 4.4025],
  ["gent", "Gante", 51.0543, 3.7174], ["ghent", "Gante", 51.0543, 3.7174],
  ["liege", "Lieja", 50.6326, 5.5797], ["charleroi", "Charleroi", 50.4108, 4.4446],
  ["amsterdam", "Ámsterdam", 52.3676, 4.9041], ["rotterdam", "Róterdam", 51.9244, 4.4777],
  ["den haag", "La Haya", 52.0705, 4.3007], ["the hague", "La Haya", 52.0705, 4.3007],
  ["utrecht", "Utrecht", 52.0907, 5.1214], ["eindhoven", "Eindhoven", 51.4416, 5.4697],
  ["groningen", "Groninga", 53.2194, 6.5665], ["maastricht", "Maastricht", 50.8514, 5.691],
  ["luxembourg", "Luxemburgo", 49.6116, 6.1319], ["luxemburg", "Luxemburgo", 49.6116, 6.1319],
  ["london", "Londres", 51.5072, -0.1276], ["manchester", "Mánchester", 53.4808, -2.2426],
  ["birmingham", "Birmingham", 52.4862, -1.8904], ["glasgow", "Glasgow", 55.8642, -4.2518],
  ["edinburgh", "Edimburgo", 55.9533, -3.1883], ["liverpool", "Liverpool", 53.4084, -2.9916],
  ["bristol", "Bristol", 51.4545, -2.5879], ["leeds", "Leeds", 53.8008, -1.5491],
  ["cardiff", "Cardiff", 51.4816, -3.1791], ["belfast", "Belfast", 54.5973, -5.9301],
  ["newcastle", "Newcastle", 54.9783, -1.6178], ["dublin", "Dublín", 53.3498, -6.2603],
  ["cork", "Cork", 51.8985, -8.4756], ["galway", "Galway", 53.2707, -9.0568],
  ["limerick", "Limerick", 52.6638, -8.6267], ["waterford", "Waterford", 52.2593, -7.1101]
].map(([key, label, lat, lon]) => ({ key, label, lat, lon }));

const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
for (const country of Object.values(countries)) {
  places.push({ key: normalize(country.capital), label: country.capital, lat: country.lat, lon: country.lon });
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[previous];
    if ((y1 > lat) !== (y2 > lat) && lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon, lat, polygon) {
  return pointInRing(lon, lat, polygon[0]) && !polygon.slice(1).some((hole) => pointInRing(lon, lat, hole));
}

function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false;
  if (geometry.type === "Polygon") return pointInPolygon(lon, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon));
  return false;
}

async function loadCountryGeometries() {
  const response = await fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson");
  if (!response.ok) throw new Error(`No se pudieron validar las fronteras (${response.status})`);
  const world = await response.json();
  const grouped = new Map();
  for (const feature of world.features) {
    const code = feature.properties.ISO_A2_EH || feature.properties.ISO_A2;
    const geometries = grouped.get(code) || [];
    geometries.push(feature.geometry);
    grouped.set(code, geometries);
  }
  return grouped;
}

const countryGeometries = await loadCountryGeometries();

async function loadAdministrativePlaces() {
  const response = await fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson");
  if (!response.ok) throw new Error(`No se pudieron cargar las regiones administrativas (${response.status})`);
  const collection = await response.json();
  const grouped = new Map();
  for (const feature of collection.features) {
    const properties = feature.properties || {};
    const code = String(properties.iso_a2 || "").toUpperCase();
    if (!countries[code]) continue;
    const lat = Number(properties.latitude);
    const lon = Number(properties.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const label = String(properties.region || properties.name || countries[code].name);
    const aliases = [properties.name, properties.name_en, properties.name_local, properties.region]
      .map((value) => normalize(String(value || "")))
      .filter((value) => value.length >= 3);
    for (const alias of new Set(aliases)) {
      const key = `${code}:${alias}`;
      const group = grouped.get(key) || { code, alias, label, lat: 0, lon: 0, count: 0 };
      group.lat += lat;
      group.lon += lon;
      group.count += 1;
      grouped.set(key, group);
    }
  }
  const index = new Map();
  for (const group of grouped.values()) {
    const list = index.get(group.code) || [];
    list.push({ key: group.alias, label: group.label, lat: group.lat / group.count, lon: group.lon / group.count });
    index.set(group.code, list);
  }
  for (const list of index.values()) list.sort((a, b) => b.key.length - a.key.length);
  return index;
}

const administrativePlaces = await loadAdministrativePlaces();

const nameContainsPlace = (name, key) => name === key || name.startsWith(`${key} `) || name.endsWith(` ${key}`) || name.includes(` ${key} `);

const conflictingCountryTokens = new Map([
  ["venezuela", "VE"], ["colombia", "CO"], ["ecuador", "EC"], ["argentina", "AR"],
  ["mexico", "MX"], ["peru", "PE"], ["chile", "CL"], ["bolivia", "BO"],
  ["brasil", "BR"], ["brazil", "BR"], ["paraguay", "PY"], ["uruguay", "UY"]
]);

function matchAdministrativePlace(code, rawState) {
  const state = normalize(rawState);
  if (!state || state === normalize(countries[code].name)) return null;
  return (administrativePlaces.get(code) || []).find((place) =>
    state === place.key || state.startsWith(`${place.key} `) || state.endsWith(` ${place.key}`)
  ) || null;
}

async function fetchCountry(code) {
  if (cacheDirectory) {
    try { return JSON.parse(await readFile(path.join(cacheDirectory, `radio-${code}.json`), "utf8")); } catch { /* Se descargará. */ }
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    for (const server of servers) {
      try {
        const response = await fetch(`${server}/json/stations/bycountrycodeexact/${code}?hidebroken=true&order=name&reverse=false&limit=100000`, {
          headers: { "User-Agent": "MediaWorld/0.4 (GitHub Pages catalog builder)" },
          signal: AbortSignal.timeout(30_000)
        });
        if (response.ok) return await response.json();
      } catch { /* Prueba el siguiente espejo. */ }
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }
  console.warn(`Aviso: no se pudo descargar temporalmente el catálogo ${code}`);
  return [];
}

function chooseLocation(station, code) {
  const country = countries[code];
  const lat = Number(station.geo_lat);
  const lon = Number(station.geo_long);
  const geometries = countryGeometries.get(code) || [];
  const isInsideCountry = (candidateLon, candidateLat) => geometries.some((geometry) => pointInGeometry(candidateLon, candidateLat, geometry));
  const nearSmallTerritory = Math.hypot(lat - country.lat, (lon - country.lon) * Math.cos(country.lat * Math.PI / 180)) < 1.1;
  if (Number.isFinite(lat) && Number.isFinite(lon) && (isInsideCountry(lon, lat) || (!geometries.length && nearSmallTerritory))) {
    return { lat, lon, label: station.state || country.name, precision: "exact" };
  }
  const name = normalize(station.name);
  const matched = places
    .filter((place) => place.key.length >= 4 && nameContainsPlace(name, place.key) && (!geometries.length || isInsideCountry(place.lon, place.lat)))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (matched) return { lat: matched.lat, lon: matched.lon, label: matched.label, precision: "city" };
  const conflictingToken = [...conflictingCountryTokens].find(([token, tokenCode]) => tokenCode !== code && nameContainsPlace(name, token));
  if (conflictingToken) return { lat: country.lat, lon: country.lon, label: country.name, precision: "country" };
  const administrative = matchAdministrativePlace(code, station.state);
  if (administrative) return { lat: administrative.lat, lon: administrative.lon, label: administrative.label, precision: "region" };
  return { lat: country.lat, lon: country.lon, label: country.name, precision: "country" };
}

function score(station) {
  return Number(station.lastcheckok) * 100000 + (station.geo_lat != null ? 20000 : 0) + Number(station.votes || 0) * 10 + Number(station.bitrate || 0);
}

const raw = [];
const countryCodes = Object.keys(countries);
for (let offset = 0; offset < countryCodes.length; offset += 4) {
  const batch = countryCodes.slice(offset, offset + 4);
  const results = await Promise.all(batch.map(async (code) => (await fetchCountry(code)).map((station) => ({ ...station, requestedCode: code }))));
  raw.push(...results.flat());
}
const unique = new Map();
for (const station of raw) {
  if (!Number(station.lastcheckok) || !station.name || !(station.url_resolved || station.url)) continue;
  const url = String(station.url_resolved || station.url).trim();
  const key = normalize(url.replace(/^https?:\/\//, "").replace(/\/$/, "")) || station.stationuuid;
  const previous = unique.get(key);
  if (!previous || score(station) > score(previous)) unique.set(key, station);
}

const output = [...unique.values()].sort((a, b) => a.requestedCode.localeCompare(b.requestedCode) || a.name.localeCompare(b.name, "es")).map((station, index) => {
  const code = station.requestedCode;
  const country = countries[code];
  const location = chooseLocation(station, code);
  const rawStream = String(station.url_resolved || station.url).trim();
  const secureStream = rawStream.startsWith("https://") ? rawStream : "";
  const codec = String(station.codec || "").toLowerCase();
  const tags = String(station.tags || "");
  const scope = /\bfm\b|\bam\b|\bfm\d|\d\s*fm/i.test(`${station.name} ${tags}`) ? "FM / Online" : "Online";
  const precisionText = { exact: "coordenadas declaradas y validadas en tierra", city: "localidad inferida del nombre", region: "ubicación regional", country: "sin coordenadas precisas; no se muestra en el mapa" }[location.precision];
  return {
    id: index + 1,
    name: String(station.name).trim(),
    mediaType: "radio",
    city: location.label,
    region: String(station.state || location.label || country.name).trim(),
    country: country.name,
    latitude: Number(location.lat.toFixed(6)),
    longitude: Number(location.lon.toFixed(6)),
    language: String(station.language || "Sin especificar"),
    scope,
    description: `${String(station.codec || "Formato sin identificar")}${station.bitrate ? ` · ${station.bitrate} kbps` : ""}. Fuente Radio Browser; ${precisionText}.`,
    websiteUrl: String(station.homepage || ""),
    streamUrl: secureStream,
    streamFormat: Number(station.hls) ? "hls" : codec,
    status: secureStream ? "verified" : "catalogued",
    verifiedAt: String(station.lastcheckoktime_iso8601 || station.lastchecktime_iso8601 || "").slice(0, 10),
    externalId: String(station.stationuuid || ""),
    countryCode: code,
    geoPrecision: location.precision,
    faviconUrl: String(station.favicon || ""),
    tags
  };
});

const target = path.join(root, "data/regional-radio.json");
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
const summary = Object.keys(countries).map((code) => `${code}: ${output.filter((station) => station.countryCode === code).length}`).join(" · ");
const exact = output.filter((station) => station.geoPrecision === "exact").length;
const playable = output.filter((station) => station.streamUrl).length;
console.log(`Catálogo regional: ${output.length} emisoras (${summary}) · ${exact} coordenadas declaradas · ${playable} streams HTTPS`);
