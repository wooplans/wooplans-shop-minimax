/**
 * Service Worker WooPlans — Cache Stratégique v3
 * Version: 3.0.0
 * Stratégies : 
 *   - Cache First (static assets, fonts, images)
 *   - Stale While Revalidate (HTML pages)
 *   - Network First avec fallback (API)
 */

const CACHE_VERSION = 'v3';
const STATIC_CACHE  = `wooplans-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `wooplans-images-${CACHE_VERSION}`;
const FONT_CACHE    = `wooplans-fonts-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/merci.html',
  '/plans/',
  '/manifest.json'
];

const FONT_URLS = [
  '/fonts/DMSans-400.ttf',
  '/fonts/DMSans-500.ttf',
  '/fonts/DMSans-600.ttf',
  '/fonts/CormorantGaramond-400.ttf',
  '/fonts/CormorantGaramond-500.ttf',
  '/fonts/CormorantGaramond-600.ttf',
  '/fonts/CormorantGaramond-400i.ttf',
  '/fonts/CormorantGaramond-500i.ttf'
];

// ── STRATÉGIES ────────────────────────────────────────────────────────────────

// Cache First + BG refresh silencieux (images)
async function stratImage(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then(r => {
      if (r && r.ok) caches.open(IMAGE_CACHE).then(c => c.put(request, r));
    }).catch(() => {});
    return cached;
  }
  try {
    const r = await fetch(request);
    if (r.ok) caches.open(IMAGE_CACHE).then(c => c.put(request, r.clone()));
    return r;
  } catch (e) {
    return new Response('', { status: 404 });
  }
}

// Cache First (fonts)
async function stratFont(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const r = await fetch(request);
    if (r.ok) caches.open(FONT_CACHE).then(c => c.put(request, r.clone()));
    return r;
  } catch (e) {
    return new Response('', { status: 404 });
  }
}

// Network First avec timeout 3s (API)
async function stratApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(request, { signal: controller.signal });
    clearTimeout(tid);
    if (r.ok) cache.put(request, r.clone());
    return r;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw e;
  }
}

// Stale While Revalidate (HTML pages)
async function stratSWR(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(async r => {
    if (r && r.ok) {
      const c = await caches.open(STATIC_CACHE);
      c.put(request, r.clone());
    }
    return r;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ── LIFECYCLE ─────────────────────────────────────────────────────────────────

self.addEventListener('install', e => {
  e.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(c => c.addAll(STATIC_ASSETS)),
      caches.open(FONT_CACHE).then(c => c.addAll(FONT_URLS))
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('wooplans-') && !k.includes(CACHE_VERSION))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // API Supabase / Chariow → Network First
  if (url.hostname.includes('supabase') || url.hostname.includes('chariow')) {
    e.respondWith(stratApi(req)); return;
  }

  // Fonts → Cache First
  if (url.pathname.startsWith('/fonts/') || 
      req.destination === 'font') {
    e.respondWith(stratFont(req)); return;
  }

  // Images (CDN, storage, temoignages) → Cache First
  if (req.destination === 'image' ||
      url.hostname.includes('b-cdn.net') ||
      url.pathname.startsWith('/temoignages/') ||
      url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    e.respondWith(stratImage(req)); return;
  }

  // Navigation HTML → Stale While Revalidate
  if (req.mode === 'navigate') {
    e.respondWith(stratSWR(req)); return;
  }

  // Static assets (CSS, JS) → Cache First with network fallback
  if (url.pathname.match(/\.(css|js)$/i)) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(r => {
          if (r.ok) caches.open(STATIC_CACHE).then(c => c.put(req, r.clone()));
          return r;
        });
      })
    );
    return;
  }
});
