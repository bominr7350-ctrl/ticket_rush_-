/* ═══════════════════════════════════════════════
   sw.js — TicketRush 서비스워커

   전략
     · 문서(HTML) 요청  : 네트워크 우선, 실패하면 캐시된 index.html (오프라인 대응)
     · 정적 자산(JS/CSS/이미지) : stale-while-revalidate
       — 캐시가 있으면 그걸 즉시 쓰고, 뒤에서 최신본으로 캐시를 갱신한다.
         빠르면서도 몇 초 뒤에는 최신 코드로 맞춰진다.
     · 그 외 요청(Supabase 등 다른 출처)은 그대로 네트워크로 보낸다 — 손대지 않는다.

   ⚠ CACHE_VERSION 을 반드시 알아야 하는 사람에게: 이 파일이나 index.html/css/js
     자산을 바꿔서 배포할 때마다 아래 CACHE_VERSION 을 올려야 한다. 올리지 않으면
     이미 설치된 사용자는 예전 버전이 계속 캐시에서 나간다 — 브라우저 캐시보다
     훨씬 끈질기게 옛 버전을 물고 있으니 각별히 주의할 것.
   ═══════════════════════════════════════════════ */

const CACHE_VERSION = 'v7';
const CACHE = `ticketrush-${CACHE_VERSION}`;

/* 오프라인에서도 앱이 뜨도록 미리 받아두는 파일들 */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/core.js',
  './js/data.js',
  './js/telemetry.js',
  './js/captcha.js',
  './js/sim.js',
  './js/seats.js',
  './js/rank.js',
  './js/leaderboard.js',
  './js/duel.js',
  './js/analysis.js',
  './js/ui.js',
  './js/app.js',
  './js/drill.js',
  './js/pwa.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', (event) => {
  // 새 버전을 즉시 활성화 대기열에 올린다 (사용자가 탭을 닫을 때까지 기다리지 않는다)
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // POST(Supabase 등)는 건드리지 않는다

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 다른 출처(Supabase API 등)는 그대로 통과

  // 문서 요청 — 네트워크 우선, 실패하면 캐시된 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 정적 자산 — stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
