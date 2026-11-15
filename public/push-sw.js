// Draw-alert notifications only. This worker never caches pages or files.
const DEFAULT_TITLE = "🔔 സൗഹൃദ പണപ്പയറ്റ്";
const DEFAULT_BODY = "ഭാഗ്യചക്ര നറുക്കെടുപ്പ് 1 മിനിറ്റിനകം ആരംഭിക്കുന്നു! ഇപ്പോൾ തന്നെ പങ്കെടുക്കൂ.";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || DEFAULT_TITLE, {
      body: data.body || DEFAULT_BODY,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "live-draw",
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 120, 300, 120, 600],
      data: { url: data.url || "/draw" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/draw", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of wins) {
        if (new URL(c.url).origin === self.location.origin) {
          try {
            await c.navigate(url);
          } catch (e) {}
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
