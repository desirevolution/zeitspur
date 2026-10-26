import { tr } from './i18n.js';
/**
 * Prompt-driven PWA updates. The running timer is persisted in IndexedDB;
 * an editor's unsaved input is not, so we never reload without user consent.
 */
export function setupPwaUpdates(): void {
  if (!('serviceWorker' in navigator)) return;

  const banner = document.querySelector<HTMLElement>('#update-banner');
  const reloadButton = document.querySelector<HTMLButtonElement>('#update-apply');
  const laterButton = document.querySelector<HTMLButtonElement>('#update-later');
  if (!banner || !reloadButton || !laterButton) return;

  let registration: ServiceWorkerRegistration | undefined;
  let lastCheck = 0;
  let updateRequested = false;
  let reloading = false;
  let postponedWorker: ServiceWorker | null = null;
  const hadControllerOnLoad = !!navigator.serviceWorker.controller;

  const showUpdate = (): void => {
    if (registration?.waiting === postponedWorker && postponedWorker !== null) return;
    banner.hidden = false;
  };

  const checkWaiting = (): void => {
    if (navigator.serviceWorker.controller && registration?.waiting) showUpdate();
  };

  const checkForUpdates = (force = false): void => {
    if (!registration || !navigator.onLine) return;
    const now = Date.now();
    if (!force && now - lastCheck < 5 * 60_000) return;
    lastCheck = now;
    void registration.update().then(checkWaiting).catch((err: unknown) => {
      // Offline or server temporarily unavailable: keep the cached app working.
      console.debug('PWA-Updateprüfung fehlgeschlagen', err);
    });
  };

  function observeInstalling(reg: ServiceWorkerRegistration): void {
    const installing = reg.installing;
    if (!installing) return;
    const installed = (): void => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) checkWaiting();
    };
    installing.addEventListener('statechange', installed);
    installed();
  }

  reloadButton.addEventListener('click', () => {
    updateRequested = true;
    reloadButton.disabled = true;
    reloadButton.textContent = tr('Aktualisieren …');
    const waiting = registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Another tab may already have activated the new worker.
      window.location.reload();
    }
  });

  laterButton.addEventListener('click', () => {
    postponedWorker = registration?.waiting ?? null;
    banner.hidden = true;
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateRequested && !reloading) {
      reloading = true;
      window.location.reload();
    } else if (hadControllerOnLoad && !updateRequested) {
      // A different tab activated a new worker. Offer a controlled page reload.
      postponedWorker = null;
      showUpdate();
    }
  });

  window.addEventListener('focus', () => checkForUpdates());
  window.addEventListener('online', () => checkForUpdates(true));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdates();
  });

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        registration = reg;
        reg.addEventListener('updatefound', () => observeInstalling(reg));
        observeInstalling(reg);
        checkWaiting();
        checkForUpdates(true);
      })
      .catch((err: unknown) => console.warn('PWA-Service-Worker konnte nicht registriert werden', err));
  });
}

// Loaded as a separate entry point so even a previous service worker that
// caches the older main.js can fetch this new module on the first upgrade.
setupPwaUpdates();
