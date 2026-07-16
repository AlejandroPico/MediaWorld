import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent, type StyleSpecification } from "maplibre-gl";
import Hls from "hls.js";
import { loadCatalog } from "./db";
import type { CatalogStats, MediaType, Station } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("No se encontró el contenedor de la aplicación");

app.innerHTML = `
  <main class="shell">
    <div id="map" aria-label="Globo terráqueo interactivo"></div>
    <header class="topbar glass">
      <button class="brand" id="home-button" aria-label="Ver el mundo completo">
        <span class="brand__mark"><i></i><i></i></span>
        <span><strong>MediaWorld</strong><small>Radio · Televisión · Mundo</small></span>
      </button>
      <div class="topbar__status" id="catalog-status"><span class="pulse"></span> Catálogo local</div>
      <div class="topbar__actions">
        <label class="map-mode" title="Presentación del mapamundi">
          <span>MAPA</span>
          <select id="map-mode" aria-label="Presentación del mapamundi">
            <option value="satellite">Satélite 3D</option>
            <option value="political">Mapa / carreteras</option>
            <option value="relief">Relieve</option>
          </select>
        </label>
        <button class="icon-button" id="locate-button" title="Mi ubicación" aria-label="Mi ubicación">⌾</button>
        <button class="icon-button" id="theme-button" title="Cambiar tema" aria-label="Cambiar tema">◐</button>
        <button class="about-button" id="about-button">Acerca de</button>
      </div>
    </header>

    <aside class="explorer glass" aria-label="Explorador de emisoras">
      <div class="explorer__heading">
        <div><span class="eyebrow">EXPLORAR</span><h1>Señales del mundo</h1></div>
        <button class="collapse-button" id="collapse-button" aria-label="Contraer panel">‹</button>
      </div>
      <label class="searchbox">
        <span>⌕</span>
        <input id="search-input" type="search" placeholder="País, ciudad o emisora…" autocomplete="off" />
        <kbd>⌘ K</kbd>
      </label>
      <div class="media-tabs" role="group" aria-label="Tipo de contenido">
        <button class="media-tab is-active" data-type="all"><span class="all-dot"></span> Todo <b id="all-count">0</b></button>
        <button class="media-tab is-active" data-type="radio"><span class="radio-dot"></span> Radio <b id="radio-count">0</b></button>
        <button class="media-tab is-active" data-type="tv"><span class="tv-dot"></span> TV <b id="tv-count">0</b></button>
      </div>
      <div class="nearby-heading"><span id="result-title">Emisoras visibles</span><small id="result-count">0 resultados</small></div>
      <div class="station-list" id="station-list"></div>
      <div class="explorer__foot">
        <span><i class="radio-dot"></i> Radio</span><span><i class="tv-dot"></i> Televisión</span>
        <button id="reset-button">Restablecer</button>
      </div>
    </aside>

    <section class="station-card glass" id="station-card" aria-live="polite" hidden></section>

    <div class="map-tools glass" aria-label="Controles del mapa">
      <button id="zoom-in" aria-label="Acercar">+</button><button id="zoom-out" aria-label="Alejar">−</button>
      <hr /><button id="reset-bearing" aria-label="Orientar al norte">N</button>
    </div>
    <div class="map-engine-status glass" id="map-engine-status">Iniciando esfera 3D…</div>

    <section class="video-window glass" id="video-window" hidden>
      <div class="video-window__head"><span>EMISIÓN EN DIRECTO</span><button id="close-video">×</button></div>
      <video id="video" playsinline></video>
    </section>

    <footer class="player glass" id="player">
      <div class="now-playing">
        <div class="station-logo is-empty" id="player-logo">MW</div>
        <div><small id="player-kicker">NINGUNA SEÑAL SELECCIONADA</small><strong id="player-title">Explora el mapa para empezar</strong><span id="player-place">La reproducción nunca comienza automáticamente</span></div>
      </div>
      <div class="transport">
        <button id="previous-button" aria-label="Anterior">‹</button>
        <button class="play-button" id="play-button" aria-label="Reproducir" disabled><span>▶</span></button>
        <button id="next-button" aria-label="Siguiente">›</button>
      </div>
      <div class="player__right">
        <span class="live-pill" id="live-pill">EN ESPERA</span>
        <label class="volume"><span>◖</span><input id="volume" type="range" min="0" max="1" value="0.72" step="0.01" aria-label="Volumen" /></label>
      </div>
      <audio id="audio" preload="none"></audio>
    </footer>

    <dialog id="about-dialog">
      <button class="dialog-close" id="dialog-close" aria-label="Cerrar">×</button>
      <span class="eyebrow">MEDIAWORLD · PRIMERA EDICIÓN</span>
      <h2>El paisaje audiovisual, sobre un solo mundo.</h2>
      <p>MediaWorld es un atlas visual de cadenas de radio y televisión. Acércate desde el planeta hasta una región, ciudad o barrio; selecciona una señal y decide tú cuándo reproducirla.</p>
      <div class="dialog-grid">
        <div><strong>Planeta 3D de CAMS</strong><span>Proyección esférica, satélite, relieve y zoom cartográfico hasta calle.</span></div>
        <div><strong>Catálogo SQLite</strong><span>La base de datos se consulta localmente en tu navegador.</span></div>
        <div><strong>Reproducción manual</strong><span>Ninguna emisora se inicia al pasar por encima o seleccionarla.</span></div>
        <div><strong>Modos cartográficos</strong><span>Satélite por defecto, mapa con carreteras y presentación de relieve.</span></div>
      </div>
      <p class="dialog-note">Las entradas marcadas como “catalogadas” están preparadas para enriquecerse y verificar su emisión en próximas iteraciones.</p>
    </dialog>
  </main>`;

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}`);
  return element as T;
};

const searchInput = byId<HTMLInputElement>("search-input");
const stationList = byId<HTMLDivElement>("station-list");
const stationCard = byId<HTMLElement>("station-card");
const playButton = byId<HTMLButtonElement>("play-button");
const audio = byId<HTMLAudioElement>("audio");
const video = byId<HTMLVideoElement>("video");
const videoWindow = byId<HTMLElement>("video-window");
const livePill = byId<HTMLElement>("live-pill");
const playerLogo = byId<HTMLElement>("player-logo");
const playerTitle = byId<HTMLElement>("player-title");
const playerPlace = byId<HTMLElement>("player-place");
const playerKicker = byId<HTMLElement>("player-kicker");

let stations: Station[] = [];
let selected: Station | null = null;
let selectedIndex = -1;
let enabledTypes = new Set<MediaType>(["radio", "tv"]);
let hls: Hls | null = null;
let isPlaying = false;
type MapMode = "satellite" | "political" | "relief";
let currentMapMode: MapMode = "satellite";
let map: maplibregl.Map | null = null;
let mapReady = false;

const POLITICAL_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const RELIEF_TILES = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";
const TERRAIN_TILEJSON = "https://tiles.mapterhorn.com/tilejson.json";
const PLACES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson";

function createBaseMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      political: {
        type: "raster",
        tiles: [POLITICAL_TILES],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors"
      }
    },
    layers: [
      { id: "space", type: "background", paint: { "background-color": "#010205" } },
      {
        id: "political-base", type: "raster", source: "political", minzoom: 0, maxzoom: 24,
        layout: { visibility: "none" },
        paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 80, "raster-saturation": -.12, "raster-contrast": .08 }
      }
    ]
  };
}

const stationToFeature = (station: Station): GeoJSON.Feature<GeoJSON.Point> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [station.longitude, station.latitude] },
  properties: { id: station.id, mediaType: station.mediaType, name: station.name, geoPrecision: station.geoPrecision }
});

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] || character);
}

function safeUrl(value: string): string {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : "#"; } catch { return "#"; }
}

function filteredStations(): Station[] {
  const query = searchInput.value.trim().toLocaleLowerCase("es");
  return stations.filter((station) => {
    const matchesType = enabledTypes.has(station.mediaType);
    const haystack = `${station.name} ${station.city} ${station.region} ${station.country} ${station.language}`.toLocaleLowerCase("es");
    return matchesType && (!query || haystack.includes(query));
  });
}

function visibleStations(items: Station[]): Station[] {
  if (searchInput.value.trim()) return items;
  if (!map || !mapReady) return items;
  const bounds = map.getBounds();
  const visible = items.filter((station) => bounds.contains([station.longitude, station.latitude]));
  return visible.length ? visible : items;
}

function updateMapData(items: Station[]): void {
  if (!map) return;
  const source = map.getSource("stations") as GeoJSONSource | undefined;
  source?.setData({ type: "FeatureCollection", features: items.map(stationToFeature) });
}

function renderList(): void {
  const filtered = filteredStations();
  const items = visibleStations(filtered).slice(0, 60);
  byId("result-count").textContent = `${items.length} ${items.length === 1 ? "resultado" : "resultados"}`;
  byId("result-title").textContent = searchInput.value.trim() ? "Resultados de búsqueda" : "Emisoras visibles";
  stationList.innerHTML = items.length ? items.map((station) => `
    <button class="station-row ${selected?.id === station.id ? "is-selected" : ""}" data-station-id="${station.id}">
      <span class="station-row__icon ${station.mediaType}">${station.mediaType === "radio" ? "◉" : "▣"}</span>
      <span><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml(station.city)} · ${escapeHtml(station.country)}</small></span>
      <i class="${station.streamUrl ? "available" : "catalogued"}" title="${station.streamUrl ? "Emisión disponible" : "Ficha catalogada"}"></i>
    </button>`).join("") : `<div class="empty-state"><span>◎</span><strong>Sin señales aquí</strong><p>Prueba otra búsqueda o aléjate en el mapa.</p></div>`;
  updateMapData(filtered);
}

function showStation(station: Station, fly = false): void {
  selected = station;
  selectedIndex = stations.findIndex((item) => item.id === station.id);
  stationCard.hidden = false;
  stationCard.innerHTML = `
    <button class="station-card__close" id="station-card-close" aria-label="Cerrar">×</button>
    <div class="station-card__head"><span class="station-logo ${station.mediaType}">${escapeHtml(initials(station.name))}</span><div><small>${station.mediaType === "radio" ? "RADIO" : "TELEVISIÓN"} · ${escapeHtml(station.scope.toUpperCase())}</small><h2>${escapeHtml(station.name)}</h2><p>${escapeHtml(station.city)}, ${escapeHtml(station.region)} · ${escapeHtml(station.country)}</p></div></div>
    <p class="station-card__description">${escapeHtml(station.description)}</p>
    <div class="station-card__meta"><span><small>IDIOMA</small>${escapeHtml(station.language)}</span><span><small>ESTADO</small>${station.streamUrl ? "Emisión disponible" : "Catalogada"}</span></div>
    <div class="station-card__actions">
      <button class="primary-action" id="card-play" ${station.streamUrl ? "" : "disabled"}>${station.streamUrl ? "▶ Reproducir" : "Emisión pendiente"}</button>
      <a href="${safeUrl(station.websiteUrl)}" target="_blank" rel="noreferrer" title="Abrir sitio oficial">↗</a>
    </div>`;
  byId("station-card-close").addEventListener("click", () => { stationCard.hidden = true; });
  byId<HTMLButtonElement>("card-play").addEventListener("click", () => void startPlayback());
  playerLogo.textContent = initials(station.name);
  playerLogo.className = `station-logo ${station.mediaType}`;
  playerKicker.textContent = station.mediaType === "radio" ? "RADIO SELECCIONADA" : "TELEVISIÓN SELECCIONADA";
  playerTitle.textContent = station.name;
  playerPlace.textContent = `${station.city} · ${station.country}`;
  playButton.disabled = !station.streamUrl;
  playButton.title = station.streamUrl ? "Reproducir" : "Esta ficha todavía no tiene emisión verificada";
  livePill.textContent = station.streamUrl ? "LISTO" : "CATALOGADA";
  stopMedia();
  if (fly && map) map.flyTo({ center: [station.longitude, station.latitude], zoom: Math.max(map.getZoom(), 10), pitch: 35, duration: 1400 });
  renderList();
}

function stopMedia(): void {
  audio.pause(); video.pause();
  audio.removeAttribute("src"); video.removeAttribute("src");
  hls?.destroy(); hls = null;
  isPlaying = false;
  playButton.innerHTML = "<span>▶</span>";
  videoWindow.hidden = true;
}

async function startPlayback(): Promise<void> {
  if (!selected?.streamUrl) return;
  if (isPlaying) {
    audio.pause(); video.pause(); isPlaying = false;
    playButton.innerHTML = "<span>▶</span>"; livePill.textContent = "PAUSA";
    return;
  }
  const media = selected.mediaType === "tv" ? video : audio;
  if (!media.src && !hls) {
    if (selected.streamFormat === "hls" && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(selected.streamUrl); hls.attachMedia(media);
    } else {
      media.src = selected.streamUrl;
    }
  }
  if (selected.mediaType === "tv") videoWindow.hidden = false;
  try {
    await media.play(); isPlaying = true;
    playButton.innerHTML = "<span>Ⅱ</span>"; livePill.textContent = "EN DIRECTO";
  } catch {
    livePill.textContent = "NO DISPONIBLE";
  }
}

function selectRelative(direction: number): void {
  if (!stations.length) return;
  let index = selectedIndex;
  for (let attempts = 0; attempts < stations.length; attempts += 1) {
    index = (index + direction + stations.length) % stations.length;
    if (enabledTypes.has(stations[index].mediaType)) { showStation(stations[index], true); break; }
  }
}

function applyTheme(): void {
  const isLight = document.documentElement.classList.toggle("light-theme");
  localStorage.setItem("mediaworld-theme", isLight ? "light" : "dark");
}

function addBaseLayers(activeMap: maplibregl.Map): void {
  if (!activeMap.getSource("satellite")) activeMap.addSource("satellite", {
    type: "raster", tiles: [SATELLITE_TILES], tileSize: 256, minzoom: 0, maxzoom: 19,
    attribution: "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community"
  });
  if (!activeMap.getLayer("satellite-base")) activeMap.addLayer({
    id: "satellite-base", type: "raster", source: "satellite", minzoom: 0, maxzoom: 24,
    layout: { visibility: "visible" },
    paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 80, "raster-contrast": .05, "raster-saturation": .04 }
  });
  if (!activeMap.getSource("relief")) activeMap.addSource("relief", {
    type: "raster", tiles: [RELIEF_TILES], tileSize: 256, minzoom: 0, maxzoom: 17,
    attribution: "Map data © OpenStreetMap contributors · SRTM · OpenTopoMap"
  });
  if (!activeMap.getLayer("relief-base")) activeMap.addLayer({
    id: "relief-base", type: "raster", source: "relief", minzoom: 0, maxzoom: 24,
    layout: { visibility: "none" },
    paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 100, "raster-saturation": -.06, "raster-contrast": .07 }
  });
  if (!activeMap.getSource("terrain-dem")) activeMap.addSource("terrain-dem", { type: "raster-dem", url: TERRAIN_TILEJSON });
  if (!activeMap.getSource("hillshade-dem")) activeMap.addSource("hillshade-dem", { type: "raster-dem", url: TERRAIN_TILEJSON });
  if (!activeMap.getLayer("terrain-hillshade")) activeMap.addLayer({
    id: "terrain-hillshade", type: "hillshade", source: "hillshade-dem", layout: { visibility: "none" },
    paint: { "hillshade-shadow-color": "#172231", "hillshade-highlight-color": "#f4e8c8", "hillshade-accent-color": "#42546a", "hillshade-exaggeration": .55 }
  });
}

function applyMapMode(activeMap: maplibregl.Map, mode: MapMode): void {
  activeMap.setLayoutProperty("satellite-base", "visibility", mode === "satellite" ? "visible" : "none");
  activeMap.setLayoutProperty("political-base", "visibility", mode === "political" ? "visible" : "none");
  activeMap.setLayoutProperty("relief-base", "visibility", mode === "relief" ? "visible" : "none");
  activeMap.setLayoutProperty("terrain-hillshade", "visibility", mode === "relief" ? "visible" : "none");
  try { activeMap.setTerrain({ source: "terrain-dem", exaggeration: mode === "relief" ? 1.2 : 1.08 }); } catch { /* La esfera sigue disponible sin elevación. */ }
}

function addPlaces(activeMap: maplibregl.Map): void {
  if (!activeMap.getSource("places")) activeMap.addSource("places", { type: "geojson", data: PLACES_URL, attribution: "Localidades © Natural Earth" });
  if (!activeMap.getLayer("place-labels")) activeMap.addLayer({
    id: "place-labels", type: "symbol", source: "places", minzoom: 2.2, maxzoom: 24,
    filter: ["<=", ["to-number", ["get", "scalerank"]], 7],
    layout: {
      "text-field": ["coalesce", ["get", "name"], ["get", "nameascii"]],
      "text-font": ["Open Sans Regular"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 12, 12, 15],
      "text-allow-overlap": false
    },
    paint: { "text-color": "#f7f9ff", "text-halo-color": "rgba(0,0,0,.94)", "text-halo-width": 1.6 }
  });
}

function installStationLayers(): void {
  const activeMap = map;
  if (!activeMap || !mapReady || activeMap.getSource("stations")) return;
  activeMap.addSource("stations", {
    type: "geojson",
    data: { type: "FeatureCollection", features: filteredStations().map(stationToFeature) },
    cluster: false
  });
  activeMap.addLayer({
    id: "station-points",
    type: "circle",
    source: "stations",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], .25, 1.25, 4, 1.8, 8, 2.8, 12, 4.6, 18, 6.2],
      "circle-color": ["match", ["get", "mediaType"], "radio", "#20e3cf", "#ff5f8d"],
      "circle-stroke-color": "rgba(2,7,13,.92)",
      "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1, 0.35, 10, 1.2],
      "circle-opacity": ["match", ["get", "geoPrecision"], "country", 0.48, 0.92]
    }
  });
  activeMap.addLayer({
    id: "station-labels",
    type: "symbol",
    source: "stations",
    minzoom: 11,
    layout: {
      "text-field": ["get", "name"],
      "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 16, 12],
      "text-offset": [0, 1.15],
      "text-anchor": "top",
      "text-optional": true,
      "text-allow-overlap": false
    },
    paint: { "text-color": "#ffffff", "text-halo-color": "rgba(2,7,13,.95)", "text-halo-width": 1.7 }
  });
  renderList();
}

function initializeMap(): void {
  const status = byId<HTMLElement>("map-engine-status");
  try {
    map = new maplibregl.Map({
      container: "map", style: createBaseMapStyle(), center: [2, 30], zoom: 1.2,
      minZoom: .25, maxZoom: 22, maxPitch: 85, pitch: 0, bearing: 0,
      renderWorldCopies: false, attributionControl: false, cooperativeGestures: false, fadeDuration: 100
    });
  } catch (error) {
    status.textContent = `Motor 3D no disponible: ${error instanceof Error ? error.message : "error WebGL"}`;
    status.classList.add("is-error");
    return;
  }
  const activeMap = map;
  activeMap.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
  activeMap.scrollZoom.setWheelZoomRate(1 / 260);
  activeMap.touchZoomRotate.enable();
  let booted = false;
  const bootMap = () => {
    if (booted || !activeMap.isStyleLoaded()) return;
    booted = true;
    try {
      activeMap.setProjection({ type: "globe" });
      addBaseLayers(activeMap);
      applyMapMode(activeMap, currentMapMode);
      addPlaces(activeMap);
      mapReady = true;
      installStationLayers();
      activeMap.on("click", "station-points", (event: MapLayerMouseEvent) => {
        const id = Number(event.features?.[0]?.properties?.id);
        const station = stations.find((item) => item.id === id);
        if (station) showStation(station);
      });
      activeMap.on("mouseenter", "station-points", () => { activeMap.getCanvas().style.cursor = "pointer"; });
      activeMap.on("mouseleave", "station-points", () => { activeMap.getCanvas().style.cursor = ""; });
      status.textContent = "Esfera 3D · Satélite";
      status.classList.add("is-ready");
      activeMap.resize();
    } catch (error) {
      status.textContent = `No se pudo activar la esfera 3D: ${error instanceof Error ? error.message : "error cartográfico"}`;
      status.classList.add("is-error");
    }
  };
  activeMap.on("style.load", bootMap);
  activeMap.on("load", bootMap);
  activeMap.on("styledata", bootMap);
  window.setTimeout(bootMap, 0);
  window.setTimeout(bootMap, 250);
  window.setTimeout(bootMap, 1000);
  activeMap.on("moveend", renderList);
}

stationList.addEventListener("click", (event) => {
  const row = (event.target as HTMLElement).closest<HTMLElement>("[data-station-id]");
  if (!row) return;
  const station = stations.find((item) => item.id === Number(row.dataset.stationId));
  if (station) showStation(station, true);
});
searchInput.addEventListener("input", renderList);
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.focus(); }
  if (event.key === "Escape") { searchInput.value = ""; searchInput.blur(); renderList(); }
});
document.querySelectorAll<HTMLButtonElement>(".media-tab[data-type]").forEach((button) => button.addEventListener("click", () => {
  const type = button.dataset.type;
  if (type === "all") {
    const allEnabled = enabledTypes.size === 2;
    enabledTypes = allEnabled ? new Set() : new Set(["radio", "tv"]);
  } else if (type === "radio" || type === "tv") {
    enabledTypes.has(type) ? enabledTypes.delete(type) : enabledTypes.add(type);
  }
  document.querySelector<HTMLButtonElement>('[data-type="all"]')?.classList.toggle("is-active", enabledTypes.size === 2);
  document.querySelector<HTMLButtonElement>('[data-type="radio"]')?.classList.toggle("is-active", enabledTypes.has("radio"));
  document.querySelector<HTMLButtonElement>('[data-type="tv"]')?.classList.toggle("is-active", enabledTypes.has("tv"));
  renderList();
}));
byId("home-button").addEventListener("click", () => map?.flyTo({ center: [2, 30], zoom: 1.2, pitch: 0, bearing: 0 }));
byId("reset-button").addEventListener("click", () => { searchInput.value = ""; enabledTypes = new Set(["radio", "tv"]); document.querySelectorAll(".media-tab").forEach((tab) => tab.classList.add("is-active")); renderList(); });
byId("zoom-in").addEventListener("click", () => map?.zoomIn());
byId("zoom-out").addEventListener("click", () => map?.zoomOut());
byId("reset-bearing").addEventListener("click", () => map?.easeTo({ bearing: 0, pitch: 0 }));
byId<HTMLSelectElement>("map-mode").addEventListener("change", (event) => {
  currentMapMode = (event.target as HTMLSelectElement).value as MapMode;
  if (map && mapReady) {
    applyMapMode(map, currentMapMode);
    const label = { satellite: "Satélite", political: "Mapa / carreteras", relief: "Relieve" }[currentMapMode];
    byId("map-engine-status").textContent = `Esfera 3D · ${label}`;
  }
});
byId("theme-button").addEventListener("click", applyTheme);
byId("collapse-button").addEventListener("click", () => document.querySelector(".explorer")?.classList.toggle("is-collapsed"));
byId("locate-button").addEventListener("click", () => navigator.geolocation?.getCurrentPosition((position) => map?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14, pitch: 45 })));
playButton.addEventListener("click", () => void startPlayback());
byId("previous-button").addEventListener("click", () => selectRelative(-1));
byId("next-button").addEventListener("click", () => selectRelative(1));
byId("close-video").addEventListener("click", () => { video.pause(); videoWindow.hidden = true; isPlaying = false; playButton.innerHTML = "<span>▶</span>"; });
byId<HTMLInputElement>("volume").addEventListener("input", (event) => { const volume = Number((event.target as HTMLInputElement).value); audio.volume = volume; video.volume = volume; });
const aboutDialog = byId<HTMLDialogElement>("about-dialog");
byId("about-button").addEventListener("click", () => aboutDialog.showModal());
byId("dialog-close").addEventListener("click", () => aboutDialog.close());

async function boot(): Promise<void> {
  try {
    const catalog = await loadCatalog();
    stations = catalog.stations;
    showStats(catalog.stats);
    if (map?.loaded() && mapReady) installStationLayers();
    renderList();
  } catch (error) {
    byId("catalog-status").innerHTML = `<span class="error-dot"></span> Catálogo no disponible`;
    stationList.innerHTML = `<div class="empty-state"><strong>No se pudo abrir SQLite</strong><p>${error instanceof Error ? error.message : "Error desconocido"}</p></div>`;
  }
}

function showStats(stats: CatalogStats): void {
  byId("all-count").textContent = String(stats.total);
  byId("radio-count").textContent = String(stats.radio);
  byId("tv-count").textContent = String(stats.tv);
  byId("catalog-status").innerHTML = `<span class="pulse"></span> ${stats.countries} países · ${stats.playable} señales listas`;
}

if (localStorage.getItem("mediaworld-theme") === "light") {
  document.documentElement.classList.add("light-theme");
}
initializeMap();
void boot();
