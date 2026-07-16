import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from "maplibre-gl";
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
        <div><strong>Globo vectorial</strong><span>Países, regiones, ciudades y barrios aparecen progresivamente con el zoom.</span></div>
        <div><strong>Catálogo SQLite</strong><span>La base de datos se consulta localmente en tu navegador.</span></div>
        <div><strong>Reproducción manual</strong><span>Ninguna emisora se inicia al pasar por encima o seleccionarla.</span></div>
        <div><strong>Fuentes abiertas</strong><span>Cartografía basada en OpenStreetMap y OpenFreeMap.</span></div>
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

const map = new maplibregl.Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [8, 25],
  zoom: 1.55,
  minZoom: 1.15,
  maxZoom: 19,
  pitch: 0,
  attributionControl: false,
  renderWorldCopies: false
});
map.setProjection({ type: "globe" });
map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

const stationToFeature = (station: Station): GeoJSON.Feature<GeoJSON.Point> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [station.longitude, station.latitude] },
  properties: { id: station.id, mediaType: station.mediaType, name: station.name }
});

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
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
  const bounds = map.getBounds();
  const visible = items.filter((station) => bounds.contains([station.longitude, station.latitude]));
  return visible.length ? visible : items;
}

function updateMapData(items: Station[]): void {
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
      <span><strong>${station.name}</strong><small>${station.city} · ${station.country}</small></span>
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
    <div class="station-card__head"><span class="station-logo ${station.mediaType}">${initials(station.name)}</span><div><small>${station.mediaType === "radio" ? "RADIO" : "TELEVISIÓN"} · ${station.scope.toUpperCase()}</small><h2>${station.name}</h2><p>${station.city}, ${station.region} · ${station.country}</p></div></div>
    <p class="station-card__description">${station.description}</p>
    <div class="station-card__meta"><span><small>IDIOMA</small>${station.language}</span><span><small>ESTADO</small>${station.streamUrl ? "Emisión disponible" : "Catalogada"}</span></div>
    <div class="station-card__actions">
      <button class="primary-action" id="card-play" ${station.streamUrl ? "" : "disabled"}>${station.streamUrl ? "▶ Reproducir" : "Emisión pendiente"}</button>
      <a href="${station.websiteUrl}" target="_blank" rel="noreferrer" title="Abrir sitio oficial">↗</a>
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
  if (fly) map.flyTo({ center: [station.longitude, station.latitude], zoom: Math.max(map.getZoom(), 6), duration: 1400 });
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
  map.setStyle(isLight ? "https://tiles.openfreemap.org/styles/positron" : "https://tiles.openfreemap.org/styles/liberty");
  map.once("style.load", installStationLayers);
}

function installStationLayers(): void {
  if (map.getSource("stations")) return;
  map.addSource("stations", {
    type: "geojson",
    data: { type: "FeatureCollection", features: filteredStations().map(stationToFeature) },
    cluster: true,
    clusterMaxZoom: 11,
    clusterRadius: 42
  });
  map.addLayer({ id: "station-clusters-halo", type: "circle", source: "stations", filter: ["has", "point_count"], paint: { "circle-color": "rgba(8,18,31,.7)", "circle-radius": ["step", ["get", "point_count"], 20, 10, 26, 30, 34], "circle-stroke-color": "rgba(255,255,255,.38)", "circle-stroke-width": 1 } });
  map.addLayer({ id: "station-clusters", type: "symbol", source: "stations", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#ffffff" } });
  map.addLayer({ id: "station-points", type: "circle", source: "stations", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 1, 5, 8, 8, 14, 11], "circle-color": ["match", ["get", "mediaType"], "radio", "#23d6c7", "#ff668f"], "circle-stroke-color": "rgba(5,14,25,.9)", "circle-stroke-width": 2, "circle-opacity": 0.95 } });
  map.addLayer({ id: "station-labels", type: "symbol", source: "stations", minzoom: 5.5, filter: ["!", ["has", "point_count"]], layout: { "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.4], "text-anchor": "top", "text-optional": true }, paint: { "text-color": "#ffffff", "text-halo-color": "rgba(4,12,22,.9)", "text-halo-width": 1.5 } });
  renderList();
}

map.on("load", () => {
  installStationLayers();
});
map.on("moveend", renderList);
map.on("click", "station-points", (event: MapLayerMouseEvent) => {
  const id = Number(event.features?.[0]?.properties?.id);
  const station = stations.find((item) => item.id === id);
  if (station) showStation(station);
});
map.on("click", "station-clusters-halo", (event: MapLayerMouseEvent) => {
  const feature = map.queryRenderedFeatures(event.point, { layers: ["station-clusters-halo"] })[0];
  const clusterId = Number(feature?.properties?.cluster_id);
  const source = map.getSource("stations") as GeoJSONSource;
  void source.getClusterExpansionZoom(clusterId).then((zoom) => map.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom }));
});
for (const layer of ["station-points", "station-clusters-halo"]) {
  map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
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
byId("home-button").addEventListener("click", () => map.flyTo({ center: [8, 25], zoom: 1.55, pitch: 0, bearing: 0 }));
byId("reset-button").addEventListener("click", () => { searchInput.value = ""; enabledTypes = new Set(["radio", "tv"]); document.querySelectorAll(".media-tab").forEach((tab) => tab.classList.add("is-active")); renderList(); });
byId("zoom-in").addEventListener("click", () => map.zoomIn());
byId("zoom-out").addEventListener("click", () => map.zoomOut());
byId("reset-bearing").addEventListener("click", () => map.easeTo({ bearing: 0, pitch: 0 }));
byId("theme-button").addEventListener("click", applyTheme);
byId("collapse-button").addEventListener("click", () => document.querySelector(".explorer")?.classList.toggle("is-collapsed"));
byId("locate-button").addEventListener("click", () => navigator.geolocation?.getCurrentPosition((position) => map.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 10 })));
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
    if (map.loaded()) installStationLayers();
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

if (localStorage.getItem("mediaworld-theme") === "light") document.documentElement.classList.add("light-theme");
void boot();
