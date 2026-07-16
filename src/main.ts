import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent, type StyleSpecification } from "maplibre-gl";
import Hls from "hls.js";
import { loadCatalog } from "./db";
import type { CatalogStats, MediaType, Station } from "./types";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("No se encontró el contenedor de la aplicación");

const icon = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

app.innerHTML = `
  <main class="shell" data-view="map">
    <div id="map" aria-label="Globo terráqueo interactivo"></div>

    <nav class="tool-dock glass" aria-label="Herramientas de MediaWorld">
      <button class="dock-button" id="filter-button" aria-label="Abrir filtros" aria-expanded="false" title="Filtros">
        ${icon('<path d="M4 5h16l-6.2 7.1v5.1l-3.6 1.8v-6.9L4 5Z"/>')}
        <span class="active-filter-dot" id="active-filter-dot" hidden></span>
      </button>
      <button class="dock-button" id="layers-button" aria-label="Abrir capas" aria-expanded="false" title="Capas">
        ${icon('<path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/>')}
      </button>
      <button class="dock-button" id="theme-button" aria-label="Elegir tema" aria-expanded="false" title="Tema">
        ${icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>')}
      </button>
      <button class="dock-button is-active" id="player-toggle" aria-label="Ocultar reproductor" aria-pressed="true" title="Reproductor">
        ${icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/>')}
      </button>
      <button class="dock-button" id="catalog-toggle" aria-label="Abrir catálogo completo" aria-pressed="false" title="Catálogo completo">
        ${icon('<path d="M4 5h4v4H4V5ZM4 15h4v4H4v-4ZM11 6h9M11 17h9"/>')}
      </button>
    </nav>

    <aside class="tool-panel filter-panel glass" id="filter-panel" aria-label="Filtros" hidden>
      <header class="panel-heading">
        <div><span class="eyebrow">EXPLORAR</span><h2>Filtrar señales</h2></div>
        <button class="panel-close" data-close-panel aria-label="Cerrar filtros">×</button>
      </header>
      <label class="searchbox">
        ${icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>')}
        <input id="search-input" type="search" placeholder="País, ciudad o emisora…" autocomplete="off" />
        <kbd>⌘ K</kbd>
      </label>
      <div class="media-tabs" role="group" aria-label="Tipo de contenido">
        <button class="media-tab is-active" data-type="all"><span class="all-dot"></span> Todo <b id="all-count">0</b></button>
        <button class="media-tab is-active" data-type="radio"><span class="radio-dot"></span> Radio <b id="radio-count">0</b></button>
        <button class="media-tab is-active" data-type="tv"><span class="tv-dot"></span> TV <b id="tv-count">0</b></button>
      </div>
      <div class="filter-grid">
        <label><span>País</span><select id="country-filter"><option value="">Todos</option></select></label>
        <label><span>Región</span><select id="region-filter" disabled><option value="">Todas</option></select></label>
        <label><span>Emisión</span><select id="availability-filter"><option value="all">Todas</option><option value="playable">Reproducibles</option><option value="catalogued">Solo ficha</option></select></label>
        <label><span>Ubicación</span><select id="location-filter"><option value="all">Todas</option><option value="mapped">Con punto</option><option value="unmapped">Sin coordenadas</option></select></label>
      </div>
      <div class="filter-summary">
        <span id="catalog-status"><i class="pulse"></i> Cargando catálogo…</span>
        <strong id="result-count">0 resultados</strong>
      </div>
      <button class="secondary-action" id="reset-button">Restablecer filtros</button>
    </aside>

    <aside class="tool-panel layers-panel glass" id="layers-panel" aria-label="Capas del mapa" hidden>
      <header class="panel-heading">
        <div><span class="eyebrow">CARTOGRAFÍA</span><h2>Capas del mundo</h2></div>
        <button class="panel-close" data-close-panel aria-label="Cerrar capas">×</button>
      </header>
      <div class="map-options" role="radiogroup" aria-label="Presentación del mapamundi">
        <button class="map-option is-active" data-map-mode="satellite"><span class="map-swatch satellite"></span><span><strong>Satélite 3D</strong><small>Imagen real y relieve</small></span><i></i></button>
        <button class="map-option" data-map-mode="boundaries"><span class="map-swatch boundaries"></span><span><strong>Político plano</strong><small>Fronteras y países</small></span><i></i></button>
        <button class="map-option" data-map-mode="political"><span class="map-swatch roads"></span><span><strong>Mapa normal</strong><small>Carreteras y localidades</small></span><i></i></button>
        <button class="map-option" data-map-mode="relief"><span class="map-swatch relief"></span><span><strong>Relieve</strong><small>Topografía y terreno</small></span><i></i></button>
      </div>
      <label class="switch-row" id="labels-row">
        <span><strong>Nombres geográficos</strong><small id="labels-help">Países, ciudades y territorios</small></span>
        <input id="labels-toggle" type="checkbox" checked /><i></i>
      </label>
      <div class="panel-actions">
        <button id="home-button">Vista mundial</button><button id="locate-button">Mi ubicación</button>
      </div>
    </aside>

    <aside class="tool-panel theme-panel glass" id="theme-panel" aria-label="Tema visual" hidden>
      <header class="panel-heading">
        <div><span class="eyebrow">APARIENCIA</span><h2>Tema visual</h2></div>
        <button class="panel-close" data-close-panel aria-label="Cerrar tema">×</button>
      </header>
      <div class="theme-options">
        <button class="theme-option is-active" data-theme-mode="auto"><span>◐</span><strong>Automático</strong><small>Sigue la luz solar local</small></button>
        <button class="theme-option" data-theme-mode="day"><span>☀</span><strong>Día</strong><small>Hueso cálido</small></button>
        <button class="theme-option" data-theme-mode="night"><span>☾</span><strong>Noche</strong><small>Azul profundo</small></button>
      </div>
      <p class="panel-note" id="theme-note">Calculando la luz de tu ubicación…</p>
    </aside>

    <section class="catalog-view" id="catalog-view" hidden>
      <header class="catalog-heading">
        <div><span class="eyebrow">ATLAS AUDIOVISUAL</span><h1>Catálogo mundial</h1><p>Todas las señales, también las que todavía no tienen coordenadas.</p></div>
        <div class="catalog-total"><strong id="catalog-result-count">0</strong><span>fichas</span></div>
      </header>
      <div class="catalog-grid" id="catalog-grid"></div>
      <button class="load-more" id="catalog-more" hidden>Mostrar más fichas</button>
      <div class="catalog-empty" id="catalog-empty" hidden><span>◎</span><strong>No hay coincidencias</strong><p>Prueba a cambiar los filtros.</p></div>
    </section>

    <section class="station-card glass" id="station-card" aria-live="polite" hidden></section>

    <div class="map-tools glass" aria-label="Controles del mapa">
      <button id="zoom-in" aria-label="Acercar">+</button><button id="zoom-out" aria-label="Alejar">−</button>
      <hr /><button id="reset-bearing" aria-label="Orientar al norte">N</button>
    </div>
    <div class="map-error glass" id="map-error" role="alert" hidden></div>

    <section class="video-window glass" id="video-window" hidden>
      <div class="video-window__head"><span>EMISIÓN EN DIRECTO</span><button id="close-video" aria-label="Cerrar vídeo">×</button></div>
      <video id="video" playsinline></video>
    </section>

    <footer class="player glass" id="player">
      <div class="now-playing">
        <div class="station-logo is-empty" id="player-logo">MW</div>
        <div><small id="player-kicker">NINGUNA SEÑAL SELECCIONADA</small><strong id="player-title">Explora el mundo para empezar</strong><span id="player-place">La reproducción siempre es manual</span></div>
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
  </main>`;

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id}`);
  return element as T;
};

const shell = document.querySelector<HTMLElement>(".shell")!;
const searchInput = byId<HTMLInputElement>("search-input");
const stationCard = byId<HTMLElement>("station-card");
const catalogView = byId<HTMLElement>("catalog-view");
const catalogGrid = byId<HTMLElement>("catalog-grid");
const catalogMore = byId<HTMLButtonElement>("catalog-more");
const playButton = byId<HTMLButtonElement>("play-button");
const player = byId<HTMLElement>("player");
const audio = byId<HTMLAudioElement>("audio");
const video = byId<HTMLVideoElement>("video");
const videoWindow = byId<HTMLElement>("video-window");
const livePill = byId<HTMLElement>("live-pill");
const playerLogo = byId<HTMLElement>("player-logo");
const playerTitle = byId<HTMLElement>("player-title");
const playerPlace = byId<HTMLElement>("player-place");
const playerKicker = byId<HTMLElement>("player-kicker");
const countryFilter = byId<HTMLSelectElement>("country-filter");
const regionFilter = byId<HTMLSelectElement>("region-filter");
const availabilityFilter = byId<HTMLSelectElement>("availability-filter");
const locationFilter = byId<HTMLSelectElement>("location-filter");
const labelsToggle = byId<HTMLInputElement>("labels-toggle");

let stations: Station[] = [];
let selected: Station | null = null;
let selectedIndex = -1;
let enabledTypes = new Set<MediaType>(["radio", "tv"]);
let hls: Hls | null = null;
let isPlaying = false;
let playerVisible = true;
let currentView: "map" | "catalog" = "map";
let catalogRenderLimit = 240;
type MapMode = "satellite" | "boundaries" | "political" | "relief";
let currentMapMode: MapMode = "satellite";
let showGeographicLabels = true;
let map: maplibregl.Map | null = null;
let mapReady = false;
type ThemeMode = "auto" | "day" | "night";
let themeMode: ThemeMode = "auto";
let userCoordinates: { latitude: number; longitude: number } | null = null;
let geolocationRequested = false;

const POLITICAL_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const SATELLITE_TILES = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const RELIEF_TILES = "https://a.tile.opentopomap.org/{z}/{x}/{y}.png";
const TERRAIN_TILEJSON = "https://tiles.mapterhorn.com/tilejson.json";
const PLACES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places_simple.geojson";
const COUNTRIES_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";

function createBaseMapStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      political: { type: "raster", tiles: [POLITICAL_TILES], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: "© OpenStreetMap contributors" }
    },
    layers: [
      { id: "space", type: "background", paint: { "background-color": "#010205" } },
      { id: "political-base", type: "raster", source: "political", minzoom: 0, maxzoom: 24, layout: { visibility: "none" }, paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 80, "raster-saturation": -.12, "raster-contrast": .08 } }
    ]
  };
}

const stationToFeature = (station: Station): GeoJSON.Feature<GeoJSON.Point> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [station.longitude, station.latitude] },
  properties: { id: station.id, mediaType: station.mediaType, name: station.name, geoPrecision: station.geoPrecision }
});

const isMappable = (station: Station): boolean => station.geoPrecision !== "country";

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
    const matchesCountry = !countryFilter.value || station.country === countryFilter.value;
    const matchesRegion = !regionFilter.value || station.region === regionFilter.value || station.city === regionFilter.value;
    const matchesAvailability = availabilityFilter.value === "all" || (availabilityFilter.value === "playable" ? Boolean(station.streamUrl) : !station.streamUrl);
    const matchesLocation = locationFilter.value === "all" || (locationFilter.value === "mapped" ? isMappable(station) : !isMappable(station));
    const haystack = `${station.name} ${station.city} ${station.region} ${station.country} ${station.language} ${station.tags}`.toLocaleLowerCase("es");
    return matchesType && matchesCountry && matchesRegion && matchesAvailability && matchesLocation && (!query || haystack.includes(query));
  });
}

function hasActiveCatalogFilters(): boolean {
  return Boolean(searchInput.value.trim() || countryFilter.value || regionFilter.value || availabilityFilter.value !== "all" || locationFilter.value !== "all" || enabledTypes.size !== 2);
}

function updateMapData(items: Station[]): void {
  if (!map) return;
  const source = map.getSource("stations") as GeoJSONSource | undefined;
  source?.setData({ type: "FeatureCollection", features: items.filter(isMappable).map(stationToFeature) });
}

function stationCardMarkup(station: Station): string {
  const imageUrl = safeUrl(station.faviconUrl);
  const logo = imageUrl !== "#"
    ? `<img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.removeAttribute('hidden')"><span hidden>${escapeHtml(initials(station.name))}</span>`
    : `<span>${escapeHtml(initials(station.name))}</span>`;
  const tags = station.tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 3);
  return `
    <button class="catalog-card ${selected?.id === station.id ? "is-selected" : ""}" data-station-id="${station.id}">
      <span class="catalog-card__top"><span class="catalog-logo ${station.mediaType}">${logo}</span><i class="catalog-type ${station.mediaType}">${station.mediaType === "radio" ? "RADIO" : "TV"}</i></span>
      <span class="catalog-card__body"><strong>${escapeHtml(station.name)}</strong><small>${escapeHtml([station.city, station.region, station.country].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(" · "))}</small></span>
      <span class="catalog-card__tags">${tags.map((tag) => `<i>${escapeHtml(tag)}</i>`).join("") || `<i>${isMappable(station) ? "Geolocalizada" : "Sin coordenadas"}</i>`}</span>
      <span class="catalog-card__status ${station.streamUrl ? "is-playable" : ""}">${station.streamUrl ? "Emisión disponible" : "Ficha catalogada"}</span>
    </button>`;
}

