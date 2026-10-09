# Comunicador visual

Aplicación web estática en español para apoyar la comunicación con pictogramas y actividades de escritura, escucha, matemáticas, vocabulario, descripción, pronunciación y perfil de usuario. Incluye manifiesto PWA y caché del contenido local para uso básico sin conexión. En la pantalla principal también permite convertir una frase en un archivo WAV con voz sintética en español y compartirlo o descargarlo; no requiere micrófono.

## Estructura

```text
.
├── assets/
│   ├── audio/       # Sonidos de respuesta
│   ├── icons/       # Favicon e iconos PWA/iOS
│   └── images/      # Imágenes locales y marcadores
├── data/            # Datos del comunicador (datos.json)
├── scripts/
│   ├── app.js       # Lógica de la pantalla principal
│   ├── pages/       # Lógica específica de cada actividad
│   ├── vendor/      # IndexedDB y motor local de voz
│   └── register-service-worker.js
├── styles/
│   ├── global.css   # Estilos compartidos
│   └── pages/       # Estilos específicos de cada actividad
├── *.html           # Páginas de la aplicación
├── manifest.json    # Configuración de la aplicación instalable
└── service-worker.js
```

Las páginas HTML permanecen en la raíz para conservar rutas simples. Los recursos se agrupan por tipo y las rutas son relativas a esa raíz, lo que también funciona bajo la ruta de proyecto de GitHub Pages.

## Compartir audio

En la pantalla principal, pulsa **Audio** para generar un WAV de la frase con una voz sintética en español. Puedes escucharlo antes de compartirlo; si el navegador no permite compartir archivos directamente, se descarga para adjuntarlo manualmente. La voz se genera en el dispositivo y no usa el micrófono ni envía la frase a un servicio externo. El motor meSpeak se distribuye bajo los términos GNU GPL indicados en `scripts/vendor/mespeak/NOTICE.md`.

## Instalar

La aplicación publicada está en [GitHub Pages](https://lyanvalentinmail-prog.github.io/Comunic-remake/). Ábrela desde un navegador compatible:

- **Android:** Chrome → menú `⋮` → **Instalar app** o **Añadir a pantalla de inicio**.
- **iPhone/iPad:** Safari → **Compartir** → **Añadir a pantalla de inicio**.
- **Computadora:** Chrome o Edge → icono **Instalar** en la barra de direcciones o menú del navegador.

Se requiere HTTPS para instalar desde la web; GitHub Pages lo proporciona. El service worker se registra automáticamente y guarda en caché los archivos locales de la aplicación.

## Ejecutar localmente

La aplicación usa `fetch()` para cargar los datos, así que debe servirse por HTTP en vez de abrir el HTML directamente como archivo:

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`. No se requiere proceso de compilación ni instalación de dependencias.
