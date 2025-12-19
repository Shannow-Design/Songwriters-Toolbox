const CACHE_NAME = 'songwriters-toolbox-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon.png',
  './modules/app.js',
  './modules/audio.js',
  './modules/chords.js',
  './modules/fretboard.js',
  './modules/theory.js'
  './modules/tuner.js'
  './modules/keyboard.js',
];

// Install Event: Cache files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Fetch Event: Serve from Cache if available
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // If found in cache, return it. If not, go to network.
      return response || fetch(event.request);
    })
  );
});