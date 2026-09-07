"use client";

import { useEffect } from "react";

/** One-time-on-mount registration of the app-shell service worker; not tied to render state, so nothing to adjust-during-render here. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
