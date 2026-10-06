import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import initSqlJs from "sql.js";
import { restorePublishedCatalog } from "./restore-published-catalog.mjs";

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "mediaworld-catalog-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, "mediaworld.sqlite");
  await writeFile(destination, "previous catalog");
  return destination;
}

async function catalog(types = ["radio", "tv"]) {
  const SQL = await initSqlJs();
  const database = new SQL.Database();
  database.run("CREATE TABLE stations (id INTEGER, name TEXT, media_type TEXT, stream_url TEXT, country_code TEXT, geo_precision TEXT)");
  for (const type of types) database.run("INSERT INTO stations VALUES (1, 'Test', ?, '', 'ES', 'exact')", [type]);
  const bytes = database.export();
  database.close();
  return bytes;
}

test("recovers both media types unchanged after a transient download failure", async (t) => {
  const destination = await fixture(t);
  const bytes = await catalog();
  let attempts = 0;
  const counts = await restorePublishedCatalog({ destination, fetchCatalog: async () => {
    attempts += 1;
    return attempts === 1 ? new Response("Unavailable", { status: 503 }) : new Response(bytes);
  } });
  assert.equal(attempts, 2);
  assert.deepEqual(counts, [["radio", 1], ["tv", 1]]);
  assert.deepEqual(new Uint8Array(await readFile(destination)), bytes);
});

test("rejects an HTML response without overwriting the existing catalog", async (t) => {
  const destination = await fixture(t);
  await assert.rejects(restorePublishedCatalog({ destination, fetchCatalog: async () => new Response("<html>Error</html>") }));
  assert.equal(await readFile(destination, "utf8"), "previous catalog");
});

test("rejects an incomplete catalog without overwriting the existing catalog", async (t) => {
  const destination = await fixture(t);
  const bytes = await catalog(["radio"]);
  await assert.rejects(restorePublishedCatalog({ destination, fetchCatalog: async () => new Response(bytes) }));
  assert.equal(await readFile(destination, "utf8"), "previous catalog");
});
