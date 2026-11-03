/* Service worker: cho app mở được khi mất mạng (sân thường sóng yếu).
 * - File của app: lấy bản mới từ mạng trước; mạng chậm (>3s) hoặc mất mạng thì dùng bản đã lưu.
 * - Thư viện Firebase, font, ảnh QR: dùng bản đã lưu nếu có (các file này không đổi theo phiên bản).
 * Dữ liệu phòng vẫn do Firebase tự đồng bộ lại khi có mạng. */
const CACHE = 'xepsan-v1';
const SHELL = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/state.js', 'js/algo.js', 'js/actions.js', 'js/ui.js', 'js/money.js', 'js/cloud.js', 'js/views.js', 'js/main.js',
  'icons/favicon.svg', 'icons/favicon-32.png', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];
const LONG_LIVED = /^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/|img\.vietqr\.io\/)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req) {
  return caches.open(CACHE).then(cache => new Promise(resolve => {
    let done = false;
    const fromCache = () => cache.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? cache.match('index.html') : null));
    const timer = setTimeout(() => fromCache().then(r => { if (r && !done) { done = true; resolve(r); } }), 3000);
    fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      clearTimeout(timer); if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(r => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  }));
}
function cacheFirst(req) {
  return caches.open(CACHE).then(cache => cache.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  })));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (LONG_LIVED.test(req.url)) e.respondWith(cacheFirst(req));
  // còn lại (Firebase realtime, đăng nhập…) đi thẳng ra mạng
});
