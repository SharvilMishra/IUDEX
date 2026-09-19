// ==========================================================================
// IUDEX — Utilities
// ==========================================================================

/** Minimal query shorthand */
export const qs = (sel, scope = document) => scope.querySelector(sel);
export const qsa = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));

/** Build a DOM element from an HTML string (single root element). */
export function h(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

/**
 * Escape user-provided text before inserting it into innerHTML.
 *
 * This matters more in IUDEX than it did in the two-user build: display
 * names, bios and messages now come from strangers, so every one of them is
 * hostile input until proven otherwise.
 */
export function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Relative-time formatting for message and last-seen timestamps. */
export function timeAgo(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 10) return "just now";

  const steps = [
    [60, "s", 1],
    [3600, "m", 60],
    [86400, "h", 3600],
    [604800, "d", 86400]
  ];
  for (const [max, label, div] of steps) {
    if (seconds < max) return `${Math.max(1, Math.floor(seconds / div))}${label} ago`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Debounce for search inputs and Firestore writes.
 *
 * With `leading = true` the call fires immediately and then goes quiet for
 * `wait` — which is what a typing indicator wants: the peer should see
 * "typing…" on the first keystroke, not 400ms after the last one.
 */
export function debounce(fn, wait = 250, leading = false) {
  let timer = null;
  return (...args) => {
    if (leading && timer === null) fn(...args);
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!leading) fn(...args);
    }, wait);
  };
}

/** Shorten a string for previews and labels. */
export function truncate(str = "", max = 40) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}
