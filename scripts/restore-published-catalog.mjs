import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogUrl = "https://alejandropico.github.io/MediaWorld/data/mediaworld.sqlite";

export async function restorePublishedCatalog({
  destination = path.join(root, "public/data/mediaworld.sqlite"),
  fetchCatalog = fetch
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchCatalog(catalogUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(90_000)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (new TextDecoder().decode(bytes.subarray(0, 16)) !== "SQLite format 3\0") {
        throw new Error("La descarga no es una base SQLite");
      }
      const SQL = await initSqlJs();
      const database = new SQL.Database(bytes);
      let counts;
      try {
        const integrity = database.exec("PRAGMA quick_check");
        if (integrity[0]?.values.length !== 1 || integrity[0].values[0][0] !== "ok") {
          throw new Error("El catálogo publicado no supera la comprobación de integridad");
        }
        // Check the columns consumed by the app as well as both catalog sections.
        database.exec("SELECT id, name, media_type, stream_url, country_code, geo_precision FROM stations LIMIT 1");
        counts = database.exec("SELECT media_type, COUNT(*) FROM stations GROUP BY media_type")[0]?.values || [];
        if (!["radio", "tv"].every((type) => counts.some(([mediaType, count]) => mediaType === type && count > 0))) {
          throw new Error("El catálogo publicado debe contener radios y televisiones");
        }
      } finally {
        database.close();
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(`${destination}.tmp`, bytes);
      await rename(`${destination}.tmp`, destination);
      console.warn(`::warning::Actualización externa fallida. Se conserva el catálogo publicado: ${counts.map(([type, count]) => `${count} ${type}`).join(" · ")}.`);
      return counts;
    } catch (error) {
      lastError = error;
      console.warn(`Recuperación del catálogo (${attempt}/3): ${error.message}`);
    }
  }
  throw new Error("No se pudo recuperar un catálogo publicado válido; se cancela el despliegue para evitar perder emisoras", { cause: lastError });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await restorePublishedCatalog();
}
