# MediaWorld

Explorador mundial de cadenas de radio y televisión sobre un globo 3D. MediaWorld permite navegar desde una vista planetaria hasta países, regiones, ciudades y barrios, descubrir medios geolocalizados y reproducir manualmente las emisiones que hayan sido verificadas.

## Primera versión

- Globo 3D MapLibre con fotografía satelital Esri, relieve y zoom cartográfico hasta calle, siguiendo el mismo motor utilizado en CAMS.
- Rótulos geográficos con control independiente para ocultarlos y nombres de emisora reservados para niveles de zoom cercanos.
- Presentación política minimalista con fronteras y nombres de países, además de satélite, carreteras y relieve.
- Puntos independientes para radio y televisión, visibles a distancia y sin mostrar nombres hasta un zoom cercano.
- Visor principal limpio, sin barras permanentes: filtros, capas, tema, reproductor y catálogo viven en una botonera flotante.
- Búsqueda por emisora, ciudad, región, país, idioma o etiqueta.
- Filtros compartidos por radio/televisión, país, región, disponibilidad de emisión y presencia de coordenadas.
- Fichas editoriales con alcance, idioma, localización, estado de la emisión y web oficial.
- Catálogo mundial independiente en tarjetas compactas, con carga continua al desplazarse, estado en tiempo real y acceso a las fichas sin coordenadas.
- Reproductor minimalista de audio y vídeo, visible por defecto y ocultable sin detener la emisión. Consultar otras fichas tampoco interrumpe lo que está sonando.
- Vídeo con controles de reproducción, pausa, volumen y pantalla completa; radio con 13 visualizadores reales a pantalla completa y controles propios.
- Los visualizadores de radio emplean Web Audio: forma de onda temporal, FFT 2048, energía por bandas, RMS e historial espectral. Incluyen osciloscopio y vúmetros clásicos, estilos CRT y de la era 2000, además de modos radiales, matriciales y contemporáneos.
- Si una emisora permite reproducir pero bloquea el análisis por las restricciones de origen del navegador, MediaWorld lo indica expresamente y mantiene una línea plana; nunca sustituye la señal por una animación falsa.
- Nombre de programa o canción en el reproductor y en las fichas cuando la propia emisión HLS entrega metadatos ID3; el espacio desaparece cuando la fuente no los facilita.
- Comprobación de salud durante la reproducción con estados de conexión, emisión, inestabilidad y falta de respuesta.
- Modo descubrimiento para viajar con zoom cercano a una señal reproducible y geolocalizada que cumpla los filtros activos e iniciar su emisión inmediatamente.
- Temas noche, automático y día con cambio directo desde la botonera; automático sigue la luz solar de la ubicación y noche es el valor inicial para usuarios nuevos.
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

La interfaz reproduce el arranque cartográfico de CAMS: MapLibre GL JS espera a que el estilo esté listo y entonces activa la proyección `globe`. Incluye fotografía satelital Esri World Imagery, terreno Mapterhorn, mapa de OpenStreetMap, relieve OpenTopoMap, fronteras y rótulos de Natural Earth. Las atribuciones obligatorias permanecen visibles de forma discreta en la esquina inferior izquierda.

## Estado

Prototipo funcional con catálogo masivo. Las coordenadas declaradas por las fuentes se conservan como exactas; las posiciones inferidas o aproximadas se identifican expresamente mediante `geo_precision`.