function renderCatalog(items: Station[], reset = false): void {
  if (reset) {
    catalogRenderLimit = 240;
    catalogView.scrollTo({ top: 0 });
  }
  const visible = items.slice(0, catalogRenderLimit);
  byId("catalog-result-count").textContent = items.length.toLocaleString("es-ES");
  catalogGrid.innerHTML = visible.map(stationCardMarkup).join("");
  byId("catalog-empty").hidden = items.length > 0;
  catalogMore.hidden = visible.length >= items.length;
  catalogMore.textContent = `Mostrar más · ${Math.min(240, items.length - visible.length).toLocaleString("es-ES")}`;
}

function renderResults(resetCatalog = false): void {
  const filtered = filteredStations();
  byId("result-count").textContent = `${filtered.length.toLocaleString("es-ES")} ${filtered.length === 1 ? "resultado" : "resultados"}`;
  byId("active-filter-dot").hidden = !hasActiveCatalogFilters();
  updateMapData(filtered);
  if (currentView === "catalog") renderCatalog(filtered, resetCatalog);
}

function populateCountryFilter(): void {
  const countries = [...new Set(stations.map((station) => station.country))].sort((a, b) => a.localeCompare(b, "es"));
  countryFilter.innerHTML = `<option value="">Todos</option>${countries.map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join("")}`;
}

