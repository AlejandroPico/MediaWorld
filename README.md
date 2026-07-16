# MediaWorld

Explorador mundial de cadenas de radio y televisión sobre un globo 3D. MediaWorld permite navegar desde una vista planetaria hasta países, regiones, ciudades y barrios, descubrir medios geolocalizados y reproducir manualmente las emisiones que hayan sido verificadas.

## Primera versión

- Globo vectorial 3D con zoom, etiquetas cartográficas progresivas y controles táctiles.
- Esfera geográfica Canvas 2D completa para navegadores o equipos sin WebGL: continentes, rotación, zoom y rótulos por nivel.
- Catálogo geolocalizado de radio y televisión con agrupación de señales.
- Búsqueda por emisora, ciudad, región, país o idioma.
- Filtros independientes para radio y televisión.
- Fichas editoriales con alcance, idioma, localización y web oficial.
- Reproductor minimalista de audio y vídeo sin reproducción automática.
- Catálogo SQLite real cargado y consultado dentro del navegador mediante WebAssembly.
- Diseño adaptable a escritorio y móvil, con temas oscuro y claro.
- Despliegue automático en GitHub Pages.

## Desarrollo local

Requiere Node.js 24 o posterior.

```bash
npm install
npm run dev
```

Para comprobar la versión de producción:

```bash
npm run build
npm run preview
```

`npm run build:db` regenera `public/data/mediaworld.sqlite` a partir de `data/stations.json` y `data/schema.sql`.

## Arquitectura de datos

GitHub Pages no ejecuta procesos de servidor. Por eso SQLite se distribuye como una base de datos de solo lectura y se abre localmente en el navegador. El JSON es la fuente editable y reproducible; el archivo SQLite es el artefacto de consulta. Las futuras herramientas de edición o recolección podrán generar nuevas versiones del catálogo durante la compilación.

Una ficha `catalogued` confirma la inclusión enciclopédica, no la disponibilidad de una emisión. Solamente las fichas con una URL verificada o marcadas expresamente como demostración habilitan el botón de reproducción.

## Cartografía y atribución

La interfaz acelerada usa MapLibre GL JS y la instancia pública de OpenFreeMap, con datos de OpenStreetMap. La esfera de compatibilidad usa geometría vectorial de Natural Earth distribuida por `world-atlas`. Las atribuciones cartográficas permanecen visibles en el visor acelerado.

## Estado

Prototipo funcional inicial. El catálogo incluido es deliberadamente pequeño: sirve para validar la experiencia, el modelo de datos y el reproductor antes de emprender la incorporación masiva y verificada de cadenas.
