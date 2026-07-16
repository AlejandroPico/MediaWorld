import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDirectory = process.env.RADIO_BROWSER_CACHE_DIR || "";
const servers = ["https://de1.api.radio-browser.info", "https://at1.api.radio-browser.info", "https://fi1.api.radio-browser.info"];

const countries = {
  ES: { name: "España", bounds: [-19, 27, 5, 44.5] },
  PT: { name: "Portugal", bounds: [-32, 30, -5.5, 43] },
  AD: { name: "Andorra", bounds: [1.3, 42.3, 1.9, 42.8] },
  GI: { name: "Gibraltar", bounds: [-5.5, 35.9, -5.2, 36.3] }
};

const places = [
  ["madrid", "Madrid", 40.4168, -3.7038], ["barcelona", "Barcelona", 41.3874, 2.1686],
  ["andalucia", "Andalucía", 37.3891, -5.9845], ["sevilla", "Sevilla", 37.3891, -5.9845],
  ["malaga", "Málaga", 36.7213, -4.4214], ["granada", "Granada", 37.1773, -3.5986],
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
  ["gibraltar", "Gibraltar", 36.1408, -5.3536]
].map(([key, label, lat, lon]) => ({ key, label, lat, lon }));

const fallbackAnchors = {
  ES: places.filter((place) => ["madrid", "barcelona", "sevilla", "valencia", "zaragoza", "a coruna", "bilbao", "valladolid", "murcia", "mallorca", "tenerife", "gran canaria"].includes(place.key)),
  PT: places.filter((place) => ["lisboa", "porto", "braga", "coimbra", "faro", "madeira", "azores"].includes(place.key)),
  AD: places.filter((place) => place.key === "andorra"),
  GI: places.filter((place) => place.key === "gibraltar")
};

const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hash = (value) => [...value].reduce((result, character) => Math.imul(result ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
const jitter = (point, seed, radius) => {
  const value = hash(seed);
  const angle = (value % 3600) / 3600 * Math.PI * 2;
  const distance = radius * (.25 + ((value >>> 12) % 750) / 1000);
  return { lat: point.lat + Math.sin(angle) * distance, lon: point.lon + Math.cos(angle) * distance / Math.max(.35, Math.cos(point.lat * Math.PI / 180)) };
};

async function fetchCountry(code) {
  if (cacheDirectory) {
    try { return JSON.parse(await readFile(path.join(cacheDirectory, `radio-${code}.json`), "utf8")); } catch { /* Se descargará. */ }
  }
  for (const server of servers) {
    try {
      const response = await fetch(`${server}/json/stations/bycountrycodeexact/${code}?hidebroken=true&order=name&reverse=false&limit=100000`, { headers: { "User-Agent": "MediaWorld/0.2 (GitHub Pages catalog builder)" } });
      if (response.ok) return await response.json();
    } catch { /* Prueba el siguiente espejo. */ }
  }
  throw new Error(`No se pudo descargar el catálogo ${code}`);
}

function chooseLocation(station, code) {
  const country = countries[code];
  const lat = Number(station.geo_lat);
  const lon = Number(station.geo_long);
  const [minLon, minLat, maxLon, maxLat] = country.bounds;
  if (Number.isFinite(lat) && Number.isFinite(lon) && lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat) {
    return { lat, lon, label: station.state || country.name, precision: "exact" };
  }
  const state = normalize(station.state);
  const name = normalize(station.name);
  const matched = places
    .filter((place) => (state && (state.includes(place.key) || place.key.includes(state))) || (place.key.length >= 4 && name.includes(place.key)))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (matched) return { ...jitter(matched, station.stationuuid, .055), label: matched.label, precision: state ? "region" : "city" };
  const anchors = fallbackAnchors[code];
  const anchor = anchors[hash(station.stationuuid) % anchors.length];
  return { ...jitter(anchor, station.stationuuid, code === "AD" || code === "GI" ? .006 : .22), label: country.name, precision: "country" };
}

function score(station) {
  return Number(station.lastcheckok) * 100000 + (station.geo_lat != null ? 20000 : 0) + Number(station.votes || 0) * 10 + Number(station.bitrate || 0);
}

const raw = (await Promise.all(Object.keys(countries).map(async (code) => (await fetchCountry(code)).map((station) => ({ ...station, requestedCode: code }))))).flat();
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
  const precisionText = { exact: "coordenadas declaradas", city: "localidad inferida", region: "ubicación regional", country: "ubicación nacional aproximada" }[location.precision];
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

const target = path.join(root, "data/iberian-radio.json");
await writeFile(target, `${JSON.stringify(output, null, 2)}\n`);
const summary = Object.keys(countries).map((code) => `${code}: ${output.filter((station) => station.countryCode === code).length}`).join(" · ");
const exact = output.filter((station) => station.geoPrecision === "exact").length;
const playable = output.filter((station) => station.streamUrl).length;
console.log(`Catálogo ibérico: ${output.length} emisoras (${summary}) · ${exact} coordenadas declaradas · ${playable} streams HTTPS`);
