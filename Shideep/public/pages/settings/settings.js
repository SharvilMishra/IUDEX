// ==========================================================================
// Shideep — Settings (SET-001..005)
// Profile info, partner's last-seen, install-to-home-screen, and sign out.
// ==========================================================================
import { h, escapeHTML, timeAgo } from "../../js/utils.js";
import { card } from "../../components/card.js";
import { skeleton } from "../../components/loader.js";
import { confirmDialog } from "../../components/modal.js";
import { showToast } from "../../components/toast.js";
import { reportError } from "../../js/ui.js";
import { getAll, where } from "../../firebase/firestore.js";
import { auth, AUTHORIZED_EMAILS } from "../../firebase/config.js";
import { logout } from "../../firebase/auth.js";
import {
  isInstallAvailable, onInstallAvailabilityChange, promptInstall, isRunningStandalone
} from "../../js/installPrompt.js";

function avatarHTML(photoURL, name, size = 52) {
  if (photoURL) {
    return `<img src="${photoURL}" alt="${escapeHTML(name || "")}" class="avatar" style="width:${size}px; height:${size}px;">`;
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return `<div class="avatar avatar--fallback" style="width:${size}px; height:${size}px; font-size:${Math.round(size * 0.4)}px;">${initial}</div>`;
}

export async function render(container) {
  const user = auth.currentUser;
  const myEmail = user?.email?.toLowerCase();
  const partnerEmail = AUTHORIZED_EMAILS.find((e) => e.toLowerCase() !== myEmail);

  container.appendChild(
    h(`
      <div class="page">
        <h1 style="margin-bottom:20px;">Settings</h1>

        <div class="card" style="display:flex; align-items:center; gap:14px; margin-bottom:14px;">
          ${avatarHTML(user?.photoURL, user?.displayName)}
          <div style="min-width:0;">
            <div style="font-weight:700;">${escapeHTML(user?.displayName || "You")}</div>
            <div class="text-muted text-xs" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(user?.email || "")}</div>
          </div>
        </div>

        <div id="partner-card" style="margin-bottom:24px;">${skeleton("height:78px;")}</div>

        <h3 style="margin-bottom:12px;">App</h3>
        <div id="install-card" style="margin-bottom:12px;" hidden></div>

        <div class="card" style="margin-bottom:28px; display:flex; justify-content:space-between; align-items:center;">
          <span class="text-muted">Version</span>
          <span>Phase 4</span>
        </div>

        <button class="btn btn--danger" id="logout-btn" style="width:100%;">Sign out</button>
      </div>
    `)
  );

  // ---- Partner card (SET-002-ish: who else is in this space) ----
  const partnerEl = document.getElementById("partner-card");
  getAll("users", [where("email", "==", partnerEmail || "")])
    .then((docs) => {
      const partner = docs[0];
      if (!partner) {
        partnerEl.innerHTML = card({
          eyebrow: "Partner",
          body: "They haven't signed in yet."
        });
        return;
      }
      partnerEl.innerHTML = `
        <div class="card" style="display:flex; align-items:center; gap:14px;">
          ${avatarHTML(partner.photoURL, partner.name)}
          <div style="min-width:0;">
            <div style="font-weight:700;">${escapeHTML(partner.name || "Partner")}</div>
            <div class="text-muted text-xs">${partner.lastSeen ? `Last seen ${timeAgo(partner.lastSeen)}` : "—"}</div>
          </div>
        </div>`;
    })
    .catch((err) => reportError(err, "loading partner info"));

  // ---- Install prompt (SET-004-ish) ----
  const installEl = document.getElementById("install-card");
  function renderInstallCard(available) {
    if (isRunningStandalone()) {
      installEl.hidden = true;
      return;
    }
    if (!available) {
      installEl.hidden = true;
      return;
    }
    installEl.hidden = false;
    installEl.innerHTML = `
      <div class="card">
        <div class="eyebrow" style="margin-bottom:8px;">Install Shideep</div>
        <p class="text-muted" style="margin-bottom:12px;">Add it to your home screen for the full app-like experience — no browser bar, opens instantly.</p>
        <button class="btn btn--primary" id="install-btn" style="width:100%;">Install app</button>
      </div>`;
    document.getElementById("install-btn").addEventListener("click", async () => {
      const accepted = await promptInstall();
      if (accepted) showToast("Installed! Look for Shideep on your home screen.", "success");
    });
  }
  renderInstallCard(isInstallAvailable());
  const unsubInstall = onInstallAvailabilityChange(renderInstallCard);

  // ---- Sign out (SET-005 / AUTH-005 reversal) ----
  document.getElementById("logout-btn").addEventListener("click", () => {
    confirmDialog("You'll need to sign in again to get back in.", {
      confirmLabel: "Sign out",
      onConfirm: async () => {
        try {
          await logout();
        } catch (err) {
          reportError(err, "signing out");
        }
      }
    });
  });

  return function teardown() {
    unsubInstall?.();
  };
}
