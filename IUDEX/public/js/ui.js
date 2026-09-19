// ==========================================================================
// IUDEX — UI Helpers
// One place to turn raw Firebase/JS errors into copy a person can act on,
// so no internal implementation detail ever reaches the screen.
// ==========================================================================
import { showToast } from "../components/toast.js";

const FRIENDLY = {
  // Firestore
  "permission-denied": "You don't have permission to do that.",
  "unavailable": "IUDEX can't reach the server right now. Check your connection.",
  "failed-precondition": "A required database index is still building. Try again shortly.",
  "not-found": "That's no longer there.",
  "resource-exhausted": "Too many requests. Give it a moment.",

  // Auth
  "network-request-failed": "No internet connection.",
  "popup-closed-by-user": "Sign-in was closed before finishing.",
  "too-many-requests": "Too many attempts. Wait a moment and try again.",

  // App-level
  "USERNAME_TAKEN": "That username is already taken.",
  "USERNAME_INVALID": "That username isn't valid.",
  "SELF_CONVERSATION": "You can't message yourself.",
  "UNSUPPORTED_FILE_TYPE": "Please choose a JPEG, PNG, or WebP image.",
  "FILE_TOO_LARGE": "That file is too large. Try an image under 8MB."
};

export function friendlyError(err) {
  const code = err?.code?.replace("auth/", "").replace("firestore/", "") || err?.message;
  return FRIENDLY[code] || "Something went wrong. Please try again.";
}

/** Toast the friendly copy; log the raw error for whoever is debugging. */
export function reportError(err, context = "") {
  console.error(`[IUDEX]${context ? ` ${context}:` : ""}`, err);
  showToast(friendlyError(err), "error");
}
