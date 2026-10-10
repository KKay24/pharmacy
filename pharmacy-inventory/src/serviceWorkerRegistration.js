// src/serviceWorkerRegistration.js
// Registration handler for MediQuick PWA Service Worker

function unregisterDevelopmentServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const serviceWorkerPath = new URL(
    `${process.env.PUBLIC_URL || ''}/service-worker.js`,
    window.location.origin
  ).pathname;

  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(
      registrations
        .filter((registration) => (
          [registration.active, registration.waiting, registration.installing]
            .filter(Boolean)
            .some((worker) => {
              const workerUrl = new URL(worker.scriptURL);
              return workerUrl.origin === window.location.origin
                && workerUrl.pathname === serviceWorkerPath;
            })
        ))
        .map((registration) => registration.unregister())
    ))
    .then(() => caches.keys())
    .then((cacheNames) => Promise.all(
      cacheNames
        .filter((name) => name.startsWith('mediquick-pwa-'))
        .map((name) => caches.delete(name))
    ))
    .catch((error) => {
      console.warn('Could not remove the development service worker cache:', error);
    });
}

export function register(config) {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    if (process.env.NODE_ENV !== 'production') {
      unregisterDevelopmentServiceWorker();
      return;
    }

    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;

      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content is available
                  if (config && config.onUpdate) {
                    config.onUpdate(registration);
                  }
                } else {
                  // Content is cached for offline use
                  if (config && config.onSuccess) {
                    config.onSuccess(registration);
                  }
                }
              }
            };
          };
        })
        .catch((error) => {
          console.warn('Service worker registration failed:', error);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
