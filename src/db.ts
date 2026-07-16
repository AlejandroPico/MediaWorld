import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { CatalogStats, MediaType, Station } from "./types";

const mapRow = (row: Record<string, unknown>): Station => ({
  id: Number(row.id),
  name: String(row.name),
  mediaType: String(row.media_type) as MediaType,
  city: String(row.city),
  region: String(row.region),
  country: String(row.country),
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  language: String(row.language),
  scope: String(row.scope),
  description: String(row.description),
  websiteUrl: String(row.website_url),
  streamUrl: String(row.stream_url),
  streamFormat: String(row.stream_format),
  status: String(row.status) as Station["status"],
  verifiedAt: String(row.verified_at)
});

export async function loadCatalog(): Promise<{ stations: Station[]; stats: CatalogStats }> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const response = await fetch(`${import.meta.env.BASE_URL}data/mediaworld.sqlite`);
  if (!response.ok) throw new Error(`No se pudo abrir el catálogo (${response.status})`);

  const database = new SQL.Database(new Uint8Array(await response.arrayBuffer()));
  const statement = database.prepare("SELECT * FROM stations ORDER BY country, city, name");
  const stations: Station[] = [];
  while (statement.step()) stations.push(mapRow(statement.getAsObject()));
  statement.free();
  database.close();

  const countries = new Set(stations.map((station) => station.country)).size;
  return {
    stations,
    stats: {
      total: stations.length,
      radio: stations.filter((station) => station.mediaType === "radio").length,
      tv: stations.filter((station) => station.mediaType === "tv").length,
      countries,
      playable: stations.filter((station) => station.streamUrl).length
    }
  };
}
