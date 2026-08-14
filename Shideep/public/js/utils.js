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

/** Shorten a string for toasts/labels, e.g. long song titles. */
export function truncate(str = "", max = 40) {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

/**
 * Attaches a swipe-left-to-dismiss gesture to `targetEl` using Pointer
 * Events (works for touch and mouse). `bgEl` (optional) is the reveal
 * layer behind it — its opacity tracks drag distance.
 *
 * Vertical drags are left alone (so page scrolling never breaks) —
 * direction is only locked in once movement is unambiguous.
 *
 * onCommit fires once the slide-out animation finishes, whether it was
 * triggered by crossing `threshold` mid-drag or by calling `.commit()`
 * programmatically (e.g. from a regular tap on a delete button), so
 * callers only need one code path for "this item is being removed".
 *
 * Returns { commit(), restore() }:
 *  - commit(): plays the slide-out/fade, then calls onCommit.
 *  - restore(): snaps back to normal — used both for "released below
 *    threshold" and for undoing an already-committed removal.
 */
export function attachSwipeToDismiss(targetEl, bgEl, { threshold = 88, onCommit } = {}) {
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let dragging = false;
  let decided = false;
  let horizontal = false;

  function restore() {
    targetEl.style.transition = "";
    targetEl.style.transform = "";
    targetEl.style.opacity = "";
    targetEl.style.pointerEvents = "";
    targetEl.classList.remove("dragging");
    if (bgEl) bgEl.style.opacity = "0";
  }

  function commit() {
    targetEl.classList.remove("dragging");
    targetEl.style.transition = "";
    targetEl.style.pointerEvents = "none";
    targetEl.style.transform = "translateX(-110%)";
    targetEl.style.opacity = "0";
    if (bgEl) bgEl.style.opacity = "1";
    const finish = () => {
      targetEl.removeEventListener("transitionend", finish);
      onCommit?.();
    };
    targetEl.addEventListener("transitionend", finish, { once: true });
    // Fallback in case transitionend never fires (e.g. reduced-motion, 0ms transitions).
    setTimeout(finish, 260);
  }

  function onPointerDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startX = e.clientX;
    startY = e.clientY;
    dx = 0;
    dragging = true;
    decided = false;
    horizontal = false;
    targetEl.classList.add("dragging");
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const curDx = e.clientX - startX;
    const curDy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(curDx) < 8 && Math.abs(curDy) < 8) return;
      decided = true;
      horizontal = Math.abs(curDx) > Math.abs(curDy);
      if (horizontal && targetEl.setPointerCapture) {
        try { targetEl.setPointerCapture(e.pointerId); } catch { /* noop */ }
      }
    }
    if (!horizontal) return;
    dx = Math.min(0, curDx);
    targetEl.style.transform = `translateX(${dx}px)`;
    if (bgEl) bgEl.style.opacity = String(Math.min(1, Math.abs(dx) / threshold));
    e.preventDefault?.();
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    if (horizontal && Math.abs(dx) >= threshold) {
      commit();
    } else {
      restore();
    }
  }

  targetEl.addEventListener("pointerdown", onPointerDown);
  targetEl.addEventListener("pointermove", onPointerMove);
  targetEl.addEventListener("pointerup", onPointerUp);
  targetEl.addEventListener("pointercancel", onPointerUp);
  targetEl.style.touchAction = "pan-y";

  return { commit, restore };
}
