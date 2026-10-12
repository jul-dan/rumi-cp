/* Romi au CP : fonctionnement hors ligne.
   - le jeu et ses icônes sont mis en cache à l'installation ;
   - la page est d'abord demandée au réseau (pour recevoir les mises à jour), sinon prise dans le cache ;
   - les polices Google sont gardées en cache après le premier chargement. */
const VERSION = "romi-v37";
const CORE = ["./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./audio/index.json", "./audio/en/index.json",
  "./art/badge-bird.webp", "./art/badge-boss0.webp", "./art/badge-boss1.webp", "./art/badge-boss2.webp", "./art/badge-boss3.webp", "./art/badge-boss4.webp", "./art/badge-boss5.webp", "./art/badge-grognon0.webp", "./art/badge-grognon1.webp", "./art/badge-grognon2.webp", "./art/badge-grognon3.webp", "./art/badge-grognon4.webp", "./art/badge-grognon5.webp", "./art/badge-rumi.webp", "./art/badge-tiger.webp", "./art/badge-zoe.webp", "./art/badge-zuma.webp", "./art/boss-0.webp", "./art/boss-1.webp", "./art/boss-2.webp", "./art/boss-3.webp", "./art/boss-4.webp", "./art/boss-5.webp", "./art/card-frame.webp", "./art/card-sky.webp", "./art/grognon-0-idle.webp", "./art/grognon-1-idle.webp", "./art/grognon-2-idle.webp", "./art/grognon-3-idle.webp", "./art/grognon-4-idle.webp", "./art/grognon-5-idle.webp", "./art/home-bg.webp", "./art/rival-1-leader-idle.webp", "./art/rumi-attack.webp", "./art/rumi-hurt.webp", "./art/rumi-idle.webp", "./art/rumi-o1-idle.webp", "./art/rumi-o2-idle.webp", "./art/rumi-o3-idle.webp", "./art/rumi-o4-idle.webp", "./art/rumi-o5-idle.webp", "./art/rumi-o6-idle.webp", "./art/rumi-o7-idle.webp", "./art/rumi-run1.webp", "./art/rumi-slash.webp", "./art/rumi-victory.webp", "./art/rumi-windup.webp", "./art/zoe-attack.webp", "./art/zoe-idle.webp", "./art/zuma-attack.webp", "./art/zuma-dragon.webp", "./art/zuma-idle.webp"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== "romi-fonts" && k !== "romi-audio2" && k !== "romi-vosk" && k !== "romi-voice" && k !== "transformers-cache").map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Polices : cache d'abord
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("romi-fonts").then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  // Reconnaissance vocale sur l'appareil : le programme et le modèle de français (≈ 40 Mo) sont gardés après le premier téléchargement
  if ((url.hostname === "cdn.jsdelivr.net" && url.pathname.includes("/vosk-browser")) || (url.hostname === "ccoreilly.github.io" && url.pathname.includes("/models/"))) {
    e.respondWith(caches.open("romi-vosk").then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      const res = await fetch(req.url, {mode:"cors"});
      if (res.ok) c.put(req.url, res.clone());
      return res;
    }).catch(() => fetch(req)));
    return;
  }
  // Voix naturelle : le programme (transformers.js, onnxruntime) est gardé pour fonctionner hors ligne.
  // (le modèle de voix lui-même est rangé par transformers.js dans son propre cache « transformers-cache »)
  if (url.hostname === "cdn.jsdelivr.net" && (url.pathname.includes("/@huggingface/transformers") || url.pathname.includes("/onnxruntime-web") || url.pathname.includes("/onnxruntime-common"))) {
    e.respondWith(caches.open("romi-voice").then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req.url, res.clone());
      return res;
    }).catch(() => fetch(req)));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Voix enregistrée : chaque phrase est gardée après la première écoute (ou toutes d'un coup depuis l'espace parent)
  if (url.pathname.includes("/audio/") && url.pathname.endsWith(".mp3")) {
    e.respondWith(caches.open("romi-audio2").then(async c => {
      const hit = await c.match(req.url);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req.url, res.clone());
      return res;
    }).catch(() => fetch(req)));
    return;
  }

  // Page du jeu : réseau d'abord, cache si hors ligne
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  // Le reste (icônes, manifeste) : cache d'abord
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
