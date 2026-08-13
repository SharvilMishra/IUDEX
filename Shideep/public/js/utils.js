// ==========================================================================
// Shideep — Utilities
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

/** Escape user-provided text before inserting into innerHTML (XSS guard). */
export function escapeHTML(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Friendly relative-time formatting for chat/journal/memories timestamps. */
export function timeAgo(date) {
  if (!date) return "";
  const d = date.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
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

export function formatDate(date, opts = { weekday: "long", month: "long", day: "numeric" }) {
  const d = date?.toDate ? date.toDate() : (date ? new Date(date) : new Date());
  return d.toLocaleDateString(undefined, opts);
}

/** Debounce for search inputs. */
export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Deterministic-ish "random but seeded per day" pick, used by Surprise Box / Daily Question. */
export function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
