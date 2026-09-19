// ==========================================================================
// IUDEX — Local storage helpers
//
// All keys are namespaced `iudex_*`. The app previously shipped as SHIDEEP,
// so anything still under a `shideep_*` key is migrated on boot rather than
// dropped — an existing install must not lose its settings just because the
// product was renamed.
//
// Every access is wrapped: localStorage throws outright in Safari private
// mode and when a browser blocks third-party storage, and none of what we
// keep here is important enough to break the app over.
// ==========================================================================

const PREFIX = "iudex_";
const LEGACY_PREFIX = "shideep_";

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
 * Copy any `shideep_*` key to its `iudex_*` equivalent, then remove the old
 * one — but only once the copy has been verified by reading it back. An
 * unwritable storage (quota, private mode) would otherwise delete the
 * original and leave nothing behind.
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
    if (!oldKey.startsWith(LEGACY_PREFIX)) continue;

    const newKey = PREFIX + oldKey.slice(LEGACY_PREFIX.length);
    const value = safeGet(oldKey);
    if (value === null) continue;

    // Never let a stale legacy value overwrite something already written
    // under the new name.
    if (safeGet(newKey) === null && !safeSet(newKey, value)) continue;
    if (safeGet(newKey) === null) continue; // write-back check failed — keep the original

    safeRemove(oldKey);
    migrated += 1;
  }

  if (migrated) console.info(`[IUDEX] migrated ${migrated} legacy storage key(s).`);
  return migrated;
}
