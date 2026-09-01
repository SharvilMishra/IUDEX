// ==========================================================================
// IUDEX — Auth Service (Firebase layer)
// Implements AUTH-001..006 from the FSD.
// ==========================================================================

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, db, googleProvider, AUTHORIZED_EMAILS } from "./config.js";

/** AUTH-003: is this email one of the two approved users? */
export function isAuthorized(email) {
  return !!email && AUTHORIZED_EMAILS.includes(email.toLowerCase());
}

/** AUTH-001/002: trigger Google Sign-In popup. Throws on failure. */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  if (!isAuthorized(user.email)) {
    // Immediately sign back out — an unauthorized account must never
    // retain a live session (AUTH-004).
    await signOut(auth);
    const err = new Error("ACCESS_DENIED");
    err.code = "ACCESS_DENIED";
    throw err;
  }

  // Seed/update the user's profile doc used across the app (mood, lastSeen).
  await setDoc(
    doc(db, "users", user.uid),
    {
      name: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      lastSeen: serverTimestamp()
    },
    { merge: true }
  );

  return user;
}

/** AUTH-005 will be reversed by explicit logout (SET-005). */
export async function logout() {
  await signOut(auth);
}

/**
 * AUTH-006: subscribe to auth state. Calls back with either:
 *   { status: "signed-out" }
 *   { status: "denied" }          -- authenticated but not whitelisted
 *   { status: "authorized", user } -- ready to load the app
 * Firebase persists sessions in IndexedDB by default, so this fires
 * automatically on reload without a fresh sign-in.
 */
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      callback({ status: "signed-out" });
      return;
    }
    if (!isAuthorized(user.email)) {
      callback({ status: "denied" });
      return;
    }
    callback({ status: "authorized", user });
  });
}
