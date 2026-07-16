import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [schema, source, regionalRadioSource, regionalTvSource] = await Promise.all([
  readFile(path.join(root, "data/schema.sql"), "utf8"),
  readFile(path.join(root, "data/stations.json"), "utf8"),
  readFile(path.join(root, "data/regional-radio.json"), "utf8").catch(() => "[]"),
  readFile(path.join(root, "data/regional-tv.json"), "utf8").catch(() => "[]")
]);
const editorialStations = JSON.parse(source);
const regionalRadioStations = JSON.parse(regionalRadioSource);
const regionalTvStations = JSON.parse(regionalTvSource);
const replacedCountries = new Set(["España", "Portugal", "Andorra", "Gibraltar", "Francia", "Bélgica", "Países Bajos", "Luxemburgo", "Reino Unido", "Irlanda"]);
const stations = [
  ...editorialStations.filter((station) => !replacedCountries.has(station.country)),
  ...regionalRadioStations,
  ...regionalTvStations
].map((station, index) => ({ ...station, id: index + 1 }));
const SQL = await initSqlJs();
const database = new SQL.Database();
database.run(schema);

const insert = database.prepare(`
  INSERT INTO stations (
    id, name, media_type, city, region, country, latitude, longitude, language,
    scope, description, website_url, stream_url, stream_format, status, verified_at,
    external_id, country_code, geo_precision, favicon_url, tags
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const station of stations) {
  insert.run([
    station.id, station.name, station.mediaType, station.city, station.region,
    station.country, station.latitude, station.longitude, station.language,
    station.scope, station.description, station.websiteUrl, station.streamUrl,
    station.streamFormat, station.status, station.verifiedAt,
    station.externalId || "", station.countryCode || "", station.geoPrecision || "exact",
    station.faviconUrl || "", station.tags || ""
  ]);
}
insert.free();
database.run("PRAGMA user_version = 1");

const outputDirectory = path.join(root, "public/data");
await mkdir(outputDirectory, { recursive: true });
const output = path.join(outputDirectory, "mediaworld.sqlite");
await writeFile(output, database.export());
database.close();
console.log(`Catálogo generado: ${stations.length} señales en ${output}`);
