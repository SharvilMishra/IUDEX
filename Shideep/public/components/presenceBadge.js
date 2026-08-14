// ==========================================================================
// Shideep — Partner Presence Badge
// Shell-level, like the mini-player and call overlay: mounted once so it
// floats above every page, showing whether your person is online right
// now and what they're doing.
// ==========================================================================
import { h, timeAgo } from "../js/utils.js";
import { subscribePartnerPresence, activityLabel } from "../js/presence.js";

export function renderPresenceBadge(container) {
  const row = h(`
    <div class="presence-badge-row" id="presence-badge-row" hidden>
      <div class="presence-pill">
        <span class="presence-avatar" id="presence-avatar">
          <span class="presence-dot" id="presence-dot"></span>
        </span>
        <span class="presence-text" id="presence-text"></span>
      </div>
    </div>
  `);
  container.appendChild(row);

  const avatarEl = document.getElementById("presence-avatar");
  const dotEl = document.getElementById("presence-dot");
  const textEl = document.getElementById("presence-text");

  subscribePartnerPresence((p) => {
    if (!p) {
      row.hidden = true;
      return;
    }
    row.hidden = false;
    dotEl.classList.toggle("online", p.online);
    if (p.photoURL) {
      avatarEl.style.backgroundImage = `url("${p.photoURL}")`;
      avatarEl.textContent = "";
    } else {
      avatarEl.style.backgroundImage = "";
      avatarEl.textContent = p.name?.[0]?.toUpperCase() || "•";
    }
    const label = p.online
      ? `${p.name} · ${activityLabel(p.page)}`
      : p.updatedAtMs
        ? `${p.name} · last seen ${timeAgo(p.updatedAtMs)}`
        : `${p.name} · offline`;
    // textContent — never innerHTML — so partner's own display name can
    // never inject markup here.
    textEl.textContent = label;
  });
}
