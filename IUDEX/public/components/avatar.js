// ==========================================================================
// e-CON — Avatar
// Photo when there is one, coloured initial when there isn't.
//
// The fallback colour is derived from the username rather than picked at
// random, so a given person looks the same everywhere in the app and across
// reloads — which is most of what makes an avatar useful at a glance.
// ==========================================================================
import { escapeHTML } from "../js/utils.js";

const HUES = [210, 190, 265, 340, 20, 45, 150, 300];

function hueFor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return HUES[hash % HUES.length];
}

/**
 * avatarHTML({ photoURL, name, username }, size, { online })
 * `online === undefined` renders no presence dot at all.
 */
export function avatarHTML(user = {}, size = 44, { online } = {}) {
  const label = user.name || user.username || "";
  const seed = user.username || user.uid || label;
  const dot = online === undefined
    ? ""
    : `<span class="avatar-dot ${online ? "avatar-dot--online" : ""}"></span>`;

  const inner = user.photoURL
    ? `<img src="${escapeHTML(user.photoURL)}" alt="" loading="lazy"
            onerror="this.remove()" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : `<span>${escapeHTML((label || "?").trim().charAt(0).toUpperCase() || "?")}</span>`;

  const hue = hueFor(String(seed));

  return `
    <span class="avatar-wrap" style="width:${size}px;height:${size}px;">
      <span class="avatar ${user.photoURL ? "" : "avatar--fallback"}"
            style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.4)}px;
                   --avatar-hue:${hue};">${inner}</span>
      ${dot}
    </span>`;
}
