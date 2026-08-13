// ==========================================================================
// Shideep — Install Prompt (PWA "Add to Home Screen")
// Registered at shell boot (imported once from app.js) so the browser's
// beforeinstallprompt event is never missed, regardless of which page the
// user happens to be on when it fires. Settings reads from this module
// rather than listening for the event itself.
// Note: this API only exists on Chromium-based browsers (Chrome/Edge on
// Android/desktop). Safari/iOS has no equivalent — there, "Add to Home
// Screen" is a manual step in the share sheet, which Settings explains
// instead of showing a button.
// ==========================================================================

let deferredPrompt = null;
const listeners = new Set();

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  listeners.forEach((fn) => fn(true));
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  listeners.forEach((fn) => fn(false));
});

export function isInstallAvailable() {
  return !!deferredPrompt;
}

/** fn(available: boolean) — fires whenever availability changes. */
export function onInstallAvailabilityChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Returns true if the user accepted the install prompt. */
export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome === "accepted";
}

/** True if already running as an installed PWA (standalone display mode). */
export function isRunningStandalone() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches
    || window.navigator.standalone === true;
}
