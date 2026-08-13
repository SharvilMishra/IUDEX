// ==========================================================================
// Shideep — UI Helpers
// Central place to turn raw errors into the friendly messages required by
// FSD §19 / TAD §17 ("never expose internal implementation details").
// ==========================================================================
import { showToast } from "../components/toast.js";

const FRIENDLY = {
  "ACCESS_DENIED": "This account isn't part of Shideep.",
  "UNSUPPORTED_FILE_TYPE": "Please choose a JPEG, PNG, or WebP image.",
  "FILE_TOO_LARGE": "That file is too large. Try an image under 8MB.",
  "permission-denied": "You don't have permission to do that.",
  "unavailable": "Shideep can't reach the server right now. Check your connection.",
  "network-request-failed": "No internet connection.",
  "popup-closed-by-user": "Sign-in was closed before finishing."
};

/** Map a Firebase/JS error to a friendly string, falling back gracefully. */
export function friendlyError(err) {
  const code = err?.code?.replace("auth/", "").replace("firestore/", "") || err?.message;
  return FRIENDLY[code] || "Something went wrong. Please try again.";
}

/** Show an error as a toast with the friendly copy, and log the raw error for devs. */
export function reportError(err, context = "") {
  console.error(`[Shideep]${context ? ` ${context}:` : ""}`, err);
  showToast(friendlyError(err), "error");
}
