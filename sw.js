const CACHE_NAME = 'songwriters-toolbox-v11'; // Incremented to v11
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
  './modules/theory.js',
  './modules/tuner.js',
  './modules/keyboard.js',
  './modules/sequencer.js',
  './modules/looper.js',
  './modules/sampler.js',
  './modules/storage.js',
  './modules/songbuilder.js',
  './modules/studio.js',
  './modules/drumSampler.js' // NEW: Added Drum Sampler module
];

// Install Event: Cache files
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forces the new worker to activate immediately
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching app assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Clean up old caches (Critical for updates)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
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