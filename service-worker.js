// Incrementa la versión cuando cambien los archivos precargados.
const CACHE_NAME = 'comunicador-cache-v17';

const urlsToCache = [
    './',
    './index.html',
    './escribir.html',
    './escuchar.html',
    './matematicas.html',
    './palabras.html',
    './descripcion.html',
    './pronunciacion.html',
    './usuario.html',
    './manifest.json',
    './data/datos.json',
    './styles/global.css',
    './styles/pages/descripcion.css',
    './styles/pages/matematicas.css',
    './styles/pages/palabras.css',
    './styles/pages/pronunciacion.css',
    './styles/pages/usuario.css',
    './scripts/app.js',
    './scripts/pages/descripcion.js',
    './scripts/pages/escribir.js',
    './scripts/pages/escuchar.js',
    './scripts/pages/matematicas.js',
    './scripts/pages/palabras.js',
    './scripts/pages/pronunciacion.js',
    './scripts/pages/usuario.js',
    './scripts/vendor/idb.min.js',
    './assets/images/placeholder.png',
    './assets/images/qtabletdos.png',
    './assets/images/tabletdos.png',
    './assets/audio/correcto.mp3',
    './assets/audio/incorrecto.mp3',
    './assets/icons/favicon.ico'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(error => console.error('Error al guardar archivos en caché:', error))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                    return undefined;
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Deja las solicitudes de pictogramas externos fuera de la caché estática.
    if (event.request.url.includes('api.arasaac.org') || event.request.url.includes('corsproxy.io')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});
