/**
 * Service Worker WooPlans — Cache Stratégique v2
 * Version: 2.0.0
 * Stratégies : Cache First+BG refresh (images), Network First (API), SWR (HTML)
 */

const CACHE_VERSION = 'v2';
const STATIC_CACHE  = `wooplans-static-${CACHE_VERSION}`;
const IMAGE_CACHE   = `wooplans-images-${CACHE_VERSION}`;
const API_CACHE     = `wooplans-api-${CACHE_VERSION}`;

const STATIC_ASSETS = ['/', '/index.html', '/merci.html', '/manifest.json'];

// ── STRATÉGIES ────────────────────────────────────────────────────────────────

// Cache First + background refresh (images Bunny CDN & témoignages)
async function stratImage(request) {
  const cached = await caches.match(request);
  if (cached) {
    // Refresh silencieux en arrière-plan
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

// Network First avec fallback cache + timeout 2.5s (API Supabase)
async function stratApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 2500);
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
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
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

  // API Supabase → Network First avec timeout
  if (url.hostname.includes('supabase')) {
    e.respondWith(stratApi(req)); return;
  }

  // Images (Bunny CDN, Supabase storage, temoignages) → Cache First
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
});