function updateRegionFilter(): void {
  const current = regionFilter.value;
  const regions = countryFilter.value
    ? [...new Set(stations.filter((station) => station.country === countryFilter.value).map((station) => station.region).filter((region) => region && region !== countryFilter.value))].sort((a, b) => a.localeCompare(b, "es"))
    : [];
  regionFilter.innerHTML = `<option value="">Todas</option>${regions.map((region) => `<option value="${escapeHtml(region)}">${escapeHtml(region)}</option>`).join("")}`;
  regionFilter.disabled = !countryFilter.value;
  if (regions.includes(current)) regionFilter.value = current;
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
  if (fly && map && isMappable(station)) map.flyTo({ center: [station.longitude, station.latitude], zoom: Math.max(map.getZoom(), 10), pitch: 35, duration: 1400 });
  renderResults();
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
  if (selected.mediaType === "tv" && playerVisible) videoWindow.hidden = false;
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

function closePanels(): void {
  document.querySelectorAll<HTMLElement>(".tool-panel").forEach((panel) => { panel.hidden = true; });
  ["filter-button", "layers-button", "theme-button"].forEach((id) => {
    const button = byId<HTMLButtonElement>(id);
    button.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  });
}

function togglePanel(panelId: string, buttonId: string): void {
  const panel = byId<HTMLElement>(panelId);
  const opening = panel.hidden;
  closePanels();
  if (opening) {
    panel.hidden = false;
    const button = byId<HTMLButtonElement>(buttonId);
    button.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
  }
}

function setView(view: "map" | "catalog"): void {
  currentView = view;
  shell.dataset.view = view;
  catalogView.hidden = view !== "catalog";
  const button = byId<HTMLButtonElement>("catalog-toggle");
  button.classList.toggle("is-active", view === "catalog");
  button.setAttribute("aria-pressed", String(view === "catalog"));
  button.setAttribute("aria-label", view === "catalog" ? "Volver al globo" : "Abrir catálogo completo");
  button.title = view === "catalog" ? "Volver al globo" : "Catálogo completo";
  stationCard.hidden = true;
  closePanels();
  if (view === "catalog") renderCatalog(filteredStations(), true);
  else window.setTimeout(() => map?.resize(), 0);
}

function isLabelsCompatible(mode: MapMode): boolean {
  return mode === "satellite" || mode === "boundaries";
}

function updateLabelsControl(): void {
  const compatible = isLabelsCompatible(currentMapMode);
  labelsToggle.disabled = !compatible;
  labelsToggle.checked = compatible && showGeographicLabels;
  byId("labels-row").classList.toggle("is-disabled", !compatible);
  byId("labels-help").textContent = compatible ? "Países, ciudades y territorios" : "Integrados en esta cartografía";
}

function addBaseLayers(activeMap: maplibregl.Map): void {
  if (!activeMap.getSource("satellite")) activeMap.addSource("satellite", { type: "raster", tiles: [SATELLITE_TILES], tileSize: 256, minzoom: 0, maxzoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community" });
  if (!activeMap.getLayer("satellite-base")) activeMap.addLayer({ id: "satellite-base", type: "raster", source: "satellite", minzoom: 0, maxzoom: 24, layout: { visibility: "visible" }, paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 80, "raster-contrast": .05, "raster-saturation": .04 } });
  if (!activeMap.getSource("relief")) activeMap.addSource("relief", { type: "raster", tiles: [RELIEF_TILES], tileSize: 256, minzoom: 0, maxzoom: 17, attribution: "Map data © OpenStreetMap contributors · SRTM · OpenTopoMap" });
  if (!activeMap.getLayer("relief-base")) activeMap.addLayer({ id: "relief-base", type: "raster", source: "relief", minzoom: 0, maxzoom: 24, layout: { visibility: "none" }, paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 100, "raster-saturation": -.06, "raster-contrast": .07 } });
  if (!activeMap.getSource("terrain-dem")) activeMap.addSource("terrain-dem", { type: "raster-dem", url: TERRAIN_TILEJSON });
  if (!activeMap.getSource("hillshade-dem")) activeMap.addSource("hillshade-dem", { type: "raster-dem", url: TERRAIN_TILEJSON });
  if (!activeMap.getLayer("terrain-hillshade")) activeMap.addLayer({ id: "terrain-hillshade", type: "hillshade", source: "hillshade-dem", layout: { visibility: "none" }, paint: { "hillshade-shadow-color": "#172231", "hillshade-highlight-color": "#f4e8c8", "hillshade-accent-color": "#42546a", "hillshade-exaggeration": .55 } });
  if (!activeMap.getSource("country-boundaries")) activeMap.addSource("country-boundaries", { type: "geojson", data: COUNTRIES_URL, attribution: "Fronteras © Natural Earth" });
  if (!activeMap.getLayer("boundaries-fill")) activeMap.addLayer({ id: "boundaries-fill", type: "fill", source: "country-boundaries", layout: { visibility: "none" }, paint: { "fill-color": "#172633", "fill-opacity": .98 } });
  if (!activeMap.getLayer("boundaries-line")) activeMap.addLayer({ id: "boundaries-line", type: "line", source: "country-boundaries", layout: { visibility: "none" }, paint: { "line-color": "#8ca4b6", "line-opacity": .82, "line-width": ["interpolate", ["linear"], ["zoom"], 0, .45, 5, 1, 10, 1.8] } });
  if (!activeMap.getLayer("country-labels")) activeMap.addLayer({
    id: "country-labels", type: "symbol", source: "country-boundaries", minzoom: 0, maxzoom: 8,
    layout: { visibility: "none", "text-field": ["coalesce", ["get", "NAME_ES"], ["get", "ADMIN"], ["get", "NAME"]], "text-font": ["Open Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 0, 8, 4, 12, 7, 15], "text-transform": "uppercase", "text-letter-spacing": .08, "text-allow-overlap": false },
    paint: { "text-color": "#dbe7ef", "text-halo-color": "rgba(8,18,27,.94)", "text-halo-width": 1.4 }
  });
}

function applyLabelVisibility(activeMap: maplibregl.Map): void {
  if (activeMap.getLayer("place-labels")) activeMap.setLayoutProperty("place-labels", "visibility", showGeographicLabels && currentMapMode === "satellite" ? "visible" : "none");
  if (activeMap.getLayer("country-labels")) activeMap.setLayoutProperty("country-labels", "visibility", showGeographicLabels && currentMapMode === "boundaries" ? "visible" : "none");
  updateLabelsControl();
}

function applyMapMode(activeMap: maplibregl.Map, mode: MapMode): void {
  activeMap.setLayoutProperty("satellite-base", "visibility", mode === "satellite" ? "visible" : "none");
  activeMap.setLayoutProperty("political-base", "visibility", mode === "political" ? "visible" : "none");
  activeMap.setLayoutProperty("relief-base", "visibility", mode === "relief" ? "visible" : "none");
  activeMap.setLayoutProperty("terrain-hillshade", "visibility", mode === "relief" ? "visible" : "none");
  activeMap.setLayoutProperty("boundaries-fill", "visibility", mode === "boundaries" ? "visible" : "none");
  activeMap.setLayoutProperty("boundaries-line", "visibility", mode === "boundaries" ? "visible" : "none");
  try { activeMap.setTerrain(mode === "boundaries" ? null : { source: "terrain-dem", exaggeration: mode === "relief" ? 1.2 : 1.08 }); } catch { /* El mapa sigue disponible sin elevación. */ }
  if (mode === "boundaries") activeMap.easeTo({ pitch: 0, duration: 450 });
  applyLabelVisibility(activeMap);
  document.querySelectorAll<HTMLElement>("[data-map-mode]").forEach((option) => option.classList.toggle("is-active", option.dataset.mapMode === mode));
}

function addPlaces(activeMap: maplibregl.Map): void {
  if (!activeMap.getSource("places")) activeMap.addSource("places", { type: "geojson", data: PLACES_URL, attribution: "Localidades © Natural Earth" });
  if (!activeMap.getLayer("place-labels")) activeMap.addLayer({
    id: "place-labels", type: "symbol", source: "places", minzoom: 2.2, maxzoom: 24,
    filter: ["<=", ["to-number", ["get", "scalerank"]], 7],
    layout: { "text-field": ["coalesce", ["get", "name"], ["get", "nameascii"]], "text-font": ["Open Sans Regular"], "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 6, 12, 12, 15], "text-allow-overlap": false },
    paint: { "text-color": "#f7f9ff", "text-halo-color": "rgba(0,0,0,.94)", "text-halo-width": 1.6 }
  });
}

function installStationLayers(): void {
  const activeMap = map;
  if (!activeMap || !mapReady || activeMap.getSource("stations")) return;
  activeMap.addSource("stations", { type: "geojson", data: { type: "FeatureCollection", features: filteredStations().filter(isMappable).map(stationToFeature) }, cluster: false });
  activeMap.addLayer({
    id: "station-points", type: "circle", source: "stations",
    paint: {
      "circle-radius": ["interpolate", ["linear"], ["zoom"], .25, 1.25, 4, 1.8, 8, 2.8, 12, 4.6, 18, 6.2],
      "circle-color": ["match", ["get", "mediaType"], "radio", "#20e3cf", "#ff5f8d"],
      "circle-stroke-color": "rgba(2,7,13,.92)", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 1, .35, 10, 1.2], "circle-opacity": .92
    }
  });
  activeMap.addLayer({
    id: "station-labels", type: "symbol", source: "stations", minzoom: 11,
    layout: { "text-field": ["get", "name"], "text-size": ["interpolate", ["linear"], ["zoom"], 11, 9, 16, 12], "text-offset": [0, 1.15], "text-anchor": "top", "text-optional": true, "text-allow-overlap": false },
    paint: { "text-color": "#ffffff", "text-halo-color": "rgba(2,7,13,.95)", "text-halo-width": 1.7 }
  });
  renderResults();
}

function showMapError(message: string): void {
  const error = byId<HTMLElement>("map-error");
  error.textContent = message;
  error.hidden = false;
}

function initializeMap(): void {
  try {
    map = new maplibregl.Map({
      container: "map", style: createBaseMapStyle(), center: [2, 30], zoom: 1.2,
      minZoom: .25, maxZoom: 22, maxPitch: 85, pitch: 0, bearing: 0,
      renderWorldCopies: false, attributionControl: false, cooperativeGestures: false, fadeDuration: 100
    });
  } catch (error) {
    void error;
    showMapError("No se pudo iniciar la vista 3D en este dispositivo. El catálogo completo sigue disponible.");
    return;
  }
  const activeMap = map;
  activeMap.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
  activeMap.scrollZoom.setWheelZoomRate(1 / 260);
  activeMap.touchZoomRotate.enable();
  let booted = false;
  const bootMap = () => {
    if (booted || !activeMap.isStyleLoaded()) return;
    booted = true;
    try {
      activeMap.setProjection({ type: "globe" });
      addBaseLayers(activeMap);
      addPlaces(activeMap);
      applyMapMode(activeMap, currentMapMode);
      mapReady = true;
      installStationLayers();
      activeMap.on("click", "station-points", (event: MapLayerMouseEvent) => {
        const id = Number(event.features?.[0]?.properties?.id);
        const station = stations.find((item) => item.id === id);
        if (station) showStation(station);
      });
      activeMap.on("mouseenter", "station-points", () => { activeMap.getCanvas().style.cursor = "pointer"; });
      activeMap.on("mouseleave", "station-points", () => { activeMap.getCanvas().style.cursor = ""; });
      activeMap.resize();
    } catch (error) {
      void error;
      showMapError("La esfera 3D no pudo cargarse. Comprueba la aceleración gráfica o abre el catálogo completo.");
    }
  };
  activeMap.on("style.load", bootMap);
  activeMap.on("load", bootMap);
  activeMap.on("styledata", bootMap);
  window.setTimeout(bootMap, 0);
  window.setTimeout(bootMap, 250);
  window.setTimeout(bootMap, 1000);
}

function isDaylight(latitude: number, longitude: number, date = new Date()): boolean {
  const rad = Math.PI / 180;
  const days = date.getTime() / 86400000 - 10957.5;
  const meanAnomaly = rad * (357.5291 + .98560028 * days);
  const eclipticLongitude = meanAnomaly + rad * (102.9372 + 180) + rad * (1.9148 * Math.sin(meanAnomaly) + .02 * Math.sin(2 * meanAnomaly) + .0003 * Math.sin(3 * meanAnomaly));
  const declination = Math.asin(Math.sin(eclipticLongitude) * Math.sin(rad * 23.4397));
  const solarNoon = .0009 - longitude / 360 + Math.round(days - .0009 + longitude / 360);
  const transit = solarNoon + .0053 * Math.sin(meanAnomaly) - .0069 * Math.sin(2 * eclipticLongitude);
  const hourAngle = rad * 360 * (days - transit);
  const altitude = Math.asin(Math.sin(rad * latitude) * Math.sin(declination) + Math.cos(rad * latitude) * Math.cos(declination) * Math.cos(hourAngle));
  return altitude > rad * -.833;
}

function applyResolvedTheme(day: boolean, note: string): void {
  document.documentElement.classList.toggle("light-theme", day);
  byId("theme-note").textContent = note;
}

function resolveAutoTheme(): void {
  if (userCoordinates) {
    const day = isDaylight(userCoordinates.latitude, userCoordinates.longitude);
    applyResolvedTheme(day, `Automático · ahora es ${day ? "de día" : "de noche"} en tu ubicación`);
    return;
  }
  const hour = new Date().getHours();
  applyResolvedTheme(hour >= 7 && hour < 19, "Automático · horario local del dispositivo");
  if (!geolocationRequested && navigator.geolocation) {
    geolocationRequested = true;
    navigator.geolocation.getCurrentPosition((position) => {
      userCoordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (themeMode === "auto") resolveAutoTheme();
    }, () => { /* El horario del dispositivo queda como alternativa. */ }, { maximumAge: 1800000, timeout: 7000 });
  }
}

function setThemeMode(mode: ThemeMode): void {
  themeMode = mode;
  localStorage.setItem("mediaworld-theme-mode", mode);
  document.querySelectorAll<HTMLElement>("[data-theme-mode]").forEach((option) => option.classList.toggle("is-active", option.dataset.themeMode === mode));
  if (mode === "day") applyResolvedTheme(true, "Tema diurno · hueso cálido");
  else if (mode === "night") applyResolvedTheme(false, "Tema nocturno · azul profundo");
  else resolveAutoTheme();
}

catalogGrid.addEventListener("click", (event) => {
  const card = (event.target as HTMLElement).closest<HTMLElement>("[data-station-id]");
  if (!card) return;
  const station = stations.find((item) => item.id === Number(card.dataset.stationId));
  if (station) showStation(station);
});
catalogMore.addEventListener("click", () => { catalogRenderLimit += 240; renderCatalog(filteredStations()); });
searchInput.addEventListener("input", () => renderResults(true));
countryFilter.addEventListener("change", () => { updateRegionFilter(); renderResults(true); });
regionFilter.addEventListener("change", () => renderResults(true));
availabilityFilter.addEventListener("change", () => renderResults(true));
locationFilter.addEventListener("change", () => renderResults(true));
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (byId("filter-panel").hidden) togglePanel("filter-panel", "filter-button");
    searchInput.focus();
  }
  if (event.key === "Escape") closePanels();
});
document.querySelectorAll<HTMLButtonElement>(".media-tab[data-type]").forEach((button) => button.addEventListener("click", () => {
  const type = button.dataset.type;
  if (type === "all") enabledTypes = enabledTypes.size === 2 ? new Set() : new Set(["radio", "tv"]);
  else if (type === "radio" || type === "tv") enabledTypes.has(type) ? enabledTypes.delete(type) : enabledTypes.add(type);
  document.querySelector<HTMLButtonElement>('[data-type="all"]')?.classList.toggle("is-active", enabledTypes.size === 2);
  document.querySelector<HTMLButtonElement>('[data-type="radio"]')?.classList.toggle("is-active", enabledTypes.has("radio"));
  document.querySelector<HTMLButtonElement>('[data-type="tv"]')?.classList.toggle("is-active", enabledTypes.has("tv"));
  renderResults(true);
}));
byId("filter-button").addEventListener("click", () => togglePanel("filter-panel", "filter-button"));
byId("layers-button").addEventListener("click", () => togglePanel("layers-panel", "layers-button"));
byId("theme-button").addEventListener("click", () => togglePanel("theme-panel", "theme-button"));
document.querySelectorAll("[data-close-panel]").forEach((button) => button.addEventListener("click", closePanels));
byId("catalog-toggle").addEventListener("click", () => setView(currentView === "map" ? "catalog" : "map"));
byId("player-toggle").addEventListener("click", () => {
  playerVisible = !playerVisible;
  player.classList.toggle("is-hidden", !playerVisible);
  if (!playerVisible) videoWindow.classList.add("is-ui-hidden");
  else videoWindow.classList.remove("is-ui-hidden");
  const button = byId<HTMLButtonElement>("player-toggle");
  button.classList.toggle("is-active", playerVisible);
  button.setAttribute("aria-pressed", String(playerVisible));
  button.setAttribute("aria-label", playerVisible ? "Ocultar reproductor" : "Mostrar reproductor");
});
byId("home-button").addEventListener("click", () => { setView("map"); map?.flyTo({ center: [2, 30], zoom: 1.2, pitch: 0, bearing: 0 }); });
byId("locate-button").addEventListener("click", () => navigator.geolocation?.getCurrentPosition((position) => {
  userCoordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
  if (themeMode === "auto") resolveAutoTheme();
  setView("map");
  map?.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14, pitch: 45 });
}));
byId("reset-button").addEventListener("click", () => {
  searchInput.value = "";
  countryFilter.value = "";
  availabilityFilter.value = "all";
  locationFilter.value = "all";
  updateRegionFilter();
  enabledTypes = new Set(["radio", "tv"]);
  document.querySelectorAll(".media-tab").forEach((tab) => tab.classList.add("is-active"));
  renderResults(true);
});
document.querySelectorAll<HTMLElement>("[data-map-mode]").forEach((option) => option.addEventListener("click", () => {
  currentMapMode = option.dataset.mapMode as MapMode;
  if (map && mapReady) applyMapMode(map, currentMapMode);
  else updateLabelsControl();
}));
labelsToggle.addEventListener("change", () => {
  if (!isLabelsCompatible(currentMapMode)) return;
  showGeographicLabels = labelsToggle.checked;
  if (map && mapReady) applyLabelVisibility(map);
});
document.querySelectorAll<HTMLElement>("[data-theme-mode]").forEach((option) => option.addEventListener("click", () => setThemeMode(option.dataset.themeMode as ThemeMode)));
byId("zoom-in").addEventListener("click", () => map?.zoomIn());
byId("zoom-out").addEventListener("click", () => map?.zoomOut());
byId("reset-bearing").addEventListener("click", () => map?.easeTo({ bearing: 0, pitch: 0 }));
playButton.addEventListener("click", () => void startPlayback());
byId("previous-button").addEventListener("click", () => selectRelative(-1));
byId("next-button").addEventListener("click", () => selectRelative(1));
byId("close-video").addEventListener("click", () => { video.pause(); videoWindow.hidden = true; isPlaying = false; playButton.innerHTML = "<span>▶</span>"; });
byId<HTMLInputElement>("volume").addEventListener("input", (event) => { const volume = Number((event.target as HTMLInputElement).value); audio.volume = volume; video.volume = volume; });

