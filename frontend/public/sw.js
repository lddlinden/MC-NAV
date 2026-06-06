// En minimal Service Worker för att möjliggöra PWA-installation
const CACHE_NAME = 'mc-tracker-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Här kan man lägga till cache-logik om man vill ha offline-stöd
  event.respondWith(fetch(event.request));
});