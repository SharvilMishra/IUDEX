// ==========================================================================
// e-CON — Local storage helpers
//
// All keys are namespaced `econ_*`. The product has been renamed twice —
// SHIDEEP -> IUDEX -> e-CON — so a real install could still be sitting on
// either older prefix. Both migrate forward on boot rather than getting
// dropped; an existing user must not lose their settings just because the
// product was renamed again.
//
// Every access is wrapped: localStorage throws outright in Safari private
// mode and when a browser blocks third-party storage, and none of what we
// keep here is important enough to break the app over.
// ==========================================================================

const PREFIX = "econ_";
// Oldest first: a key still on the original prefix should end up at the
// current one in a single pass, not require running the app twice.
const LEGACY_PREFIXES = ["shideep_", "iudex_"];

function safeGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { window.localStorage.setItem(key, value); return true; } catch { return false; }
}
function safeRemove(key) {
  try { window.localStorage.removeItem(key); } catch { /* noop */ }
}

export function getStored(name, fallback = null) {
  const value = safeGet(PREFIX + name);
  return value === null ? fallback : value;
}

export function setStored(name, value) {
  return safeSet(PREFIX + name, String(value));
}

export function removeStored(name) {
  safeRemove(PREFIX + name);
}

/**
 * Copy any key under a legacy prefix to its `econ_*` equivalent, then
 * remove the old one — but only once the copy has been verified by reading
 * it back. An unwritable storage (quota, private mode) would otherwise
 * delete the original and leave nothing behind.
 *
 * Safe to call on every boot: it's a no-op once there's nothing left to move.
 */
export function migrateLegacyKeys() {
  // Snapshot the key list first, via the standard length/key(i) API rather
  // than Object.keys(). Two reasons: key(i) is the specified interface, and
  // removing entries mid-iteration shifts every later index — reading the
  // list up front means the removals below can't make us skip a key.
  let keys = [];
  try {
    const store = window.localStorage;
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key !== null) keys.push(key);
    }
  } catch {
    return 0;
  }

  let migrated = 0;
  for (const oldKey of keys) {
    const prefix = LEGACY_PREFIXES.find((p) => oldKey.startsWith(p));
    if (!prefix) continue;

    const newKey = PREFIX + oldKey.slice(prefix.length);
    const value = safeGet(oldKey);
    if (value === null) continue;

    // Never let a stale legacy value overwrite something already written
    // under the new name.
    if (safeGet(newKey) === null && !safeSet(newKey, value)) continue;
    if (safeGet(newKey) === null) continue; // write-back check failed — keep the original

    safeRemove(oldKey);
    migrated += 1;
  }

  if (migrated) console.info(`[e-CON] migrated ${migrated} legacy storage key(s).`);
  return migrated;
}
