// ═══════════════════════════════════════════════════════════
// TRACKER BITCOIN — Service Worker v1.0
// Bitcoin Intelligence Indonesia
// by nzmlfhmy · 2026
// ═══════════════════════════════════════════════════════════

const CACHE = 'tracker-bitcoin-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
];

// ── INSTALL: Cache semua file lokal ──────────────────────────
self.addEventListener('install', e => {
  console.log('[TB-SW] Installing...');
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => {
        console.log('[TB-SW] Cache selesai');
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE: Hapus cache lama ───────────────────────────────
self.addEventListener('activate', e => {
  console.log('[TB-SW] Activating...');
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => {
          console.log('[TB-SW] Hapus cache lama:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: Strategi caching ──────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = e.request.url;

  // API Bitcoin (CoinGecko) — Network only, tidak dicache
  // Agar harga selalu fresh
  if (url.includes('coingecko.com') || url.includes('api.')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'Tidak ada koneksi internet' }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Google Fonts — Cache first
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
    return;
  }

  // File lokal — Cache first, update di background
  if (url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Update cache di background
        const fetchPromise = fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          }
          return res;
        }).catch(() => null);

        // Return cache dulu, fetch di background
        return cached || fetchPromise || caches.match('/index.html');
      })
    );
    return;
  }
});

// ── PUSH NOTIFICATION ────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {
    title: '₿ Tracker Bitcoin',
    body: 'Update harga Bitcoin tersedia!',
    icon: '/icons/icon-192x192.png'
  };

  e.waitUntil(
    self.registration.showNotification(data.title || '₿ Tracker Bitcoin', {
      body: data.body || 'Cek harga Bitcoin sekarang',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [100, 50, 100],
      tag: 'tracker-bitcoin',
      renotify: true,
      data: { url: data.url || '/' }
    })
  );
});

// ── NOTIFICATION CLICK ───────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(wins => {
        // Jika app sudah terbuka, fokus ke sana
        if (wins.length > 0) {
          wins[0].focus();
          return;
        }
        // Jika belum, buka baru
        return clients.openWindow(e.notification.data?.url || '/');
      })
  );
});

console.log('[TB-SW] Service Worker loaded — Tracker Bitcoin v1.0');
