// ==========================================================================
// e-CON — User Directory Service
// Discovery and search over the public `users` collection.
// ==========================================================================

import {
  getAll, getDocById, setDocById, subscribeDoc,
  orderBy, limit, startAt, endAt, serverTimestamp
} from "../firebase/firestore.js";
import { normalizeUsername } from "./usernames.js";
import { auth } from "../firebase/config.js";

/**
 * The Discover feed: every account that has claimed a username.
 *
 * Ordered by username rather than join date on purpose — `orderBy` skips
 * documents that lack the field entirely, so this also filters out
 * half-onboarded accounts for free, with no composite index needed.
 */
export async function listUsers(max = 40) {
  const users = await getAll("users", [orderBy("username"), limit(max)]);
  return users.filter((u) => u.username && u.uid !== auth.currentUser?.uid);
}

/**
 * Prefix search on @username.
 *
 * Firestore has no LIKE/contains operator, so a prefix range query is the
 * only server-side option: everything from the query string up to the same
 * string plus a very high code point. This is why usernames are stored
 * lowercased — the range is byte-ordered, so mixed case would silently
 * miss matches.
 */
export async function searchUsersByUsername(raw, max = 20) {
  const q = normalizeUsername(raw);
  if (!q) return [];

  const results = await getAll("users", [
    orderBy("username"),
    startAt(q),
    endAt(`${q}\uf8ff`),
    limit(max)
  ]);
  return results.filter((u) => u.uid !== auth.currentUser?.uid);
}

export async function getUserById(uid) {
  return getDocById("users", uid);
}

export function subscribeUser(uid, cb) {
  return subscribeDoc("users", uid, cb);
}

/** Update the signed-in user's own editable profile fields. */
export async function updateMyProfile({ name, bio, photoURL }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");

  const patch = { updatedAt: serverTimestamp() };
  if (name !== undefined) patch.name = name.trim().slice(0, 50);
  if (bio !== undefined) patch.bio = bio.trim().slice(0, 160);
  if (photoURL !== undefined) patch.photoURL = photoURL.trim();

  await setDocById("users", uid, patch, true);
  return getDocById("users", uid);
}

/**
 * A private account doesn't stop appearing in Discover or search — hiding
 * someone by search is a different feature (findability) than this one
 * (who can start a conversation with you). It only changes what happens
 * when a new person messages them for the first time: see
 * services/conversations.js for the request/accept/decline flow this gates.
 */
export async function setPrivateAccount(isPrivate) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  await setDocById("users", uid, { private: !!isPrivate }, true);
}

export function isPrivateAccount(user) {
  return !!user?.private;
}

/**
 * Presence is a claim with an expiry, not a fact: Firestore has no reliable
 * disconnect signal (mobile OSes just kill the tab), so a heartbeat that
 * stopped 5 minutes ago is treated as offline here regardless of what the
 * last write claimed.
 */
const STALE_MS = 90000;

export function isOnline(user) {
  const at = user?.presence?.updatedAt;
  const ms = at?.toMillis ? at.toMillis() : null;
  return !!user?.presence?.online && !!ms && Date.now() - ms < STALE_MS;
}
