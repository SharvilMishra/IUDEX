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
 *
 * Optional 4th arg for an action button (e.g. "Undo"):
 *   showToast("Removed from queue", "info", 4000, {
 *     actionLabel: "Undo",
 *     onAction: () => { ... }
 *   });
 * Tapping the action cancels the toast's own auto-dismiss and fires
 * onAction immediately — callers should not also rely on the toast's
 * timeout to know when the undo window closed; run their own timer.
 * `message` may contain markup (existing callers already relied on
 * this) — callers passing user-provided text should escapeHTML() it
 * themselves first.
 */
export function showToast(message, type = "info", duration = 3200, opts = {}) {
  const { actionLabel, onAction } = opts;
  const stack = ensureStack();
  const el = h(`
    <div class="toast toast--${type}">
      <span class="toast-message">${message}</span>
      ${actionLabel ? `<button type="button" class="toast-action">${actionLabel}</button>` : ""}
    </div>
  `);
  stack.appendChild(el);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    el.style.transition = "opacity 200ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  };

  const timer = setTimeout(dismiss, duration);

  if (actionLabel) {
    el.querySelector(".toast-action").addEventListener("click", () => {
      clearTimeout(timer);
      onAction?.();
      dismiss();
    });
  }
}
