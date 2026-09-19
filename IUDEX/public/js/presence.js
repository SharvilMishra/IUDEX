// ==========================================================================
// IUDEX — Presence
//
// Writes a heartbeat to users/{uid}.presence while the tab is visible.
// Reading side (services/users.js -> isOnline) treats a stale heartbeat as
// offline, because Firestore gives no reliable disconnect signal: mobile
// browsers routinely kill a tab without firing anything at all. So presence
// is a claim with an expiry, never a fact — the `pagehide` write below is a
// best-effort nicety, not the mechanism.
//
// Unlike the old two-user build, no route label is broadcast. Telling a
// stranger which screen you're on is a detail that made sense between two
// partners and doesn't in a public directory.
// ==========================================================================
import { auth } from "../firebase/config.js";
import { setDocById, serverTimestamp } from "../firebase/firestore.js";

const HEARTBEAT_MS = 25000;

let heartbeatTimer = null;
let visibilityHandler = null;
let pagehideHandler = null;

function writePresence(online) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  setDocById(
    "users",
    uid,
    { presence: { online, updatedAt: serverTimestamp() }, lastSeen: serverTimestamp() },
    true
  ).catch((err) => console.warn("[presence] write failed:", err.message));
}

export function initPresence() {
  stopPresence();

  writePresence(true);
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible") writePresence(true);
  }, HEARTBEAT_MS);

  visibilityHandler = () => writePresence(document.visibilityState === "visible");
  pagehideHandler = () => writePresence(false);

  document.addEventListener("visibilitychange", visibilityHandler);
  window.addEventListener("pagehide", pagehideHandler);
}

export function stopPresence() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;

  if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
  if (pagehideHandler) window.removeEventListener("pagehide", pagehideHandler);
  visibilityHandler = null;
  pagehideHandler = null;
}

/** Kept so the router's onChange contract stays stable; intentionally a no-op. */
export function setPresenceRoute() {}
