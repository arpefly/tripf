// Service Worker для PWA
const CACHE_NAME = "tripf-v1";
const urlsToCache = ["/", "/manifest.json", "/favicon.ico"];

// Установка Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    })
  );
});

// Активация Service Worker
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Перехват запросов (стратегия Network First)
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Не перехватываем SSE и не-кэшируемые запросы (например, POST или long-poll).
  const acceptHeader = request.headers.get("accept") || "";
  const isEventStream = acceptHeader.includes("text/event-stream");
  if (request.method !== "GET" || isEventStream) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Клонируем ответ только для обычных GET-запросов
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Если сеть недоступна, возвращаем из кэша
        return caches.match(request);
      })
  );
});
