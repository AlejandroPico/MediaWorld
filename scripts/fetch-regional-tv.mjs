import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tvCountries } from "./catalog-countries.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const api = "https://iptv-org.github.io/api";

const detailedCountries = {
  ES: { name: "España", anchors: [["Madrid", 40.4168, -3.7038], ["Barcelona", 41.3874, 2.1686], ["Sevilla", 37.3891, -5.9845], ["València", 39.4699, -0.3763], ["Palma", 39.5696, 2.6502], ["Tenerife", 28.4636, -16.2518], ["Extremadura", 39.1748, -6.1527], ["Aragón", 41.5976, -0.9057]] },
  PT: { name: "Portugal", anchors: [["Lisboa", 38.7223, -9.1393], ["Porto", 41.1579, -8.6291], ["Coimbra", 40.2033, -8.4103], ["Faro", 37.0194, -7.9304], ["Funchal", 32.6669, -16.9241]] },
  AD: { name: "Andorra", anchors: [["Andorra", 42.5063, 1.5218]] },
  GI: { name: "Gibraltar", anchors: [["Gibraltar", 36.1408, -5.3536]] },
  FR: { name: "Francia", anchors: [["París", 48.8566, 2.3522], ["Lyon", 45.764, 4.8357], ["Marsella", 43.2965, 5.3698], ["Toulouse", 43.6047, 1.4442], ["Burdeos", 44.8378, -0.5792], ["Lille", 50.6292, 3.0573], ["Nantes", 47.2184, -1.5536], ["Estrasburgo", 48.5734, 7.7521]] },
  BE: { name: "Bélgica", anchors: [["Bruselas", 50.8503, 4.3517], ["Amberes", 51.2194, 4.4025], ["Gante", 51.0543, 3.7174], ["Lieja", 50.6326, 5.5797]] },
  NL: { name: "Países Bajos", anchors: [["Ámsterdam", 52.3676, 4.9041], ["Róterdam", 51.9244, 4.4777], ["La Haya", 52.0705, 4.3007], ["Utrecht", 52.0907, 5.1214], ["Eindhoven", 51.4416, 5.4697]] },
  LU: { name: "Luxemburgo", anchors: [["Luxemburgo", 49.6116, 6.1319]] },
  UK: { name: "Reino Unido", anchors: [["Londres", 51.5072, -0.1276], ["Mánchester", 53.4808, -2.2426], ["Birmingham", 52.4862, -1.8904], ["Glasgow", 55.8642, -4.2518], ["Edimburgo", 55.9533, -3.1883], ["Cardiff", 51.4816, -3.1791], ["Belfast", 54.5973, -5.9301]] },
  IE: { name: "Irlanda", anchors: [["Dublín", 53.3498, -6.2603], ["Cork", 51.8985, -8.4756], ["Galway", 53.2707, -9.0568], ["Limerick", 52.6638, -8.6267]] }
};

const countries = Object.fromEntries(Object.entries(tvCountries).map(([code, country]) => [code, {
  ...country,
  ...(detailedCountries[code] || {}),
  anchors: detailedCountries[code]?.anchors || [[country.capital, country.lat, country.lon]]
}]));

const cityAliases = [
  ["madrid", "Madrid"], ["barcelona", "Barcelona"], ["sevilla", "Sevilla"], ["valencia", "València"], ["palma", "Palma"], ["tenerife", "Tenerife"], ["extremadura", "Extremadura"], ["aragon", "Aragón"],
  ["lisboa", "Lisboa"], ["lisbon", "Lisboa"], ["porto", "Porto"], ["coimbra", "Coimbra"], ["faro", "Faro"], ["funchal", "Funchal"],
  ["paris", "París"], ["lyon", "Lyon"], ["marseille", "Marsella"], ["toulouse", "Toulouse"], ["bordeaux", "Burdeos"], ["lille", "Lille"], ["nantes", "Nantes"], ["strasbourg", "Estrasburgo"],
  ["bruxelles", "Bruselas"], ["brussels", "Bruselas"], ["antwerpen", "Amberes"], ["antwerp", "Amberes"], ["gent", "Gante"], ["ghent", "Gante"], ["liege", "Lieja"],
  ["amsterdam", "Ámsterdam"], ["rotterdam", "Róterdam"], ["den haag", "La Haya"], ["the hague", "La Haya"], ["utrecht", "Utrecht"], ["eindhoven", "Eindhoven"],
  ["london", "Londres"], ["manchester", "Mánchester"], ["birmingham", "Birmingham"], ["glasgow", "Glasgow"], ["edinburgh", "Edimburgo"], ["cardiff", "Cardiff"], ["belfast", "Belfast"],
  ["dublin", "Dublín"], ["cork", "Cork"], ["galway", "Galway"], ["limerick", "Limerick"], ["andorra", "Andorra"], ["gibraltar", "Gibraltar"], ["luxembourg", "Luxemburgo"]
];

