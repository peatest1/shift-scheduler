// Service worker ของ "ระบบจัดเวร กฟภ."
// - ตัวแอป (index.html ฯลฯ): โหลดจากเน็ตก่อนเสมอ (ได้เวอร์ชันล่าสุดทันทีที่อัปโหลดใหม่) ถ้าไม่มีเน็ตค่อยใช้ที่เก็บไว้
// - ไลบรารี Firebase / ฟอนต์: เก็บไว้ใช้ซ้ำให้เปิดแอปเร็ว
// - ข้อมูลเวร (Firestore/Auth) ไม่เก็บ ไม่แทรกแซง — ใช้ข้อมูลสดจากเซิร์ฟเวอร์เสมอ
const CACHE = "shift-scheduler-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const STATIC_HOSTS = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // network-first
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
    );
    return;
  }

  if (STATIC_HOSTS.includes(url.hostname)) {
    // stale-while-revalidate
    event.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone()); return res; }).catch(() => hit);
          return hit || net;
        })
      )
    );
  }
  // อื่นๆ (Firestore, Auth ฯลฯ): ปล่อยผ่านตามปกติ
});
