// ==========================================================================
// IUDEX — Presence
// "Is my person around, and what are they doing?" Built on the existing
// users/{uid} profile doc (auth.js already seeds name/email/photoURL there)
// by adding a `presence` map. Firestore has no reliable disconnect signal
// (especially on mobile, where the OS can just kill the tab), so presence
// is treated as a claim with an expiry: a stale write is shown as offline
// client-side regardless of what it says, rather than trusting it forever.
// ==========================================================================
import { auth, AUTHORIZED_EMAILS } from "../firebase/config.js";
import { setDocById, subscribe, serverTimestamp, where, limit } from "../firebase/firestore.js";

const HEARTBEAT_MS = 25000;
const STALE_MS = 90000; // no write in this long -> treat as offline, however it last claimed to be

const ROUTE_LABELS = {
  home: "on Home",
  chat: "in Chat",
  games: "playing a game",
  gallery: "in Gallery",
  bucketlist: "checking Goals",
  memories: "in Memories",
  music: "listening to Music",
  mood: "in Mood",
  settings: "in Settings"
};

export function activityLabel(route) {
  return ROUTE_LABELS[route] || "in the app";
}

let heartbeatTimer = null;
let currentRoute = "home";

function writePresence(online) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  setDocById(
    "users",
    uid,
    { presence: { online, page: currentRoute, updatedAt: serverTimestamp() }, lastSeen: serverTimestamp() },
    true
  ).catch((err) => console.warn("[presence] write failed:", err.message));
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === "visible") writePresence(true);
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

/** Call once when the app shell mounts (after sign-in). */
export function initPresence() {
  writePresence(true);
  startHeartbeat();

  document.addEventListener("visibilitychange", () => {
    writePresence(document.visibilityState === "visible");
  });

  // Best-effort — Android in particular often kills the page before this
  // fires, which is exactly why the staleness check on the reading side
  // (STALE_MS) is the real source of truth, not this write.
  window.addEventListener("pagehide", () => writePresence(false));
}

/** Call from the router's onChange so the partner sees the right page. */
export function setPresenceRoute(route) {
  currentRoute = route;
  if (document.visibilityState === "visible") writePresence(true);
}

/**
 * Subscribe to the *other* authorized user's live presence.
 * cb receives null before they've ever signed in, otherwise:
 *   { online, page, name, photoURL, updatedAtMs }
 * Re-evaluates on a timer too (not just on new Firestore data) so a
 * partner who goes stale without ever writing "offline" still flips
 * to offline in the UI on its own.
 */
export function subscribePartnerPresence(cb) {
  const myEmail = auth.currentUser?.email?.toLowerCase();
  const otherEmail = AUTHORIZED_EMAILS.find((e) => e.toLowerCase() !== myEmail);
  if (!otherEmail) {
    cb(null);
    return () => {};
  }

  let latest = null;

  function emit() {
    if (!latest) {
      cb(null);
      return;
    }
    const p = latest.presence || {};
    const updatedAtMs = p.updatedAt?.toMillis ? p.updatedAt.toMillis() : null;
    const fresh = updatedAtMs ? Date.now() - updatedAtMs < STALE_MS : false;
    cb({
      online: !!p.online && fresh,
      page: p.page || "home",
      name: (latest.name || "").split(" ")[0] || "Partner",
      photoURL: latest.photoURL || "",
      updatedAtMs
    });
  }

  const unsub = subscribe("users", [where("email", "==", otherEmail), limit(1)], (docs) => {
    latest = docs[0] || null;
    emit();
  });
  const staleTick = setInterval(emit, 20000);

  return () => {
    unsub();
    clearInterval(staleTick);
  };
}
