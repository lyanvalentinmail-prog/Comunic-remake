# Comunicador visual

Aplicación web estática en español para apoyar la comunicación con pictogramas y actividades de escritura, escucha, matemáticas, vocabulario, descripción, pronunciación y perfil de usuario.

## Estructura

```text
.
├── assets/
│   ├── audio/       # Sonidos de respuesta
│   ├── icons/       # Favicon
│   └── images/      # Imágenes locales y marcadores
├── data/            # Datos del comunicador (datos.json)
├── scripts/
│   ├── app.js       # Lógica de la pantalla principal
│   ├── pages/       # Lógica específica de cada actividad
│   └── vendor/      # Bibliotecas externas
├── styles/
│   ├── global.css   # Estilos compartidos
│   └── pages/       # Estilos específicos de cada actividad
├── *.html           # Páginas de la aplicación
├── manifest.json    # Configuración de la aplicación instalable
└── service-worker.js
```

Las páginas HTML permanecen en la raíz para conservar rutas simples y enlaces directos. Los recursos se agrupan por tipo; las rutas de imágenes, estilos, scripts y datos son relativas a la raíz.

## Ejecutar localmente

La aplicación usa `fetch()` para cargar los datos, así que debe servirse por HTTP en vez de abrir el HTML directamente como archivo:

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`. No se requiere proceso de compilación ni instalación de dependencias.

## Publicar

Se puede publicar como sitio estático desde la raíz del repositorio, por ejemplo con GitHub Pages.
