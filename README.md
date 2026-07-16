# MediaWorld

Explorador mundial de cadenas de radio y televisión sobre un globo 3D. MediaWorld permite navegar desde una vista planetaria hasta países, regiones, ciudades y barrios, descubrir medios geolocalizados y reproducir manualmente las emisiones que hayan sido verificadas.

## Primera versión

- Globo 3D MapLibre con fotografía satelital Esri, relieve y zoom cartográfico hasta calle, siguiendo el mismo motor utilizado en CAMS.
- Rótulos geográficos con control independiente para ocultarlos y nombres de emisora reservados para niveles de zoom cercanos.
- Presentación política minimalista con fronteras y nombres de países, además de satélite, carreteras y relieve.
- Puntos independientes para radio y televisión, visibles a distancia y sin mostrar nombres hasta un zoom cercano.
- Búsqueda por emisora, ciudad, región, país o idioma.
- Filtros por radio/televisión, país, región, disponibilidad de emisión y presencia de coordenadas.
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

`npm run catalog:refresh` actualiza radios desde Radio Browser y canales de televisión desde IPTV-org para los 249 países y territorios ISO: Europa, Asia, América, África, Oceanía, el Caribe, la Antártida y los archipiélagos remotos del Atlántico, Pacífico e Índico. Los resultados se normalizan, deduplican y guardan en `data/regional-radio.json` y `data/regional-tv.json` antes de compilar SQLite.

## Arquitectura de datos

GitHub Pages no ejecuta procesos de servidor. Por eso SQLite se distribuye como una base de datos de solo lectura y se abre localmente en el navegador. El JSON es la fuente editable y reproducible; el archivo SQLite es el artefacto de consulta. Las futuras herramientas de edición o recolección podrán generar nuevas versiones del catálogo durante la compilación.

Una ficha `catalogued` confirma la inclusión enciclopédica, no la disponibilidad de una emisión. Solamente las fichas con una URL verificada o marcadas expresamente como demostración habilitan el botón de reproducción.

El mapa no inventa coordenadas para completar cobertura. Las posiciones declaradas se comprueban contra las fronteras terrestres de Natural Earth; las inferencias solo se aceptan cuando el nombre o la región declarada de la señal coincide con una ciudad o división administrativa oficial del mismo país. Las fichas nacionales sin coordenadas fiables permanecen en la búsqueda y en SQLite, se pueden aislar con el filtro «Sin coordenadas», pero no generan puntos ni desplazan el visor.

## Cartografía y atribución

La interfaz reproduce el arranque cartográfico de CAMS: MapLibre GL JS espera a que el estilo esté listo y entonces activa la proyección `globe`. Incluye fotografía satelital Esri World Imagery, terreno Mapterhorn, mapa de OpenStreetMap, relieve OpenTopoMap, fronteras y rótulos de Natural Earth. Las atribuciones permanecen visibles en el visor.

## Estado

Prototipo funcional con catálogo masivo. Las coordenadas declaradas por las fuentes se conservan como exactas; las posiciones inferidas o aproximadas se identifican expresamente mediante `geo_precision`.
