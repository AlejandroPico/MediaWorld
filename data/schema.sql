PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('radio', 'tv')),
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  language TEXT NOT NULL,
  scope TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',
  stream_url TEXT NOT NULL DEFAULT '',
  stream_format TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('verified', 'catalogued', 'demo')),
  verified_at TEXT NOT NULL DEFAULT '',
  external_id TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '',
  geo_precision TEXT NOT NULL DEFAULT 'exact' CHECK (geo_precision IN ('exact', 'city', 'region', 'country')),
  favicon_url TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_stations_location ON stations(country, region, city);
CREATE INDEX IF NOT EXISTS idx_stations_media_type ON stations(media_type);
CREATE INDEX IF NOT EXISTS idx_stations_coordinates ON stations(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_stations_external_id ON stations(external_id);
