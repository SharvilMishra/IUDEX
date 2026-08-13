// ==========================================================================
// Shideep — Toast Component
// ==========================================================================
import { h } from "../js/utils.js";

let stackEl = null;

function ensureStack() {
  if (!stackEl) {
    stackEl = h(`<div class="toast-stack" role="status" aria-live="polite"></div>`);
    document.body.appendChild(stackEl);
  }
  return stackEl;
}

/**
 * showToast("Photo uploaded", "success")
 * type: "info" | "success" | "error"
 */
export function showToast(message, type = "info", duration = 3200) {
  const stack = ensureStack();
  const el = h(`<div class="toast toast--${type}">${message}</div>`);
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 200ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, duration);
}