async function boot(): Promise<void> {
  try {
    const catalog = await loadCatalog();
    stations = catalog.stations;
    populateCountryFilter();
    updateRegionFilter();
    showStats(catalog.stats);
    if (map?.loaded() && mapReady) installStationLayers();
    renderResults();
  } catch (error) {
    byId("catalog-status").innerHTML = `<i class="error-dot"></i> Catálogo no disponible`;
    byId("catalog-empty").hidden = false;
    byId("catalog-empty").innerHTML = `<strong>No se pudo abrir SQLite</strong><p>${escapeHtml(error instanceof Error ? error.message : "Error desconocido")}</p>`;
  }
}

function showStats(stats: CatalogStats): void {
  byId("all-count").textContent = stats.total.toLocaleString("es-ES");
  byId("radio-count").textContent = stats.radio.toLocaleString("es-ES");
  byId("tv-count").textContent = stats.tv.toLocaleString("es-ES");
  byId("catalog-status").innerHTML = `<i class="pulse"></i> ${stats.countries} países · ${stats.mappable.toLocaleString("es-ES")} ubicadas`;
}

const storedTheme = localStorage.getItem("mediaworld-theme-mode");
setThemeMode(storedTheme === "day" || storedTheme === "night" || storedTheme === "auto" ? storedTheme : "auto");
window.setInterval(() => { if (themeMode === "auto") resolveAutoTheme(); }, 300000);
updateLabelsControl();
initializeMap();
void boot();