const normalize = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const nameContainsPlace = (name, key) => name === key || name.startsWith(`${key} `) || name.endsWith(` ${key}`) || name.includes(` ${key} `);
cityAliases.push(...Object.values(countries).map((country) => [normalize(country.capital), country.capital]));

const genericAdministrativeNames = new Set([
  "central", "eastern", "western", "northern", "southern", "north", "south", "east", "west",
  "region", "province", "district", "oblast", "republic", "territory", "autonomous"
]);
const ambiguousPlaceNames = new Set([
  "america", "central", "college", "enterprise", "independence", "liberty", "mobile", "national",
  "normal", "orange", "reading", "union", "university"
]);

async function loadAdministrativePlaces() {
  const response = await fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson");
  if (!response.ok) throw new Error(`No se pudieron cargar las regiones administrativas (${response.status})`);
  const collection = await response.json();
  const index = new Map();
  for (const feature of collection.features) {
    const properties = feature.properties || {};
    const code = String(properties.iso_a2 || "").toUpperCase();
    if (!Object.values(countries).some((country) => country.countryCode === code)) continue;
    const lat = Number(properties.latitude);
    const lon = Number(properties.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const label = String(properties.region || properties.name || "").trim();
    const aliases = [properties.name, properties.name_en, properties.name_local, properties.region]
      .map((value) => normalize(String(value || "")))
      .filter((value) => value.length >= 4 && !genericAdministrativeNames.has(value));
    const list = index.get(code) || [];
    for (const alias of new Set(aliases)) list.push({ key: alias, label, lat, lon });
    index.set(code, list);
  }
  for (const list of index.values()) list.sort((a, b) => b.key.length - a.key.length);
  return index;
}

const administrativePlaces = await loadAdministrativePlaces();

async function loadPopulatedPlaces() {
  const response = await fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson");
  if (!response.ok) throw new Error(`No se pudieron cargar las ciudades (${response.status})`);
  const collection = await response.json();
  const targetCodes = new Set(Object.values(countries).map((country) => country.countryCode));
  const grouped = new Map();
  for (const feature of collection.features) {
    const properties = feature.properties || {};
    const code = String(properties.iso_a2 || "").toUpperCase();
    if (!targetCodes.has(code)) continue;
    const lat = Number(properties.latitude);
    const lon = Number(properties.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const label = String(properties.name || properties.nameascii || "").trim();
    const aliases = [properties.name, properties.nameascii, ...String(properties.namealt || "").split("|")]
      .map((value) => normalize(String(value || "")))
      .filter((value) => value.length >= 5 && !ambiguousPlaceNames.has(value));
    for (const alias of new Set(aliases)) {
      const key = `${code}:${alias}`;
      const candidate = { key: alias, label, region: String(properties.adm1name || label), lat, lon, population: Number(properties.pop_max || 0) };
      const previous = grouped.get(key);
      if (!previous || candidate.population > previous.population) grouped.set(key, candidate);
    }
  }
  const index = new Map();
  for (const [compoundKey, place] of grouped) {
    const code = compoundKey.slice(0, 2);
    const list = index.get(code) || [];
    list.push(place);
    index.set(code, list);
  }
  for (const list of index.values()) list.sort((a, b) => b.key.length - a.key.length || b.population - a.population);
  return index;
}

const populatedPlaces = await loadPopulatedPlaces();

async function getJson(name) {
  const response = await fetch(`${api}/${name}.json`, { headers: { "User-Agent": "MediaWorld/0.3 catalog builder" } });
  if (!response.ok) throw new Error(`No se pudo descargar ${name}.json (${response.status})`);
  return response.json();
}

const [allChannels, allStreams, allFeeds] = await Promise.all([getJson("channels"), getJson("streams"), getJson("feeds")]);
const targetCodes = new Set(Object.keys(countries));
const streamIndex = new Map();
for (const stream of allStreams) {
  if (!stream.channel) continue;
  const list = streamIndex.get(stream.channel) || [];
  list.push(stream);
  streamIndex.set(stream.channel, list);
}
const feedIndex = new Map();
for (const feed of allFeeds) {
  if (feed.is_main && !feedIndex.has(feed.channel)) feedIndex.set(feed.channel, feed);
}

function streamScore(stream) {
  const url = String(stream.url || "");
  return (url.startsWith("https://") ? 10000 : 0) + (/\.m3u8(?:$|\?)/i.test(url) ? 3000 : 0) + (!stream.referrer && !stream.user_agent ? 1000 : 0) + (parseInt(stream.quality, 10) || 0);
}

function locate(channel) {
  const country = countries[channel.country];
  const name = normalize(`${channel.name} ${(channel.alt_names || []).join(" ")}`);
  const matched = cityAliases.find(([alias]) => alias.length >= 4 && nameContainsPlace(name, alias));
  if (matched) {
    const anchor = country.anchors.find(([label]) => normalize(label) === normalize(matched[1]));
    if (anchor) return { lat: anchor[1], lon: anchor[2], city: anchor[0], region: anchor[0], precision: "city" };
  }
  const populated = (populatedPlaces.get(country.countryCode) || []).find((place) => nameContainsPlace(name, place.key));
  if (populated) return { lat: populated.lat, lon: populated.lon, city: populated.label, region: populated.region, precision: "city" };
  const administrative = (administrativePlaces.get(country.countryCode) || []).find((place) =>
    nameContainsPlace(name, place.key)
  );
  if (administrative) return { lat: administrative.lat, lon: administrative.lon, city: administrative.label, region: administrative.label, precision: "region" };
  return { lat: country.lat, lon: country.lon, city: country.name, region: country.name, precision: "country" };
}

const output = allChannels
  .filter((channel) => targetCodes.has(channel.country) && !channel.is_nsfw && !channel.closed)
  .sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))
  .map((channel, index) => {
    const country = countries[channel.country];
    const location = locate(channel);
    const feed = feedIndex.get(channel.id);
    const streams = (streamIndex.get(channel.id) || []).sort((a, b) => streamScore(b) - streamScore(a));
    const chosen = streams[0];
    const rawUrl = String(chosen?.url || "");
    const streamUrl = rawUrl.startsWith("https://") && !chosen?.referrer && !chosen?.user_agent ? rawUrl : "";
    return {
      id: index + 1,
      name: String(channel.name).trim(),
      mediaType: "tv",
      city: location.city,
      region: location.region,
      country: country.name,
      latitude: Number(location.lat.toFixed(6)),
      longitude: Number(location.lon.toFixed(6)),
      language: (feed?.languages || []).join(", ") || "Sin especificar",
      scope: location.precision === "country" ? "Nacional / internacional" : "Local / regional",
      description: `Canal catalogado por IPTV-org${chosen?.quality ? ` · ${chosen.quality}` : ""}. ${{ city: "Localidad inferida del nombre", region: "Región administrativa inferida del nombre", country: "Sin coordenadas precisas; no se muestra en el mapa" }[location.precision]}.`,
      websiteUrl: String(channel.website || ""),
      streamUrl,
      streamFormat: /\.m3u8(?:$|\?)/i.test(streamUrl) ? "hls" : "video",
      status: streamUrl ? "verified" : "catalogued",
      verifiedAt: new Date().toISOString().slice(0, 10),
      externalId: `iptv-org:${channel.id}`,
      countryCode: channel.country === "UK" ? "GB" : channel.country,
      geoPrecision: location.precision,
      faviconUrl: "",
      tags: (channel.categories || []).join(",")
    };
  });

await writeFile(path.join(root, "data/regional-tv.json"), `${JSON.stringify(output, null, 2)}\n`);
const summary = Object.keys(countries).map((code) => `${code}: ${output.filter((item) => (code === "UK" ? item.countryCode === "GB" : item.countryCode === code)).length}`).join(" · ");
console.log(`Catálogo TV regional: ${output.length} canales (${summary}) · ${output.filter((item) => item.streamUrl).length} streams HTTPS reproducibles`);
