/* Golden Gates Payments service worker: keeps the app files, fonts and PDF tool on the phone so it opens with no internet.
   Change VERSION whenever you upload a new index.html so phones pick up the update. */
var VERSION = "goldengates-pay-54";
var FILES = ["./", "./index.html", "./privacy.html", "./install.html", "./pdf-lib.min.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png"];

// Outside files the page asks for (fonts, PDF tool): saved on install so the first offline start already works.
function saveOutsideFiles(c) {
  return fetch("./index.html", { cache: "reload" }).then(function (r) { return r.text(); }).then(function (html) {
    var urls = [], m, h, tags = html.match(/<link[^>]*>|<script[^>]*>/g) || [];
    tags.forEach(function (t) {
      if (/^<link/.test(t) ? !/rel="stylesheet"/.test(t) : false) return;
      h = t.match(/(?:href|src)="(https?:[^"]+)"/);
      if (h && urls.indexOf(h[1]) < 0) urls.push(h[1]);
    });
    return Promise.all(urls.map(function (u) {
      return fetch(u).then(function (r) {
        if (!r.ok) return;
        var copy = r.clone();
        return c.put(u, r).then(function () {
          if (!/css/.test(copy.headers.get("content-type") || "")) return;
          // font files: only the latin and latin-ext pieces (English and French)
          return copy.text().then(function (css) {
            var parts = css.split(/\/\*\s*([a-z-]+)\s*\*\//), files = [];
            for (var i = 1; i < parts.length; i += 2) {
              if (!/^latin(-ext)?$/.test(parts[i])) continue;
              var f, fre = /url\((https?:[^)]+)\)/g;
              while ((f = fre.exec(parts[i + 1]))) files.push(f[1]);
            }
            return Promise.all(files.map(function (fu) { return fetch(fu).then(function (fr) { if (fr.ok) return c.put(fu, fr); }).catch(function () {}); }));
          });
        });
      }).catch(function () {});
    }));
  }).catch(function () {});
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(FILES).then(function () { return saveOutsideFiles(c); });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET" || !/^https?:/.test(e.request.url)) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    var net = fetch(e.request).then(function (r) {
      if (r && (r.ok || r.type === "opaque")) { var cp = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, cp); }); }
      return r;
    }).catch(function () {
      return hit || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error());
    });
    return hit || net;
  }));
});
