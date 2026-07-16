import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import type { GeometryCollection, Topology } from "topojson-specification";
import type { Station } from "./types";

type Point = [number, number];

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class CanvasGlobe {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly levelLabel: HTMLElement;
  private readonly projection = geoOrthographic().precision(0.35).clipAngle(90);
  private readonly countries: GeoPermissibleObjects;
  private readonly graticule = geoGraticule10();
  private readonly resizeObserver: ResizeObserver;
  private stations: Station[] = [];
  private rotation: [number, number, number] = [-8, -22, 0];
  private zoom = 1;
  private width = 0;
  private height = 0;
  private baseRadius = 0;
  private frame = 0;
  private dragging = false;
  private pointerStart: Point = [0, 0];
  private rotationStart: Point = [0, 0];
  private light = false;

  constructor(private readonly container: HTMLElement, private readonly onSelect: (station: Station) => void) {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "canvas-globe__canvas";
    this.canvas.setAttribute("aria-label", "Esfera mundial interactiva sin WebGL");
    this.canvas.tabIndex = 0;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D no está disponible");
    this.context = context;
    this.levelLabel = document.createElement("div");
    this.levelLabel.className = "canvas-globe__level glass";
    this.container.replaceChildren(this.canvas, this.levelLabel);

    const topology = worldData as unknown as Topology;
    this.countries = feature(topology, topology.objects.countries as GeometryCollection) as GeoPermissibleObjects;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.bindEvents();
    this.resize();
  }

  setStations(stations: Station[]): void {
    this.stations = stations;
    this.scheduleDraw();
  }

  setLight(light: boolean): void {
    this.light = light;
    this.scheduleDraw();
  }

  zoomIn(): void { this.setZoom(this.zoom * 1.45); }
  zoomOut(): void { this.setZoom(this.zoom / 1.45); }

  home(): void {
    this.animateTo([-8, -22, 0], 1);
  }

  north(): void {
    this.animateTo([this.rotation[0], 0, 0], this.zoom);
  }

  flyTo(station: Station): void {
    this.animateTo([-station.longitude, -station.latitude, 0], Math.max(4.2, this.zoom));
  }

  private bindEvents(): void {
    this.canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.setZoom(this.zoom * Math.exp(-event.deltaY * 0.0015));
    }, { passive: false });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      this.pointerStart = [event.clientX, event.clientY];
      this.rotationStart = [this.rotation[0], this.rotation[1]];
      this.canvas.setPointerCapture(event.pointerId);
      this.canvas.classList.add("is-dragging");
    });
    this.canvas.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      const sensitivity = 75 / (this.baseRadius * Math.sqrt(this.zoom));
      const dx = event.clientX - this.pointerStart[0];
      const dy = event.clientY - this.pointerStart[1];
      this.rotation = [
        this.rotationStart[0] + dx * sensitivity,
        clamp(this.rotationStart[1] - dy * sensitivity, -88, 88),
        0
      ];
      this.scheduleDraw();
    });
    const release = (event: PointerEvent): void => {
      if (!this.dragging) return;
      this.dragging = false;
      this.canvas.releasePointerCapture(event.pointerId);
      this.canvas.classList.remove("is-dragging");
    };
    this.canvas.addEventListener("pointerup", release);
    this.canvas.addEventListener("pointercancel", release);
    this.canvas.addEventListener("click", (event) => {
      if (Math.hypot(event.clientX - this.pointerStart[0], event.clientY - this.pointerStart[1]) > 5) return;
      const rectangle = this.canvas.getBoundingClientRect();
      const point: Point = [event.clientX - rectangle.left, event.clientY - rectangle.top];
      const match = this.visibleMarkers()
        .map(({ station, point: marker }) => ({ station, distance: Math.hypot(point[0] - marker[0], point[1] - marker[1]) }))
        .filter((item) => item.distance <= 15)
        .sort((a, b) => a.distance - b.distance)[0];
      if (match) this.onSelect(match.station);
    });
    this.canvas.addEventListener("keydown", (event) => {
      if (event.key === "+" || event.key === "=") this.zoomIn();
      if (event.key === "-") this.zoomOut();
      if (event.key === "Home") this.home();
    });
  }

  private resize(): void {
    const rectangle = this.container.getBoundingClientRect();
    this.width = Math.max(1, rectangle.width);
    this.height = Math.max(1, rectangle.height);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.baseRadius = Math.max(105, Math.min(this.width, this.height) * 0.39);
    this.scheduleDraw();
  }

  private setZoom(value: number): void {
    this.zoom = clamp(value, 0.72, 18);
    this.scheduleDraw();
  }

  private animateTo(targetRotation: [number, number, number], targetZoom: number): void {
    const startRotation = [...this.rotation] as [number, number, number];
    const startZoom = this.zoom;
    const startedAt = performance.now();
    const duration = 820;
    const tick = (now: number): void => {
      const raw = clamp((now - startedAt) / duration, 0, 1);
      const t = 1 - Math.pow(1 - raw, 3);
      this.rotation = [
        startRotation[0] + (targetRotation[0] - startRotation[0]) * t,
        startRotation[1] + (targetRotation[1] - startRotation[1]) * t,
        0
      ];
      this.zoom = startZoom + (targetZoom - startZoom) * t;
      this.draw();
      if (raw < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  private scheduleDraw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.draw());
  }

  private isVisible(station: Station): boolean {
    const center: Point = [-this.rotation[0], -this.rotation[1]];
    return geoDistance([station.longitude, station.latitude], center) < Math.PI / 2;
  }

  private visibleMarkers(): Array<{ station: Station; point: Point }> {
    return this.stations.flatMap((station) => {
      if (!this.isVisible(station)) return [];
      const projected = this.projection([station.longitude, station.latitude]);
      return projected ? [{ station, point: projected as Point }] : [];
    });
  }

  private draw(): void {
    if (!this.width || !this.height) return;
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    this.projection
      .translate([this.width / 2, this.height / 2])
      .scale(this.baseRadius * this.zoom)
      .rotate(this.rotation);
    const path = geoPath(this.projection, context);

    context.save();
    context.beginPath();
    path({ type: "Sphere" });
    const ocean = context.createRadialGradient(
      this.width / 2 - this.baseRadius * 0.25,
      this.height / 2 - this.baseRadius * 0.25,
      this.baseRadius * 0.08,
      this.width / 2,
      this.height / 2,
      this.baseRadius * Math.min(this.zoom, 1.2)
    );
    ocean.addColorStop(0, this.light ? "#b9e2f3" : "#123a58");
    ocean.addColorStop(0.62, this.light ? "#75b5d2" : "#0a263d");
    ocean.addColorStop(1, this.light ? "#4c8eaf" : "#061725");
    context.fillStyle = ocean;
    context.fill();
    context.strokeStyle = this.light ? "rgba(18,94,128,.55)" : "rgba(105,199,240,.62)";
    context.lineWidth = Math.max(0.8, 1.7 / Math.sqrt(this.zoom));
    context.stroke();

    if (this.zoom < 7) {
      context.beginPath();
      path(this.graticule);
      context.strokeStyle = this.light ? "rgba(22,92,124,.13)" : "rgba(102,182,219,.12)";
      context.lineWidth = 0.55;
      context.stroke();
    }

    context.beginPath();
    path(this.countries);
    context.fillStyle = this.light ? "rgba(225,237,224,.94)" : "rgba(33,75,81,.96)";
    context.fill();
    context.strokeStyle = this.light ? "rgba(53,105,117,.65)" : "rgba(103,166,159,.52)";
    context.lineWidth = clamp(0.9 / Math.sqrt(this.zoom), 0.18, 0.8);
    context.stroke();
    context.restore();

    this.drawStations();
    this.drawLabels();
    this.updateLevel();
  }

  private drawStations(): void {
    const context = this.context;
    for (const { station, point } of this.visibleMarkers()) {
      const color = station.mediaType === "radio" ? "#27e1cf" : "#ff668f";
      const radius = clamp(4.4 + Math.log2(this.zoom + 1) * 1.25, 4.5, 9.5);
      context.beginPath();
      context.arc(point[0], point[1], radius + 5, 0, Math.PI * 2);
      context.fillStyle = station.mediaType === "radio" ? "rgba(39,225,207,.13)" : "rgba(255,102,143,.13)";
      context.fill();
      context.beginPath();
      context.arc(point[0], point[1], radius, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = "rgba(3,12,21,.9)";
      context.lineWidth = 2;
      context.stroke();
      if (station.streamUrl) {
        context.beginPath();
        context.arc(point[0], point[1], Math.max(1.5, radius * .28), 0, Math.PI * 2);
        context.fillStyle = "#ffffff";
        context.fill();
      }
    }
  }

  private drawLabels(): void {
    const markers = this.visibleMarkers();
    const labels: Array<{ text: string; point: Point; priority: number; accent?: boolean }> = [];
    const seen = new Set<string>();
    for (const { station, point } of markers) {
      let text = station.country;
      let priority = 1;
      if (this.zoom >= 2.35) { text = station.region; priority = 2; }
      if (this.zoom >= 4.1) { text = station.city; priority = 3; }
      if (this.zoom >= 7.2) { text = station.name; priority = station.streamUrl ? 5 : 4; }
      const key = text.toLocaleLowerCase("es");
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push({ text, point, priority, accent: this.zoom >= 7.2 });
    }
    labels.sort((a, b) => b.priority - a.priority);
    const occupied: Array<{ x: number; y: number; width: number; height: number }> = [];
    const context = this.context;
    const fontSize = this.zoom < 2.35 ? 11 : this.zoom < 4.1 ? 10 : this.zoom < 7.2 ? 10 : 11;
    context.font = `600 ${fontSize}px "DM Sans", sans-serif`;
    context.textBaseline = "middle";
    for (const label of labels) {
      const width = context.measureText(label.text).width + 12;
      const rectangle = { x: label.point[0] + 10, y: label.point[1] - 10, width, height: 20 };
      if (occupied.some((item) => rectangle.x < item.x + item.width && rectangle.x + rectangle.width > item.x && rectangle.y < item.y + item.height && rectangle.y + rectangle.height > item.y)) continue;
      if (rectangle.x + rectangle.width > this.width - 8 || rectangle.y < 8 || rectangle.y + rectangle.height > this.height - 8) continue;
      occupied.push(rectangle);
      context.fillStyle = this.light ? "rgba(245,250,252,.88)" : "rgba(3,13,22,.78)";
      context.beginPath();
      context.roundRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height, 5);
      context.fill();
      context.fillStyle = label.accent ? (this.light ? "#173f54" : "#e9f8fb") : (this.light ? "#31586d" : "#b9d1dd");
      context.fillText(label.text, rectangle.x + 6, rectangle.y + rectangle.height / 2);
    }
  }

  private updateLevel(): void {
    const level = this.zoom < 1.5 ? "Planeta" : this.zoom < 2.35 ? "Países" : this.zoom < 4.1 ? "Regiones" : this.zoom < 7.2 ? "Ciudades" : "Emisoras";
    this.levelLabel.innerHTML = `<span>NIVEL</span><strong>${level}</strong><i>${this.zoom.toFixed(1)}×</i>`;
  }
}
