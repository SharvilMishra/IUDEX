// ==========================================================================
// Shideep — Call Overlay
// Shell-level, like the mini-player — mounted once in app.js, not inside
// any page's outlet, so an incoming or active call is visible no matter
// where you are in the app.
// ==========================================================================
import { h, escapeHTML } from "../js/utils.js";
import {
  subscribeCallState, acceptIncomingCall, hangUp, toggleMute
} from "../js/callManager.js";

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function renderCallOverlay(container) {
  const overlay = h(`
    <div class="call-overlay" id="call-overlay" hidden>
      <div class="call-overlay-inner">
        <div class="call-avatar-pulse" id="call-avatar">📞</div>
        <div class="call-status-label" id="call-status-label">Calling…</div>
        <div class="call-duration" id="call-duration"></div>

        <div class="call-actions" id="call-actions-active" hidden>
          <button class="call-btn call-btn--mute" id="call-mute-btn" aria-label="Mute">🎤</button>
          <button class="call-btn call-btn--end" id="call-end-btn" aria-label="End call">✕</button>
        </div>

        <div class="call-actions" id="call-actions-incoming" hidden>
          <button class="call-btn call-btn--decline" id="call-decline-btn" aria-label="Decline">✕</button>
          <button class="call-btn call-btn--accept" id="call-accept-btn" aria-label="Accept">✓</button>
        </div>

        <div class="call-actions" id="call-actions-outgoing" hidden>
          <button class="call-btn call-btn--end" id="call-cancel-btn" aria-label="Cancel">✕</button>
        </div>
      </div>
    </div>
  `);
  container.appendChild(overlay);

  const el = document.getElementById("call-overlay");
  const statusLabel = document.getElementById("call-status-label");
  const durationEl = document.getElementById("call-duration");
  const avatarEl = document.getElementById("call-avatar");
  const activeActions = document.getElementById("call-actions-active");
  const incomingActions = document.getElementById("call-actions-incoming");
  const outgoingActions = document.getElementById("call-actions-outgoing");
  const muteBtn = document.getElementById("call-mute-btn");

  document.getElementById("call-accept-btn").addEventListener("click", acceptIncomingCall);
  document.getElementById("call-decline-btn").addEventListener("click", hangUp);
  document.getElementById("call-cancel-btn").addEventListener("click", hangUp);
  document.getElementById("call-end-btn").addEventListener("click", hangUp);
  muteBtn.addEventListener("click", toggleMute);

  subscribeCallState(({ status, mySide, callerName, muted, durationSec }) => {
    activeActions.hidden = true;
    incomingActions.hidden = true;
    outgoingActions.hidden = true;

    if (status === "idle") {
      el.hidden = true;
      return;
    }
    el.hidden = false;

    if (status === "ringing" && mySide === "callee") {
      avatarEl.classList.add("ringing");
      statusLabel.textContent = `${escapeHTML(callerName || "Your partner")} is calling…`;
      durationEl.textContent = "";
      incomingActions.hidden = false;
    } else if (status === "ringing" && mySide === "caller") {
      avatarEl.classList.add("ringing");
      statusLabel.textContent = "Calling…";
      durationEl.textContent = "";
      outgoingActions.hidden = false;
    } else if (status === "active") {
      avatarEl.classList.remove("ringing");
      statusLabel.textContent = "On call";
      durationEl.textContent = formatDuration(durationSec);
      activeActions.hidden = false;
      muteBtn.textContent = muted ? "🔇" : "🎤";
      muteBtn.classList.toggle("call-btn--muted", muted);
    } else {
      // Unknown mySide (e.g. late subscriber before role resolved) — show a
      // neutral "connecting" state rather than nothing.
      avatarEl.classList.add("ringing");
      statusLabel.textContent = "Connecting…";
    }
  });
}
